"""Actual app permissions exercised with isolated SQLite and mocked media."""
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock
import re
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.models import Listing, ListingPhoto, OpenHouseEvent, User
from app.db.session import get_db
from app.api.listing_photos import get_object_storage, get_image_processor
from app.api.listings import get_media_storage
from app.cli.demo_listing_data import DEMO_LISTINGS
from app.schemas.listing import ListingCreate

PASSWORD_HASH = get_password_hash('TestPassword123!')
@pytest.fixture()
def viewer_app(monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "ENABLE_ADMIN_DEMO_VIEWER", True)
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    for role in ('viewer', 'staff', 'admin'):
        db.add(User(email=f'{role}@example.com', role=role, full_name='Private account name', hashed_password=PASSWORD_HASH, is_active=True))
    listing = Listing(**ListingCreate.model_validate(DEMO_LISTINGS[0]).model_dump())
    db.add(listing); db.flush()
    db.add(ListingPhoto(listing_id=listing.id, original_filename='home.webp', source_format='webp', width=800, height=600, thumbnail_key='thumb', medium_key='medium', large_key='large', position=0, is_primary=True))
    db.add(OpenHouseEvent(listing_id=listing.id, starts_at=datetime.now(timezone.utc)+timedelta(days=1), ends_at=datetime.now(timezone.utc)+timedelta(days=1,hours=2)))
    db.commit()
    storage = MagicMock()
    storage.get_reference_url.side_effect = lambda key: f'https://media.example/{key}'
    processor = MagicMock()
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_object_storage] = lambda: storage
    app.dependency_overrides[get_media_storage] = lambda: storage
    app.dependency_overrides[get_image_processor] = lambda: processor
    try:
        # No lifespan: never connect to the configured deployment database.
        yield TestClient(app), db, storage, processor
    finally:
        app.dependency_overrides = previous
        db.close(); engine.dispose()


def headers(role='viewer'):
    return {'Authorization': f'Bearer {create_access_token(subject=f"{role}@example.com", role=role)}'}


def snapshot(db):
    return {table.name: list(db.execute(select(table)).all()) for table in Base.metadata.sorted_tables}


APP_WRITES = [(method.upper(), path) for path, operations in app.openapi()['paths'].items() for method in operations if method in ('post', 'put', 'patch', 'delete')]
assert APP_WRITES, 'Permission coverage must not silently skip all write routes'
@pytest.mark.parametrize('method,path', APP_WRITES)
def test_every_application_write_rejects_viewer_without_data_or_media_changes(viewer_app, method, path):
    client, db, storage, processor = viewer_app
    before = snapshot(db)
    response = client.request(method, re.sub(r'\{[^}]+\}', '1', path), headers=headers(), json={})
    assert response.status_code == 403, (method, path, response.text)
    assert snapshot(db) == before
    assert not storage.mock_calls and not processor.mock_calls


@pytest.mark.parametrize('path', ['/listings', '/listings/1', '/listings/1/preview', '/listings/1/photos', '/listings/1/open-houses'])
def test_approved_reads_work_without_private_account_fields(viewer_app, path):
    response = viewer_app[0].get(path, headers=headers())
    assert response.status_code == 200, response.text
    for secret in ('hashed_password', 'Private account name', 'staff@example.com', 'mfa_secret', 'recovery_codes'):
        assert secret not in response.text


SAFE_INTERNAL_READS = {'/', '/health', '/example', '/listings', '/listings/{listing_id}', '/listings/{listing_id}/preview', '/listings/{listing_id}/photos', '/listings/{listing_id}/open-houses'}
FULL_ADMIN_READS = [path for path, operations in app.openapi()['paths'].items() if 'get' in operations and not path.startswith('/public/') and path not in SAFE_INTERNAL_READS and path != '/auth/account']
@pytest.mark.parametrize('path', FULL_ADMIN_READS)
def test_full_admin_gets_are_available_without_writes_or_secrets(viewer_app, path):
    client, db, _, _ = viewer_app
    before = snapshot(db)
    response = client.get(re.sub(r'\{[^}]+\}', '1', path), headers=headers())
    assert response.status_code in (200,404), (path, response.status_code, response.text)
    assert snapshot(db) == before
    for secret in ('hashed_password', 'mfa_secret_encrypted', 'mfa_recovery_code_hashes', PASSWORD_HASH):
        assert secret not in response.text


@pytest.mark.parametrize('path', ['/listings', '/listings/1', '/listings/1/photos', '/listings/1/open-houses', '/users'])
def test_unauthenticated_internal_reads_are_401(viewer_app, path):
    assert viewer_app[0].get(path).status_code == 401


def test_viewer_login_and_public_registration_cannot_grant_viewer(viewer_app):
    client, db, _, _ = viewer_app
    login = client.post('/auth/login', data={'username':'viewer@example.com','password':'TestPassword123!'})
    assert login.status_code == 200 and login.json()['access_token']
    assert client.get('/listings', headers={'Authorization':'Bearer '+login.json()['access_token']}).status_code == 200
    response = client.post('/auth/register', json={'email':'escalate@example.com','password':'TestPassword123!','role':'viewer'})
    assert response.status_code == 422
    assert db.query(User).filter_by(email='escalate@example.com').first() is None


@pytest.mark.parametrize('change', ['inactive','archived','role','deleted'])
def test_viewer_revocation_takes_effect_with_existing_token(viewer_app, change):
    client, db, _, _ = viewer_app
    token = headers()
    user = db.query(User).filter_by(role='viewer').one()
    if change == 'inactive': user.is_active = False
    elif change == 'archived': user.archived_at = datetime.now(timezone.utc)
    elif change == 'role': user.role = 'public_user'
    else: db.delete(user)
    db.commit()
    assert client.get('/listings', headers=token).status_code in (401,403)


