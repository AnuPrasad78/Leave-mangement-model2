"""Leave-credit policy (Phase 1): proration table, policy constants, admin gate."""

from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.leave_policy import (
    ANNUAL_DAYS_PER_YEAR,
    CARRY_FORWARD_MAX,
    CONTINGENCY_DAYS_PER_YEAR,
    OPTIONAL_HOLIDAYS_MAX,
    PRORATION_METHOD,
    deduction_pool,
    prorated_annual,
)


@pytest.mark.unit
def test_policy_constants():
    assert ANNUAL_DAYS_PER_YEAR == Decimal("22")
    assert CONTINGENCY_DAYS_PER_YEAR == Decimal("10")
    assert CARRY_FORWARD_MAX == Decimal("6")
    assert OPTIONAL_HOLIDAYS_MAX == 3
    assert PRORATION_METHOD == "months_worked_of_12_half_up"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("doj", "year", "expected"),
    [
        (None, 2027, Decimal("22.0")),  # unknown DOJ: full credit
        (date(2026, 6, 1), 2027, Decimal("22.0")),  # joined a previous year: full
        (date(2028, 3, 1), 2027, Decimal("0.0")),  # joins after the year: none
        (date(2027, 1, 1), 2027, Decimal("22.0")),
        (date(2027, 7, 1), 2027, Decimal("11.0")),  # exactly half the months
        (date(2027, 3, 20), 2027, Decimal("18.5")),  # 10 months -> 18.33 -> 18.5 on the 0.5 grid
        (date(2027, 3, 2), 2027, Decimal("18.5")),  # DOJ month counts as a worked month
        (date(2027, 8, 1), 2027, Decimal("9.0")),  # 5 months -> 9.17 -> 9.0
        (date(2027, 12, 31), 2027, Decimal("2.0")),  # 1 month -> 1.83 -> 2.0
    ],
)
def test_prorated_annual_table(doj, year, expected):
    assert prorated_annual(doj, year) == expected


@pytest.mark.unit
def test_prorated_annual_stays_within_cap():
    assert prorated_annual(date(2020, 1, 1), 2027) <= ANNUAL_DAYS_PER_YEAR
    assert prorated_annual(None, 2027) <= ANNUAL_DAYS_PER_YEAR


@pytest.mark.unit
@pytest.mark.parametrize(
    ("leave_type", "expected"),
    [
        ("Contingency Bucket", "contingency"),
        ("Work From Home", None),
        ("Business Travel", None),
        ("Leave Without Pay", None),
        ("Loss Of Pay", None),
        ("Paid Time Off", "annual"),
        ("Compensatory Off", "annual"),
    ],
)
def test_deduction_pool_table(leave_type, expected):
    assert deduction_pool(leave_type) == expected


@pytest.mark.unit
def test_require_admin_rejects_non_admins(session, employee_factory):
    from fastapi.testclient import TestClient  # noqa: F401 (imports run through app chain)

    from app.models import SystemRole
    from app.security import require_admin

    employee = employee_factory("gate.emp@emids.com")
    manager = employee_factory("gate.mgr@emids.com", role="manager")

    with session() as db:
        from sqlalchemy import select

        from app.models import User

        with pytest.raises(HTTPException) as exc:
            require_admin(user=db.scalar(select(User).where(User.email == "gate.emp@emids.com")), session=db)
        assert exc.value.status_code == 403

        with pytest.raises(HTTPException) as exc:
            require_admin(user=db.scalar(select(User).where(User.email == "gate.mgr@emids.com")), session=db)
        assert exc.value.status_code == 403

    assert employee.system_role == SystemRole.EMPLOYEE and manager.system_role == SystemRole.MANAGER


@pytest.mark.integration
def test_approval_credits_prorated_annual_and_policy_caps(
    client, employee_factory, leave_types, session, auth_headers
):
    manager = employee_factory("policy.mgr@emids.com", role="manager")
    employee = employee_factory(
        "policy.emp@emids.com", manager=manager, doj=date(2027, 3, 2)
    )
    emp_headers = auth_headers("policy.emp@emids.com")
    mgr_headers = auth_headers("policy.mgr@emids.com")

    body = {
        "type": "Paid Time Off",
        "from": "2027-07-01",
        "to": "2027-07-05",
        "days": 5,
        "mode": "Full Day",
        "reason": "Policy credit check",
        "requestedOn": "2027-06-20",
    }
    request_no = client.post("/leave-requests", json=body, headers=emp_headers).json()["requestNo"]
    assert client.post(
        f"/leave-requests/{request_no}/decision", json={"decision": "Approved"}, headers=mgr_headers
    ).status_code == 200

    balance = client.get("/balances/me", headers=emp_headers).json()
    assert float(balance["annual_credited"]) == 18.5
    assert float(balance["contingency_credited"]) == 10.0
    assert float(balance["annual_cap"]) == 22.0
    assert float(balance["contingency_cap"]) == 10.0
