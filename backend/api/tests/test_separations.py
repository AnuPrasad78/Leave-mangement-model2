"""Separation requests: creation, enum + remarks validation, persistence check via DB.

There is no GET endpoint for separations, so persistence is verified directly
against the database — that is the correct level of verification when the API
surface is write-only.
"""

import pytest

from app.models import SeparationRequest


def submit(client, headers, **overrides):
    body = {
        "last_working_day": "2027-06-30",
        "reason": "Better Opportunity",
        "remarks": None,
        **overrides,
    }
    return client.post("/separation-requests", json=body, headers=headers)


@pytest.mark.integration
def test_submit_creates_pending_separation(client, employee_factory, auth_headers, session):
    employee = employee_factory("leaver.one@emids.com")
    headers = auth_headers("leaver.one@emids.com")

    response = submit(client, headers)

    assert response.status_code == 201
    assert response.json() == {"ok": True}

    with session() as db:
        row = db.query(SeparationRequest).one()
    assert row.employee_id == employee.id
    assert row.status.value == "Pending"
    assert str(row.last_working_day) == "2027-06-30"
    assert row.reason == "Better Opportunity"
    assert row.remarks is None


@pytest.mark.integration
def test_remarks_at_the_800_char_limit_are_accepted(client, employee_factory, auth_headers):
    employee_factory("leaver.two@emids.com")

    response = submit(client, auth_headers("leaver.two@emids.com"), remarks="x" * 800)

    assert response.status_code == 201


@pytest.mark.integration
def test_remarks_over_the_limit_rejected(client, employee_factory, auth_headers):
    employee_factory("leaver.three@emids.com")

    response = submit(client, auth_headers("leaver.three@emids.com"), remarks="x" * 801)

    assert response.status_code == 422


@pytest.mark.integration
def test_reason_outside_whitelist_rejected(client, employee_factory, auth_headers):
    employee_factory("leaver.four@emids.com")

    response = submit(client, auth_headers("leaver.four@emids.com"), reason="Thing Other")

    assert response.status_code == 422


@pytest.mark.integration
def test_each_whitelisted_reason_is_accepted(client, employee_factory, auth_headers):
    from app.schemas import SeparationInput

    employee_factory("leaver.five@emids.com")
    headers = auth_headers("leaver.five@emids.com")

    for reason in SeparationInput.model_fields["reason"].annotation.__args__:
        response = submit(client, headers, reason=reason)
        assert response.status_code == 201, reason


@pytest.mark.integration
def test_separation_requires_authentication(client):
    assert client.post("/separation-requests", json={"last_working_day": "2027-06-30", "reason": "Other"}).status_code == 401
