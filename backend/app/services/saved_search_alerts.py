"""Saved-search matching and duplicate-safe email alert delivery."""

from datetime import datetime, timedelta, timezone
import logging

from sqlalchemy.orm import Session

from app.api.public_listings import _eligible_public_listings
from app.db.models import Listing, SavedSearch, SavedSearchAlertDelivery, User
from app.schemas.saved_search import SavedSearchCriteria
from app.services.email_service import EmailDeliveryError, TransactionalEmailService


logger = logging.getLogger(__name__)


FREQUENCY_INTERVALS = {
    "daily": timedelta(days=1),
    "weekly": timedelta(days=7),
}


def listing_matches_saved_search(
    listing: Listing,
    criteria: SavedSearchCriteria,
) -> bool:
    """Apply supported public filters to one listing."""
    if criteria.min_price is not None and listing.price < criteria.min_price:
        return False
    if criteria.max_price is not None and listing.price > criteria.max_price:
        return False
    if criteria.min_bedrooms is not None and listing.bedrooms < criteria.min_bedrooms:
        return False
    if (
        criteria.min_bathrooms is not None
        and float(listing.bathrooms) < criteria.min_bathrooms
    ):
        return False
    if criteria.location:
        term = criteria.location.casefold()
        if term not in listing.city.casefold() and term not in listing.state.casefold():
            return False
    if criteria.property_type is not None and listing.property_type != criteria.property_type:
        return False
    if criteria.min_sqft is not None:
        if listing.sqft is None or listing.sqft < criteria.min_sqft:
            return False
    if criteria.max_sqft is not None:
        if listing.sqft is None or listing.sqft > criteria.max_sqft:
            return False
    if criteria.min_acreage is not None:
        if listing.acreage is None or float(listing.acreage) < criteria.min_acreage:
            return False
    if criteria.max_acreage is not None:
        if listing.acreage is None or float(listing.acreage) > criteria.max_acreage:
            return False
    if criteria.min_year_built is not None:
        if listing.year_built is None or listing.year_built < criteria.min_year_built:
            return False
    if criteria.max_year_built is not None:
        if listing.year_built is None or listing.year_built > criteria.max_year_built:
            return False
    if criteria.status is not None and listing.status != criteria.status:
        return False
    return True


def _search_is_due(saved_search: SavedSearch, now: datetime) -> bool:
    if saved_search.alert_frequency == "immediate":
        return True

    interval = FREQUENCY_INTERVALS[saved_search.alert_frequency]
    if saved_search.last_alerted_at is None:
        return True

    last_alerted = saved_search.last_alerted_at
    if last_alerted.tzinfo is None:
        last_alerted = last_alerted.replace(tzinfo=timezone.utc)

    return now - last_alerted >= interval


def process_saved_search_alerts(
    db: Session,
    *,
    now: datetime | None = None,
    only_immediate: bool = False,
    listing_id: int | None = None,
    email_service: TransactionalEmailService | None = None,
) -> int:
    """Send due alerts and return the number of emails delivered."""
    current_time = now or datetime.now(timezone.utc)
    service = email_service or TransactionalEmailService()

    searches = (
        db.query(SavedSearch)
        .filter(SavedSearch.alerts_enabled.is_(True))
        .order_by(SavedSearch.id.asc())
        .all()
    )
    sent_count = 0

    for saved_search in searches:
        if only_immediate and saved_search.alert_frequency != "immediate":
            continue
        if not _search_is_due(saved_search, current_time):
            continue

        criteria = SavedSearchCriteria.model_validate(saved_search.criteria)
        query = _eligible_public_listings(db).filter(
            Listing.created_at >= saved_search.created_at
        )
        if listing_id is not None:
            query = query.filter(Listing.id == listing_id)

        candidates = query.order_by(Listing.created_at.asc(), Listing.id.asc()).all()
        matched: list[Listing] = []

        for listing in candidates:
            if not listing_matches_saved_search(listing, criteria):
                continue

            delivered = (
                db.query(SavedSearchAlertDelivery)
                .filter(
                    SavedSearchAlertDelivery.saved_search_id == saved_search.id,
                    SavedSearchAlertDelivery.listing_id == listing.id,
                )
                .first()
            )
            if delivered is None:
                matched.append(listing)

        if not matched:
            continue

        user = db.query(User).filter(User.id == saved_search.user_id).first()
        if user is None or not user.is_active or user.email_verified_at is None:
            continue

        lines = [
            f"{listing.title} - ${listing.price:,.0f} - "
            f"{listing.city}, {listing.state}"
            for listing in matched
        ]
        try:
            service.send(
                to_email=user.email,
                subject=f"New homes matching {saved_search.name}",
                text_body=(
                    f"New public listings match your saved search: {saved_search.name}.\n\n"
                    + "\n".join(lines)
                    + "\n\nOpen Juniper & Lane Realty to view the latest details."
                ),
            )
        except EmailDeliveryError:
            logger.exception(
                "Saved-search alert delivery failed: saved_search_id=%s",
                saved_search.id,
            )
            continue

        for listing in matched:
            db.add(
                SavedSearchAlertDelivery(
                    saved_search_id=saved_search.id,
                    listing_id=listing.id,
                    delivered_at=current_time,
                )
            )

        saved_search.last_alerted_at = current_time
        db.commit()
        sent_count += 1

    return sent_count
