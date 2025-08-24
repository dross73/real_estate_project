# backend/app/core/db.py

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Resolve the project root: .../real_estate_project
PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Load environment variables from the root .env
load_dotenv(PROJECT_ROOT / ".env")

# Read the connection string from .env
DATABASE_URL = os.getenv("DATABASE_URL")

# Fail fast if it's still missing
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set. Ensure real_estate_project/.env exists and has DATABASE_URL.")

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL, echo=True)

# Session factory for database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models 
Base = declarative_base()
