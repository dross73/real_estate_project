from fastapi import FastAPI

# DB engine + model registry
from app.core.db import Base, engine

# import to register Listing with Base
from app.db import models  

# create tables (temporary; we'll use Alembic later)
Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Real Estate API up"}
