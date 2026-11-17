"""Shared server-side offset pagination.

One envelope, one dependency, half the math — every list board pages the same
way: `page`/`page_size` query params (default 1/10, page_size capped at 100),
count over the filtered query, then SQL `.offset()/.limit()` under a
deterministic order with a unique tie-breaker.
"""

import math
from dataclasses import dataclass

from fastapi import Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class PageParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(10, ge=1, le=100, description="Rows per page (max 100)"),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


def paginate_query(
    session: Session,
    query,
    params: PageParams,
    order_by: tuple,
    tuples: bool = False,
) -> dict:
    """Filter-then-count-then-slice. `tuples=True` for queries selecting more
    than one entity (rows come back as ORM-row tuples instead of entities)."""
    total = int(session.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0)
    ordered = query.order_by(*order_by).offset(params.offset).limit(params.page_size)
    rows = session.execute(ordered).all() if tuples else session.scalars(ordered).all()
    page_count = math.ceil(total / params.page_size) if total else 0
    return {
        "rows": rows,
        "page": params.page,
        "page_size": params.page_size,
        "total": total,
        "page_count": page_count,
    }
