# ------------------------------------------------------------------------------
# Purpose:
# Define the API endpoints for real estate listings.
# Implements full CRUD functionality (Create, Read, Update, Delete) and list with pagination.
# Endpoints use Pydantic schemas to guarantee request/response contracts.
# Each route is backed by the Postgres database via SQLAlchemy ORM.
# ------------------------------------------------------------------------------

# Import FastAPI router utilities, HTTP exception handling, status codes,
# Response objects, and dependency injection system.
from fastapi import APIRouter, HTTPException, status, Response, Depends

# Import SQLAlchemy Session type for database interactions.
from sqlalchemy.orm import Session

# Import datetime and timezone so we can set created_at and updated_at correctly in UTC.
from datetime import datetime, timezone

# Bring in our dependency that provides a database session for each request.
from app.db.session import get_db

# Import the Listing ORM model (represents the listings table).
from app.db.models import Listing

# Import Pydantic schemas:
# - ListingCreate: for validating data when creating a new record
# - ListingUpdate: for validating partial updates
# - ListingRead: for formatting a single record in responses
# - PaginatedListingRead: for wrapping multiple records with pagination metadata
from app.schemas.listing import (
    ListingCreate,
    ListingUpdate,
    ListingRead,
    PaginatedListingRead,
)

# Create a router with a URL prefix (/listings) and a tag (used in Swagger docs).
router = APIRouter(prefix="/listings", tags=["Listings"])


# ------------------------------------------------------------------------------
# GET /listings
# List all listings with pagination.
# ------------------------------------------------------------------------------
@router.get("", response_model=PaginatedListingRead, status_code=status.HTTP_200_OK)
def list_listings(
    # Query parameter: which page of results to fetch (defaults to 1)
    page: int = 1,

    # Query parameter: how many items per page (defaults to 10)
    per_page: int = 10,

    # Injected database session for queries
    db: Session = Depends(get_db),
) -> PaginatedListingRead:
    # Calculate offset (starting row) based on page number
    offset = max(page - 1, 0) * per_page

    # Fetch rows from the database using limit and offset for pagination
    rows: list[Listing] = db.query(Listing).offset(offset).limit(per_page).all()

    # Convert ORM objects into Pydantic ListingRead models for safe responses
    items: list[ListingRead] = [ListingRead.model_validate(row) for row in rows]

    # Count total number of listings for pagination metadata
    total: int = db.query(Listing).count()

    # Return PaginatedListingRead object with items, total count, and pagination info
    return PaginatedListingRead(items=items, total=total, page=page, per_page=per_page)


# ------------------------------------------------------------------------------
# GET /listings/{listing_id}
# Fetch a single listing by ID.
# ------------------------------------------------------------------------------
@router.get("/{listing_id}", response_model=ListingRead, status_code=status.HTTP_200_OK)
def get_listing(
    # Path parameter: the ID of the listing from the URL (e.g., /listings/5)
    listing_id: int,

    # Injected database session
    db: Session = Depends(get_db),
) -> ListingRead:
    # Query the database for a listing with this ID
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    # If no record is found, return a 404 error
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    # Convert the ORM object into a Pydantic ListingRead response
    return ListingRead.model_validate(listing)


# ------------------------------------------------------------------------------
# POST /listings
# Create a new listing in the database.
# ------------------------------------------------------------------------------
@router.post("", response_model=ListingRead, status_code=status.HTTP_201_CREATED)
def create_listing(
    # Request body: validated against ListingCreate schema
    payload: ListingCreate,

    # Injected database session
    db: Session = Depends(get_db),
) -> ListingRead:
    # Create a new Listing ORM object from validated input data
    listing = Listing(**payload.model_dump())

    # Set created_at and updated_at timestamps (UTC-safe)
    listing.created_at = datetime.now(timezone.utc)
    listing.updated_at = datetime.now(timezone.utc)

    # Add to session and commit changes to persist to the database
    db.add(listing)
    db.commit()

    # Refresh object so it has database-generated values (e.g., id)
    db.refresh(listing)

    # Return the new record as a Pydantic ListingRead model
    return ListingRead.model_validate(listing)


# ------------------------------------------------------------------------------
# PUT /listings/{listing_id}
# Update an existing listing by ID.
# ------------------------------------------------------------------------------
@router.put("/{listing_id}", response_model=ListingRead, status_code=status.HTTP_200_OK)
def update_listing(
    # Path parameter: the listing ID from the URL
    listing_id: int,

    # Request body: validated by ListingUpdate schema
    payload: ListingUpdate,

    # Injected database session
    db: Session = Depends(get_db),
) -> ListingRead:
    # Query the database for the listing with this ID
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    # If no record is found, return a 404 error
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    # Loop through only the fields provided in the request body
    # exclude_unset=True prevents overwriting fields not sent by the client
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, key, value)

    # Update the updated_at timestamp
    listing.updated_at = datetime.now(timezone.utc)

    # Commit changes and refresh object so it has the latest state
    db.commit()
    db.refresh(listing)

    # Return the updated record as a Pydantic ListingRead model
    return ListingRead.model_validate(listing)


# ------------------------------------------------------------------------------
# DELETE /listings/{listing_id}
# Delete a listing by ID.
# ------------------------------------------------------------------------------
@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_listing(
    # Path parameter: the listing ID from the URL
    listing_id: int,

    # Injected database session
    db: Session = Depends(get_db),
) -> Response:
    # Query the database for the listing with this ID
    listing = db.query(Listing).filter(Listing.id == listing_id).first()

    # If no record is found, return a 404 error
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )

    # Delete the record from the session and commit changes
    db.delete(listing)
    db.commit()

    # Return an empty response with 204 No Content status
    return Response(status_code=status.HTTP_204_NO_CONTENT)
