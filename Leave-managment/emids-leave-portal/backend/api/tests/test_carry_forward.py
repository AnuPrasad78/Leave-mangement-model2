"""Phase 7: the year-end carry-forward job."""

from datetime import date
from decimal import Decimal

import pytest

from app.leave_policy import carry_forward_amount


@pytest.mark.unit
@pytest.mark.parametrize(
    ("remaining", "expected"),
    [
        (Decimal("0"), Decimal("0")),
        (Decimal("5"), Decimal("5")),
        (Decimal("6"), Decimal("6")),
        (Decimal("7"), Decimal("6")),
        (Decimal("-1"), Decimal("0")),
    ],
)
def test_carry_forward_clamp_table(remaining, expected):
    assert carry_forward_amount(remaining) == expected


def _source_balance(employee, year, credited, utilized, contingency_credited=Decimal("10.00"), utilized_contingency=Decimal("0.00")):
    from app.models import LeaveBalance

    return LeaveBalance(
        employee_id=employee.id,
        year=year,
        annual_credited=credited,
        annual_utilized=utilized,
        contingency_credited=contingency_credited,
        contingency_utilized=utilized_contingency,
    )


@pytest.mark.integration
def test_carry_forward_creates_next_year_rows(client, admin_factory, employee_factory, auth_headers, session):
    admin_factory("forward.admin@emids.com", role="admin")
    employee = employee_factory("forward.emp@emids.com")
    admin_headers = auth_headers("forward.admin@emids.com")
    source_year = date.today().year - 1

    with session() as db:
        db.add(_source_balance(employee, source_year, Decimal("18.00"), Decimal("15.00")))
        db.commit()

    response = client.post(
        "/admin/leave-requests/carry-forward", json={"year": source_year}, headers=admin_headers
    )
    assert response.status_code == 200, response.text

    target = client.get(f"/admin/leave-balances?year={source_year + 1}", headers=admin_headers).json()
    assert target["total"] == 1
    row = target["items"][0]
    assert float(row["opening_annual"]) == 3.0  # remaining: 18 credited - 15 utilized
    assert float(row["contingency_credited"]) == 10.0
    assert float(row["annual_credited"]) == 22.0  # doj None -> full credit for the new year


@pytest.mark.integration
def test_carry_forward_clamps_at_six_and_idempotent(client, admin_factory, employee_factory, auth_headers, session):
    admin_factory("clamp.admin@emids.com", role="admin")
    employee = employee_factory("clamp.emp@emids.com")
    admin_headers = auth_headers("clamp.admin@emids.com")
    source_year = date.today().year - 1

    with session() as db:
        db.add(_source_balance(employee, source_year, Decimal("22.00"), Decimal("15.00")))  # remaining 7
        db.commit()

    first = client.post("/admin/leave-requests/carry-forward", json={"year": source_year}, headers=admin_headers)
    assert first.status_code == 200

    row = client.get(f"/admin/leave-balances?year={source_year + 1}", headers=admin_headers).json()["items"][0]
    assert float(row["opening_annual"]) == 6.0

    second = client.post("/admin/leave-requests/carry-forward", json={"year": source_year}, headers=admin_headers)
    assert second.status_code == 200
    row_again = client.get(f"/admin/leave-balances?year={source_year + 1}", headers=admin_headers).json()["items"][0]
    assert float(row_again["opening_annual"]) == 6.0  # same result, idempotent


@pytest.mark.integration
def test_carry_forward_refuses_any_year_but_the_previous_one(client, admin_factory, auth_headers):
    from datetime import date

    admin_factory("refuse.admin@emids.com", role="admin")
    admin_headers = auth_headers("refuse.admin@emids.com")

    response = client.post(
        "/admin/leave-requests/carry-forward", json={"year": date.today().year - 2}, headers=admin_headers
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Carry-forward may only run for the previous year"


@pytest.mark.integration
def test_carry_forward_zero_remaining_leaves_no_opening(client, admin_factory, employee_factory, auth_headers, session):
    admin_factory("zero.admin@emids.com", role="admin")
    employee = employee_factory("zero.emp@emids.com")
    admin_headers = auth_headers("zero.admin@emids.com")
    source_year = date.today().year - 1

    with session() as db:
        db.add(_source_balance(employee, source_year, Decimal("18.00"), Decimal("18.00")))
        db.commit()

    assert client.post(
        "/admin/leave-requests/carry-forward", json={"year": source_year}, headers=admin_headers
    ).status_code == 200

    row = client.get(f"/admin/leave-balances?year={source_year + 1}", headers=admin_headers).json()["items"][0]
    assert float(row["opening_annual"]) == 0.0


@pytest.mark.integration
def test_carry_forward_ignores_contingency_only_balances(client, admin_factory, employee_factory, auth_headers, session):
    """Contingency never carries forward (ADMIN_DECISIONS.md Q2a)."""
    admin_factory("conly.admin@emids.com", role="admin")
    employee = employee_factory("conly.emp@emids.com")
    admin_headers = auth_headers("conly.admin@emids.com")
    source_year = date.today().year - 1

    with session() as db:
        db.add(
            _source_balance(
                employee,
                source_year,
                Decimal("22.00"),
                Decimal("22.00"),  # annual exhausted
                contingency_credited=Decimal("10.00"),
                utilized_contingency=Decimal("0.00"),  # plenty of contingency unused
            )
        )
        db.commit()

    assert client.post(
        "/admin/leave-requests/carry-forward", json={"year": source_year}, headers=admin_headers
    ).status_code == 200

    row = client.get(f"/admin/leave-balances?year={source_year + 1}", headers=admin_headers).json()["items"][0]
    assert float(row["opening_annual"]) == 0.0


@pytest.mark.integration
def test_carry_forward_requires_admin(client, employee_factory, auth_headers):
    employee_factory("cgate.emp@emids.com")
    response = client.post(
        "/admin/leave-requests/carry-forward", json={"year": date.today().year - 1},
        headers=auth_headers("cgate.emp@emids.com"),
    )
    assert response.status_code == 403
