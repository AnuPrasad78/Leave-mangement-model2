from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.pagination import PageParams, page_params, paginate_query
from app.db import get_session, settings
from app.leave_policy import (
    ANNUAL_DAYS_PER_YEAR,
    CARRY_FORWARD_MAX,
    CONTINGENCY_DAYS_PER_YEAR,
    OPTIONAL_HOLIDAYS_MAX,
    carry_forward_amount,
    deduction_pool,
    prorated_annual,
)
from app.models import (
    AuditLog,
    Employee,
    Holiday,
    LeaveBalance,
    LeaveMode,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    Notification,
    OptionalHolidayPick,
    PasswordResetToken,
    SeparationRequest,
    SystemRole,
    User,
)
from app.schemas import (
    AuditLogOutput,
    AuditLogsPageOutput,
    BalanceUpsertInput,
    BulkDecisionInput,
    DecisionInput,
    EmployeeAdminOutput,
    EmployeeCreateInput,
    EmployeeCreateOutput,
    EmployeeAdminRowOutput,
    EmployeeOutput,
    EmployeeUpdateInput,
    EmployeesPageOutput,
    CarryForwardInput,
    LeaveRequestInput,
    LeaveRequestUpdateInput,
    LoginInput,
    NudgeInput,
    OptionalPickInput,
    PasswordResetPerformInput,
    PasswordResetInitOutput,
    SeparationInput,
    TokenOutput,

)
from app.security import create_access_token, get_current_user, hash_password, require_admin, verify_password

router = APIRouter()


