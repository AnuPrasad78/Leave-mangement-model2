"""Approval workflow: who may decide, how balance pools move, and rollback guarantees."""

from datetime import date
from decimal import Decimal

import pytest


def apply(client, headers, **overrides):
    body = {
        "type": "Paid Time Off",
        "from": "2027-03-01",
        "to": "2027-03-05",
        "days": 5,
        "mode": "Full Day",
        "reason": "Project release",
        "requestedOn": "2027-02-20",
        **overrides,
    }
    return client.post("/leave-requests", json=body, headers=headers)


def decide(client, headers, request_no, decision="Approved"):
    return client.post(
        f"/leave-requests/{request_no}/decision", json={"decision": decision}, headers=headers
    )


def balance_of(client, headers):
    return client.get("/balances/me", headers=headers).json()


def mine(client, headers):
    return client.get("/leave-requests/mine", headers=headers).json()


# --------------------------------------------------------------------------
# Happy paths
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_manager_approval_creates_and_debits_pools(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("approve.mgr@emids.com", role="manager")
    employee_factory("approve.emp@emids.com", manager=manager)
    emp_headers = auth_headers("approve.emp@emids.com")
    mgr_headers = auth_headers("approve.mgr@emids.com")

    assert balance_of(client, emp_headers) is None  # nothing yet

    request_no = apply(client, emp_headers).json()["requestNo"]
    assert decide(client, mgr_headers, request_no, "Approved").status_code == 200

    balance = balance_of(client, emp_headers)
    assert balance["year"] == 2027
    # Numeric columns arrive JSON-serialized as strings (pydantic Any-serializer on a dict payload)
    assert float(balance["annual_credited"]) == 18.0
    assert float(balance["annual_utilized"]) == 5.0
    assert float(balance["contingency_credited"]) == 10.0
    assert float(balance["contingency_utilized"]) == 0.0

    row = next(r for r in mine(client, emp_headers) if r["request_no"] == request_no)
    assert row["status"] == "Approved"


@pytest.mark.integration
def test_approval_recounts_existing_pending_request_with_fixed_holiday(
    client, employee_factory, leave_types, auth_headers, make_holiday, session
):
    from app.models import Employee, LeaveRequest

    manager = employee_factory("holiday.approve.mgr@emids.com", role="manager")
    employee = employee_factory("holiday.approve.emp@emids.com", manager=manager)
    with session() as db:
        db.get(Employee, employee.id).location = "Bangalore, IN"
        db.commit()
    make_holiday(kind="fixed", holiday_date=date(2027, 3, 3), name="Fixed", location="Bangalore")

    employee_headers = auth_headers("holiday.approve.emp@emids.com")
    manager_headers = auth_headers("holiday.approve.mgr@emids.com")
    request_no = apply(client, employee_headers).json()["requestNo"]
    with session() as db:
        request = db.query(LeaveRequest).filter(LeaveRequest.request_no == request_no).one()
        request.days = Decimal("5")
        db.commit()

    assert decide(client, manager_headers, request_no).status_code == 200
    assert float(balance_of(client, employee_headers)["annual_utilized"]) == 4.0
    row = next(row for row in mine(client, employee_headers) if row["request_no"] == request_no)
    assert float(row["days"]) == 4.0


@pytest.mark.integration
def test_rejection_does_not_touch_balances(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("reject.mgr@emids.com", role="manager")
    employee_factory("reject.emp@emids.com", manager=manager)
    emp_headers = auth_headers("reject.emp@emids.com")
    mgr_headers = auth_headers("reject.mgr@emids.com")

    request_no = apply(client, emp_headers).json()["requestNo"]
    assert decide(client, mgr_headers, request_no, "Rejected").status_code == 200

    assert balance_of(client, emp_headers) is None
    assert next(r for r in mine(client, emp_headers))["status"] == "Rejected"


@pytest.mark.integration
def test_contingency_bucket_draws_from_contingency_pool(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("con.mgr@emids.com", role="manager")
    employee_factory("con.emp@emids.com", manager=manager)
    emp_headers = auth_headers("con.emp@emids.com")
    mgr_headers = auth_headers("con.mgr@emids.com")

    request_no = apply(
        client,
        emp_headers,
        type="Contingency Bucket",
        **{"from": "2027-03-01", "to": "2027-03-02"},
        days=2,
    ).json()["requestNo"]
    assert decide(client, mgr_headers, request_no, "Approved").status_code == 200

    balance = balance_of(client, emp_headers)
    assert float(balance["contingency_utilized"]) == 2.0
    assert float(balance["annual_utilized"]) == 0.0


# --------------------------------------------------------------------------
# Insufficient balance
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_insufficient_annual_balance_rejects_and_keeps_pending(
    client, employee_factory, leave_types, session, auth_headers
):
    from app.models import LeaveBalance

    manager = employee_factory("broke.mgr@emids.com", role="manager")
    employee = employee_factory("broke.emp@emids.com", manager=manager)

    # Exhaust the annual pool for 2027 ahead of time
    with session() as db:
        db.add(
            LeaveBalance(
                employee_id=employee.id,
                year=2027,
                opening_annual=Decimal("0"),
                annual_credited=Decimal("18"),
                annual_utilized=Decimal("18"),
                contingency_credited=Decimal("10"),
                contingency_utilized=Decimal("10"),
            )
        )
        db.commit()

    emp_headers = auth_headers("broke.emp@emids.com")
    mgr_headers = auth_headers("broke.mgr@emids.com")

    request_no = apply(client, emp_headers).json()["requestNo"]
    response = decide(client, mgr_headers, request_no, "Approved")

    assert response.status_code == 409
    assert response.json()["detail"] == "Insufficient annual leave balance"
    assert next(r for r in mine(client, emp_headers))["status"] == "Pending"  # unchanged


@pytest.mark.integration
def test_insufficient_contingency_balance_rejects_and_keeps_pending(
    client, employee_factory, leave_types, session, auth_headers
):
    from app.models import LeaveBalance

    manager = employee_factory("concap.mgr@emids.com", role="manager")
    employee = employee_factory("concap.emp@emids.com", manager=manager)

    with session() as db:
        db.add(
            LeaveBalance(
                employee_id=employee.id,
                year=2027,
                contingency_credited=Decimal("10"),
                contingency_utilized=Decimal("10"),
            )
        )
        db.commit()

    emp_headers = auth_headers("concap.emp@emids.com")
    mgr_headers = auth_headers("concap.mgr@emids.com")

    request_no = apply(
        client, emp_headers, type="Contingency Bucket", days=1,
        **{"from": "2027-03-01", "to": "2027-03-01"},
    ).json()["requestNo"]
    response = decide(client, mgr_headers, request_no, "Approved")

    assert response.status_code == 409
    assert response.json()["detail"] == "Insufficient contingency leave balance"


@pytest.mark.integration
def test_wfh_approval_never_creates_a_balance_row(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("wfh.mgr@emids.com", role="manager")
    employee_factory("wfh.emp@emids.com", manager=manager)
    emp_headers = auth_headers("wfh.emp@emids.com")
    mgr_headers = auth_headers("wfh.mgr@emids.com")

    request_no = apply(
        client, emp_headers, type="Work From Home", days=1,
        **{"from": "2027-03-01", "to": "2027-03-01"},
    ).json()["requestNo"]

    assert decide(client, mgr_headers, request_no, "Approved").status_code == 200
    assert balance_of(client, emp_headers) is None


# --------------------------------------------------------------------------
# Authorization: who may decide
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_admin_can_decide_any_request(client, employee_factory, leave_types, auth_headers):
    employee = employee_factory("admin.target@emids.com")
    admin = employee_factory("root.admin@emids.com", role="admin")

    request_no = apply(client, auth_headers("admin.target@emids.com")).json()["requestNo"]

    assert decide(client, auth_headers("root.admin@emids.com"), request_no).status_code == 200
    row = next(r for r in mine(client, auth_headers("admin.target@emids.com")))
    assert row["status"] == "Approved"


@pytest.mark.integration
def test_employee_cannot_decide_own_request(client, employee_factory, leave_types, auth_headers):
    employee_factory("self.decider@emids.com")

    request_no = apply(client, auth_headers("self.decider@emids.com")).json()["requestNo"]

    response = decide(client, auth_headers("self.decider@emids.com"), request_no)

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to decide this request"


@pytest.mark.integration
def test_manager_cannot_decide_another_managers_report(client, employee_factory, leave_types, auth_headers):
    manager_a = employee_factory("mgr.a@emids.com", role="manager")
    employee_factory("mgr.b@emids.com", role="manager")
    employee_factory("report.of.a@emids.com", manager=manager_a)

    request_no = apply(client, auth_headers("report.of.a@emids.com")).json()["requestNo"]

    response = decide(client, auth_headers("mgr.b@emids.com"), request_no)

    assert response.status_code == 403
    assert response.json()["detail"] == "Not authorized to decide this request"


@pytest.mark.integration
def test_plain_employee_cannot_decide_a_peers_request(client, employee_factory, leave_types, auth_headers):
    peer = employee_factory("peer.one@emids.com")
    employee_factory("peer.two@emids.com")  # same level: peer, not manager

    request_no = apply(client, auth_headers("peer.one@emids.com")).json()["requestNo"]

    assert decide(client, auth_headers("peer.two@emids.com"), request_no).status_code == 403


# --------------------------------------------------------------------------
# State machine
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_decided_request_cannot_be_decided_again(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("twice.mgr@emids.com", role="manager")
    employee_factory("twice.emp@emids.com", manager=manager)
    emp_headers = auth_headers("twice.emp@emids.com")
    mgr_headers = auth_headers("twice.mgr@emids.com")

    request_no = apply(client, emp_headers).json()["requestNo"]
    assert decide(client, mgr_headers, request_no).status_code == 200

    response = decide(client, mgr_headers, request_no, "Rejected")

    assert response.status_code == 409
    assert response.json()["detail"] == "Only pending requests can be decided"


@pytest.mark.integration
def test_decision_of_unknown_request_returns_404(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("ghost.mgr@emids.com", role="manager")

    response = decide(client, auth_headers("ghost.mgr@emids.com"), "LV-99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "One or more requests were not found"


@pytest.mark.integration
def test_invalid_decision_value_rejected(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("maybe.mgr@emids.com", role="manager")
    employee_factory("maybe.emp@emids.com", manager=manager)

    request_no = apply(client, auth_headers("maybe.emp@emids.com")).json()["requestNo"]

    response = client.post(
        f"/leave-requests/{request_no}/decision",
        json={"decision": "Maybe"},
        headers=auth_headers("maybe.mgr@emids.com"),
    )

    assert response.status_code == 422


# --------------------------------------------------------------------------
# Bulk decisions
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_bulk_decision_approves_multiple_and_debits_once_each(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("bulk.mgr@emids.com", role="manager")
    employee_factory("bulk.emp@emids.com", manager=manager)
    emp_headers = auth_headers("bulk.emp@emids.com")
    mgr_headers = auth_headers("bulk.mgr@emids.com")

    first = apply(client, emp_headers, **{"from": "2027-03-01", "to": "2027-03-05"}, days=5).json()["requestNo"]
    second = apply(client, emp_headers, **{"from": "2027-04-05", "to": "2027-04-09"}, days=5).json()["requestNo"]

    response = client.post(
        "/leave-requests/bulk-decision",
        json={"decision": "Approved", "request_nos": [first, second]},
        headers=mgr_headers,
    )

    assert response.status_code == 200
    assert float(balance_of(client, emp_headers)["annual_utilized"]) == 10.0
    statuses = {r["request_no"]: r["status"] for r in mine(client, emp_headers)}
    assert statuses == {first: "Approved", second: "Approved"}


@pytest.mark.integration
def test_bulk_with_one_unknown_request_rolls_back_everything(client, employee_factory, leave_types, auth_headers):
    """Enterprise-critical: a partially valid bulk must change NOTHING."""
    manager = employee_factory("bulkrb.mgr@emids.com", role="manager")
    employee_factory("bulkrb.emp@emids.com", manager=manager)
    emp_headers = auth_headers("bulkrb.emp@emids.com")
    mgr_headers = auth_headers("bulkrb.mgr@emids.com")

    real = apply(client, emp_headers).json()["requestNo"]

    response = client.post(
        "/leave-requests/bulk-decision",
        json={"decision": "Approved", "request_nos": [real, "LV-99999"]},
        headers=mgr_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "One or more requests were not found"
    assert next(r for r in mine(client, emp_headers))["status"] == "Pending"  # rollback proof


@pytest.mark.integration
def test_bulk_with_empty_list_rejected(client, employee_factory, leave_types, auth_headers):
    manager = employee_factory("bulke.mgr@emids.com", role="manager")

    response = client.post(
        "/leave-requests/bulk-decision",
        json={"decision": "Approved", "request_nos": []},
        headers=auth_headers("bulke.mgr@emids.com"),
    )

    assert response.status_code == 422
