"""Roster desk: role retunes via PUT /admin/employees with settled-team guards."""

import pytest


@pytest.mark.integration
def test_admin_promotes_employee_to_manager(client, employee_factory, auth_headers):
    admin = employee_factory("roster.admin@emids.com", role="admin")
    person = employee_factory("roster.person@emids.com", manager=admin)
    headers = auth_headers("roster.admin@emids.com")

    response = client.put(
        f"/admin/employees/{person.id}",
        json={"system_role": "manager"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["system_role"] == "manager"

    # role retunes land in the audit trail like every other admin mutation
    logs = client.get("/admin/audit-logs?action=employee_updated", headers=headers).json()
    assert logs["rows"][0]["detail_json"]["system_role"] == {"before": "employee", "after": "manager"}


@pytest.mark.integration
def test_admin_without_manager_cannot_be_demoted_to_employee(client, admin_factory, employee_factory, auth_headers):
    admin_factory("keeping.admin@emids.com", role="admin")
    peer = admin_factory("nomanager.admin@emids.com", role="admin")  # has no reporting manager
    headers = auth_headers("keeping.admin@emids.com")

    response = client.put(
        f"/admin/employees/{peer.id}",
        json={"system_role": "employee"},
        headers=headers,
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Employees need a reporting manager"


@pytest.mark.integration
def test_demoted_or_retired_manager_with_active_reports_is_blocked(client, employee_factory, auth_headers):
    admin = employee_factory("team.admin@emids.com", role="admin")
    manager = employee_factory("team.manager@emids.com", role="manager")
    employee_factory("team.report@emids.com", manager=manager)
    headers = auth_headers("team.admin@emids.com")

    response = client.put(
        f"/admin/employees/{manager.id}",
        json={"system_role": "employee", "manager_id": admin.id},
        headers=headers,
    )
    assert response.status_code == 409
    assert "active direct reports" in response.json()["detail"]


@pytest.mark.integration
def test_manager_demotion_allowed_once_reports_moved(client, employee_factory, auth_headers):
    admin = employee_factory("moved.admin@emids.com", role="admin")
    manager = employee_factory("moved.manager@emids.com", role="manager")
    report = employee_factory("moved.report@emids.com", manager=manager)
    headers = auth_headers("moved.admin@emids.com")

    moved = client.put(f"/admin/employees/{report.id}", json={"manager_id": admin.id}, headers=headers)
    assert moved.status_code == 200

    response = client.put(
        f"/admin/employees/{manager.id}",
        json={"system_role": "employee", "manager_id": admin.id},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["system_role"] == "employee"


@pytest.mark.integration
def test_admin_cannot_change_own_role(client, admin_factory, auth_headers):
    admin_factory("selfrole.admin@emids.com", role="admin")
    headers = auth_headers("selfrole.admin@emids.com")

    me = client.get("/admin/employees", headers=headers).json()["rows"][0]
    response = client.put(
        f"/admin/employees/{me['id']}",
        json={"system_role": "manager"},
        headers=headers,
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "You cannot change your own role"


@pytest.mark.integration
def test_inactive_manager_cannot_take_reports(client, admin_factory, employee_factory, auth_headers):
    admin_factory("inactive.target.admin@emids.com", role="admin")
    manager = employee_factory("inactive.mgr@emids.com", role="manager")
    person = employee_factory("inactive.person@emids.com")
    headers = auth_headers("inactive.target.admin@emids.com")

    client.post(f"/admin/employees/{manager.id}/deactivate", headers=headers)
    response = client.put(
        f"/admin/employees/{person.id}",
        json={"manager_id": manager.id},
        headers=headers,
    )
    # the roster desk refuses a deactivated manager — PUT must not accept it either
    assert response.status_code == 422
    assert response.json()["detail"] == "That manager is not active"
