"""The LeaveBalance backfill: computed rows for every missing employee/year."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.backfill_balances import backfill_balances
from app.leave_policy import (
    ANNUAL_DAYS_PER_YEAR,
    CONTINGENCY_DAYS_PER_YEAR,
    prorated_annual,
)
from app.models import LeaveBalance

this_year = date.today().year


@pytest.mark.integration
def test_backfill_creates_computed_rows_for_employees_missing_one(
    employee_factory, session
):
    emp_no_doj = employee_factory("bf.none@emids.com")
    emp_midyear = employee_factory("bf.mid@emids.com", doj=date(this_year, 7, 1))

    created = backfill_balances()

    assert created == 2
    with session() as db:
        rows = {
            row.employee_id: row
            for row in db.scalars(select(LeaveBalance)).all()
        }
    assert rows[emp_no_doj.id].year == this_year
    assert rows[emp_no_doj.id].annual_credited == ANNUAL_DAYS_PER_YEAR  # unknown DOJ -> full 22
    assert rows[emp_midyear.id].annual_credited == prorated_annual(date(this_year, 7, 1), this_year)
    for row in rows.values():
        assert row.contingency_credited == CONTINGENCY_DAYS_PER_YEAR
        assert row.annual_cap == ANNUAL_DAYS_PER_YEAR
        assert row.contingency_cap == CONTINGENCY_DAYS_PER_YEAR
        assert row.annual_utilized == Decimal("0")


@pytest.mark.integration
def test_backfill_leaves_existing_rows_and_used_years_alone(employee_factory, session):
    employee = employee_factory("bf.existing@emids.com")
    with session() as db:
        db.add(
            LeaveBalance(
                employee_id=employee.id,
                year=this_year,
                annual_credited=Decimal("5.00"),
                annual_utilized=Decimal("2.00"),
            )
        )
        db.commit()

    created = backfill_balances()

    assert created == 0
    with session() as db:
        row = db.scalar(select(LeaveBalance).where(LeaveBalance.employee_id == employee.id))
    assert float(row.annual_credited) == 5.0  # admin corrections are never overwritten


@pytest.mark.integration
def test_backfill_is_idempotent(employee_factory, session):
    employee_factory("bf.idem.a@emids.com")
    employee_factory("bf.idem.b@emids.com")

    assert backfill_balances() == 2
    assert backfill_balances() == 0


@pytest.mark.integration
def test_backfill_respects_an_explicit_year(employee_factory, session):
    employee = employee_factory("bf.year@emids.com")

    created = backfill_balances(year=this_year - 1)

    assert created == 1
    with session() as db:
        rows = db.scalars(select(LeaveBalance).where(LeaveBalance.employee_id == employee.id)).all()
    assert [row.year for row in rows] == [this_year - 1]
    # the backfilled year is still computed from the employee's real DOJ
    assert rows[0].annual_credited == prorated_annual(employee.doj, this_year - 1)
