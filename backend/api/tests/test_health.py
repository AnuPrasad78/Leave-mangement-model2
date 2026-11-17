"""Health endpoints: the first thing production monitoring hits, so they get tests."""

import pytest


@pytest.mark.integration
def test_health_returns_ok(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.integration
def test_database_health_reports_connected(client):
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
