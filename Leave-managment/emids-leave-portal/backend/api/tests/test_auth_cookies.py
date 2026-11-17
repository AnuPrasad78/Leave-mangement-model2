"""HttpOnly cookie session flow: issuance, absence, invalidity, expiry, logout
clearance, and the CSRF origin guard. Complements conftest.auth_headers which
still exercises the Authorization-header fallback used by the other suites."""

from datetime import datetime, timedelta, timezone

import jwt

from itertools import count

from app.db import settings

SESSION_COOKIE = settings.SESSION_COOKIE_NAME
DEFAULT_PASSWORD = "TestPassword123!"

_seq = count(1)


def _login(client, email, password="TestPassword123!"):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_login_sets_httponly_cookie(client, admin_factory):
    user = admin_factory("cookie.admin@emids.com")
    response = _login(client, user.email)
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    header = response.headers["set-cookie"]
    assert f"{SESSION_COOKIE}=" in header
    assert "httponly" in header.lower()
    assert "Path=/" in header
    # JWT must never appear in the login response body
    assert "token" not in response.json().keys()


def test_login_response_contains_no_jwt(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    response = _login(client, user.email)
    body = response.text
    cookie_value = response.cookies.get(SESSION_COOKIE)
    assert cookie_value and "." in cookie_value  # looks like a JWT
    assert cookie_value not in body  # but the JWT never appears in the body


def test_missing_cookie_returns_401(client, admin_factory):
    admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    response = client.get("/employees/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_invalid_cookie_returns_401(client, admin_factory):
    admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    client.cookies.set(SESSION_COOKIE, "not-a-jwt")
    try:
        response = client.get("/employees/me")
        assert response.status_code == 401
    finally:
        client.cookies.delete(SESSION_COOKIE)


def test_expired_cookie_returns_401(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    expired = jwt.encode(
        {"sub": user.user_id, "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    client.cookies.set(SESSION_COOKIE, expired)
    try:
        response = client.get("/employees/me")
        assert response.status_code == 401
        assert response.json()["detail"] == "Authentication required"
    finally:
        client.cookies.delete(SESSION_COOKIE)


def test_alt_creds_expired_cookie_returns_401(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    expired = jwt.encode(
        {"sub": user.user_id, "exp": datetime(2020, 1, 1)},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    client.cookies.set(SESSION_COOKIE, expired)
    try:
        assert client.get("/employees/me").status_code == 401
    finally:
        client.cookies.delete(SESSION_COOKIE)


def test_valid_cookie_authenticates(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    login = _login(client, user.email)
    client.cookies.update(login.cookies)
    response = client.get("/employees/me")
    assert response.status_code == 200
    assert response.json()["email"].lower() == user.email.lower()
    client.cookies.delete(SESSION_COOKIE)


def test_logout_clears_cookie(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    login = _login(client, user.email)
    client.cookies.update(login.cookies)
    assert client.cookies.get(SESSION_COOKIE)
    response = client.post("/auth/logout", headers={"Origin": "http://localhost:5173"})
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    # cleared with matching attributes → unauthenticated afterwards
    assert client.get("/employees/me").status_code == 401
    client.cookies.delete(SESSION_COOKIE)


def test_employee_cannot_reach_admin_api_with_cookie(client, admin_factory, employee_factory):
    employee = employee_factory("cookie-staff-{}@emids.com".format(next(_seq)))
    admin = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    login = _login(client, employee.email)
    client.cookies.update(login.cookies)
    client.post("/auth/logout", headers={"Origin": "http://localhost:5173"})
    admin_login = _login(client, admin.email)
    # deliberately: employee cookie reinstated
    client.cookies.set(SESSION_COOKIE, login.cookies.get(SESSION_COOKIE))
    response = client.get("/admin/employees")
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"
    client.cookies.delete(SESSION_COOKIE)


def test_csrf_origin_guard_rejects_foreign_origin(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    login = _login(client, user.email)
    client.cookies.update(login.cookies)
    response = client.post(
        "/admin/notifications",
        json={"recipient_employee_ids": [], "title": "x", "body": "y"},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403
    assert "Cross-site" in response.json()["detail"]
    client.cookies.delete(SESSION_COOKIE)


def test_csrf_origin_guard_rejects_missing_origin(client, admin_factory):
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    login = _login(client, user.email)
    client.cookies.update(login.cookies)
    response = client.post("/separation-requests", json={"last_working_day": "2099-01-01", "reason": "Resignation"})
    assert response.status_code == 403
    client.cookies.delete(SESSION_COOKIE)


def test_csrf_origin_guard_allows_configured_origin_and_skips_bearer(client, admin_factory, employee_factory):
    user = employee_factory("cookie-staff-{}@emids.com".format(next(_seq)))
    login = _login(client, user.email)
    token = login.cookies.get(SESSION_COOKIE)

    # allowed origin + cookie → passes the guard (may fail later validation, not 403)
    response = client.post(
        "/separation-requests",
        json={"last_working_day": "2099-01-01", "reason": "Resignation"},
        headers={"Origin": "http://localhost:5173", **{"Authorization": f"Bearer {token}"}},
    )
    assert response.status_code != 403


def test_bearer_header_requests_bypass_cookie_csrf(client, admin_factory, employee_factory):
    user = employee_factory("cookie-staff-{}@emids.com".format(next(_seq)))
    login = _login(client, user.email)
    client.cookies.delete(SESSION_COOKIE)  # pure Bearer, no cookie in jar

    token = login.cookies.get(SESSION_COOKIE)
    response = client.post(
        "/separation-requests",
        json={"last_working_day": "2099-01-01", "reason": "Resignation"},
        headers={"Authorization": f"Bearer {token}"},  # no Origin header
    )
    assert response.status_code != 403


def test_invalid_cookie_does_not_fall_back_to_a_valid_bearer_header(client, admin_factory):
    """An unusable cookie must not silently fall back to the header fallback."""
    user = admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    token = _login(client, user.email).cookies.get(SESSION_COOKIE)
    client.cookies.delete(SESSION_COOKIE)
    client.cookies.set(SESSION_COOKIE, "not-a-jwt")  # invalid, but present
    try:
        response = client.get("/employees/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401
    finally:
        client.cookies.delete(SESSION_COOKIE)


def test_bearer_header_is_rejected_when_fallback_is_disabled(client, admin_factory, monkeypatch):
    """Deployed configuration (compose) sets AUTH_BEARER_FALLBACK=false: without
    a session cookie the Authorization header must not authenticate."""
    admin_factory("cookie-admin-{}@emids.com".format(next(_seq)))
    monkeypatch.setattr(settings, "AUTH_BEARER_FALLBACK", False)
    response = client.get("/employees/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"
