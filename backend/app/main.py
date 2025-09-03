# backend/app/main.py

from fastapi import FastAPI

# --- Internal imports ---
# DB engine + model registry
from app.core.db import Base, engine

# Import to register Listing with Base
from app.db import models  # noqa: F401  USED LATER when we connect to DB

# Import the router object from app/api/example.py so we can use it here
from app.api.example import router as example_router

# --- Database setup ---
# Create tables (temporary; we'll use Alembic later)
Base.metadata.create_all(bind=engine)

# --- FastAPI app instance ---
app = FastAPI()

# --- Routers ---
# Register the router with our FastAPI app so its endpoints become active
app.include_router(example_router)

# --- Root endpoint ---
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Real Estate API up"}
