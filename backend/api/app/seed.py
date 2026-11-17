from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.backfill_balances import balance_values_for
from app.db import SessionLocal, settings
from app.leave_policy import deduction_pool
from app.models import (
    Employee,
    Holiday,
    LeaveBalance,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    User,
)
from app.security import hash_password
from app.seed_data import (
    ADMIN_EMAIL,
    DEMO_REQUESTS,
    EMPLOYEES,
    HOLIDAYS,
    INDIA_OPTIONAL_HOLIDAYS,
    LEAVE_TYPES,
    MANAGER_EMAIL,
    MANAGER_OPENING_ANNUAL,
)


def demo_utilized(requests: list[dict]) -> dict[tuple[str, int], dict[str, Decimal]]:
    """Utilized balances implied by the seeded demo requests: only APPROVED
    requests for a deduction-drawing leave type (leave_policy.deduction_pool)
    consume balance, grouped by employee email and request year."""
    utilized: dict[tuple[str, int], dict[str, Decimal]] = {}
    for request_data in requests:
        pool = deduction_pool(request_data["leave_type"])
        if pool is None or request_data["status"] != LeaveStatus.APPROVED:
            continue
        entry = utilized.setdefault(
            (request_data["employee_email"], request_data["start_date"].year),
            {"annual": Decimal("0"), "contingency": Decimal("0")},
        )
        entry[pool] += request_data["days"]
    return utilized


ORG_DEFAULTS = {
    "account": "Investments and strategic initiatives",
    "project_name": "Project AB - AI Industrialization",
    "function_name": "Engineering - Digital Platforms",
    "delivery_partner_name": "Arumugam Thiraviam",
    "location": "Bangalore, IN",
}


def seed_demo_data() -> None:
    if not settings.DEMO_PASSWORD:
        raise RuntimeError("Set DEMO_PASSWORD in backend/api/.env before seeding demo logins.")

    hashed_password = hash_password(settings.DEMO_PASSWORD)
    with SessionLocal.begin() as session:
        employees_by_email: dict[str, Employee] = {}

        for employee_data in EMPLOYEES:
            email = employee_data["email"]
            user = session.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(email=email, password_hash=hashed_password)
                session.add(user)
                session.flush()
            else:
                user.password_hash = hashed_password
                user.is_active = True
            employee = session.scalar(select(Employee).where(Employee.email == email))
            values = {**ORG_DEFAULTS, **employee_data}
            values.pop("email")
            if employee is None:
                employee = Employee(email=email, **values)
                session.add(employee)
                session.flush()
            else:
                for field, value in values.items():
                    setattr(employee, field, value)
            employee.user_id = user.id
            employees_by_email[email] = employee

        manager_id = employees_by_email[MANAGER_EMAIL].id
        for email, employee in employees_by_email.items():
            if email not in {MANAGER_EMAIL, ADMIN_EMAIL, "sandeep.venkateshkamath@emids.com"}:
                employee.manager_id = manager_id

        leave_types_by_name: dict[str, LeaveType] = {}
        for name in LEAVE_TYPES:
            leave_type = session.scalar(select(LeaveType).where(LeaveType.name == name))
            if leave_type is None:
                leave_type = LeaveType(name=name, is_active=True)
                session.add(leave_type)
            else:
                leave_type.is_active = True
            leave_types_by_name[name] = leave_type
        session.flush()

        for location, year, holiday_date, name in HOLIDAYS:
            values = {
                "country": "India",
                "location": location,
                "year": year,
                "kind": "fixed",
                "holiday_date": datetime.strptime(holiday_date, "%Y-%m-%d").date(),
                "name": name,
            }
            upsert_holiday(session, values)
        for year, holiday_date, name in INDIA_OPTIONAL_HOLIDAYS:
            values = {
                "country": "India",
                "location": None,
                "year": year,
                "kind": "optional",
                "holiday_date": datetime.strptime(holiday_date, "%Y-%m-%d").date(),
                "name": name,
            }
            upsert_holiday(session, values)

        for request_data in DEMO_REQUESTS:
            values = {
                "request_no": request_data["request_no"],
                "employee_id": employees_by_email[request_data["employee_email"]].id,
                "leave_type_id": leave_types_by_name[request_data["leave_type"]].id,
                "start_date": request_data["start_date"],
                "end_date": request_data["end_date"],
                "days": request_data["days"],
                "mode": request_data["mode"],
                "reason": request_data["reason"],
                "status": request_data["status"],
                "requested_on": request_data["requested_on"],
                "approver_id": (
                    manager_id if request_data["status"].value in {"Approved", "Rejected"} else None
                ),
                "decided_at": (
                    datetime.fromisoformat(request_data["decided_at"])
                    if request_data.get("decided_at")
                    else None
                ),
            }
            statement = insert(LeaveRequest).values(**values)
            session.execute(
                statement.on_conflict_do_update(
                    index_elements=[LeaveRequest.request_no],
                    set_={key: value for key, value in values.items() if key != "request_no"},
                )
            )

        current_year = date.today().year
        utilized = demo_utilized(DEMO_REQUESTS)
        seeded_rows = 0
        for email, employee in employees_by_email.items():
            values = {
                **balance_values_for(employee, current_year),
                "opening_annual": MANAGER_OPENING_ANNUAL if email == MANAGER_EMAIL else Decimal("0"),
                "annual_utilized": utilized.get(email, {}).get("annual", Decimal("0")),
                "contingency_utilized": utilized.get(email, {}).get("contingency", Decimal("0")),
            }
            session.execute(
                insert(LeaveBalance)
                .values(**values)
                .on_conflict_do_update(
                    constraint="leave_balances_employee_year_key",
                    set_={key: value for key, value in values.items() if key not in {"employee_id", "year"}},
                )
            )
            seeded_rows += 1

    print(f"Seeded {len(EMPLOYEES)} login profiles, {len(LEAVE_TYPES)} leave types, {len(DEMO_REQUESTS)} requests, {seeded_rows} balances, and {len(HOLIDAYS) + len(INDIA_OPTIONAL_HOLIDAYS)} India holidays.")


def upsert_holiday(session, values: dict) -> None:
    statement = insert(Holiday).values(**values)
    session.execute(
        statement.on_conflict_do_nothing(
            constraint="holidays_unique_entry",
        )
    )


if __name__ == "__main__":
    seed_demo_data()
