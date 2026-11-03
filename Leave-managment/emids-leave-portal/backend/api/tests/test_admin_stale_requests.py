"""Phase 6a: stale (past-dated) pending review with WFH/travel-proxy evidence."""

import pytest


def apply_pending(client, headers, from_date="2027-02-01", to_date="2027-02-05", days=5, **overrides):
    body = {
        "type": "Paid Time Off",
        "from": from_date,
        "to": to_date,
        "days": days,
        "mode": "Full Day",
        "reason": "Stale review check",
        "requestedOn": "2027-01-15",
        **overrides,
    }
    return client.post("/leave-requests", json=body, headers=headers)


@pytest.mark.integration
def test_stale_lists_past_dated_pending_with_context(client, admin_factory, employee_factory, leave_types, auth_headers):
    admin_factory("stale.admin@emids.com", role="admin")
    manager = employee_factory("stale.mgr@emids.com", role="manager")
    employee = employee_factory("stale.emp@emids.com", manager=manager)
    others = employee_factory("stale.other@emids.com")
    emp_headers = auth_headers("stale.emp@emids.com")

    stale_no = apply_pending(client, emp_headers).json()["requestNo"]
    fresh_no = apply_pending(client, emp_headers, from_date="2027-05-01", to_date="2027-05-05").json()["requestNo"]

    assert client.post(
        f"/leave-requests/{stale_no}/cancel", headers=emp_headers
    ).status_code == 200
    pending_no = apply_pending(client, emp_headers).json()["requestNo"]

    approved_no = apply_pending(client, emp_headers, from_date="2027-06-01", to_date="2027-06-05").json()["requestNo"]
    client.post(f"/leave-requests/{approved_no}/decision", json={"decision": "Approved"},
                headers=auth_headers("stale.mgr@emids.com"))

    rows = client.get("/admin/requests/stale?before=2027-03-01", headers=auth_headers("stale.admin@emids.com")).json()["rows"]
    request_numbers = [row["request_no"] for row in rows]
    assert pending_no in request_numbers
    assert fresh_no not in request_numbers
    assert approved_no not in request_numbers

    row = next(r for r in rows if r["request_no"] == pending_no)
    assert row["evidence"]["window"]["from"] == "2027-02-01"
    assert row["evidence"]["nearby_approved"] == []
    _ = others and employee and manager


@pytest.mark.integration
def test_stale_evidence_includes_overlapping_wfh_and_holidays(client, admin_factory, employee_factory, leave_types, auth_headers, session):
    admin_factory("stalewf.admin@emids.com", role="admin")
    manager = employee_factory("stalewf.mgr@emids.com", role="manager")
    employee = employee_factory("stalewf.emp@emids.com", manager=manager)
    emp_headers = auth_headers("stalewf.emp@emids.com")
    mgr_headers = auth_headers("stalewf.mgr@emids.com")

    pending_no = apply_pending(client, emp_headers).json()["requestNo"]

    # approved WFH inside the ±7-day neighborhood of the pending window
    # (the attendance proxy, Q1); overlapping actives can never co-exist
    wfh_no = client.post(
        "/leave-requests",
        json={
            "type": "Work From Home",
            "from": "2027-02-10",
            "to": "2027-02-11",
            "days": 2,
            "mode": "Full Day",
            "reason": "WFH proxy",
            "requestedOn": "2027-01-20",
        },
        headers=emp_headers,
    )
    assert wfh_no.status_code == 201, wfh_no.text
    client.post(f"/leave-requests/{wfh_no.json()['requestNo']}/decision",
                json={"decision": "Approved"}, headers=mgr_headers)

    from datetime import date

    from app.models import Holiday
    with session() as db:
        db.add(
            Holiday(
                country="India",
                location=None,
                year=2027,
                kind="fixed",
                holiday_date=date(2027, 2, 1),
                name="Test Holiday",
            )
        )
        db.commit()

    rows = client.get("/admin/requests/stale?before=2027-03-01", headers=auth_headers("stalewf.admin@emids.com")).json()["rows"]
    row = next(r for r in rows if r["request_no"] == pending_no)
    neighbor_types = [o["leave_type"] for o in row["evidence"]["nearby_approved"]]
    assert "Work From Home" in neighbor_types
    holiday_names = [h["name"] for h in row["evidence"]["holidays"]]
    assert "Test Holiday" in holiday_names


@pytest.mark.integration
def test_stale_review_decides_through_the_existing_routes(client, admin_factory, employee_factory, leave_types, auth_headers):
    admin_factory("staledec.admin@emids.com", role="admin")
    employee_factory("staledec.emp@emids.com")
    emp_headers = auth_headers("staledec.emp@emids.com")

    stale_no = apply_pending(client, emp_headers).json()["requestNo"]
    admin_headers = auth_headers("staledec.admin@emids.com")

    response = client.post(f"/leave-requests/{stale_no}/decision", json={"decision": "Rejected"}, headers=admin_headers)
    assert response.status_code == 200

    statuses = {r["request_no"]: r["status"] for r in client.get("/leave-requests/mine", headers=emp_headers).json()}
    assert statuses[stale_no] == "Rejected"


@pytest.mark.integration
def test_stale_review_puts_a_notification_for_the_worker_and_manager(client, admin_factory, employee_factory, leave_types, auth_headers):
    admin_factory("notify.admin@emids.com", role="admin")
    manager = employee_factory("notify.mgr@emids.com", role="manager")
    employee_factory("notify.emp@emids.com", manager=manager)
    admin_headers = auth_headers("notify.admin@emids.com")

    stale_no = apply_pending(client, auth_headers("notify.emp@emids.com")).json()["requestNo"]
    client.post(f"/leave-requests/{stale_no}/decision", json={"decision": "Approved"}, headers=admin_headers)

    employee_inbox = client.get("/notifications", headers=auth_headers("notify.emp@emids.com")).json()
    assert any(item["kind"] == "request_decided" and item["target_id"] == stale_no for item in employee_inbox)

    manager_inbox = client.get("/notifications", headers=auth_headers("notify.mgr@emids.com")).json()
    # the admin (not the manager) decided, so the manager is told as well
    assert any(item["kind"] == "team_request_decided" and item["target_id"] == stale_no for item in manager_inbox)


@pytest.mark.integration
def test_notifications_require_signin(client):
    assert client.get("/notifications").status_code == 401
