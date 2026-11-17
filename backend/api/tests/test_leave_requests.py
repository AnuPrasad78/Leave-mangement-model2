"""Leave request lifecycle: creation rules, overlap constraints, cancellation.

The overlap rules are enforced by a Postgres GIST exclusion constraint
(`leave_requests_no_active_overlap`) — the most bug-prone business rule in
this API, which is why it gets its own section below.
"""

import pytest

BASE_BODY = {
    "type": "Paid Time Off",
    "from": "2027-03-01",
    "to": "2027-03-05",
    "days": 5,
    "mode": "Full Day",
    "reason": "Family wedding",
    "requestedOn": "2027-02-20",
}


def apply(client, headers, **overrides):
    body = {**BASE_BODY, **overrides}
    return client.post("/leave-requests", json=body, headers=headers)


def mine(client, headers):
    return client.get("/leave-requests/mine", headers=headers).json()


# --------------------------------------------------------------------------
# Creation
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_create_leave_request_returns_request_number(client, employee_factory, leave_types, auth_headers):
    employee_factory("applicant.one@emids.com")

    response = apply(client, auth_headers("applicant.one@emids.com"))

    assert response.status_code == 201
    assert response.json()["requestNo"].startswith("LV-")


@pytest.mark.integration
def test_created_request_is_pending_and_queryable(client, employee_factory, leave_types, auth_headers):
    employee = employee_factory("applicant.two@emids.com")

    headers = auth_headers("applicant.two@emids.com")
    request_no = apply(client, headers).json()["requestNo"]

    rows = mine(client, headers)
    row = next(r for r in rows if r["request_no"] == request_no)
    assert row["status"] == "Pending"
    assert float(row["days"]) == 5.0
    assert row["mode"] == "Full Day"
    assert row["reason"] == "Family wedding"
    assert row["requested_on"] == "2027-02-20"
    assert row["leave_types"] == {"name": "Paid Time Off"}
    assert row["employees"]["full_name"] == employee.full_name
    assert row["employees"]["emp_no"] == employee.emp_no


@pytest.mark.integration
def test_unknown_leave_type_rejected(client, employee_factory, leave_types, auth_headers):
    employee_factory("applicant.three@emids.com")

    response = apply(client, auth_headers("applicant.three@emids.com"), type="Sabbatical")

    assert response.status_code == 404
    assert response.json()["detail"] == "Unknown or inactive leave type"


@pytest.mark.integration
def test_inactive_leave_type_rejected(client, employee_factory, leave_types, session, auth_headers):
    # leave_types seeded all types active; deactivate one
    from app.models import LeaveType

    with session() as db:
        leave = db.query(LeaveType).filter(LeaveType.name == "Voting Leave").one()
        leave.is_active = False
        db.commit()

    employee_factory("applicant.four@emids.com")

    response = apply(client, auth_headers("applicant.four@emids.com"), type="Voting Leave")

    assert response.status_code == 404


@pytest.mark.integration
def test_zero_or_negative_days_rejected(client, employee_factory, leave_types, auth_headers):
    employee_factory("applicant.five@emids.com")
    headers = auth_headers("applicant.five@emids.com")

    assert apply(client, headers, days=0).status_code == 422
    assert apply(client, headers, days=-2).status_code == 422


@pytest.mark.integration
def test_end_before_start_rejected(client, employee_factory, leave_types, auth_headers):
    employee_factory("applicant.six@emids.com")

    response = apply(client, auth_headers("applicant.six@emids.com"), to="2027-02-25")

    assert response.status_code == 422
    assert response.json()["detail"] == "Invalid leave dates or day count"


@pytest.mark.integration
def test_valid_half_day_accepted(client, employee_factory, leave_types, auth_headers):
    employee_factory("half.day@emids.com")

    response = apply(
        client,
        auth_headers("half.day@emids.com"),
        **{
            "from": "2027-03-01",
            "to": "2027-03-01",
            "days": 0.5,
            "mode": "First Half",
        },
    )

    assert response.status_code == 201


