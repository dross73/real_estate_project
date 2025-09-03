# backend/app/core/db.py


# Standard library imports
import os  # For accessing environment variables and OS-level operations
from pathlib import Path  # For robust, cross-platform file path handling

# SQLAlchemy imports for database connection and ORM
from sqlalchemy import create_engine  # To create a database engine/connection
from sqlalchemy.orm import sessionmaker, declarative_base  # For session management and model base class

# dotenv import for loading environment variables from a .env file
from dotenv import load_dotenv


# Resolve the project root directory (e.g., .../real_estate_project)
PROJECT_ROOT = Path(__file__).resolve().parents[3]


# Load environment variables from the .env file at the project root
load_dotenv(PROJECT_ROOT / ".env")


# Read the database connection string from the loaded environment variables
DATABASE_URL = os.getenv("DATABASE_URL")


# Fail fast if the connection string is missing
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set. Ensure real_estate_project/.env exists and has DATABASE_URL.")


# Create the SQLAlchemy engine (the core interface to the database)
# echo=True enables SQL query logging for debugging
engine = create_engine(DATABASE_URL, echo=True)


# Session factory for creating new database sessions
# autocommit and autoflush are set to False for explicit control
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Base class for all ORM models (tables should inherit from this)
Base = declarative_base()
