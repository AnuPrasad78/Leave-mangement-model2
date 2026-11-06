"""Profile and team endpoints: /auth/me, /employees/me, /employees/me/team."""

import pytest


@pytest.mark.integration
def test_me_returns_profile_with_manager_name(client, employee_factory, auth_headers):
    manager = employee_factory("din.djarin@emids.com", full_name="Din Djarin")
    employee_factory(
        "grogu.djarin@emids.com",
        full_name="Grogu Djarin",
        manager=manager,
    )

    headers = auth_headers("grogu.djarin@emids.com")

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Grogu Djarin"
    assert body["email"] == "grogu.djarin@emids.com"
    assert body["system_role"] == "employee"
    assert body["manager"] == {"full_name": "Din Djarin"}


@pytest.mark.integration
def test_me_reports_null_manager_for_top_level_employee(client, employee_factory, auth_headers):
    employee_factory("orphan.profile@emids.com")

    headers = auth_headers("orphan.profile@emids.com")

    body = client.get("/auth/me", headers=headers).json()
    assert body["manager"] is None


@pytest.mark.integration
def test_employees_me_alias_returns_same_payload(client, employee_factory, auth_headers):
    employee_factory("alias.check@emids.com", full_name="Alias Check")

    headers = auth_headers("alias.check@emids.com")

    session_response = client.get("/auth/me", headers=headers)
    employees_response = client.get("/employees/me", headers=headers)

    assert session_response.status_code == employees_response.status_code == 200
    assert session_response.json() == employees_response.json()


@pytest.mark.integration
def test_team_lists_only_direct_reports(client, employee_factory, auth_headers):
    manager = employee_factory("team.lead@emids.com", role="manager")
    first = employee_factory("report.one@emids.com", manager=manager)
    second = employee_factory("report.two@emids.com", manager=manager)
    employee_factory("unrelated.person@emids.com")  # not on this team

    headers = auth_headers("team.lead@emids.com")

    response = client.get("/employees/me/team", headers=headers)

    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert ids == {first.id, second.id}


@pytest.mark.integration
def test_team_endpoint_returns_no_reports_for_regular_employee(client, employee_factory, auth_headers):
    employee_factory("solo.contributor@emids.com")

    headers = auth_headers("solo.contributor@emids.com")

    response = client.get("/employees/me/team", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.integration
def test_user_without_employee_profile_is_forbidden(client, user_factory, auth_headers):
    """Users exist for login, but must have a linked Employee profile to use the API."""
    user_factory("profile.less@emids.com")

    headers = auth_headers("profile.less@emids.com")

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "No employee profile is linked to this account"


@pytest.mark.integration
def test_profile_endpoints_require_authentication(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/employees/me").status_code == 401
    assert client.get("/employees/me/team").status_code == 401
