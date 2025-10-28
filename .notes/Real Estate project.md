
activate python if not already
.\.venv\Scripts\Activate.ps1


# Run if not already started
docker compose up -d

# You can check if running with:
docker ps

uvicorn app.main:app --reload

open db
docker exec -it re_db psql -U admin_db -d realestate