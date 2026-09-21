"""CLI entry point for scheduled saved-search alert delivery."""

from app.db.session import SessionLocal
from app.services.saved_search_alerts import process_saved_search_alerts


def main() -> None:
    db = SessionLocal()
    try:
        process_saved_search_alerts(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
