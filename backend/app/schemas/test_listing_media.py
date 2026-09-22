"""Validation tests for listing virtual-tour links."""

import pytest
from pydantic import ValidationError

from app.schemas.listing import ListingCreate


def _listing_payload(**overrides):
    payload = {
        "title": "Tour Test Home",
        "status": "Active",
        "is_public": True,
        "is_featured": False,
        "hide_exact_address": False,
        "price": 350000,
        "property_type": "Single Family",
        "address": "123 Main St",
        "city": "Ames",
        "state": "IA",
        "bedrooms": 3,
        "bathrooms": 2.0,
        "amenities": [],
        "virtual_tour_url": None,
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=abc",
        "https://vimeo.com/12345",
        "https://my.matterport.com/show/?m=abc",
        "https://tour.example.com/property/27",
    ],
)
def test_listing_accepts_http_virtual_tour_providers(url):
    listing = ListingCreate.model_validate(
        _listing_payload(virtual_tour_url=url)
    )

    assert listing.virtual_tour_url == url


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "not-a-url",
    ],
)
def test_listing_rejects_non_http_virtual_tour_urls(url):
    with pytest.raises(ValidationError):
        ListingCreate.model_validate(
            _listing_payload(virtual_tour_url=url)
        )
