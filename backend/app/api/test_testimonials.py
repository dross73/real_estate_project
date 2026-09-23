"""Integration tests for testimonial moderation and verified public submission."""

from datetime import datetime, timezone

from app.api.testimonials import admin_router, public_router
from app.core.security import create_access_token
from app.db.models import AuditLog, SiteSetting, Testimonial, User


def _headers(role: str, email: str | None = None) -> dict[str, str]:
    subject = email or f"{role}@example.com"
    token = create_access_token(subject=subject, role=role)
    return {"Authorization": f"Bearer {token}"}


def _public_user(
    db,
    *,
    email: str = "buyer@example.com",
    verified: bool = True,
) -> User:
    user = User(
        role="public_user",
        email=email,
        full_name="Buyer Person",
        hashed_password="not-used",
        is_active=True,
        email_verified_at=datetime.now(timezone.utc) if verified else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _settings(
    db,
    *,
    show_testimonials: bool = True,
    enable_submissions: bool = True,
) -> SiteSetting:
    settings = SiteSetting(
        id=1,
        show_testimonials=show_testimonials,
        enable_testimonial_submissions=enable_submissions,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def test_staff_can_create_approve_list_and_delete_testimonial(
    isolated_api_factory,
):
    api = isolated_api_factory([admin_router, public_router])
    _settings(api.db)

    created = api.client.post(
        "/testimonials",
        headers=_headers("staff"),
        json={
            "author_name": "Alex Customer",
            "body": "The team made the buying process easy to understand.",
            "rating": 5,
            "status": "Pending",
        },
    )

    assert created.status_code == 201
    testimonial_id = created.json()["id"]
    assert created.json()["status"] == "Pending"

    approved = api.client.put(
        f"/testimonials/{testimonial_id}",
        headers=_headers("admin"),
        json={"status": "Approved"},
    )

    assert approved.status_code == 200
    assert approved.json()["status"] == "Approved"
    assert approved.json()["moderated_by_email"] == "admin@example.com"
    assert approved.json()["moderated_at"] is not None

    public = api.client.get("/public/testimonials")
    assert public.status_code == 200
    assert [item["id"] for item in public.json()] == [testimonial_id]
    assert public.json()[0]["author_name"] == "Alex Customer"
    assert "status" not in public.json()[0]
    assert "moderated_by_email" not in public.json()[0]

    deleted = api.client.delete(
        f"/testimonials/{testimonial_id}",
        headers=_headers("staff"),
    )
    assert deleted.status_code == 204
    assert api.db.query(Testimonial).count() == 0

    actions = [
        row.action
        for row in api.db.query(AuditLog).order_by(AuditLog.id.asc()).all()
    ]
    assert actions == [
        "testimonial.created",
        "testimonial.updated",
        "testimonial.deleted",
    ]


def test_verified_public_submission_is_pending_until_moderated(
    isolated_api_factory,
):
    api = isolated_api_factory([admin_router, public_router])
    _settings(api.db)
    user = _public_user(api.db)

    submitted = api.client.post(
        "/public/testimonials",
        headers=_headers("public_user", user.email),
        json={
            "body": "I appreciated the clear communication throughout the process.",
            "rating": 5,
        },
    )

    assert submitted.status_code == 201
    response_body = submitted.json()
    testimonial_id = response_body["id"]
    assert "author_user_id" not in response_body
    assert "status" not in response_body
    assert "moderated_by_email" not in response_body

    stored = api.db.query(Testimonial).filter(
        Testimonial.id == testimonial_id
    ).one()
    assert stored.author_user_id == user.id
    assert stored.author_name == "Buyer Person"
    assert stored.source == "public"
    assert stored.status == "Pending"

    before_approval = api.client.get("/public/testimonials")
    assert before_approval.status_code == 200
    assert before_approval.json() == []

    approved = api.client.put(
        f"/testimonials/{testimonial_id}",
        headers=_headers("staff"),
        json={"status": "Approved"},
    )
    assert approved.status_code == 200

    after_approval = api.client.get("/public/testimonials")
    assert [item["id"] for item in after_approval.json()] == [testimonial_id]


def test_public_submission_requires_verified_user_and_enabled_setting(
    isolated_api_factory,
):
    api = isolated_api_factory([public_router])
    _settings(api.db, enable_submissions=False)
    verified_user = _public_user(api.db, email="verified@example.com")
    unverified_user = _public_user(
        api.db,
        email="unverified@example.com",
        verified=False,
    )

    disabled = api.client.post(
        "/public/testimonials",
        headers=_headers("public_user", verified_user.email),
        json={
            "body": "This submission should be blocked while disabled.",
            "rating": 4,
        },
    )
    unverified = api.client.post(
        "/public/testimonials",
        headers=_headers("public_user", unverified_user.email),
        json={
            "body": "This submission should be blocked before verification.",
            "rating": None,
        },
    )

    assert disabled.status_code == 403
    assert unverified.status_code == 403
    assert api.db.query(Testimonial).count() == 0


def test_public_list_returns_only_approved_testimonials_when_visible(
    isolated_api_factory,
):
    api = isolated_api_factory([public_router])
    settings = _settings(api.db, show_testimonials=True)

    api.db.add_all(
        [
            Testimonial(
                author_name="Approved Customer",
                body="Approved testimonial content.",
                rating=5,
                source="internal",
                status="Approved",
            ),
            Testimonial(
                author_name="Pending Customer",
                body="Pending testimonial content.",
                rating=4,
                source="public",
                status="Pending",
            ),
            Testimonial(
                author_name="Rejected Customer",
                body="Rejected testimonial content.",
                rating=2,
                source="public",
                status="Rejected",
            ),
        ]
    )
    api.db.commit()

    visible = api.client.get("/public/testimonials")
    assert visible.status_code == 200
    assert [item["author_name"] for item in visible.json()] == [
        "Approved Customer"
    ]

    settings.show_testimonials = False
    api.db.commit()

    hidden = api.client.get("/public/testimonials")
    assert hidden.status_code == 200
    assert hidden.json() == []
