"""Phase 3: admin employee CRUD, deactivation semantics, audit entries."""

from datetime import date

import pytest
from sqlalchemy import select

from app.leave_policy import ANNUAL_DAYS_PER_YEAR, CONTINGENCY_DAYS_PER_YEAR, prorated_annual
from app.models import LeaveRequest


@pytest.mark.integration
def test_admin_creates_employee_with_generated_password(client, admin_factory, auth_headers):
    admin_factory("empcr.admin@emids.com", role="admin")
    body = {
        "full_name": "Nikhil Raut",
        "email": "empcr.new@emids.com",
        "job_title": "Consultant",
        "system_role": "employee",
    }
    response = client.post(
        "/admin/employees", json=body, headers=auth_headers("empcr.admin@emids.com")
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["employee"]["full_name"] == "Nikhil Raut"
    assert payload["employee"]["is_active"] is True
    assert payload["employee"]["emp_no"].startswith("EM-")
    assert len(payload["temporary_password"]) >= 8  # returned once, for the admin to share

    assert client.post(
        "/auth/login",
        json={"email": "empcr.new@emids.com", "password": payload["temporary_password"]},
    ).status_code == 200


@pytest.mark.integration
def test_admin_creates_employee_with_provided_password(client, admin_factory, auth_headers):
    admin_factory("empcp.admin@emids.com", role="admin")
    body = {
        "full_name": "Provided Password Person",
        "email": "empcp.new@emids.com",
        "system_role": "manager",
        "temporary_password": "Choosable09!",
    }
    response = client.post(
        "/admin/employees", json=body, headers=auth_headers("empcp.admin@emids.com")
    )
    assert response.status_code == 201
    assert client.post(
        "/auth/login", json={"email": "empcp.new@emids.com", "password": "Choosable09!"}
    ).status_code == 200


@pytest.mark.integration
@pytest.mark.parametrize(
    ("month_day", "expected"),
    [
        ("01-01", 22.0),
        ("07-01", 11.0),
        ("12-31", 2.0),
    ],
)
def test_create_credits_the_current_years_balance(client, admin_factory, auth_headers, month_day, expected):
    """Every created employee owns a LeaveBalance for the current year, with
    credits computed by leave_policy from their DOJ — never hardcoded."""
    admin_factory("balcre.admin@emids.com", role="admin")
    this_year = date.today().year

    email = "balcre.new@emids.com"
    response = client.post(
        "/admin/employees",
        json={"full_name": "Balanced Person", "email": email, "doj": f"{this_year}-{month_day}"},
        headers=auth_headers("balcre.admin@emids.com"),
    )
    assert response.status_code == 201, response.text
    temp_password = response.json()["temporary_password"]
    headers = {
        "Authorization": "Bearer "
        + client.post(
            "/auth/login",
            json={"email": email, "password": temp_password},
        ).json()["access_token"],
    }

    body = client.get("/balances/me", headers=headers).json()
    assert body["year"] == this_year
    assert float(body["annual_credited"]) == expected
    assert float(body["contingency_credited"]) == 10.0
    assert float(body["annual_cap"]) == float(ANNUAL_DAYS_PER_YEAR)
    assert float(body["contingency_cap"]) == float(CONTINGENCY_DAYS_PER_YEAR)
    assert float(body["annual_utilized"]) == 0.0


@pytest.mark.integration
def test_create_credits_full_year_for_doj_in_a_previous_year(client, admin_factory, auth_headers):
    admin_factory("balprev.admin@emids.com", role="admin")
    this_year = date.today().year
    email = "balprev.new@emids.com"
    response = client.post(
        "/admin/employees",
        json={"full_name": "Old Joiner", "email": email, "doj": f"{this_year - 1}-06-02"},
        headers=auth_headers("balprev.admin@emids.com"),
    )
    assert response.status_code == 201
    temp_password = response.json()["temporary_password"]
    headers = {
        "Authorization": "Bearer "
        + client.post(
            "/auth/login",
            json={"email": email, "password": temp_password},
        ).json()["access_token"],
    }
    assert float(client.get("/balances/me", headers=headers).json()["annual_credited"]) == 22.0


@pytest.mark.integration
def test_employee_created_audit_records_the_balance(client, admin_factory, auth_headers, session):
    from app.models import AuditLog

    admin_factory("audbal.admin@emids.com", role="admin")
    response = client.post(
        "/admin/employees",
        json={"full_name": "Audit Balanced", "email": "audbal.new@emids.com"},
        headers=auth_headers("audbal.admin@emids.com"),
    )
    assert response.status_code == 201

    with session() as db:
        log = db.scalar(select(AuditLog).where(AuditLog.action == "employee_created"))
        balance_detail = log.detail_json["leave_balance"]
    assert balance_detail["year"] == date.today().year
    assert balance_detail["annual_credited"] == 22.0  # _jsonable floats, not raw Decimals
    assert balance_detail["contingency_credited"] == 10.0


@pytest.mark.integration
def test_create_rejects_duplicate_email(client, admin_factory, auth_headers):
    admin_factory("dupemail.admin@emids.com", role="admin")
    body = {"full_name": "First", "email": "dupemail.once@emids.com"}
    assert client.post(
        "/admin/employees", json=body, headers=auth_headers("dupemail.admin@emids.com")
    ).status_code == 201

    clash = client.post(
        "/admin/employees",
        json={"full_name": "Second", "email": "dupemail.once@emids.com"},
        headers=auth_headers("dupemail.admin@emids.com"),
    )
    assert clash.status_code == 409
    assert clash.json()["detail"] == "Email already registered"


@pytest.mark.integration
def test_create_rejects_unknown_manager_and_admin_role(client, admin_factory, auth_headers):
    admin_factory("badref.admin@emids.com", role="admin")
    headers = auth_headers("badref.admin@emids.com")

    no_manager = client.post(
        "/admin/employees",
        json={
            "full_name": "No Manager",
            "email": "badref.a@emids.com",
            "manager_id": "00000000-0000-0000-0000-000000000000",
        },
        headers=headers,
    )
    assert no_manager.status_code == 404
    assert no_manager.json()["detail"] == "Manager not found"

    admin_role = client.post(
        "/admin/employees",
        json={"full_name": "Admin Role", "email": "badref.b@emids.com", "system_role": "admin"},
        headers=headers,
    )
    assert admin_role.status_code == 422


@pytest.mark.integration
def test_update_edits_fields_and_reassigns_manager(client, admin_factory, employee_factory, auth_headers, session):
    admin_factory("edit.admin@emids.com", role="admin")
    employee = employee_factory("edit.victim@emids.com", full_name="Original Name")
    manager = employee_factory("edit.mgr@emids.com", role="manager")
    headers = auth_headers("edit.admin@emids.com")

    response = client.put(
        f"/admin/employees/{employee.id}",
        json={"full_name": "Renamed Person", "job_title": "Senior Consultant", "manager_id": manager.id},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["full_name"] == "Renamed Person"
    assert payload["manager_id"] == manager.id

    with session() as db:
        row = db.get(LeaveRequest, 0)  # engine reachable; no exceptions raised
    _ = row


@pytest.mark.integration
def test_update_cannot_make_employee_their_own_manager(client, admin_factory, employee_factory, auth_headers):
    admin_factory("selfmgr.admin@emids.com", role="admin")
    employee = employee_factory("selfmgr.emp@emids.com")
    headers = auth_headers("selfmgr.admin@emids.com")

    response = client.put(
        f"/admin/employees/{employee.id}", json={"manager_id": employee.id}, headers=headers
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "An employee cannot be their own manager"


@pytest.mark.integration
def test_update_email_syncs_the_login_user(client, admin_factory, employee_factory, auth_headers):
    admin_factory("mailsync.admin@emids.com", role="admin")
    employee_factory("mailsync.emp@emids.com")
    headers = auth_headers("mailsync.admin@emids.com")

    profile = client.get("/auth/me", headers=auth_headers("mailsync.emp@emids.com")).json()
    response = client.put(
        f"/admin/employees/{profile['id']}", json={"email": "mailsync.renamed@emids.com"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["email"] == "mailsync.renamed@emids.com"
    assert client.post(
        "/auth/login", json={"email": "mailsync.renamed@emids.com", "password": "TestPassword123!"}
    ).status_code == 200
    assert client.post(
        "/auth/login", json={"email": "mailsync.emp@emids.com", "password": "TestPassword123!"}
    ).status_code == 401


@pytest.mark.integration
def test_deactivation_blocks_login_but_preserves_history(client, admin_factory, employee_factory, leave_types, auth_headers, session):
    admin_factory("deact.admin@emids.com", role="admin")
    manager = employee_factory("deact.mgr@emids.com", role="manager")
    employee = employee_factory("deact.emp@emids.com", manager=manager)
    emp_headers = auth_headers("deact.emp@emids.com")
    request_no = client.post(
        "/leave-requests",
        json={
            "type": "Work From Home",
            "from": "2027-03-01",
            "to": "2027-03-03",
            "days": 3,
            "mode": "Full Day",
            "reason": "History check",
            "requestedOn": "2027-02-20",
        },
        headers=emp_headers,
    ).json()["requestNo"]

    headers = auth_headers("deact.admin@emids.com")
    assert client.post(f"/admin/employees/{employee.id}/deactivate", headers=headers).status_code == 200

    # blocked at login...
    assert client.post(
        "/auth/login", json={"email": "deact.emp@emids.com", "password": "TestPassword123!"}
    ).status_code == 401
    # ...and live tokens die on next use
    assert client.get("/auth/me", headers=emp_headers).status_code == 401

    with session() as db:
        row = db.scalar(select(LeaveRequest).where(LeaveRequest.request_no == request_no))
        assert row is not None  # history preserved, no cascade delete


@pytest.mark.integration
def test_reactivation_restores_login(client, admin_factory, employee_factory, auth_headers):
    admin_factory("react.admin@emids.com", role="admin")
    employee_factory("react.emp@emids.com")
    headers = auth_headers("react.admin@emids.com")
    employee_id = client.get("/auth/me", headers=auth_headers("react.emp@emids.com")).json()["id"]

    assert client.post(f"/admin/employees/{employee_id}/deactivate", headers=headers).status_code == 200
    assert client.post(
        "/auth/login", json={"email": "react.emp@emids.com", "password": "TestPassword123!"}
    ).status_code == 401
    assert client.post(f"/admin/employees/{employee_id}/activate", headers=headers).status_code == 200
    assert client.post(
        "/auth/login", json={"email": "react.emp@emids.com", "password": "TestPassword123!"}
    ).status_code == 200


@pytest.mark.integration
def test_list_searches_name_email_and_emp_no(client, admin_factory, employee_factory, auth_headers):
    admin_factory("search.admin@emids.com", role="admin")
    employee_factory("search.vikram@emids.com", full_name="Vikram Deshmukh")
    employee_factory("search.meera@emids.com", full_name="Meera Krishnan")
    headers = auth_headers("search.admin@emids.com")

    by_name = client.get("/admin/employees?search=Vikram", headers=headers).json()
    assert by_name["total"] == 1 and by_name["rows"][0]["full_name"] == "Vikram Deshmukh"

    by_email = client.get("/admin/employees?search=vikram@emids", headers=headers).json()
    assert by_email["total"] == 1

    emp_no = by_name["rows"][0]["emp_no"]
    assert client.get(f"/admin/employees?search={emp_no}", headers=headers).json()["total"] == 1
