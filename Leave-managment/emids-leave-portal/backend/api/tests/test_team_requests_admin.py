"""Phase 2: admin visibility in /leave-requests/team and the seeded admin login."""

import pytest


def apply(client, headers, **overrides):
    body = {
        "type": "Work From Home",  # no balance side effects for this phase
        "from": "2027-03-01",
        "to": "2027-03-03",
        "days": 3,
        "mode": "Full Day",
        "reason": "Team visibility check",
        "requestedOn": "2027-02-20",
        **overrides,
    }
    return client.post("/leave-requests", json=body, headers=headers)


@pytest.mark.integration
def test_admin_sees_org_wide_requests(client, employee_factory, leave_types, auth_headers):
    emp_a = employee_factory("teamv.a@emids.com")
    emp_b = employee_factory("teamv.b@emids.com")
    manager = employee_factory("teamv.mgr@emids.com", role="manager")
    employee_factory("teamv.report@emids.com", manager=manager)
    admin = employee_factory("teamv.admin@emids.com", role="admin")

    apply(client, auth_headers("teamv.a@emids.com"))
    apply(client, auth_headers("teamv.b@emids.com"))
    apply(client, auth_headers("teamv.report@emids.com"))
    apply(client, auth_headers("teamv.admin@emids.com"))

    admin_rows = client.get("/leave-requests/team", headers=auth_headers("teamv.admin@emids.com")).json()
    employee_ids = {row["employee_id"] for row in admin_rows}
    assert {emp_a.id, emp_b.id, admin.id} <= employee_ids


@pytest.mark.integration
def test_manager_still_sees_reports_only(client, employee_factory, leave_types, auth_headers):
    employee_factory("manager-only.a@emids.com")
    manager = employee_factory("manager-only.mgr@emids.com", role="manager")
    employee_factory("manager-only.report@emids.com", manager=manager)

    apply(client, auth_headers("manager-only.a@emids.com"))
    report_no = apply(client, auth_headers("manager-only.report@emids.com")).json()["requestNo"]

    rows = client.get("/leave-requests/team", headers=auth_headers("manager-only.mgr@emids.com")).json()
    assert [row["request_no"] for row in rows] == [report_no]


@pytest.mark.integration
def test_employee_cannot_list_team(client, employee_factory, auth_headers):
    employee_factory("team-deny@emids.com")
    response = client.get("/leave-requests/team", headers=auth_headers("team-deny@emids.com"))
    assert response.status_code == 403
    assert response.json()["detail"] == "Manager access required"


@pytest.mark.integration
def test_admin_team_pagination_defaults_and_slices(client, employee_factory, leave_types, auth_headers):
    employee_factory("page.a@emids.com")
    manager = employee_factory("page.mgr@emids.com", role="manager")
    employee_factory("page.report@emids.com", manager=manager)
    employee_factory("page.admin@emids.com", role="admin")

    apply(client, auth_headers("page.a@emids.com"))
    first = apply(client, auth_headers("page.report@emids.com")).json()["requestNo"]

    rows = client.get("/leave-requests/team", headers=auth_headers("page.admin@emids.com")).json()
    sliced = client.get(
        "/leave-requests/team?limit=1&offset=1", headers=auth_headers("page.admin@emids.com")
    ).json()
    assert len(rows) == 2  # default limit 100 shows everything
    assert len(sliced) == 1
    assert sliced[0]["request_no"] != first  # offset moved past the head


@pytest.mark.unit
def test_seed_data_declares_the_admin_login():
    from app.seed_data import ADMIN_EMAIL, EMPLOYEES

    admin_entries = [entry for entry in EMPLOYEES if entry.get("system_role", "employee") == "admin"]
    assert len(admin_entries) == 1
    assert admin_entries[0]["email"] == ADMIN_EMAIL == "admin@emids.com"


@pytest.mark.integration
def test_seeded_admin_login_is_idempotent(session, monkeypatch):
    """Running seed_demo_data twice leaves exactly one admin login/profile."""
    from app import seed as seed_module
    from sqlalchemy import func, select

    from app.models import Employee, User

    monkeypatch.setenv("DEMO_PASSWORD", "TestPassword123!")
    settings = seed_module.settings
    settings.DEMO_PASSWORD = "TestPassword123!"
    try:
        seed_module.seed_demo_data()
        seed_module.seed_demo_data()
    finally:
        settings.DEMO_PASSWORD = None

    with session() as db:
        count = db.scalar(select(func.count()).select_from(User).where(User.email == "admin@emids.com"))
        profile = db.scalar(
            select(Employee).where(
                Employee.email == "admin@emids.com", Employee.system_role == "admin"
            )
        )
        assert count == 1
        assert profile is not None
