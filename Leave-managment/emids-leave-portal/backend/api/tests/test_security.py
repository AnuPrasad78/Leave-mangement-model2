"""Authentication: token issuance, token validation, and login edge cases.

Covers /auth/login behavior plus the bearer-token contract that protects
every other endpoint.
"""

import jwt
import pytest

from app.db import settings
from app.security import create_access_token, hash_password, verify_password


# --------------------------------------------------------------------------
# Unit: password hashing
# --------------------------------------------------------------------------
@pytest.mark.unit
def test_password_hash_is_not_reversible():
    hashed = hash_password("correct-horse")

    assert hashed != "correct-horse"
    assert verify_password("correct-horse", hashed)


@pytest.mark.unit
def test_wrong_password_fails_verification():
    hashed = hash_password("correct-horse")

    assert not verify_password("battery-staple", hashed)


@pytest.mark.unit
def test_hashes_are_salted():
    """Same password twice must produce different hashes."""

    assert hash_password("same-password") != hash_password("same-password")


# --------------------------------------------------------------------------
# Unit: JWT issuance
# --------------------------------------------------------------------------
@pytest.mark.unit
def test_access_token_has_subject_and_required_expiry():
    token = create_access_token("11111111-1111-1111-1111-111111111111")

    payload = jwt.decode(
        token, settings.JWT_SECRET, algorithms=["HS256"], options={"require": ["exp", "sub"]}
    )
    assert payload["sub"] == "11111111-1111-1111-1111-111111111111"


# --------------------------------------------------------------------------
# Integration: token validation at the boundary
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_login_returns_bearer_token(client, employee_factory):
    employee_factory("ada.lovelace@emids.com")

    response = client.post(
        "/auth/login", json={"email": "ada.lovelace@emids.com", "password": "TestPassword123!"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


@pytest.mark.integration
def test_login_is_case_insensitive_on_email(client, employee_factory):
    employee_factory("Grace.Hopper@emids.com")

    response = client.post(
        "/auth/login", json={"email": "grace.hopper@emids.com", "password": "TestPassword123!"}
    )

    assert response.status_code == 200


@pytest.mark.integration
def test_unknown_email_rejected(client):
    response = client.post("/auth/login", json={"email": "ghost@emids.com", "password": "whatever"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.integration
def test_wrong_password_rejected(client, employee_factory):
    employee_factory("alan.turing@emids.com")

    response = client.post("/auth/login", json={"email": "alan.turing@emids.com", "password": "Enigma2026!"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.integration
def test_deactivated_user_cannot_login(client, employee_factory):
    employee_factory("disabled.user@emids.com", is_active=False)

    response = client.post(
        "/auth/login", json={"email": "disabled.user@emids.com", "password": "TestPassword123!"}
    )

    assert response.status_code == 401


# --------------------------------------------------------------------------
# Integration: protected endpoint rejects bad tokens
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_missing_token_is_rejected(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.integration
def test_garbage_token_is_rejected(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not.a.jwt"})

    assert response.status_code == 401


@pytest.mark.integration
def test_token_signed_with_wrong_secret_is_rejected(client):
    forged = jwt.encode({"sub": "someone"}, "some-other-secret", algorithm="HS256")

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401


@pytest.mark.integration
def test_token_for_unknown_user_is_rejected(client, employee_factory):
    employee_factory("real.user@emids.com")
    token = create_access_token("99999999-9999-9999-9999-999999999999")

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


@pytest.mark.integration
def test_deactivated_user_with_valid_token_is_rejected(client, employee_factory, session):
    employee = employee_factory("suspended.user@emids.com")
    token = create_access_token(employee.user_id)

    from sqlalchemy import update

    from app.models import User

    with session() as db:
        db.execute(update(User).where(User.email == "suspended.user@emids.com").values(is_active=False))
        db.commit()

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


@pytest.mark.integration
def test_expired_token_is_rejected(client, employee_factory, monkeypatch):
    employee_factory("old.token@emids.com")
    monkeypatch.setattr(settings, "ACCESS_TOKEN_MINUTES", -1)
    token = create_access_token("00000000-0000-0000-0000-000000000000")

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


@pytest.mark.integration
def test_logout_requires_authentication(client):
    response = client.post("/auth/logout")

    assert response.status_code == 401
