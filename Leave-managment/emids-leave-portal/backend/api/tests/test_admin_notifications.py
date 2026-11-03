"""Admin nudge (manager reminders): role gates, writes, audit."""

import pytest
from sqlalchemy import select

from app.models import Notification


@pytest.mark.integration
def test_employee_and_manager_cannot_send_nudge(client, employee_factory, auth_headers):
    employee_factory("nudge.admin@emids.com", role="admin")
    manager = employee_factory("nudge.manager@emids.com", role="manager")
    employee = employee_factory("nudge.emp@emids.com")

    admin_headers = auth_headers("nudge.admin@emids.com")
    manager_headers = auth_headers("nudge.manager@emids.com")
    employee_headers = auth_headers("nudge.emp@emids.com")

    body = {"recipient_employee_ids": [manager.id], "title": "Review queue", "body": "Please review pending requests."}
    assert client.post("/admin/notifications", json=body, headers=employee_headers).status_code == 403
    assert client.post("/admin/notifications", json=body, headers=manager_headers).status_code == 403
    assert client.post("/admin/notifications", json=body, headers=admin_headers).status_code == 200


@pytest.mark.integration
def test_nudge_writes_notifications_and_audit_row(client, employee_factory, auth_headers):
    employee_factory("nudgeok.admin@emids.com", role="admin")
    manager_a = employee_factory("nudge.a@emids.com", role="manager")
    admin_headers = auth_headers("nudgeok.admin@emids.com")

    response = client.post(
        "/admin/notifications",
        json={
            "recipient_employee_ids": [manager_a.id],
            "title": "Review queue",
            "body": "2 pending requests are waiting on you.",
        },
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True, "recipients": 1}

    # the recipient sees exactly one in-app notification
    mine = client.get("/notifications", headers=auth_headers("nudge.a@emids.com")).json()
    assert len(mine) == 1
    assert mine[0]["kind"] == "admin_nudge"
    assert mine[0]["title"] == "Review queue"
    assert mine[0]["read_at"] is None

    # exactly one audit row records the send
    logs = client.get("/admin/audit-logs?action=nudge_sent", headers=admin_headers).json()
    assert logs["total"] == 1
    assert logs["items"][0]["detail_json"]["recipient_ids"] == [manager_a.id]


@pytest.mark.integration
def test_nudge_rejects_unknown_recipient_and_empty_list(client, employee_factory, auth_headers):
    employee_factory("nudgedup.admin@emids.com", role="admin")
    employee_factory("nudgedup.a@emids.com", role="manager")
    admin_headers = auth_headers("nudgedup.admin@emids.com")

    duplicate = client.post(
        "/admin/notifications",
        json={
            "recipient_employee_ids": ["00000000-0000-0000-0000-000000000001"],
            "title": "Hi",
            "body": "Unknown recipient must 404.",
        },
        headers=admin_headers,
    )
    assert duplicate.status_code == 404

    # a fully empty recipient list never reaches the endpoint (422)
    empty = client.post(
        "/admin/notifications",
        json={"recipient_employee_ids": [], "title": "Hi", "body": "Body"},
        headers=admin_headers,
    )
    assert empty.status_code == 422


@pytest.mark.integration
def test_nudge_duplicate_ids_send_once(session, client, employee_factory, auth_headers):
    employee_factory("nudgedup2.admin@emids.com", role="admin")
    manager_b = employee_factory("nudgedup2.b@emids.com", role="manager")
    admin_headers = auth_headers("nudgedup2.admin@emids.com")

    response = client.post(
        "/admin/notifications",
        json={
            "recipient_employee_ids": [manager_b.id, manager_b.id],
            "title": "Review queue",
            "body": "Nudge once.",
        },
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["recipients"] == 1

    with session() as db_session:
        rows = db_session.scalars(select(Notification).where(Notification.kind == "admin_nudge")).all()
    assert len(rows) == 1
