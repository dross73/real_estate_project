# backend/app/api/example.py


# Import typing for optional fields in Pydantic models
from typing import Optional

# Import FastAPI's APIRouter to define API endpoints in modular groups
from fastapi import APIRouter

# Import Pydantic's BaseModel and Field for data validation and schema generation
from pydantic import BaseModel, Field



# Create a router instance to group related endpoints under the "example" tag in the API docs
router = APIRouter(tags=["example"])



# Define a Pydantic model for the MVP listing example
# This model specifies the expected fields and their types for a real estate listing
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

    # Optional longer description of the property
    description: Optional[str] = Field(
        None, json_schema_extra={"example": "Updated kitchen, fenced yard, quiet street."}
    )

    # Square footage of the property
    sqft: int = Field(..., json_schema_extra={"example": 1580})


    # Number of bedrooms in the property
    bedrooms: int = Field(..., json_schema_extra={"example": 3})

    # Number of bathrooms (can be fractional, e.g., 1.5)
    bathrooms: float = Field(..., json_schema_extra={"example": 2.0})

    # Path or URL to a cover image for the listing
    cover_image: str = Field(..., json_schema_extra={"example": "/images/123-main.jpg"})



# Define a GET endpoint that returns a static example listing
# This endpoint is useful for documentation, testing, or as a template for clients
@router.get("/example", response_model=ListingExample, summary="Example MVP Listing shape")
def get_example_listing() -> ListingExample:
    # Return a hardcoded example payload matching the ListingExample model
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
