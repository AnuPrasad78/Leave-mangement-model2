"""Balances endpoint: absence before activity, latest-year selection, auth guard."""

import pytest
from decimal import Decimal


def _approve_five_days(client, emp_headers, mgr_headers):
    request_no = client.post(
        "/leave-requests",
        json={
            "type": "Paid Time Off",
            "from": "2027-03-01",
            "to": "2027-03-05",
            "days": 5,
            "mode": "Full Day",
            "reason": "Testing",
            "requestedOn": "2027-02-20",
        },
        headers=emp_headers,
    ).json()["requestNo"]
    return client.post(
        f"/leave-requests/{request_no}/decision",
        json={"decision": "Approved"},
        headers=mgr_headers,
    )


@pytest.mark.integration
def test_no_balance_until_first_approval(client, employee_factory, auth_headers):
    employee_factory("balance.none@emids.com")

    response = client.get("/balances/me", headers=auth_headers("balance.none@emids.com"))

    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.integration
def test_balance_appears_after_approval(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("balance.mgr@emids.com", role="manager")
    employee_factory("balance.emp@emids.com", manager=manager)
    emp_headers = auth_headers("balance.emp@emids.com")
    mgr_headers = auth_headers("balance.mgr@emids.com")

    assert _approve_five_days(client, emp_headers, mgr_headers).status_code == 200

    body = client.get("/balances/me", headers=emp_headers).json()
    assert body["year"] == 2027
    # Numeric columns arrive JSON-serialized as strings (pydantic Any-serializer on a dict payload)
    assert float(body["annual_utilized"]) == 5.0
    assert float(body["annual_credited"]) == 18.0


@pytest.mark.integration
def test_latest_year_wins_when_multiple_balance_rows_exist(
    client, employee_factory, leave_types, session, auth_headers
):
    from app.models import Employee
    from app.models import LeaveBalance

    employee = employee_factory("balance.multi@emids.com")

    # an old year exists with plenty utilized, to prove the endpoint picks the newest
    with session() as db:
        db.add(
            LeaveBalance(
                employee_id=employee.id,
                year=2025,
                annual_credited=Decimal("18"),
                annual_utilized=Decimal("6"),
            )
        )
        db.commit()

    manager = employee_factory("balance.ltmgr@emids.com", role="manager")
    employee_factory("balance.ltemp@emids.com", manager=manager)
    emp_headers = auth_headers("balance.ltemp@emids.com")
    mgr_headers = auth_headers("balance.ltmgr@emids.com")

    assert _approve_five_days(client, emp_headers, mgr_headers).status_code == 200

    body = client.get("/balances/me", headers=emp_headers).json()
    assert body["year"] == 2027  # newest row, not 2025
    assert float(body["annual_utilized"]) == 5.0


@pytest.mark.integration
def test_balances_require_authentication(client):
    assert client.get("/balances/me").status_code == 401
