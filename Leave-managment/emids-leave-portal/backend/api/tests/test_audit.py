"""Phase 3: the audit trail — mutations append rows, reads filter."""

import pytest
from sqlalchemy import select

from app.models import AuditLog


@pytest.mark.integration
def test_create_update_deactivate_append_audit_rows(client, employee_factory, auth_headers):
    admin = employee_factory("trail.admin@emids.com", role="admin")
    headers = auth_headers("trail.admin@emids.com")

    created = client.post(
        "/admin/employees",
        json={"full_name": "Trail Person", "email": "trail.person@emids.com"},
        headers=headers,
    ).json()["employee"]
    client.put(
        f"/admin/employees/{created['id']}",
        json={"job_title": "Consultant"},
        headers=headers,
    )
    client.post(f"/admin/employees/{created['id']}/deactivate", headers=headers)
    client.post(f"/admin/employees/{created['id']}/activate", headers=headers)

    logs = client.get("/admin/audit-logs", headers=headers).json()
    actions = [item["action"] for item in logs["rows"]]
    assert actions == ["employee_activated", "employee_deactivated", "employee_updated", "employee_created"]
    assert logs["total"] == 4
    assert all(item["actor_employee_id"] == admin.id for item in logs["rows"])

    updated = next(item for item in logs["rows"] if item["action"] == "employee_updated")
    assert updated["target_type"] == "employee"
    assert updated["target_id"] == created["id"]
    assert updated["detail_json"]["job_title"] == {"before": None, "after": "Consultant"}


@pytest.mark.integration
def test_filter_by_action_and_target_type(client, employee_factory, auth_headers):
    employee_factory("filter.admin@emids.com", role="admin")
    headers = auth_headers("filter.admin@emids.com")
    first = client.post(
        "/admin/employees", json={"full_name": "Filter A", "email": "filter.a@emids.com"}, headers=headers
    ).json()["employee"]
    client.post(
        "/admin/employees", json={"full_name": "Filter B", "email": "filter.b@emids.com"}, headers=headers
    )

    only_jobs = client.get(
        "/admin/audit-logs?action=employee_updated", headers=headers
    ).json()
    assert only_jobs["total"] == 0

    created = client.get(
        "/admin/audit-logs?action=employee_created&target_id=" + first["id"], headers=headers
    ).json()
    assert created["total"] == 1
    assert created["rows"][0]["detail_json"]["email"] == "filter.a@emids.com"


@pytest.mark.integration
def test_admin_route_access_writes_no_rows_for_403(client, employee_factory, auth_headers):
    employee_factory("trailno.admin@emids.com", role="admin")
    employee_factory("trailno.emp@emids.com")
    employee_headers = auth_headers("trailno.emp@emids.com")
    client.get("/admin/audit-logs", headers=employee_headers)  # 403
    admin_headers = auth_headers("trailno.admin@emids.com")
    assert client.get("/admin/audit-logs", headers=admin_headers).json()["total"] == 0
