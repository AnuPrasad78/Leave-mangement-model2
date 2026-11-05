# Task: Auto-create leave_balances rows for every employee (no hardcoded balances)

## Context

The FastAPI backend is in `backend/api/app/`. The `leave_balances` table is one row per employee per year (`models.py`, class `LeaveBalance`, unique key on `employee_id + year`).

Right now a `LeaveBalance` row is only created in three places:

1. `seed.py` — inserts a hardcoded `BALANCES` list from `seed_data.py` (only covers some demo employees).
2. `routes.py` → `admin_carry_forward` — creates next-year rows for employees that already had a row, using the helper `prorated_annual(doj, year)` from `leave_policy.py`.
3. `routes.py` → `admin_upsert_leave_balance` (`PUT /admin/leave-balances/{employee_id}/{year}`) — creates a row only when an admin manually saves one.

**Bug:** `admin_create_employee` (`POST /admin/employees`, `routes.py`) creates the `User` + `Employee` rows but never a `leave_balances` row. So new employees have no balance → `GET /balances/me` returns `null` → the Dashboard donut falls back to `EMPTY_BALANCES` (0/0) and Apply Leave has no numbers to check against.

## The changes (all balance amounts must be COMPUTED, never hardcoded)

All credit amounts must come from existing helpers in `backend/api/app/leave_policy.py` — the single source of truth:

- `ANNUAL_DAYS_PER_YEAR` (22), `CONTINGENCY_DAYS_PER_YEAR` (10)
- `prorated_annual(doj, year)` — annual credit prorated by date of joining (months worked / 12, rounded to nearest 0.5). Uses these exact rules already: DOJ in a previous year → full 22; DOJ after the year → 0; joining month counts as a worked month.
- `carry_forward_amount(remaining)` — capped at 6, floor 0.

### 1. Auto-create on employee creation

In `admin_create_employee` (`routes.py`), inside the same transaction, after adding the `Employee`, also add:

```python
LeaveBalance(
    employee_id=employee.id,
    year=date.today().year,
    annual_credited=prorated_annual(employee.doj, date.today().year),
    contingency_credited=CONTINGENCY_DAYS_PER_YEAR,
    annual_cap=ANNUAL_DAYS_PER_YEAR,
    contingency_cap=CONTINGENCY_DAYS_PER_YEAR,
)
```

(`opening_annual`, `annual_utilized`, `contingency_utilized` keep their 0 server defaults.) If the employee was created in a later event (e.g. DOJ set in a future year), the prorated helper handles it — do not invent amounts.

### 2. Seed: replace the hardcoded `BALANCES` list with computed values

In `seed.py` / `seed_data.py`:

- Delete the hardcoded `BALANCES` list (or stop importing it).
- Instead, for EVERY employee in `EMPLOYEES` and the current seed year, upsert a `LeaveBalance` row (same `on_conflict_do_update` on `leave_balances_employee_year_key` as today) where:
  - `annual_credited = prorated_annual(emp["doj"], year)`
  - `contingency_credited = CONTINGENCY_DAYS_PER_YEAR`
  - `annual_cap = ANNUAL_DAYS_PER_YEAR`, `contingency_cap = CONTINGENCY_DAYS_PER_YEAR`
  - `opening_annual` = 0 except for the manager, whose carry-forward leftover (4.25) is demo data — keep it but comment that it is demo-only.
- Keep the small demo `*_utilized` overrides ONLY where they make the demo `DEMO_REQUESTS` consistent (utilized must equal the sum of that employee's seeded Approved Annual/Contingency days) — these represent usage, not policy, so hardcoding them is acceptable and must be labeled as demo data with a comment. Recompute them from the seeded `DEMO_REQUESTS` `days` sums rather than typing literals by hand if practical.

### 3. Backfill existing rows in the live DB (one-off, idempotent)

Add a small standalone script (e.g. `backend/api/scripts/backfill_balances.py`) that:

- Runs after seed/bootstrap, uses the same database config the app uses.
- For every employee in `employees` with no `leave_balances` row for the current year, inserts one with the same computed fields as above.
- Idempotent: `INSERT ... ON CONFLICT (employee_id, year) DO NOTHING` on the `leave_balances_employee_year_key` constraint.
- Never modifies rows that already exist (admins may have edited them manually).

## Rules / constraints

- Do NOT change the schema or add migrations.
- Do NOT touch `prorated_annual` / `carry_forward_amount` — they are the tested policy. Import from `leave_policy`, never re-implement or hardcode 22 / 10 anywhere else.
- Do NOT change `admin_upsert_leave_balance` behavior (admins must still be able to override manually).
- The `/balances/me` endpoint can stay as-is (latest-year row); with this fix it will always find a row for new users.
- Keep audit logging style consistent (the existing `_audit` helper); you may fold the created balance info into the existing `employee_created` audit detail instead of a new audit row.

## Tests

Extend `backend/api/tests/` (follow the fixtures in `conftest.py`):

1. Creating an employee via `POST /admin/employees` with a DOJ in the current year yields a `leave_balances` row whose `annual_credited` equals `prorated_annual(doj, current_year)` (e.g. DOJ = Jan → 22.0, DOJ = Jul → 11.0, DOJ = Dec → 2.0).
2. A DOJ in a previous year yields the full 22.
3. `GET /balances/me` returns real numbers (not null) immediately after creating the current user through the admin endpoint.
4. No duplicate row is created if the employee already had one for the year.
5. Backfill script is a no-op when every employee already has a row, and fills in only the missing employee when run twice.

## Verification

- Run the pytest suite in `backend/api` and make sure ALL existing tests still pass (`test_balances.py`, `test_carry_forward.py`, `test_admin_balances.py`, `test_admin_employees.py` in particular — some may assert on seed balance numbers that will legitimately change; update those assertions to the computed values, but do not weaken what they verify).
- Repeat the verification step after writing the backfill script: run it twice and confirm the count of `leave_balances` rows equals the employee count for the current year and doesn't grow on the second run.
