from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import (
    Employee,
    Holiday,
    LeaveBalance,
    LeaveMode,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    OptionalHolidayPick,
    SeparationRequest,
    SystemRole,
    User,
)
from app.schemas import (
    BulkDecisionInput,
    DecisionInput,
    EmployeeOutput,
    LeaveRequestInput,
    LeaveRequestUpdateInput,
    LoginInput,
    OptionalPickInput,
    SeparationInput,
    TokenOutput,

)
from app.security import create_access_token, get_current_user, verify_password

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
    employee: Employee = Depends(current_employee), session: Session = Depends(get_session)
) -> list[dict]:
    if employee.system_role not in {SystemRole.MANAGER, SystemRole.ADMIN}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    report_ids = list(session.scalars(select(Employee.id).where(Employee.manager_id == employee.id)).all())
    return request_rows(session, report_ids)


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
    if leave_type is None or leave_type.name in {
        "Work From Home", "Business Travel", "Leave Without Pay", "Loss Of Pay"
    }:
        return
    pool = "contingency" if leave_type.name == "Contingency Bucket" else "annual"
    year = request.start_date.year
    values = {
        "employee_id": request.employee_id,
        "year": year,
        "opening_annual": Decimal("0"),
        "annual_credited": Decimal("18"),
        "annual_utilized": Decimal("0"),
        "contingency_credited": Decimal("10"),
        "contingency_utilized": Decimal("0"),
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
        request_employee = session.get(Employee, request.employee_id)
        if request_employee is None or not can_decide_for(employee, request_employee):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to decide this request")
        if request.status != LeaveStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending requests can be decided")
    try:
        for request in requests:
            if decision == LeaveStatus.APPROVED:
                update_balance_for_decision(session, request, decision)
            request.status = decision
            request.approver_id = employee.id
            request.decided_at = datetime.now(timezone.utc)
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
        if count >= 3:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You can choose only 3 optional holidays per year")
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
