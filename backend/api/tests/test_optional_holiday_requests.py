"""Optional-Holiday leave requests: configured-date gating, past-date
rejection, the yearly allowance cap, duplicates, and the guarantee that these
requests never touch regular leave balances.

Backend validation is authoritative here — each spec posts the payload a
tampered frontend could send (direct API calls, not the UI flow).
"""

from datetime import date, timedelta

import pytest

from app.leave_policy import OPTIONAL_HOLIDAYS_MAX

OPT_BODY = {
    "type": "Optional Holiday",
    "from": None,
    "to": None,
    "days": 1,
    "mode": "Full Day",
    "reason": "Festival at home",
    "requestedOn": None,
}

# A future year so the configured dates never collide with the past-date rule.
YEAR = date.today().year + 1


def apply_optional(client, headers, holiday_date, **overrides):
    body = {
        **OPT_BODY,
        "from": holiday_date.isoformat(),
        "to": holiday_date.isoformat(),
        "requestedOn": date.today().isoformat(),
        **overrides,
    }
    return client.post("/leave-requests", json=body, headers=headers)


@pytest.fixture
def opt_pair(employee_factory):
    """Manager + reporting employee pair; returns (employee_email, manager_email)."""
    manager = employee_factory("opt.mgr@emids.com", role="manager")
    employee_factory("opt.emp@emids.com", role="employee", manager=manager)
    return "opt.emp@emids.com", "opt.mgr@emids.com"


@pytest.fixture
def opt_emp_headers(client, opt_pair, auth_headers):
    return auth_headers(opt_pair[0])


@pytest.fixture
def opt_mgr_headers(client, opt_pair, auth_headers):
    return auth_headers(opt_pair[1])


@pytest.mark.integration
def test_leave_policies_me_exposes_allowance(client, employee_factory, auth_headers):
    employee_factory("policy.reader@emids.com")
    response = client.get("/leave-policies/me", headers=auth_headers("policy.reader@emids.com"))

    assert response.status_code == 200
    assert response.json()["optional_holidays_max"] == OPTIONAL_HOLIDAYS_MAX


@pytest.mark.integration
def test_optional_holiday_on_configured_future_date_is_accepted(
    client, leave_types, make_holiday, opt_emp_headers
):
    holiday = make_holiday(year=YEAR, holiday_date=date(YEAR, 5, 1), name="opt-fest-may")

    response = apply_optional(client, opt_emp_headers, holiday.holiday_date)

    assert response.status_code == 201
    assert response.json()["requestNo"].startswith("LV-")


@pytest.mark.integration
def test_unconfigured_future_date_rejected(client, employee_factory, leave_types, opt_emp_headers):
    response = apply_optional(client, opt_emp_headers, date(YEAR, 7, 15))

    assert response.status_code == 422
    assert response.json()["detail"] == "This date is not a configured optional holiday"


@pytest.mark.integration
def test_past_configured_date_rejected(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers
):
    past = date.today() - timedelta(days=30)
    make_holiday(year=past.year, holiday_date=past, name="opt-fest-past")

    response = apply_optional(client, opt_emp_headers, past)

    assert response.status_code == 422
    assert response.json()["detail"] == "Optional holiday leave cannot be requested for a past date"


@pytest.mark.integration
def test_today_is_selectable_when_configured(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers
):
    today = date.today()
    make_holiday(year=today.year, holiday_date=today, name="opt-fest-today")

    response = apply_optional(client, opt_emp_headers, today)

    assert response.status_code == 201


@pytest.mark.integration
def test_optional_holiday_rejects_multi_day_and_half_day(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers
):
    holiday = make_holiday(year=YEAR, holiday_date=date(YEAR, 5, 2), name="opt-fest-june")

    multi = apply_optional(
        client, opt_emp_headers, holiday.holiday_date,
        to=(holiday.holiday_date + timedelta(days=1)).isoformat(),
        days=2,
    )
    half = apply_optional(
        client, opt_emp_headers, holiday.holiday_date, days=0.5, mode="First Half",
    )
    wrong_days_full_mode = apply_optional(
        client, opt_emp_headers, holiday.holiday_date, days=0.5,
    )

    assert multi.status_code == 422
    assert half.status_code == 422
    assert wrong_days_full_mode.status_code == 422
    assert half.json()["detail"] == "Optional holidays are single full-day requests"


@pytest.mark.integration
def test_duplicate_open_request_rejected(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers
):
    holiday = make_holiday(year=YEAR, holiday_date=date(YEAR, 5, 3), name="opt-fest-dup")

    assert apply_optional(client, opt_emp_headers, holiday.holiday_date).status_code == 201

    response = apply_optional(client, opt_emp_headers, holiday.holiday_date)

    assert response.status_code == 409
    assert response.json()["detail"] == "You already have a request for this optional holiday"
    open_rows = [
        r for r in client.get("/leave-requests/mine", headers=opt_emp_headers).json()
        if r["status"] in ("Pending", "Approved")
    ]
    assert len(open_rows) == 1


