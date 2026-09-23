"""Tests for dynamic public sitemap eligibility and canonical URLs."""

from app.api.seo import router
from app.db.models import AgentProfile, Listing, SiteSetting


def _listing(
    db,
    *,
    title: str,
    status: str,
    is_public: bool,
) -> Listing:
    listing = Listing(
        title=title,
        status=status,
        is_public=is_public,
        is_featured=False,
        hide_exact_address=False,
        price=350000,
        property_type="Single Family",
        address="123 Main St",
        city="Ames",
        state="IA",
        bedrooms=3,
        bathrooms=2.0,
        amenities=[],
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _agent(db, *, public: bool, active: bool) -> AgentProfile:
    agent = AgentProfile(
        full_name="Jordan Agent",
        email=f"agent-{public}-{active}@example.com",
        is_public=public,
        is_active=active,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def test_sitemap_contains_public_routes_and_eligible_dynamic_pages(
    isolated_api_factory,
):
    api = isolated_api_factory([router])
    api.db.add(
        SiteSetting(
            id=1,
            show_about=True,
            show_contact=True,
            show_privacy=False,
            show_terms=False,
        )
    )
    api.db.commit()

    active = _listing(
        api.db,
        title="Active Home",
        status="Active",
        is_public=True,
    )
    pending = _listing(
        api.db,
        title="Pending Home",
        status="Pending",
        is_public=True,
    )
    sold = _listing(
        api.db,
        title="Sold Home",
        status="Sold",
        is_public=True,
    )
    public_agent = _agent(api.db, public=True, active=True)

    response = api.client.get("/public/seo/sitemap.xml")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    xml = response.text

    assert "http://localhost:4200/" in xml
    assert "http://localhost:4200/listings" in xml
    assert "http://localhost:4200/about" in xml
    assert "http://localhost:4200/contact" in xml
    assert f"http://localhost:4200/listings/{active.id}" in xml
    assert f"http://localhost:4200/listings/{pending.id}" in xml
    assert f"http://localhost:4200/listings/{sold.id}" in xml
    assert f"http://localhost:4200/agents/{public_agent.id}" in xml
    assert "/privacy" not in xml
    assert "/terms" not in xml


def test_sitemap_excludes_hidden_draft_archived_and_private_agent_pages(
    isolated_api_factory,
):
    api = isolated_api_factory([router])

    hidden = _listing(
        api.db,
        title="Hidden",
        status="Active",
        is_public=False,
    )
    draft = _listing(
        api.db,
        title="Draft",
        status="Draft",
        is_public=True,
    )
    archived = _listing(
        api.db,
        title="Archived",
        status="Archived",
        is_public=True,
    )
    private_agent = _agent(api.db, public=False, active=True)
    inactive_agent = _agent(api.db, public=True, active=False)

    response = api.client.get("/public/seo/sitemap.xml")
    xml = response.text

    assert f"/listings/{hidden.id}" not in xml
    assert f"/listings/{draft.id}" not in xml
    assert f"/listings/{archived.id}" not in xml
    assert f"/agents/{private_agent.id}" not in xml
    assert f"/agents/{inactive_agent.id}" not in xml


def test_sitemap_publishes_optional_legal_routes_only_when_enabled(
    isolated_api_factory,
):
    api = isolated_api_factory([router])
    api.db.add(
        SiteSetting(
            id=1,
            show_about=False,
            show_contact=False,
            show_privacy=True,
            privacy_body="Privacy text",
            show_terms=True,
            terms_body="Terms text",
        )
    )
    api.db.commit()

    response = api.client.get("/public/seo/sitemap.xml")
    xml = response.text

    assert "/about" not in xml
    assert "/contact" not in xml
    assert "http://localhost:4200/privacy" in xml
    assert "http://localhost:4200/terms" in xml
    assert "/admin" not in xml
    assert "/account" not in xml
    assert "/preview/" not in xml
