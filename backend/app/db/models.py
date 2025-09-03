# backend/app/db/models.py



# Import SQLAlchemy column types and base class for ORM models
from sqlalchemy import Column, Integer, String, Float
# Import the declarative base class for SQLAlchemy ORM models
# All models should inherit from this Base to be registered with the ORM
from app.core.db import Base


# Define the Listing model, which represents a real estate listing in the database
class Listing(Base):
    """
    Represents a real estate listing in the database.
    Fields are kept minimal for a simple MVP; you can expand this model as needed.
    """

    # Set the table name in the database
    __tablename__ = "listings"

    # Unique identifier for each listing (primary key, auto-incremented)
    id = Column(Integer, primary_key=True, index=True)

    # Price of the property in USD (using Float for simplicity)
    price = Column(Float, nullable=False)

    # Address fields for the property
    address = Column(String, nullable=False)
    city = Column(String, nullable=False)
    state = Column(String, nullable=False)

    # Number of bedrooms in the property
    bedrooms = Column(Integer, nullable=False)

    # Number of bathrooms (can be fractional, e.g., 1.5)
    bathrooms = Column(Float, nullable=False)

    # Provide a readable string representation for debugging and logging
    def __repr__(self) -> str:
        return (
            f"<Listing id={self.id} ${self.price} "
            f"{self.bedrooms}bd/{self.bathrooms}ba {self.city}, {self.state}>"
        )

