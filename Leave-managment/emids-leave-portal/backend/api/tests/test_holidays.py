"""Holidays and optional picks: country scoping, upcoming filter, 3-picks-per-year cap."""

from datetime import date

import pytest


def add_pick(client, headers, holiday_id):
    return client.post("/holidays/picks", json={"holiday_id": holiday_id}, headers=headers)


def get_picks(client, headers):
    return client.get("/holidays/picks", headers=headers).json()


# --------------------------------------------------------------------------
# Holiday listings
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_holidays_list_returns_india_only_and_sorted(
    client, employee_factory, make_holiday, auth_headers
):
    employee_factory("holiday.viewer@emids.com")
    headers = auth_headers("holiday.viewer@emids.com")
    make_holiday(kind="fixed", holiday_date=date(2027, 1, 26), name="Republic Day")
    make_holiday(kind="fixed", holiday_date=date(2027, 3, 11), name="Holi")
    make_holiday(
        kind="fixed", holiday_date=date(2027, 7, 5), name="US Day", country="USA"
    )

    response = client.get("/holidays", headers=headers)

    assert response.status_code == 200
    rows = response.json()
    names = [h["name"] for h in rows]
    dates = [str(h["holiday_date"]) for h in rows]
    assert dates == sorted(dates)
    assert names == ["Republic Day", "Holi"]  # USA row excluded


@pytest.mark.integration
def test_upcoming_holidays_filter_includes_boundary_date(
    client, employee_factory, make_holiday, auth_headers
):
    employee_factory("upcoming.viewer@emids.com")
    headers = auth_headers("upcoming.viewer@emids.com")
    past = make_holiday(kind="fixed", holiday_date=date(2026, 8, 15), name="Past One", year=2026)
    boundary = make_holiday(kind="fixed", holiday_date=date(2027, 1, 1), name="New Year")
    later = make_holiday(kind="fixed", holiday_date=date(2027, 3, 11), name="Holi")

    # the endpoint's query parameter is `from_date` (what services/holidays.ts actually calls)
    response = client.get("/holidays/upcoming", headers=headers, params={"from_date": "2027-01-01"})

    assert response.status_code == 200
    ids = [h["id"] for h in response.json()]
    assert ids == [boundary.id, later.id]  # boundary inclusive, past excluded


# --------------------------------------------------------------------------
# Optional holiday picks
# --------------------------------------------------------------------------
@pytest.mark.integration
def test_pick_optional_holiday_lifecycle(client, employee_factory, make_holiday, auth_headers):
    employee_factory("pickers.one@emids.com")
    headers = auth_headers("pickers.one@emids.com")
    holiday_a = make_holiday(holiday_date=date(2027, 4, 14), name="Ambedkar Jayanti", year=2027)
    holiday_b = make_holiday(holiday_date=date(2027, 8, 15), name="Independence Eve", year=2027)

    assert add_pick(client, headers, holiday_a.id).status_code == 201
    assert get_picks(client, headers) == [holiday_a.id]

    # re-picking the same holiday is idempotent, never a duplicate
    assert add_pick(client, headers, holiday_a.id).status_code == 201
    assert get_picks(client, headers) == [holiday_a.id]


@pytest.mark.integration
def test_more_than_three_picks_in_a_year_rejected(
    client, employee_factory, make_holiday, auth_headers
):
    employee_factory("pickers.two@emids.com")
    headers = auth_headers("pickers.two@emids.com")
    four_holidays = [
        make_holiday(holiday_date=date(2027, 1, 10 + i), name=f"Extra {i}", year=2027)
        for i in range(4)
    ]

    for holiday in four_holidays[:3]:
        assert add_pick(client, headers, holiday.id).status_code == 201

    response = add_pick(client, headers, four_holidays[3].id)

    assert response.status_code == 409
    assert response.json()["detail"] == "You can choose only 3 optional holidays per year"
    assert len(get_picks(client, headers)) == 3


@pytest.mark.integration
def test_three_picks_cap_is_per_year(client, employee_factory, make_holiday, auth_headers):
    employee_factory("pickers.three@emids.com")
    headers = auth_headers("pickers.three@emids.com")
    for i in range(3):
        assert add_pick(
            client, headers, make_holiday(holiday_date=date(2027, 1, 10 + i), name=f"In DropIndex {i}", year=2027).id
        ).status_code == 201

    # a 2026 optional holiday must still be pickable: cap is per (employee, country, year)
    older = make_holiday(holiday_date=date(2026, 12, 24), name="Old Optional", year=2026)
    assert add_pick(client, headers, older.id).status_code == 201


@pytest.mark.integration
def test_picking_fixed_kind_holiday_rejected(client, employee_factory, make_holiday, auth_headers):
    employee_factory("pickers.four@emids.com")
    headers = auth_headers("pickers.four@emids.com")
    fixed = make_holiday(kind="fixed", holiday_date=date(2027, 1, 26), name="Republic Day", year=2027)

    response = add_pick(client, headers, fixed.id)

    assert response.status_code == 404
    assert response.json()["detail"] == "Optional India holiday not found"


@pytest.mark.integration
def test_picking_non_india_optional_holiday_rejected(client, employee_factory, make_holiday, auth_headers):
    employee_factory("pickers.five@emids.com")
    headers = auth_headers("pickers.five@emids.com")
    usa_optional = make_holiday(
        kind="optional", holiday_date=date(2027, 11, 25), name="Thanksgiving", country="USA", year=2027
    )

    response = add_pick(client, headers, usa_optional.id)

    assert response.status_code == 404


@pytest.mark.integration
def test_remove_pick_and_idempotent_remove(client, employee_factory, make_holiday, auth_headers):
    employee_factory("pickers.six@emids.com")
    headers = auth_headers("pickers.six@emids.com")
    holiday = make_holiday(holiday_date=date(2027, 4, 14), name="Pick-me", year=2027)
    add_pick(client, headers, holiday.id)
    unknown_id = holiday.id + 5000

    assert client.delete(f"/holidays/picks/{holiday.id}", headers=headers).status_code == 200
    assert get_picks(client, headers) == []
    # deleting a pick you never had is still a success
    assert client.delete(f"/holidays/picks/{unknown_id}", headers=headers).status_code == 200


@pytest.mark.integration
def test_holidays_and_picks_require_authentication(client):
    assert client.get("/holidays").status_code == 401
    assert client.get("/holidays/upcoming", params={"from_date": "2027-01-01"}).status_code == 401
    assert client.get("/holidays/picks").status_code == 401
    assert client.post("/holidays/picks", json={"holiday_id": 1}).status_code == 401
