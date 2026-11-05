"""One-off backfill: every employee missing a LeaveBalance row for a year gets
one, with credits computed by `app.leave_policy` (never hardcoded).

Run from `backend/api` (idempotent — re-running creates only the still-missing
rows, and the `leave_balances_employee_year_key` unique constraint makes it
safe against concurrent runs):

    python -m app.backfill_balances            # current year
    python -m app.backfill_balances --year 2026
"""

import argparse
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.db import SessionLocal
from app.leave_policy import (
    ANNUAL_DAYS_PER_YEAR,
    CONTINGENCY_DAYS_PER_YEAR,
    prorated_annual,
)
from app.models import Employee, LeaveBalance


def balance_values_for(employee: Employee, year: int) -> dict[str, Decimal | int]:
    """Policy-computed column values for one employee's `year` balance row."""
    return {
        "employee_id": employee.id,
        "year": year,
        "annual_credited": prorated_annual(employee.doj, year),
        "contingency_credited": CONTINGENCY_DAYS_PER_YEAR,
        "annual_cap": ANNUAL_DAYS_PER_YEAR,
        "contingency_cap": CONTINGENCY_DAYS_PER_YEAR,
    }


def backfill_balances(year: int | None = None) -> int:
    """Insert a computed LeaveBalance row for every employee missing one for
    `year` (default: the current year). Returns the number of rows created."""
    year = year or date.today().year
    created = 0
    with SessionLocal.begin() as session:
        employees = session.scalars(select(Employee)).all()
        covered = set(
            session.scalars(select(LeaveBalance.employee_id).where(LeaveBalance.year == year)).all()
        )
        for employee in employees:
            if employee.id in covered:
                continue
            statement = (
                insert(LeaveBalance)
                .values(**balance_values_for(employee, year))
                .on_conflict_do_nothing(constraint="leave_balances_employee_year_key")
                .returning(LeaveBalance.id)
            )
            if session.scalars(statement).first() is not None:
                created += 1
    return created


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create missing yearly leave balances.")
    parser.add_argument("--year", type=int, default=None, help="Balance year (default: current year)")
    args = parser.parse_args()
    inserted = backfill_balances(args.year)
    print(f"Created {inserted} balance row(s) for {args.year or date.today().year}.")