@router.post("/auth/login", response_model=TokenOutput)
def login(payload: LoginInput, session: Session = Depends(get_session)) -> TokenOutput:
    user = session.scalar(select(User).where(func.lower(User.email) == payload.email.lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenOutput(access_token=create_access_token(user.id))


@router.post("/auth/logout")
def logout(_: User = Depends(get_current_user)) -> dict[str, bool]:
    return {"ok": True}


def employee_for_user(user: User, session: Session) -> Employee:
    employee = session.scalar(select(Employee).where(Employee.user_id == user.id))
    if employee is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No employee profile is linked to this account")
    return employee


def current_employee(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> Employee:
    return employee_for_user(user, session)


def employee_payload(employee: Employee, session: Session) -> dict:
    payload = EmployeeOutput.model_validate(employee).model_dump(mode="json")
    manager = session.get(Employee, employee.manager_id) if employee.manager_id else None
    payload["manager"] = {"full_name": manager.full_name} if manager else None
    return payload


@router.get("/auth/me")
@router.get("/employees/me")
def get_my_profile(
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> dict:
    return employee_payload(employee, session)


@router.get("/employees/me/team")
def get_my_team_ids(
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[dict[str, str]]:
    reports = session.scalars(select(Employee).where(Employee.manager_id == employee.id)).all()
    return [{"id": report.id} for report in reports]


def can_decide_for(employee: Employee, request_employee: Employee) -> bool:
    return employee.system_role == SystemRole.ADMIN or request_employee.manager_id == employee.id


def request_payload(request: LeaveRequest, employee: Employee, leave_type: LeaveType) -> dict:
    return {
        "request_no": request.request_no,
        "employee_id": request.employee_id,
        "start_date": request.start_date,
        "end_date": request.end_date,
        "days": request.days,
        "mode": request.mode.value,
        "reason": request.reason,
        "status": request.status.value,
        "requested_on": request.requested_on,
        "leave_types": {"name": leave_type.name},
        "employees": {"full_name": employee.full_name, "emp_no": employee.emp_no},
    }


def request_rows(session: Session, employee_ids: list[str]) -> list[dict]:
    if not employee_ids:
        return []
    rows = session.execute(
        select(LeaveRequest, Employee, LeaveType)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .join(LeaveType, LeaveType.id == LeaveRequest.leave_type_id)
        .where(LeaveRequest.employee_id.in_(employee_ids))
        .order_by(LeaveRequest.requested_on.desc(), LeaveRequest.id.desc())
    ).all()
    return [request_payload(request, employee, leave_type) for request, employee, leave_type in rows]


@router.get("/leave-requests/mine")
def list_my_requests(
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[dict]:
    return request_rows(session, [employee.id])


@router.get("/leave-requests/team")
def list_team_requests(
    page: int | None = Query(default=None, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(Pending|Approved|Rejected|Cancelled)$"),
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
):
    if employee.system_role not in {SystemRole.MANAGER, SystemRole.ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")

    def query():
        stmt = (
            select(LeaveRequest, Employee, LeaveType)
            .join(Employee, Employee.id == LeaveRequest.employee_id)
            .join(LeaveType, LeaveType.id == LeaveRequest.leave_type_id)
        )
        # Managers review only their reports; admins review the whole organization.
        if employee.system_role == SystemRole.MANAGER:
            stmt = stmt.where(Employee.manager_id == employee.id)
        if status_filter is not None:
            stmt = stmt.where(LeaveRequest.status == LeaveStatus(status_filter))
        return stmt

    if page is None:
        # Legacy full pull (no paging params): the manager queue and org
        # aggregates need every row, so no envelope and no slicing.
        return request_rows_query(session, query())
    view = paginate_query(session, query(), PageParams(page=page, page_size=page_size),
                          (LeaveRequest.requested_on.desc(), LeaveRequest.id.desc()), tuples=True)
    return {**view, "rows": [request_payload(req, emp, ltype) for req, emp, ltype in view["rows"]]}


def request_rows_query(session: Session, stmt) -> list[dict]:
    rows = session.execute(stmt.order_by(LeaveRequest.requested_on.desc(), LeaveRequest.id.desc())).all()
    return [request_payload(request, employee, leave_type) for request, employee, leave_type in rows]


@router.post("/leave-requests", status_code=status.HTTP_201_CREATED)
def create_leave_request(
    payload: LeaveRequestInput,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    leave_type = session.scalar(
        select(LeaveType).where(LeaveType.name == payload.type, LeaveType.is_active.is_(True))
    )
    if leave_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown or inactive leave type")
    if payload.days <= 0 or payload.to_date < payload.from_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid leave dates or day count")
    if payload.mode != LeaveMode.FULL_DAY and (payload.from_date != payload.to_date or payload.days != Decimal("0.5")):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Half-day requests must be a single 0.5-day date")

    request = LeaveRequest(
        employee_id=employee.id,
        leave_type_id=leave_type.id,
        start_date=payload.from_date,
        end_date=payload.to_date,
        days=payload.days,
        mode=payload.mode,
        reason=payload.reason or "(no reason given)",
        requested_on=payload.requested_on,
    )
    session.add(request)
    try:
        session.commit()
    except Exception as error:
        session.rollback()
        if "leave_requests_no_active_overlap" in str(error) or "exclusion constraint" in str(error).lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dates overlap another active request") from error
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not create leave request") from error
    session.refresh(request)
    return {"requestNo": request.request_no}

@router.put("/leave-requests/{request_no}")
def update_leave_request(
    request_no: str,
    payload: LeaveRequestUpdateInput,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    request = session.scalar(
        select(LeaveRequest)
        .where(
            LeaveRequest.request_no == request_no,
            LeaveRequest.employee_id == employee.id,
        )
        .with_for_update()
    )

    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if request.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending requests can be edited",
        )

    leave_type = session.scalar(
        select(LeaveType).where(
            LeaveType.name == payload.type,
            LeaveType.is_active.is_(True),
        )
    )
    if leave_type is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown or inactive leave type",
        )

    if payload.days <= 0 or payload.to_date < payload.from_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid leave dates or day count",
        )

    if payload.mode != LeaveMode.FULL_DAY and (
        payload.from_date != payload.to_date or payload.days != Decimal("0.5")
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Half-day requests must be a single 0.5-day date",
        )

    request.leave_type_id = leave_type.id
    request.start_date = payload.from_date
    request.end_date = payload.to_date
    request.days = payload.days
    request.mode = payload.mode
    request.reason = payload.reason or "(no reason given)"

    try:
        session.commit()
    except Exception as error:
        session.rollback()
        if "leave_requests_no_active_overlap" in str(error) or "exclusion constraint" in str(error).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Dates overlap another active request",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update leave request",
        ) from error

    return {"ok": True}

def update_balance_for_decision(session: Session, request: LeaveRequest, decision: LeaveStatus) -> None:
    leave_type = session.get(LeaveType, request.leave_type_id)
    if leave_type is None:
        return
    pool = deduction_pool(leave_type.name)
    if pool is None:
        return
    year = request.start_date.year
    request_employee = session.get(Employee, request.employee_id)
    if request_employee is None:
        raise HTTPException(status_code=409, detail="Could not load employee profile")
    values = {
        "employee_id": request.employee_id,
        "year": year,
        "opening_annual": Decimal("0"),
        "annual_credited": prorated_annual(request_employee.doj, year),
        "annual_utilized": Decimal("0"),
        "contingency_credited": CONTINGENCY_DAYS_PER_YEAR,
        "contingency_utilized": Decimal("0"),
        "annual_cap": ANNUAL_DAYS_PER_YEAR,
        "contingency_cap": CONTINGENCY_DAYS_PER_YEAR,
    }
    session.execute(
        insert(LeaveBalance).values(**values).on_conflict_do_nothing(
            constraint="leave_balances_employee_year_key"
        )
    )
    balance = session.scalar(
        select(LeaveBalance)
        .where(LeaveBalance.employee_id == request.employee_id, LeaveBalance.year == year)
        .with_for_update()
    )
    if balance is None:
        raise HTTPException(status_code=409, detail="Could not load leave balance")

    if decision == LeaveStatus.APPROVED:
        if pool == "annual":
            remaining = balance.opening_annual + balance.annual_credited - balance.annual_utilized
            if request.days > remaining:
                raise HTTPException(status_code=409, detail="Insufficient annual leave balance")
            balance.annual_utilized += request.days
        else:
            remaining = balance.contingency_credited - balance.contingency_utilized
            if request.days > remaining:
                raise HTTPException(status_code=409, detail="Insufficient contingency leave balance")
            balance.contingency_utilized += request.days


def decide_requests(
    request_numbers: list[str], decision: LeaveStatus, employee: Employee, session: Session
) -> None:
    requests = session.scalars(
        select(LeaveRequest).where(LeaveRequest.request_no.in_(request_numbers)).with_for_update()
    ).all()
    if len(requests) != len(set(request_numbers)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more requests were not found")
    for request in requests:
        if request.employee_id == employee.id:
            # can_decide_for admits admins for every employee, including
            # themselves — deciding your own request must stay forbidden.
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot decide your own leave request")
        request_employee = session.get(Employee, request.employee_id)
        if request_employee is None or not can_decide_for(employee, request_employee):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to decide this request")
        if request.status != LeaveStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending requests can be decided")
    try:
        for request in requests:
            request_employee = session.get(Employee, request.employee_id)
            if decision == LeaveStatus.APPROVED:
                update_balance_for_decision(session, request, decision)
            request.status = decision
            request.approver_id = employee.id
            request.decided_at = datetime.now(timezone.utc)
            _notify_decision(session, request, request_employee, employee, decision)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not save request decision") from error


@router.post("/leave-requests/{request_no}/cancel")
def cancel_leave_request(
    request_no: str,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    request = session.scalar(
        select(LeaveRequest).where(
            LeaveRequest.request_no == request_no,
            LeaveRequest.employee_id == employee.id,
        ).with_for_update()
    )
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if request.status != LeaveStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending requests can be cancelled")
    request.status = LeaveStatus.CANCELLED
    session.commit()
    return {"ok": True}


@router.post("/leave-requests/{request_no}/decision")
def decide_one(
    request_no: str,
    payload: DecisionInput,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    decide_requests([request_no], LeaveStatus(payload.decision), employee, session)
    return {"ok": True}


@router.post("/leave-requests/bulk-decision")
def decide_many(
    payload: BulkDecisionInput,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    decide_requests(payload.request_nos, LeaveStatus(payload.decision), employee, session)
    return {"ok": True}


@router.get("/balances/me")
def get_latest_balance(
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> dict | None:
    balance = session.scalar(
        select(LeaveBalance)
        .where(LeaveBalance.employee_id == employee.id)
        .order_by(LeaveBalance.year.desc())
        .limit(1)
    )
    if balance is None:
        return None
    return {column.name: getattr(balance, column.name) for column in LeaveBalance.__table__.columns}


@router.get("/leave-types")
def list_leave_types(
    _: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[dict[str, str]]:
    leave_types = session.scalars(
        select(LeaveType).where(LeaveType.is_active.is_(True)).order_by(LeaveType.id)
    ).all()
    return [{"name": leave_type.name} for leave_type in leave_types]


@router.get("/holidays")
def list_holidays(
    _: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[dict]:
    holidays = session.scalars(
        select(Holiday).where(Holiday.country == "India").order_by(Holiday.holiday_date)
    ).all()
    return [{column.name: getattr(holiday, column.name) for column in Holiday.__table__.columns} for holiday in holidays]


@router.get("/holidays/upcoming")
def list_upcoming_holidays(
    from_date: date,
    _: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> list[dict]:
    holidays = session.scalars(
        select(Holiday)
        .where(Holiday.country == "India", Holiday.holiday_date >= from_date)
        .order_by(Holiday.holiday_date)
    ).all()
    return [
        {"id": holiday.id, "kind": holiday.kind, "holiday_date": holiday.holiday_date, "name": holiday.name, "location": holiday.location}
        for holiday in holidays
    ]


@router.get("/holidays/picks")
def list_my_picks(
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[int]:
    return list(
        session.scalars(
            select(OptionalHolidayPick.holiday_id).where(OptionalHolidayPick.employee_id == employee.id)
        ).all()
    )


@router.post("/holidays/picks", status_code=status.HTTP_201_CREATED)
def add_pick(
    payload: OptionalPickInput,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    holiday = session.get(Holiday, payload.holiday_id)
    if holiday is None or holiday.country != "India" or holiday.kind != "optional":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Optional India holiday not found")
    try:
        lock_key = f"optional-picks:{employee.id}:{holiday.country}:{holiday.year}"
        session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:lock_key, 0))"),
            {"lock_key": lock_key},
        )
        exists = session.get(OptionalHolidayPick, (employee.id, holiday.id))
        if exists:
            return {"ok": True}
        count = session.scalar(
            select(func.count())
            .select_from(OptionalHolidayPick)
            .join(Holiday, Holiday.id == OptionalHolidayPick.holiday_id)
            .where(
                OptionalHolidayPick.employee_id == employee.id,
                Holiday.country == holiday.country,
                Holiday.year == holiday.year,
            )
        )
        if count >= OPTIONAL_HOLIDAYS_MAX:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"You can choose only {OPTIONAL_HOLIDAYS_MAX} optional holidays per year",
            )
        session.add(OptionalHolidayPick(employee_id=employee.id, holiday_id=holiday.id))
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not save optional holiday pick") from error
    return {"ok": True}


@router.delete("/holidays/picks/{holiday_id}")
def remove_pick(
    holiday_id: int,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    pick = session.get(OptionalHolidayPick, (employee.id, holiday_id))
    if pick is not None:
        session.delete(pick)
        session.commit()
    return {"ok": True}


@router.post("/separation-requests", status_code=status.HTTP_201_CREATED)
def create_separation_request(
    payload: SeparationInput,
    employee: Employee = Depends(current_employee),
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    session.add(
        SeparationRequest(
            employee_id=employee.id,
            last_working_day=payload.last_working_day,
            reason=payload.reason,
            remarks=payload.remarks,
        )
    )
    session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Admin persona (Phases 3+): audit, employee management, policies, balances.
# Mutating admin endpoints are audited; list reads are not (they would flood
# the append-only table), noted in the handoff report.
# --------------------------------------------------------------------------

def employee_admin_payload(employee: Employee, session: Session) -> dict:
    is_active = True
    if employee.user_id is not None:
        user = session.get(User, employee.user_id)
        if user is not None:
            is_active = user.is_active
    payload = EmployeeOutput.model_validate(employee).model_dump(mode="json")
    payload["is_active"] = is_active
    return payload


def _audit(request: Request, admin: Employee, session: Session, action: str, target_type: str, target_id: str | None, detail: dict | None = None) -> None:
    record_audit(
        session,
        actor=admin,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        request_ip=request.client.host if request.client else None,
    )


def _jsonable(value):
    """JSONB detail columns need plain JSON types (dates and Decimals especially)."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


@router.post("/admin/employees", status_code=status.HTTP_201_CREATED)
def admin_create_employee(
    payload: EmployeeCreateInput,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> EmployeeCreateOutput:
    if payload.manager_id is not None and session.get(Employee, payload.manager_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")

    temporary_password = payload.temporary_password or secrets.token_urlsafe(12)
    try:
        user = User(email=payload.email, password_hash=hash_password(temporary_password), is_active=True)
        session.add(user)
        session.flush()
        employee = Employee(
            email=payload.email,
            user_id=user.id,
            full_name=payload.full_name,
            initials=payload.initials,
            job_title=payload.job_title,
            doj=payload.doj,
            account=payload.account,
            project_name=payload.project_name,
            function_name=payload.function_name,
            manager_id=payload.manager_id,
            delivery_partner_name=payload.delivery_partner_name,
            location=payload.location,
            system_role=SystemRole(payload.system_role),
        )
        session.add(employee)
        session.flush()
        balance_year = date.today().year
        balance = LeaveBalance(
            employee_id=employee.id,
            year=balance_year,
            annual_credited=prorated_annual(payload.doj, balance_year),
            contingency_credited=CONTINGENCY_DAYS_PER_YEAR,
            annual_cap=ANNUAL_DAYS_PER_YEAR,
            contingency_cap=CONTINGENCY_DAYS_PER_YEAR,
        )
        session.add(balance)
        session.commit()
    except Exception as error:
        session.rollback()
        if "employees_email_key" in str(error) or "users_email_key" in str(error) or "unique" in str(error).lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from error
        if "employees_manager_id_fkey" in str(error):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found") from error
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not create employee") from error
    session.refresh(employee)
    _audit(request, admin, session, "employee_created", "employee", employee.id, {
        "email": employee.email,
        "system_role": employee.system_role.value,
        "manager_id": employee.manager_id,
        "leave_balance": {
            "year": balance_year,
            "annual_credited": _jsonable(balance.annual_credited),
            "contingency_credited": _jsonable(balance.contingency_credited),
            "annual_cap": _jsonable(balance.annual_cap),
            "contingency_cap": _jsonable(balance.contingency_cap),
        },
    })
    session.commit()
    return EmployeeCreateOutput(
        employee=employee_admin_payload(employee, session),  # pydantic coerces the dict
        temporary_password=payload.temporary_password if payload.temporary_password else temporary_password,
    )


@router.put("/admin/employees/{employee_id}")
def admin_update_employee(
    employee_id: str,
    payload: EmployeeUpdateInput,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    employee = session.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    if values.get("manager_id"):
        proposed_manager = session.get(Employee, values["manager_id"])
        if proposed_manager is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
        if values["manager_id"] == employee.id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="An employee cannot be their own manager")
        if proposed_manager.system_role == SystemRole.EMPLOYEE:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Pick someone in the manager role")
        proposed_manager_user = session.get(User, proposed_manager.user_id) if proposed_manager.user_id else None
        if proposed_manager_user is None or not proposed_manager_user.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="That manager is not active")

    if "system_role" in values and values["system_role"] != employee.system_role.value:
        self_role_change = employee.id == admin.id
        if self_role_change:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot change your own role")
        if values["system_role"] != "admin" and employee.system_role == SystemRole.ADMIN:
            remaining_admins = session.scalar(
                select(func.count()).select_from(Employee).where(
                    Employee.system_role == SystemRole.ADMIN,
                    Employee.id != employee.id,
                )
            )
            if not remaining_admins:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Cannot demote the last active admin of the organization",
                )
        # Settled-team guard (roster desk rule): nobody loses the manager cap
        # (or demotes themselves out of the queue) while active reports hang
        # off them — reassign those people first.
        if employee.system_role == SystemRole.MANAGER or (employee.system_role == SystemRole.ADMIN and values["system_role"] != "manager"):
            active_reports = session.scalar(
                select(func.count()).select_from(Employee).where(
                    Employee.manager_id == employee.id,
                    Employee.system_role == SystemRole.EMPLOYEE,
                )
            )
            if active_reports:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"{employee.full_name} still has {active_reports} active direct reports — reassign them first",
                )
        if values["system_role"] == "employee":
            manager_id = values.get("manager_id") or employee.manager_id
            if not manager_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Employees need a reporting manager",
                )
            manager = session.get(Employee, manager_id)
            if manager is None or manager.system_role == SystemRole.EMPLOYEE:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Pick someone in the manager role",
                )
            manager_user = session.get(User, manager.user_id) if manager.user_id else None
            if manager_user is None or not manager_user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="That manager is not active",
                )

    if "email" in values and values["email"] != employee.email:
        duplicate = session.scalar(select(Employee).where(func.lower(Employee.email) == values["email"].lower()))
        if duplicate is not None and duplicate.id != employee.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    before = {field: getattr(employee, field) for field in values}
    for field, value in values.items():
        setattr(employee, field, value)
    if "email" in values and employee.user_id is not None:
        linked_user = session.get(User, employee.user_id)
        if linked_user is not None:
            linked_user.email = values["email"]

    try:
        session.commit()
    except Exception as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not update employee") from error

    session.refresh(employee)
    _audit(request, admin, session, "employee_updated", "employee", employee.id, {
        field: {"before": _jsonable(before[field]), "after": _jsonable(getattr(employee, field))}
        for field in values
    })
    session.commit()
    return employee_admin_payload(employee, session)


@router.post("/admin/employees/{employee_id}/deactivate")
def admin_deactivate_employee(
    employee_id: str,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return _admin_set_active(employee_id, False, admin, session, request)


@router.post("/admin/employees/{employee_id}/activate")
def admin_activate_employee(
    employee_id: str,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    return _admin_set_active(employee_id, True, admin, session, request)


def _admin_set_active(
    employee_id: str, active: bool, admin: Employee, session: Session, request: Request
) -> dict:
    employee = session.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")
    if employee.user_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No linked login for this employee")
    user = session.get(User, employee.user_id)
    if user is None or user.is_active == active:
        return {"ok": True}
    user.is_active = active
    session.commit()
    _audit(request, admin, session, "employee_deactivated" if not active else "employee_activated", "employee", employee.id)
    session.commit()
    return {"ok": True}


EMPLOYEE_SORT_COLUMNS = {
    "full_name": Employee.full_name,
    "doj": Employee.doj,
    "emp_no": Employee.emp_no,
}


@router.get("/admin/employees", response_model=EmployeesPageOutput)
def admin_list_employees(
    search: str | None = None,
    role: str | None = Query(default=None, pattern="^(employee|manager|admin)$"),
    active: bool | None = None,
    manager_id: str | None = None,
    sort: str = Query(default="full_name", pattern="^(full_name|doj|emp_no)$"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    params: PageParams = Depends(page_params),
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    query = select(Employee)
    # A linked account that was switched off takes the row out of the active
    # view; rows with no login at all always count as active.
    if active is not None:
        query = query.outerjoin(User, User.id == Employee.user_id)
        query = query.where(
            or_(Employee.user_id.is_(None), User.is_active.is_(True))
            if active
            else User.is_active.is_(False)
        )
    if role is not None:
        query = query.where(Employee.system_role == SystemRole(role))
    if manager_id:
        query = query.where(Employee.manager_id == manager_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            Employee.full_name.ilike(pattern)
            | Employee.email.ilike(pattern)
            | Employee.emp_no.ilike(pattern)
        )

    sort_col = EMPLOYEE_SORT_COLUMNS[sort]
    direction = sort_col.desc() if order == "desc" else sort_col.asc()
    view = paginate_query(session, query, params, (direction.nulls_last(), Employee.id.asc()))

    user_ids = [employee.user_id for employee in view["rows"] if employee.user_id is not None]
    active_by_id: dict[str, bool] = {}
    if user_ids:
        for user in session.scalars(select(User).where(User.id.in_(user_ids))).all():
            active_by_id[user.id] = user.is_active

    ids = sorted({employee.manager_id for employee in view["rows"] if employee.manager_id})
    manager_names: dict[str, str] = {}
    if ids:
        manager_names = dict(
            session.execute(select(Employee.id, Employee.full_name).where(Employee.id.in_(ids))).all()
        )

    items = []
    for employee in view["rows"]:
        payload = employee_admin_row_payload(employee, employee_admin_payload(employee, session), active_by_id, manager_names)
        items.append(payload)
    return {**view, "rows": items}


def employee_admin_row_payload(
    employee: Employee,
    payload: dict,
    active_by_id: dict[str, bool],
    manager_names: dict[str, str],
) -> dict:
    payload["is_active"] = active_by_id.get(employee.user_id, True)
    payload["manager_name"] = manager_names.get(employee.manager_id)
    return payload


@router.get("/admin/audit-logs", response_model=AuditLogsPageOutput)
def admin_list_audit_logs(
    employee_id: str | None = None,
    action: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(page_params),
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    query = select(AuditLog)
    if employee_id is not None:
        query = query.where(
            AuditLog.actor_employee_id == employee_id
        )
    if action is not None:
        query = query.where(AuditLog.action == action)
    if target_type is not None:
        query = query.where(AuditLog.target_type == target_type)
    if target_id is not None:
        query = query.where(AuditLog.target_id == target_id)
    if date_from is not None:
        query = query.where(func.date(AuditLog.created_at) >= date_from)
    if date_to is not None:
        query = query.where(func.date(AuditLog.created_at) <= date_to)
    view = paginate_query(session, query, params, (AuditLog.created_at.desc(), AuditLog.id.desc()))
    view["rows"] = [AuditLogOutput.model_validate(row).model_dump(mode="json") for row in view["rows"]]
    return view


# --------------------------------------------------------------------------
# Password reset (Phase 4): admin initializes, employee self-serves the new
# password through the public endpoint. Tokens are stored hashed and are
# single-use; delivery is admin-copied (see ADMIN_DECISIONS.md Q4).
# --------------------------------------------------------------------------


@router.post("/admin/employee-password-resets/{user_id}/init")
def admin_init_password_reset(
    user_id: str,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot reset the password of a deactivated user; reactivate first",
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES)
    session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_password(token),
            expires_at=expires_at,
            created_by=admin.user_id,
        )
    )
    _audit(
        request, admin, session, "password_reset_initialized", "user", user.id,
        {"expires_at": expires_at.isoformat()},
    )
    session.commit()
    return PasswordResetInitOutput(
        reset_token=token,
        reset_endpoint=f"/auth/password-reset/{token}",
        expires_at=expires_at,
    ).model_dump(mode="json")


@router.post("/auth/password-reset/{token}")
def perform_password_reset(
    token: str,
    payload: PasswordResetPerformInput,
    session: Session = Depends(get_session),
) -> dict[str, bool]:
    now = datetime.now(timezone.utc)
    live_tokens = session.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    ).all()
    match = next(
        (row for row in live_tokens if verify_password(token, row.token_hash)), None
    )
    if match is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
        )
    user = session.get(User, match.user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.password_hash = hash_password(payload.password)
    match.used_at = now
    for stale in live_tokens:
        if stale.user_id == match.user_id and stale.id != match.id:
            stale.used_at = now
    session.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Leave policies and balances (Phase 5)
# --------------------------------------------------------------------------


@router.get("/admin/leave-policies")
def admin_read_leave_policies(
    admin: Employee = Depends(require_admin),
) -> dict:
    from app.leave_policy import (
        ANNUAL_DAYS_PER_YEAR,
        CONTINGENCY_DAYS_PER_YEAR,
        CARRY_FORWARD_MAX,
        OPTIONAL_HOLIDAYS_MAX,
        PRORATION_METHOD,
    )

    return {
        "annual_days_per_year": float(ANNUAL_DAYS_PER_YEAR),
        "contingency_days_per_year": float(CONTINGENCY_DAYS_PER_YEAR),
        "carry_forward_max": float(CARRY_FORWARD_MAX),
        "optional_holidays_max": OPTIONAL_HOLIDAYS_MAX,
        "prorated_by": "doj",
        "proration_method": PRORATION_METHOD,
    }


@router.get("/admin/leave-balances")
def admin_list_leave_balances(
    year: int | None = None,
    params: PageParams = Depends(page_params),
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    if year is None:
        year = date.today().year
    def balances_query():
        return (
            select(LeaveBalance, Employee.full_name, Employee.emp_no, Employee.system_role)
            .join(Employee, Employee.id == LeaveBalance.employee_id)
            .where(LeaveBalance.year == year)
        )
    view = paginate_query(
        session,
        balances_query(),
        params,
        (Employee.full_name.asc(), Employee.id.asc()),
        tuples=True,
    )
    items = []
    for balance, full_name, emp_no, system_role in view["rows"]:
        payload = {column.name: getattr(balance, column.name) for column in LeaveBalance.__table__.columns}
        payload.pop("id", None)
        payload["employee"] = {
            "id": balance.employee_id,
            "full_name": full_name,
            "emp_no": emp_no,
            "system_role": system_role.value,
        }
        items.append(payload)
    return {**view, "rows": items, "year": year}


@router.put("/admin/leave-balances/{employee_id}/{year}")
def admin_upsert_leave_balance(
    employee_id: str,
    year: int,
    payload: BalanceUpsertInput,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    employee = session.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    balance = session.scalar(
        select(LeaveBalance).where(
            LeaveBalance.employee_id == employee_id, LeaveBalance.year == year
        )
    )
    existed = balance is not None
    if not existed:
        balance = LeaveBalance(employee_id=employee_id, year=year)
        session.add(balance)
        session.flush()

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No fields to update")

    floor_field = {
        "annual_credited": balance.annual_utilized,
        "opening_annual": balance.annual_utilized,
        "annual_cap": balance.annual_utilized,
        "contingency_credited": balance.contingency_utilized,
        "contingency_cap": balance.contingency_utilized,
    }
    for field, value in changes.items():
        if value is not None and value < floor_field[field]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field} cannot go below what has already been utilized",
            )

    before = {field: getattr(balance, field) for field in changes}
    for field, value in changes.items():
        setattr(balance, field, value)

    try:
        session.commit()
    except Exception as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not save the balance") from error

    session.refresh(balance)
    detail = {
        field: {"before": _jsonable(before[field]), "after": _jsonable(getattr(balance, field))}
        for field in changes
    }
    if not existed:
        detail["employee"] = employee.full_name
        detail["year"] = year
    _audit(
        request, admin, session,
        "balance_created" if not existed else "balance_updated",
        "leave_balance", f"{employee_id}:{year}",
        detail,
    )
    session.commit()
    return {column.name: getattr(balance, column.name) for column in LeaveBalance.__table__.columns}


@router.get("/admin/requests/stale")
def admin_list_stale_requests(
    before: date,
    params: PageParams = Depends(page_params),
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    """Past-dated pending requests (end_date < before) with leave-context evidence,
    standing in for the attendance module this repo does not have (ADMIN_DECISIONS.md Q1).
    Paging also bounds the per-row evidence lookups to the page itself."""
    def stale_query():
        return (
            select(LeaveRequest, Employee, LeaveType)
            .join(Employee, Employee.id == LeaveRequest.employee_id)
            .join(LeaveType, LeaveType.id == LeaveRequest.leave_type_id)
            .where(
                LeaveRequest.status == LeaveStatus.PENDING,
                LeaveRequest.end_date < before,
            )
        )
    view = paginate_query(
        session,
        stale_query(),
        params,
        (LeaveRequest.end_date.asc(), LeaveRequest.id.asc()),
        tuples=True,
    )
    items = []
    for request, employee, leave_type in view["rows"]:
        evidence = _leave_context_evidence(session, request)
        items.append({**request_payload(request, employee, leave_type), "evidence": evidence})
    return {**view, "rows": items}


def _leave_context_evidence(session: Session, request: LeaveRequest) -> dict:
    """Approved Work From Home / Business Travel requests in a ±7-day neighborhood
    of the request window plus holidays inside it, as read-only context for the
    reviewing admin. Truly overlapping rows can never exist (the no-active-overlap
    exclusion constraint), so the neighborhood stands in for the attendance
    module this repo does not have (ADMIN_DECISIONS.md Q1)."""
    from datetime import timedelta

    window_start, window_end = request.start_date, request.end_date
    neighbors = session.execute(
        select(LeaveRequest, Employee, LeaveType)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .join(LeaveType, LeaveType.id == LeaveRequest.leave_type_id)
        .where(
            LeaveRequest.employee_id == request.employee_id,
            LeaveRequest.status == LeaveStatus.APPROVED,
            LeaveRequest.id != request.id,
            LeaveRequest.leave_type_id == LeaveType.id,
            LeaveType.name.in_(["Work From Home", "Business Travel"]),
            LeaveRequest.start_date <= window_end + timedelta(days=7),
            LeaveRequest.end_date >= window_start - timedelta(days=7),
        )
        .order_by(LeaveRequest.start_date)
    ).all()
    evidence_rows = [
        {
            "request_no": row_request.request_no,
            "leave_type": row_leave_type.name,
            "start_date": row_request.start_date,
            "end_date": row_request.end_date,
            "status": row_request.status.value,
        }
        for row_request, _row_employee, row_leave_type in neighbors
    ]
    holidays = session.scalars(
        select(Holiday)
        .where(Holiday.holiday_date.between(window_start, window_end))
        .order_by(Holiday.holiday_date)
    ).all()
    return {
        "window": {"from": window_start, "to": window_end},
        "nearby_approved": evidence_rows,
        "holidays": [
            {"holiday_date": holiday.holiday_date, "name": holiday.name, "kind": holiday.kind}
            for holiday in holidays
        ],
    }


# --------------------------------------------------------------------------
# Year-end carry-forward (Phase 7). Admin-triggered, strictly the previous
# year, idempotent for unchanged source balances (ADMIN_DECISIONS.md Q8).
# --------------------------------------------------------------------------


@router.post("/admin/leave-requests/carry-forward")
def admin_carry_forward(
    payload: CarryForwardInput,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    target_year = payload.year + 1
    if payload.year != date.today().year - 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Carry-forward may only run for the previous year",
        )

    lock_key = f"carry-forward:{target_year}"
    session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:lock_key, 0))"),
        {"lock_key": lock_key},
    )

    balances = session.scalars(select(LeaveBalance).where(LeaveBalance.year == payload.year)).all()
    results = {}
    for balance in balances:
        employee = session.get(Employee, balance.employee_id)
        if employee is None:
            continue
        remaining = balance.opening_annual + balance.annual_credited - balance.annual_utilized
        carried = carry_forward_amount(remaining)
        next_row = session.scalars(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == balance.employee_id,
                LeaveBalance.year == target_year,
            )
        ).first()
        if next_row is None:
            session.add(
                LeaveBalance(
                    employee_id=balance.employee_id,
                    year=target_year,
                    opening_annual=carried,
                    annual_credited=prorated_annual(employee.doj, target_year),
                    contingency_credited=CONTINGENCY_DAYS_PER_YEAR,
                    annual_cap=ANNUAL_DAYS_PER_YEAR,
                    contingency_cap=CONTINGENCY_DAYS_PER_YEAR,
                )
            )
        else:
            next_row.opening_annual = max(carried, Decimal("0"))
        results[employee.full_name] = {
            "remaining": float(remaining),
            "carried": float(carried),
            "year": target_year,
        }

    _audit(
        request, admin,
        session, "carry_forward", "leave_balance", str(target_year),
        {"source_year": payload.year, "employees": results},
    )
    session.commit()
    return {"ok": True, "source_year": payload.year, "target_year": target_year, "employees": len(results)}


# --------------------------------------------------------------------------
# Decision notifications (Phase 6): rows written inside the decision
# transaction; read endpoint below (ADMIN_DECISIONS.md Q7).
# --------------------------------------------------------------------------


@router.post("/admin/notifications")
def admin_send_nudge(
    payload: NudgeInput,
    request: Request,
    admin: Employee = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    """In-app nudge to the managers (or anyone) holding pending decisions:
    writes one Notification per recipient plus a single audit row."""
    recipient_ids = list(dict.fromkeys(payload.recipient_employee_ids))
    recipients = {
        row.id: row
        for row in session.scalars(select(Employee).where(Employee.id.in_(recipient_ids))).all()
    }
    missing = [recipient_id for recipient_id in recipient_ids if recipient_id not in recipients]
    if missing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    for recipient in recipients.values():
        session.add(
            Notification(
                recipient_employee_id=recipient.id,
                kind="admin_nudge",
                title=payload.title,
                body=payload.body,
                target_type="admin_nudge",
            )
        )
    _audit(
        request, admin, session, "nudge_sent", "notification", None,
        {"title": payload.title, "recipient_ids": recipient_ids},
    )
    try:
        session.commit()
    except Exception as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Could not send the nudge") from error
    return {"ok": True, "recipients": len(recipient_ids)}


def _notify_decision(session: Session, request: LeaveRequest, request_employee: Employee, approver: Employee, decision: LeaveStatus) -> None:
    title = f"Leave request {request.request_no} {decision.value}"
    session.add(
        Notification(
            recipient_employee_id=request_employee.id,
            kind="request_decided",
            title=title,
            body=f"Your {request.start_date.isoformat()} leave request was {decision.value} by {approver.full_name}.",
            target_type="leave_request",
            target_id=request.request_no,
        )
    )
    if request_employee.manager_id is not None and request_employee.manager_id != approver.id:
        session.add(
            Notification(
                recipient_employee_id=request_employee.manager_id,
                kind="team_request_decided",
                title=f"{request_employee.full_name}'s request {request.request_no} {decision.value}",
                body=f"Decided by {approver.full_name} covering {request.start_date.isoformat()} to {request.end_date.isoformat()}.",
                target_type="leave_request",
                target_id=request.request_no,
            )
        )


@router.get("/notifications")
def list_my_notifications(
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[dict]:
    rows = session.scalars(
        select(Notification)
        .where(Notification.recipient_employee_id == employee.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    ).all()
    return [
        {
            "id": notification.id,
            "kind": notification.kind,
            "title": notification.title,
            "body": notification.body,
            "target_type": notification.target_type,
            "target_id": notification.target_id,
            "read_at": notification.read_at,
            "created_at": notification.created_at,
        }
        for notification in rows
    ]
