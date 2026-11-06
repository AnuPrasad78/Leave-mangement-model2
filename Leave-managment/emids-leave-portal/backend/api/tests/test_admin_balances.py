"""Phase 5: policy reading and admin-authored balance corrections."""

from datetime import date
from decimal import Decimal

import pytest


@pytest.mark.integration
def test_policies_report_the_module_values(client, admin_factory, employee_factory, auth_headers):
    admin_factory("policyread.admin@emids.com", role="admin")
    employee_factory("policyread.emp@emids.com")
    admin_headers = auth_headers("policyread.admin@emids.com")

    body = client.get("/admin/leave-policies", headers=admin_headers).json()
    assert body["annual_days_per_year"] == 22.0
    assert body["contingency_days_per_year"] == 10.0
    assert body["carry_forward_max"] == 6.0
    assert body["optional_holidays_max"] == 3
    assert body["prorated_by"] == "doj"
    assert body["proration_method"] == "months_worked_of_12_half_up"


@pytest.mark.integration
def test_balance_overview_shows_employee_briefs(client, admin_factory, employee_factory, auth_headers, session):
    from app.models import LeaveBalance

    admin_factory("overview.admin@emids.com", role="admin")
    employee = employee_factory("overview.emp@emids.com", full_name="Overview Person")
    admin_headers = auth_headers("overview.admin@emids.com")

    empty = client.get("/admin/leave-balances?year=2027", headers=admin_headers).json()
    assert empty == {"rows": [], "page": 1, "page_size": 10, "total": 0, "page_count": 0, "year": 2027}

    with session() as db:
        db.add(
            LeaveBalance(
                employee_id=employee.id,
                year=2027,
                annual_credited=Decimal("22.00"),
                annual_utilized=Decimal("3.50"),
                contingency_credited=Decimal("10.00"),
            )
        )
        db.commit()

    rows = client.get("/admin/leave-balances?year=2027", headers=admin_headers).json()
    assert rows["total"] == 1
    row = rows["rows"][0]
    assert float(row["annual_credited"]) == 22.0
    assert row["employee"]["full_name"] == "Overview Person"
    assert row["employee"]["system_role"] == "employee"


@pytest.mark.integration
def test_upsert_creates_and_updates_with_audit(client, admin_factory, employee_factory, auth_headers):
    admin_factory("upsert.admin@emids.com", role="admin")
    employee = employee_factory("upsert.emp@emids.com")
    admin_headers = auth_headers("upsert.admin@emids.com")

    created = client.put(
        f"/admin/leave-balances/{employee.id}/2027",
        json={"annual_credited": 20, "contingency_credited": 10},
        headers=admin_headers,
    )
    assert created.status_code == 200, created.text
    assert float(created.json()["annual_credited"]) == 20.0

    updated = client.put(
        f"/admin/leave-balances/{employee.id}/2027",
        json={"opening_annual": 3},
        headers=admin_headers,
    )
    assert updated.status_code == 200
    assert float(updated.json()["opening_annual"]) == 3.0
    assert float(updated.json()["annual_credited"]) == 20.0

    logs = client.get("/admin/audit-logs?target_type=leave_balance", headers=admin_headers).json()
    actions = [item["action"] for item in logs["rows"]]
    assert actions == ["balance_updated", "balance_created"]
    created_log = logs["rows"][1]
    assert created_log["target_id"] == f"{employee.id}:2027"
    assert created_log["detail_json"]["employee"] == employee.full_name
    assert float(created_log["detail_json"]["annual_credited"]["after"]) == 20.0


@pytest.mark.integration
def test_upsert_never_goes_below_utilized(client, admin_factory, employee_factory, auth_headers, session):
    from app.models import LeaveBalance

    admin_factory("floor.admin@emids.com", role="admin")
    employee = employee_factory("floor.emp@emids.com")
    admin_headers = auth_headers("floor.admin@emids.com")

    with session() as db:
        db.add(
            LeaveBalance(
                employee_id=employee.id,
                year=2027,
                annual_credited=Decimal("22.00"),
                annual_utilized=Decimal("10.00"),
            )
        )
        db.commit()

    too_low = client.put(
        f"/admin/leave-balances/{employee.id}/2027",
        json={"annual_credited": 5},
        headers=admin_headers,
    )
    assert too_low.status_code == 422
    assert "utilized" in too_low.json()["detail"]


@pytest.mark.integration
def test_upsert_unknown_employee_404(client, admin_factory, auth_headers):
    admin_factory("missing.admin@emids.com", role="admin")
    response = client.put(
        "/admin/leave-balances/00000000-0000-0000-0000-000000000000/2027",
        json={"annual_credited": 5},
        headers=auth_headers("missing.admin@emids.com"),
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Employee not found"


@pytest.mark.integration
def test_balance_and_policy_reads_are_admin_only(client, employee_factory, auth_headers):
    employee_factory("floorgate.emp@emids.com")
    headers = auth_headers("floorgate.emp@emids.com")
    assert client.get("/admin/leave-policies", headers=headers).status_code == 403
    assert client.get("/admin/leave-balances", headers=headers).status_code == 403
