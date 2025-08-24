# backend/app/db/models.py

# This defines the DB table structure using SQLAlchemy ORM.
# `Base` comes from our db core and registers models for metadata (migrations later).

from sqlalchemy import Column, Integer, String, Float
from app.core.db import Base

class Listing(Base):
    """
    Represents a real estate lisying in the database.
    Keep fields minimal for slimmed down project; we can evolve later

    """

    __tablename__ = "listings"

    # Primary key (auto-incrementing integer)
    id = Column(Integer, primary_key=True, index=True)

    # Price in USD for MVP; Float is fine initially (we can switch to Decimal later if needed)
    price = Column(Float, nullable=False)

    # Basic address fields; lengths are unconstrained for now
    address = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)

    # Core attributes buyers filer on
    bedrooms = Column(Integer, nullable=False)
    # Bathrooms allow decimals (e.g., 1.5 for a half bath)
    bathrooms = Column(Float, nullable=False) 

    # __repr__ is a special Python method that returns a
    # human-readable string when you print the object in a shell or logs.
    # This makes debugging easier because you'll see key info instead of <Listing object at 0x...>
    def __repr__(self) -> str:
        return (
            f"<Listing id={self.id} ${self.price} "
            f"{self.bedrooms}bd/{self.bathrooms}ba {self.city}, {self.state}>"
        )

