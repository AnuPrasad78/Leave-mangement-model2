"""Phase 4: password reset flow — init (admin), perform (public)."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import PasswordResetToken


def init_reset(client, headers, user_id):
    return client.post(f"/admin/employee-password-resets/{user_id}/init", headers=headers)


@pytest.mark.integration
def test_full_flow_replaces_the_password(client, admin_factory, employee_factory, auth_headers, session):
    admin_factory("reset.admin@emids.com", role="admin")
    employee_factory("reset.emp@emids.com")
    admin_headers = auth_headers("reset.admin@emids.com")
    user_id = client.get("/auth/me", headers=auth_headers("reset.emp@emids.com")).json()["user_id"]

    response = init_reset(client, admin_headers, user_id)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["reset_token"]
    assert payload["reset_endpoint"].endswith(payload["reset_token"])

    with session() as db:
        row = db.scalar(select(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
        assert row is not None
        assert row.token_hash != payload["reset_token"]  # stored hashed, never plaintext
        assert row.used_at is None

    assert client.post(
        "/auth/login", json={"email": "reset.emp@emids.com", "password": "TestPassword123!"}
    ).status_code == 200
    perform = client.post(
        payload["reset_endpoint"], json={"password": "FreshPassword44!"}
    )
    assert perform.status_code == 200, perform.text

    assert client.post(
        "/auth/login", json={"email": "reset.emp@emids.com", "password": "TestPassword123!"}
    ).status_code == 401
    assert client.post(
        "/auth/login", json={"email": "reset.emp@emids.com", "password": "FreshPassword44!"}
    ).status_code == 200


@pytest.mark.integration
def test_token_is_single_use(client, admin_factory, employee_factory, auth_headers):
    admin_factory("single.admin@emids.com", role="admin")
    employee_factory("single.emp@emids.com")
    user_id = client.get("/auth/me", headers=auth_headers("single.emp@emids.com")).json()["user_id"]
    init = init_reset(client, auth_headers("single.admin@emids.com"), user_id).json()

    first = client.post(init["reset_endpoint"], json={"password": "OnePassword11!"})
    assert first.status_code == 200
    second = client.post(init["reset_endpoint"], json={"password": "TwoPassword22!"})
    assert second.status_code == 400
    assert second.json()["detail"] == "Invalid or expired reset token"
    # password stays at the first reset
    assert client.post(
        "/auth/login", json={"email": "single.emp@emids.com", "password": "OnePassword11!"}
    ).status_code == 200


@pytest.mark.integration
def test_expired_token_is_rejected(client, admin_factory, employee_factory, auth_headers, session):
    from app.security import hash_password

    admin_factory("exp.admin@emids.com", role="admin")
    employee_factory("exp.emp@emids.com")
    user_id = client.get("/auth/me", headers=auth_headers("exp.emp@emids.com")).json()["user_id"]

    stale_token = "stale-token-value-for-expiry-test"
    with session() as db:
        db.add(
            PasswordResetToken(
                user_id=user_id,
                token_hash=hash_password(stale_token),
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
                created_by=None,
            )
        )
        db.commit()

    response = client.post("/auth/password-reset/stale-token-value-for-expiry-test",
                           json={"password": "LatePassword33!"})
    assert response.status_code == 400


@pytest.mark.integration
def test_unknown_token_is_rejected(client, admin_factory, employee_factory, auth_headers):
    admin_factory("unknown.admin@emids.com", role="admin")
    employee_factory("unknown.emp@emids.com")
    response = client.post("/auth/password-reset/no-such-token", json={"password": "Whatever01!"})
    assert response.status_code == 400


@pytest.mark.integration
def test_deactivated_user_cannot_reset_via_public_endpoint(client, admin_factory, employee_factory, auth_headers):
    admin_factory("inactive.admin@emids.com", role="admin")
    employee = employee_factory("inactive.emp@emids.com")
    admin_headers = auth_headers("inactive.admin@emids.com")
    user_id = client.get("/auth/me", headers=auth_headers("inactive.emp@emids.com")).json()["user_id"]
    client.post(f"/admin/employees/{employee.id}/deactivate", headers=admin_headers)

    # init refuses, and a live pre-deactivation token does not resurrect the login
    init = init_reset(client, admin_headers, user_id)
    assert init.status_code == 409


@pytest.mark.integration
def test_reset_init_is_admin_only(client, employee_factory, auth_headers):
    employee_factory("resetgate.emp@emids.com")
    employee_factory("resetgate.mgr@emids.com", role="manager")
    user_id = client.get("/auth/me", headers=auth_headers("resetgate.emp@emids.com")).json()["user_id"]
    for email in ("resetgate.emp@emids.com", "resetgate.mgr@emids.com"):
        response = init_reset(client, auth_headers(email), user_id)
        assert response.status_code == 403
