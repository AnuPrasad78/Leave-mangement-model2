"""Container entrypoint helper: seed demo data exactly once, when empty.

Runs after `alembic upgrade head`. Seeding is idempotent by construction
(seed.py upserts on unique keys), but we skip it entirely when the database
has already been populated so restarts never touch existing data. Set
DEMO_PASSWORD to enable; without it the seed step is a no-op (the API still
comes up with an empty database).
"""

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import User


def run() -> None:
    with SessionLocal.begin() as session:
        user_count = session.scalar(select(func.count()).select_from(User))
    if user_count:
        return
    from app import seed
    from app.db import settings

    if not settings.DEMO_PASSWORD:
        import logging

        logging.getLogger(__name__).warning(
            "Database is empty and DEMO_PASSWORD is not set — skipping demo seed."
        )
        return
    seed.seed_demo_data()


if __name__ == "__main__":
    run()