@pytest.mark.integration
def test_cancelled_request_frees_the_date_again(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers
):
    holiday = make_holiday(year=YEAR, holiday_date=date(YEAR, 5, 4), name="opt-fest-cancel")
    headers = opt_emp_headers
    request_no = apply_optional(client, headers, holiday.holiday_date).json()["requestNo"]

    assert client.post(f"/leave-requests/{request_no}/cancel", headers=headers).status_code == 200

    retry = apply_optional(client, headers, holiday.holiday_date)
    assert retry.status_code == 201


@pytest.mark.integration
def test_rejected_request_does_not_consume_the_allowance(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers, opt_mgr_headers
):
    holiday = make_holiday(year=YEAR, holiday_date=date(YEAR, 5, 5), name="opt-fest-reject")
    first = apply_optional(client, opt_emp_headers, holiday.holiday_date).json()["requestNo"]

    assert client.post(
        f"/leave-requests/{first}/decision", json={"decision": "Rejected"}, headers=opt_mgr_headers
    ).status_code == 200

    # The rejected one consumed nothing — the employee can still raise all 3.
    dates = [date(YEAR, 6, 1), date(YEAR, 6, 2), date(YEAR, 6, 3)]
    for offset, holiday_date in enumerate(dates):
        make_holiday(year=YEAR, holiday_date=holiday_date, name=f"opt-fest-retry-{offset}")
        response = apply_optional(client, opt_emp_headers, holiday_date)
        assert response.status_code == 201, response.text


@pytest.mark.integration
def test_allowance_cap_enforced(
    client, employee_factory, leave_types, make_holiday, opt_emp_headers
):
    dates = [date(YEAR, 9, 1), date(YEAR, 9, 2), date(YEAR, 9, 3), date(YEAR, 9, 4)]
    for index, holiday_date in enumerate(dates):
        make_holiday(year=YEAR, holiday_date=holiday_date, name=f"opt-fest-cap-{index}")

        response = apply_optional(client, opt_emp_headers, holiday_date)

        if index < OPTIONAL_HOLIDAYS_MAX:
            assert response.status_code == 201
        else:
            assert response.status_code == 409
            assert response.json()["detail"] == (
                f"You can use only {OPTIONAL_HOLIDAYS_MAX} optional holidays per year"
            )


@pytest.mark.integration
def test_approved_optional_holiday_deducts_no_regular_balance(
    client, employee_factory, leave_types, make_holiday, session, opt_emp_headers, opt_mgr_headers
):
    from app.models import LeaveBalance

    holiday = make_holiday(year=YEAR, holiday_date=date(YEAR, 10, 5), name="opt-fest-balance")
    request_no = apply_optional(client, opt_emp_headers, holiday.holiday_date).json()["requestNo"]

    before = client.get("/balances/me", headers=opt_emp_headers).json()

    assert client.post(
        f"/leave-requests/{request_no}/decision", json={"decision": "Approved"}, headers=opt_mgr_headers
    ).status_code == 200

    after = client.get("/balances/me", headers=opt_emp_headers).json()
    if before is None:
        # No balance row existed before and none may be created to record an
        # optional holiday — the decision must not spin up ledger activity.
        with session() as db:
            assert db.query(LeaveBalance).count() == 0
    else:
        assert after["annual_utilized"] == before["annual_utilized"]
        assert after["contingency_utilized"] == before["contingency_utilized"]
        assert after["annual_credited"] == before["annual_credited"]
        assert after["contingency_credited"] == before["contingency_credited"]


@pytest.mark.integration
def test_other_leave_types_keep_their_balance_rules(
    client, employee_factory, leave_types, opt_pair, auth_headers
):
    """Guard the non-optional workflow: a Paid Time Off approval still updates
    the annual ledger exactly as before."""
    emp_email, mgr_email = opt_pair
    emp_headers, mgr_headers = auth_headers(emp_email), auth_headers(mgr_email)

    body = {
        "type": "Paid Time Off",
        "from": f"{YEAR}-03-02",
        "to": f"{YEAR}-03-06",
        "days": 5,
        "mode": "Full Day",
        "reason": "Regular balance sanity",
        "requestedOn": date.today().isoformat(),
    }
    request_no = client.post("/leave-requests", json=body, headers=emp_headers).json()["requestNo"]

    assert client.post(
        f"/leave-requests/{request_no}/decision", json={"decision": "Approved"}, headers=mgr_headers
    ).status_code == 200

    balance = client.get("/balances/me", headers=emp_headers).json()
    assert balance is not None
    assert float(balance["annual_utilized"]) == 5.0
