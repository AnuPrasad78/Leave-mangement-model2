"""Phase 3: role gating on every /admin/* route."""

import pytest


def admin_routes(employee_id="EM-X"):
    return [
        ("post", "/admin/employees"),
        ("put", f"/admin/employees/{employee_id}"),
        ("post", f"/admin/employees/{employee_id}/deactivate"),
        ("post", f"/admin/employees/{employee_id}/activate"),
        ("get", "/admin/employees"),
        ("get", "/admin/audit-logs"),
    ]


@pytest.mark.integration
def test_employee_is_403_on_every_admin_route(client, employee_factory, auth_headers):
    employee_factory("gate.everyone@emids.com")
    headers = auth_headers("gate.everyone@emids.com")
    for method, path in admin_routes():
        response = client.request(method, path, headers=headers)
        assert response.status_code == 403, (method, path, response.status_code)
        assert response.json()["detail"] == "Admin access required", (method, path)


@pytest.mark.integration
def test_manager_is_403_on_every_admin_route(client, employee_factory, auth_headers):
    employee_factory("gate.mgr@emids.com", role="manager")
    headers = auth_headers("gate.mgr@emids.com")
    for method, path in admin_routes():
        response = client.request(method, path, headers=headers)
        assert response.status_code == 403, (method, path, response.status_code)


@pytest.mark.integration
def test_admin_routes_require_authentication(client):
    for method, path in admin_routes():
        response = client.request(method, path)
        assert response.status_code == 401, (method, path, response.status_code)


@pytest.mark.integration
def test_admin_passes_the_gate(client, employee_factory, auth_headers):
    employee_factory("gate.admin@emids.com", role="admin")
    response = client.get("/admin/employees", headers=auth_headers("gate.admin@emids.com"))
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1  # just the admin's own row exists
    assert body["rows"][0]["system_role"] == "admin"
