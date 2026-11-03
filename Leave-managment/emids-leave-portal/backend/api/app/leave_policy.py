"""Leave-credit policy: the single source of truth for credit amounts.

Prefer importing this module instead of hardcoding day counts anywhere else (routes,
carry-forward, tests). The values below implement the 2026 admin-persona policy
recorded in ADMIN_DECISIONS.md: 22 annual days prorated by date of joining
(months worked / 12, rounded to the nearest 0.5), a flat 10 contingency days,
a carry-forward ceiling of 6, and 3 optional-holiday picks per year.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal

ANNUAL_DAYS_PER_YEAR = Decimal("22")
CONTINGENCY_DAYS_PER_YEAR = Decimal("10")
CARRY_FORWARD_MAX = Decimal("6")
OPTIONAL_HOLIDAYS_MAX = 3

# Serialized into audit rows so a change of method is visible in history.
PRORATION_METHOD = "months_worked_of_12_half_up"

_HALF = Decimal("0.5")
_TWELVE = Decimal("12")


def prorated_annual(doj: date | None, year: int) -> Decimal:
    """Annual credit for `year`, prorated by DOJ.

    The joining month counts as a worked month; rounds to the nearest 0.5 day
    (the grid the Numeric(5,2) balance columns store). Unknown or previous-year
    DOJ credits the full 22; a DOJ after the year credits 0.
    """
    if doj is None or doj.year < year:
        return ANNUAL_DAYS_PER_YEAR
    if doj.year > year:
        return Decimal("0")
    months_worked = 12 - (doj.month - 1)
    credit = ANNUAL_DAYS_PER_YEAR * months_worked / _TWELVE
    rounded = (credit / _HALF).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * _HALF
    return rounded


def carry_forward_amount(remaining: Decimal | None) -> Decimal:
    """How much of `remaining` annual days rolls into next year's opening."""
    amount = remaining if remaining is not None else Decimal("0")
    if amount < 0:
        amount = Decimal("0")
    return min(amount, CARRY_FORWARD_MAX)
