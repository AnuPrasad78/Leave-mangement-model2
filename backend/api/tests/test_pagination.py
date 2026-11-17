"""The offset-pagination matrix: one envelope, every converted endpoint.
Covers page slicing (first/next/last/off-range/empty), param validation,
totals after filters, search+filter combinations, the sort allowlist and the
RBAC gate that runs before any paging happens."""

from datetime import date, timedelta
from decimal import Decimal

import pytest


def apply(client, headers, *, from_date=None, to_date=None, days=2):
    start = from_date or (date.today() + timedelta(days=70))
    end = to_date or (start + timedelta(days=days - 1))
    response = client.post(
        "/leave-requests",
        json={"type": "Paid Time Off", "from": str(start), "to": str(end),
              "days": days, "mode": "Full Day", "reason": "pager-test",
              "requested_on": str(date.today())},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response


# --- /admin/employees ----------------------------------------------------------


def _seed_people(employee_factory, count=5):
    for index in range(count):
        employee_factory(
            f"pager.p{index}@emids.com",
            full_name=f"Pager Person {index:02d}",
            doj=f"2024-0{index + 1}-10" if index < 4 else None,
        )


def test_employees_first_second_and_last_page(client, admin_factory, employee_factory, auth_headers):
    admin_factory("pager.admin@emids.com", role="admin")
    _seed_people(employee_factory)
    headers = auth_headers("pager.admin@emids.com")

    first = client.get("/admin/employees?page=1&page_size=2", headers=headers).json()
    assert first["page"] == 1 and first["page_size"] == 2
    assert first["total"] == 6 and first["page_count"] == 3
    assert [row["full_name"] for row in first["rows"]] == ["Pager Admin", "Pager Person 00"]

    second = client.get("/admin/employees?page=2&page_size=2", headers=headers).json()
    assert [row["full_name"] for row in second["rows"]] == ["Pager Person 01", "Pager Person 02"]

    last = client.get("/admin/employees?page=3&page_size=2", headers=headers).json()
    assert [row["full_name"] for row in last["rows"]] == ["Pager Person 03", "Pager Person 04"]

    beyond = client.get("/admin/employees?page=9&page_size=2", headers=headers).json()
    assert beyond["rows"] == []
    assert beyond["total"] == 6 and beyond["page_count"] == 3


def test_employees_empty_dataset(client, admin_factory, auth_headers):
    admin_factory("pager.empty@emids.com", role="admin")
    headers = auth_headers("pager.empty@emids.com")
    # the admin's own row exists; search for something that matches nobody
    body = client.get("/admin/employees?search=nobody-matches", headers=headers).json()
    assert body == {"rows": [], "page": 1, "page_size": 10, "total": 0, "page_count": 0}


@pytest.mark.parametrize(
    "query",
    ["page=0", "page=-1", "page_size=0", "page_size=101", "sort=salary", "order=upward"],
)
def test_employees_rejects_invalid_paging_params(client, admin_factory, auth_headers, query):
    admin_factory("pager.badparams@emids.com", role="admin")
    headers = auth_headers("pager.badparams@emids.com")
    response = client.get(f"/admin/employees?{query}", headers=headers)
    assert response.status_code == 422


def test_employees_filters_then_counts(client, admin_factory, employee_factory, auth_headers):
    admin_factory("pager.filters@emids.com", role="admin")
    employee_factory("pager.e@emids.com", full_name="Filter Employee")
    employee_factory("pager.m@emids.com", full_name="Filter Manager", role="manager")
    headers = auth_headers("pager.filters@emids.com")

    managers = client.get("/admin/employees?role=manager&page_size=100", headers=headers).json()
    assert managers["total"] == 1
    assert managers["rows"][0]["full_name"] == "Filter Manager"

    off_page = client.get("/admin/employees?role=manager&page=99&page_size=2", headers=headers).json()
    assert off_page["total"] == 1 and off_page["rows"] == []

    search_and_role = client.get(
        "/admin/employees?role=employee&search=Filter&page_size=100", headers=headers
    ).json()
    assert search_and_role["total"] == 1
    assert search_and_role["rows"][0]["system_role"] == "employee"


def test_employees_sort_allowlist_and_direction(client, admin_factory, employee_factory, auth_headers):
    admin_factory("pager.sort@emids.com", role="admin")
    employee_factory("pager.doja@emids.com", full_name="Sort A", doj="2023-01-10")
    employee_factory("pager.dojb@emids.com", full_name="Sort B", doj="2025-05-10")
    employee_factory("pager.dojc@emids.com", full_name="Sort C", doj=None)  # nulls sort last
    headers = auth_headers("pager.sort@emids.com")

    newest_first = client.get("/admin/employees?sort=doj&order=desc", headers=headers).json()
    named = [row["full_name"] for row in newest_first["rows"] if row["full_name"].startswith("Sort")]
    assert named == ["Sort B", "Sort A", "Sort C"]  # newest doj first, nulls last
    dojs = [row["doj"] for row in newest_first["rows"]]
    assert dojs == sorted(dojs, key=lambda value: value or "", reverse=True)

    by_number = client.get("/admin/employees?sort=emp_no&order=asc&page_size=100", headers=headers).json()
    numbers = [row["emp_no"] for row in by_number["rows"]]
    assert numbers == sorted(numbers)


def test_employees_rows_carry_manager_name(client, admin_factory, employee_factory, auth_headers):
    admin_factory("pager.mgrname@emids.com", role="admin")
    manager = employee_factory("pager.boss@emids.com", full_name="Pager Boss", role="manager")
    employee_factory("pager.direct@emids.com", full_name="Pager Direct", manager=manager)
    headers = auth_headers("pager.mgrname@emids.com")

    body = client.get("/admin/employees?search=Pager Direct", headers=headers).json()
    assert body["rows"][0]["manager_name"] == "Pager Boss"


def test_employees_rbac_blocks_pagination(client, admin_factory, employee_factory, auth_headers):
    admin_factory("pager.gate.admin@emids.com", role="admin")
    employee_factory("pager.gate.emp@emids.com")
    response = client.get(
        "/admin/employees?page=1&page_size=10", headers=auth_headers("pager.gate.emp@emids.com")
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


# --- /admin/audit-logs ---------------------------------------------------------


def test_audit_logs_pages_with_filters(client, admin_factory, auth_headers):
    admin_factory("audit.page.admin@emids.com", role="admin")
    headers = auth_headers("audit.page.admin@emids.com")

    for index in range(3):  # each API create appends one employee_created audit row
        response = client.post(
            "/admin/employees",
            json={"full_name": f"Audit M{index}", "email": f"audit.page.m{index}@emids.com", "system_role": "employee"},
            headers=headers,
        )
        assert response.status_code == 201, response.text

    page_one = client.get(
        "/admin/audit-logs?action=employee_created&page=1&page_size=2", headers=headers
    ).json()
    assert page_one["total"] == 3 and page_one["page_count"] == 2
    assert len(page_one["rows"]) == 2

    page_two = client.get(
        "/admin/audit-logs?action=employee_created&page=2&page_size=2", headers=headers
    ).json()
    assert len(page_two["rows"]) == 1
    # descending order stays stable: page 2 does not repeat page 1
    assert {row["id"] for row in page_one["rows"]}.isdisjoint({row["id"] for row in page_two["rows"]})


# --- /admin/leave-balances -----------------------------------------------------


def test_leave_balances_pages_and_counts(client, admin_factory, employee_factory, auth_headers, session):
    from app.models import LeaveBalance

    admin_factory("balance.page.admin@emids.com", role="admin")
    for index in range(3):
        employee = employee_factory(f"balance.page{index}@emids.com", full_name=f"Balance Person {index}")
        with session() as db:
            db.add(LeaveBalance(employee_id=employee.id, year=2027, annual_credited=Decimal("22.00")))
            db.commit()
    headers = auth_headers("balance.page.admin@emids.com")

    page_one = client.get("/admin/leave-balances?year=2027&page=1&page_size=2", headers=headers).json()
    assert page_one["total"] == 3 and page_one["page_count"] == 2 and page_one["year"] == 2027
    assert len(page_one["rows"]) == 2

    last = client.get("/admin/leave-balances?year=2027&page=2&page_size=2", headers=headers).json()
    assert len(last["rows"]) == 1


# --- /leave-requests/team ------------------------------------------------------


def _seed_team(client, auth_headers):
    apply(client, auth_headers("team.env.a@emids.com"))
    return apply(client, auth_headers("team.env.report@emids.com"))


def test_team_paged_envelope_and_pending_filter(client, employee_factory, auth_headers, leave_types):
    employee_factory("team.env.a@emids.com")
    manager = employee_factory("team.env.mgr@emids.com", role="manager")
    report = employee_factory("team.env.report@emids.com", manager=manager)
    employee_factory("team.env.admin@emids.com", role="admin")

    seeded = _seed_team(client, auth_headers)

    default_rows = client.get(
        "/leave-requests/team", headers=auth_headers("team.env.admin@emids.com")
    ).json()
    # Legacy full pull: a raw array covering the whole org.
    assert isinstance(default_rows, list) and len(default_rows) == 2
    assert seeded.json()["requestNo"] in [row["request_no"] for row in default_rows]

    paged = client.get(
        "/leave-requests/team?page=1&page_size=1", headers=auth_headers("team.env.admin@emids.com")
    ).json()
    assert paged["total"] == 2 and paged["page"] == 1 and paged["page_count"] == 2
    assert paged["rows"][0]["request_no"] == default_rows[0]["request_no"]

    pending_only = client.get(
        "/leave-requests/team?status=Pending", headers=auth_headers("team.env.admin@emids.com")
    ).json()
    assert isinstance(pending_only, list) and pending_only[0]["status"] == "Pending"

    manager_scope = client.get(
        "/leave-requests/team?page=1&page_size=10", headers=auth_headers("team.env.mgr@emids.com")
    ).json()
    assert manager_scope["total"] == 1
    assert manager_scope["rows"][0]["employee_id"] == report.id


def test_team_rejects_bad_status_filter_and_stays_rbac_gated(client, employee_factory, auth_headers):
    employee_factory("team.bad.a@emids.com")
    employee_factory("team.bad.mgr@emids.com", role="manager")

    bad_status = client.get(
        "/leave-requests/team?status=Escalated", headers=auth_headers("team.bad.mgr@emids.com")
    )
    assert bad_status.status_code == 422

    employee_view = client.get(
        "/leave-requests/team?page=1&page_size=10", headers=auth_headers("team.bad.a@emids.com")
    )
    assert employee_view.status_code == 403
    assert employee_view.json()["detail"] == "Manager access required"