@pytest.mark.parametrize('old_role', ['admin','staff'])
def test_demotion_to_viewer_invalidates_old_privileged_token(viewer_app, old_role):
    client, db, _, _ = viewer_app
    token = headers(old_role)
    user = db.query(User).filter_by(role=old_role).one(); user.role = 'viewer'; db.commit()
    before = snapshot(db)
    assert client.put('/listings/1', headers=token, json={'title':'Forbidden'}).status_code == 403
    assert client.get('/users', headers=token).status_code == 403
    assert snapshot(db) == before


@pytest.mark.parametrize('role', ['admin','staff'])
def test_admin_and_staff_keep_listing_writes_and_reads(viewer_app, role):
    client = viewer_app[0]
    token = headers(role)
    assert client.get('/listings', headers=token).status_code == 200
    response = client.put('/listings/1', headers=token, json={'title':'Allowed edit'})
    assert response.status_code == 200 and response.json()['title']=='Allowed edit'


def test_only_admin_can_create_and_deactivate_viewer(viewer_app):
    client, db, _, _ = viewer_app
    payload = {'email':'newviewer@example.com','password':'StrongPassword123!','role':'viewer'}
    assert client.post('/users',headers=headers('staff'),json=payload).status_code == 403
    response = client.post('/users',headers=headers('admin'),json=payload)
    assert response.status_code == 201, response.text
    user = db.query(User).filter_by(email=payload['email']).one()
    assert user.hashed_password != payload['password']
    assert client.put(f'/users/{user.id}',headers=headers('admin'),json={'is_active':False}).status_code == 200
    assert not user.is_active


@pytest.mark.parametrize('method,path', [(method, path) for method, path in APP_WRITES if path.startswith(('/listings', '/users', '/agents', '/offices', '/leads', '/testimonials'))])
def test_internal_write_requires_authentication(viewer_app, method, path):
    client, db, storage, processor = viewer_app
    before = snapshot(db)
    response = client.request(method, re.sub(r'\{[^}]+\}', '1', path), json={})
    assert response.status_code == 401
    assert snapshot(db) == before
    assert not storage.mock_calls and not processor.mock_calls


def test_invalid_bearer_cannot_fall_through_to_anonymous_analytics_write(viewer_app):
    client, db, _, _ = viewer_app
    path = next(path for method, path in APP_WRITES if path.startswith('/public/analytics'))
    before = snapshot(db)
    response = client.post(re.sub(r'\{[^}]+\}', '1', path), headers={'Authorization': 'Bearer invalid'}, json={})
    assert response.status_code == 401
    assert snapshot(db) == before


def test_viewer_search_filter_sort_and_pagination_are_database_operations(viewer_app):
    client, db, _, _ = viewer_app
    for price in (400000, 100000):
        payload = ListingCreate.model_validate(DEMO_LISTINGS[0]).model_dump()
        payload.update(title=f'Story City {price}', price=price)
        db.add(Listing(**payload))
    db.commit()
    response = client.get('/listings',headers=headers(),params={'search':'Story City','status':'Active','sort':'price_asc','page':2,'per_page':1})
    assert response.status_code == 200
    assert response.json()['total'] == 3
    assert response.json()['items'][0]['price'] == 289000


def test_app_startup_and_health_use_only_the_isolated_database(viewer_app, monkeypatch):
    import app.main as main_module
    monkeypatch.setattr(main_module, 'engine', viewer_app[1].get_bind())
    with TestClient(app) as client:
        assert client.get('/health').status_code == 200


def test_real_multipart_photo_upload_is_denied_before_processing_or_storage(viewer_app):
    client, db, storage, processor = viewer_app
    before = snapshot(db)
    response = client.post('/listings/1/photos', headers=headers(), files={'file': ('image.png', b'not processed', 'image/png')})
    assert response.status_code == 403
    assert snapshot(db) == before
    assert not processor.mock_calls and not storage.mock_calls


def test_demo_feature_is_disabled_by_default():
    from app.core.config import Settings
    assert Settings.model_fields['ENABLE_ADMIN_DEMO_VIEWER'].default is False


@pytest.mark.parametrize('path', [path for path, operations in app.openapi()['paths'].items() if 'get' in operations])
def test_disabled_demo_rejects_existing_viewer_token_everywhere(viewer_app, monkeypatch, path):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), 'ENABLE_ADMIN_DEMO_VIEWER', False)
    response = viewer_app[0].get(re.sub(r'\{[^}]+\}', '1', path), headers=headers())
    assert response.status_code == 403


def test_disabled_demo_rejects_login_and_preserves_normal_roles(viewer_app, monkeypatch):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), 'ENABLE_ADMIN_DEMO_VIEWER', False)
    client = viewer_app[0]
    response = client.post('/auth/login', data={'username':'viewer@example.com','password':'TestPassword123!'})
    assert response.status_code == 403
    assert 'access_token' not in response.json()
    for role in ('staff', 'admin'):
        assert client.get('/listings', headers=headers(role)).status_code == 200
        assert client.post('/auth/login', data={'username':f'{role}@example.com','password':'TestPassword123!'}).status_code == 200


@pytest.mark.parametrize('path', ['/exports/leads.csv', '/exports/analytics.csv'])
def test_viewer_exports_never_create_temporary_files(viewer_app, monkeypatch, path):
    from app.services import csv_exports
    def forbidden_disk_file(*args, **kwargs):
        raise AssertionError('Viewer exports must stay in memory')
    monkeypatch.setattr(csv_exports, 'SpooledTemporaryFile', forbidden_disk_file)
    response = viewer_app[0].get(path, headers=headers())
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/csv')
