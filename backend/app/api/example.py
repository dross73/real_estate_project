# backend/app/api/example.py

# Import built-in modules
from typing import Optional

# Import FastAPI routing
from fastapi import APIRouter

# Import Pydantic model and field helpers
from pydantic import BaseModel, Field


# Create a router that will group endpoints in the docs under "example"
router = APIRouter(tags=["example"])


# Define the exact MVP Listing shape
# Fields: price, address, city, state, description, sqft, bedrooms, bathrooms, cover_image
class ListingExample(BaseModel):
    # Price in dollars as an integer
    # Pydantic v2: "example" must be passed inside json_schema_extra
    price: int = Field(..., json_schema_extra={"example": 259900})

    # Street address of the property
    address: str = Field(..., json_schema_extra={"example": "123 Maple St"})

    # City name
    city: str = Field(..., json_schema_extra={"example": "Des Moines"})

    # Two-letter state code
    state: str = Field(..., json_schema_extra={"example": "IA"})

    # Optional longer description
    description: Optional[str] = Field(
        None, json_schema_extra={"example": "Updated kitchen, fenced yard, quiet street."}
    )

    # Square footage as an integer
    sqft: int = Field(..., json_schema_extra={"example": 1580})

    # Number of bedrooms
    bedrooms: int = Field(..., json_schema_extra={"example": 3})

    # Number of bathrooms, supports halves (e.g., 1.5)
    bathrooms: float = Field(..., json_schema_extra={"example": 2.0})

    # Single cover image path or URL
    cover_image: str = Field(..., json_schema_extra={"example": "/images/123-main.jpg"})


# Expose a GET endpoint that returns a static example shaped to MVP
@router.get("/example", response_model=ListingExample, summary="Example MVP Listing shape")
def get_example_listing() -> ListingExample:
    # Return a hardcoded payload strictly matching MVP fields
    return ListingExample(
        price=259900,
        address="123 Maple St",
        city="Des Moines",
        state="IA",
        description="Updated kitchen, fenced yard, quiet street.",
        sqft=1580,
        bedrooms=3,
        bathrooms=2.0,
        cover_image="/images/123-main.jpg",
    )