@pytest.mark.integration
def test_half_day_spanning_multiple_dates_rejected(client, employee_factory, leave_types, auth_headers):
    employee_factory("half.wrong@emids.com")

    response = apply(
        client,
        auth_headers("half.wrong@emids.com"),
        **{"from": "2027-03-01", "to": "2027-03-02", "days": 0.5, "mode": "First Half"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Half-day requests must be a single 0.5-day date"


@pytest.mark.integration
def test_half_day_with_full_day_count_rejected(client, employee_factory, leave_types, auth_headers):
    employee_factory("half.wrong.two@emids.com")

    response = apply(
        client,
        auth_headers("half.wrong.two@emids.com"),
        **{"from": "2027-03-01", "to": "2027-03-01", "days": 1, "mode": "Second Half"},
    )

    assert response.status_code == 422


# --------------------------------------------------------------------------
# Overlap constraint (GIST exclusion)
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_overlapping_dates_rejected(client, employee_factory, leave_types, auth_headers):
    employee_factory("overlap.me@emids.com")
    headers = auth_headers("overlap.me@emids.com")

    assert apply(client, headers).status_code == 201  # Mar 1–5

    response = apply(client, headers, **{"from": "2027-03-03", "to": "2027-03-08"}, days=6)

    assert response.status_code == 409
    assert response.json()["detail"] == "Dates overlap another active request"


@pytest.mark.integration
def test_overlap_with_approved_request_also_rejected(
    client, employee_factory, leave_types, auth_headers
):
    manager = employee_factory("overlap.mgr@emids.com", role="manager")
    employee_factory("overlap.emp@emids.com", manager=manager)

    employee_headers = auth_headers("overlap.emp@emids.com")
    manager_headers = auth_headers("overlap.mgr@emids.com")

    first = apply(client, employee_headers, **{"from": "2027-04-01", "to": "2027-04-03"}, days=3).json()
    assert (
        client.post(
            f"/leave-requests/{first['requestNo']}/decision",
            json={"decision": "Approved"},
            headers=manager_headers,
        ).status_code
        == 200
    )

    response = apply(
        client, employee_headers, **{"from": "2027-04-03", "to": "2027-04-05"}, days=3
    )

    assert response.status_code == 409


@pytest.mark.integration
def test_adjacent_dates_are_not_overlapping(client, employee_factory, leave_types, auth_headers):
    """End date boundary is inclusive, but starting the day after must be allowed."""
    employee_factory("adjacent.dates@emids.com")
    headers = auth_headers("adjacent.dates@emids.com")

    assert apply(client, headers, **{"from": "2027-05-10", "to": "2027-05-12"}, days=3).status_code == 201

    response = apply(client, headers, **{"from": "2027-05-13", "to": "2027-05-14"}, days=2)

    assert response.status_code == 201


@pytest.mark.integration
def test_different_employees_may_hold_the_same_dates(client, employee_factory, leave_types, auth_headers):
    employee_factory("xyz.corp@emids.com")
    employee_factory("abc.corp@emids.com")

    assert apply(client, auth_headers("xyz.corp@emids.com")).status_code == 201
    assert apply(client, auth_headers("abc.corp@emids.com")).status_code == 201


# --------------------------------------------------------------------------
# My-requests and team listing
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_mine_excludes_other_employees_requests(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("list.mgr@emids.com", role="manager")
    mine_employee = employee_factory("list.me@emids.com", manager=manager)
    peer = employee_factory("list.peer@emids.com", manager=manager)

    my_no = apply(client, auth_headers("list.me@emids.com")).json()["requestNo"]
    peer_no = apply(client, auth_headers("list.peer@emids.com")).json()["requestNo"]

    rows = mine(client, auth_headers("list.me@emids.com"))
    assert [r["request_no"] for r in rows] == [my_no]
    assert peer_no != my_no


@pytest.mark.integration
def test_team_view_returns_direct_reports_requests(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("teamview.mgr@emids.com", role="manager")
    employee_factory("teamview.one@emids.com", manager=manager)
    employee_factory("teamview.two@emids.com", manager=manager)
    outside = employee_factory("teamview.out@emids.com")  # not managed by mgr, not a report

    one_no = apply(client, auth_headers("teamview.one@emids.com")).json()["requestNo"]
    two_no = apply(client, auth_headers("teamview.two@emids.com")).json()["requestNo"]
    apply(client, auth_headers("teamview.out@emids.com"))

    rows = client.get("/leave-requests/team", headers=auth_headers("teamview.mgr@emids.com")).json()
    assert {r["request_no"] for r in rows} == {one_no, two_no}


@pytest.mark.integration
def test_team_view_forbidden_for_plain_employee(client, employee_factory, leave_types, auth_headers):
    employee_factory("forbidden.view@emids.com")

    response = client.get("/leave-requests/team", headers=auth_headers("forbidden.view@emids.com"))

    assert response.status_code == 403
    assert response.json()["detail"] == "Manager access required"


# --------------------------------------------------------------------------
# Cancellation
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_owner_can_cancel_pending_request(client, employee_factory, leave_types, auth_headers):
    employee_factory("canceller.one@emids.com")
    headers = auth_headers("canceller.one@emids.com")

    request_no = apply(client, headers).json()["requestNo"]

    response = client.post(f"/leave-requests/{request_no}/cancel", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert next(r for r in mine(client, headers) if r["request_no"] == request_no)["status"] == "Cancelled"


@pytest.mark.integration
def test_cancelling_frees_the_dates_for_reapplication(client, employee_factory, leave_types, auth_headers):
    employee_factory("canceller.two@emids.com")
    headers = auth_headers("canceller.two@emids.com")

    first = apply(client, headers, **{"from": "2027-06-01", "to": "2027-06-05"}, days=5).json()["requestNo"]
    assert apply(client, headers, **{"from": "2027-06-02", "to": "2027-06-06"}, days=4).status_code == 409

    client.post(f"/leave-requests/{first}/cancel", headers=headers)

    assert apply(client, headers, **{"from": "2027-06-02", "to": "2027-06-06"}, days=4).status_code == 201


@pytest.mark.integration
def test_cannot_cancel_someone_elses_request(client, employee_factory, leave_types, auth_headers):
    employee_factory("owner.one@emids.com")
    employee_factory("meddler.one@emids.com")

    other_no = apply(client, auth_headers("owner.one@emids.com")).json()["requestNo"]

    response = client.post(
        f"/leave-requests/{other_no}/cancel", headers=auth_headers("meddler.one@emids.com")
    )

    assert response.status_code == 404


@pytest.mark.integration
def test_cannot_cancel_twice(client, employee_factory, leave_types, auth_headers):
    employee_factory("canceller.three@emids.com")
    headers = auth_headers("canceller.three@emids.com")

    request_no = apply(client, headers).json()["requestNo"]
    client.post(f"/leave-requests/{request_no}/cancel", headers=headers)

    response = client.post(f"/leave-requests/{request_no}/cancel", headers=headers)

    assert response.status_code == 409
    assert response.json()["detail"] == "Only pending requests can be cancelled"


@pytest.mark.integration
def test_leave_requests_require_authentication(client):
    assert client.post("/leave-requests", json=BASE_BODY).status_code == 401
    assert client.get("/leave-requests/mine").status_code == 401
