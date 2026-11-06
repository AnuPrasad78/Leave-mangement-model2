"""Seed-side balance computations stay policy-driven and request-consistent."""

from datetime import date
from decimal import Decimal

import pytest

from app.models import LeaveStatus
from app.seed import demo_utilized


def _request(email, leave_type, status, days, year=2026):
    return {
        "employee_email": email,
        "leave_type": leave_type,
        "status": status,
        "days": Decimal(days),
        "start_date": date(year, 10, 12),
        "end_date": date(year, 10, 16),
    }


@pytest.mark.unit
def test_demo_utilized_only_count_approved_requests_with_a_deduction_pool():
    requests = [
        _request("a@emids.com", "Paid Time Off", LeaveStatus.PENDING, "5"),  # not consumed yet
        _request("b@emids.com", "Business Travel", LeaveStatus.APPROVED, "3"),  # no-deduction type
        _request("c@emids.com", "Leave Without Pay", LeaveStatus.APPROVED, "4"),  # no-deduction type
        _request("c@emids.com", "Contingency Bucket", LeaveStatus.APPROVED, "3"),
        _request("d@emids.com", "Paid Time Off", LeaveStatus.APPROVED, "2", year=2025),
        _request("d@emids.com", "Paid Time Off", LeaveStatus.APPROVED, "1.5"),
    ]

    assert demo_utilized(requests) == {
        ("c@emids.com", 2026): {"annual": Decimal("0"), "contingency": Decimal("3")},
        ("d@emids.com", 2025): {"annual": Decimal("2"), "contingency": Decimal("0")},
        ("d@emids.com", 2026): {"annual": Decimal("1.5"), "contingency": Decimal("0")},
    }


@pytest.mark.unit
def test_demo_utilized_of_the_actual_seed_matches_the_demo_requests():
    """The seeded demo requests consume nothing measurable (Business Travel is
    no-deduction; the rest are Pending/Rejected), so every seeded utilized stays 0."""
    from app.seed_data import DEMO_REQUESTS

    resulted = demo_utilized(DEMO_REQUESTS)
    for pools in resulted.values():
        assert pools == {"annual": Decimal("0"), "contingency": Decimal("0")}
