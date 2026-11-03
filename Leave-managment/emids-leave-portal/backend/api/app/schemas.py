from datetime import date
from decimal import Decimal
from typing import Literal
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import LeaveMode


class LoginInput(BaseModel):
    email: str
    password: str


class TokenOutput(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class LeaveRequestInput(BaseModel):
    type: str
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    days: Decimal
    mode: LeaveMode
    reason: str
    requested_on: date = Field(alias="requestedOn")

    model_config = ConfigDict(populate_by_name=True)

class LeaveRequestUpdateInput(BaseModel):
    type: str
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")
    days: Decimal
    mode: LeaveMode
    reason: str

    model_config = ConfigDict(populate_by_name=True)

class DecisionInput(BaseModel):
    decision: Literal["Approved", "Rejected"]


class BulkDecisionInput(DecisionInput):
    request_nos: list[str] = Field(min_length=1, max_length=100)


class SeparationInput(BaseModel):
    last_working_day: date
    reason: Literal[
        "Better Opportunity",
        "Higher Studies",
        "Personal Reasons",
        "Health Reasons",
        "Relocation",
        "Entrepreneurship",
        "Career Break",
        "Other",
    ]
    remarks: str | None = Field(default=None, max_length=800)


class OptionalPickInput(BaseModel):
    holiday_id: int


class EmployeeOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str | None
    emp_no: str
    full_name: str
    initials: str | None
    email: str
    job_title: str | None
    doj: date | None
    account: str | None
    project_name: str | None
    function_name: str | None
    manager_id: str | None
    delivery_partner_name: str | None
    location: str | None
    system_role: str
    created_at: datetime | None = None


class EmployeeCreateInput(BaseModel):
    """Admin creates a User + linked Employee. system_role is restricted to
    employee|manager here; promote/demote runs through PUT on an existing row."""

    full_name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    system_role: Literal["employee", "manager"] = "employee"
    temporary_password: str | None = Field(default=None, min_length=8, max_length=128)
    initials: str | None = Field(default=None, max_length=8)
    job_title: str | None = None
    doj: date | None = None
    account: str | None = None
    project_name: str | None = None
    function_name: str | None = None
    manager_id: str | None = None
    delivery_partner_name: str | None = None
    location: str | None = None


class EmployeeUpdateInput(BaseModel):
    """Partial profile edit. Note: system_role is NOT editable here."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, min_length=3, max_length=320)
    initials: str | None = Field(default=None, max_length=8)
    job_title: str | None = None
    doj: date | None = None
    account: str | None = None
    project_name: str | None = None
    function_name: str | None = None
    manager_id: str | None = None
    delivery_partner_name: str | None = None
    location: str | None = None


class EmployeeAdminOutput(EmployeeOutput):
    is_active: bool


class AuditLogOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_user_id: str | None
    actor_employee_id: str | None
    action: str
    target_type: str
    target_id: str | None
    detail_json: dict | None
    request_ip: str | None
    created_at: datetime | None = None

    @field_validator("request_ip", mode="before")
    @classmethod
    def _stringify_inet(cls, value):
        # inet columns load as ipaddress objects; audit rows are plain text to clients
        return str(value) if value is not None else None


class AuditLogsPageOutput(BaseModel):
    items: list[AuditLogOutput]
    total: int


class EmployeesPageOutput(BaseModel):
    items: list[EmployeeAdminOutput]
    total: int


class EmployeeCreateOutput(BaseModel):
    employee: EmployeeAdminOutput
    temporary_password: str | None = None


class PasswordResetInitOutput(BaseModel):
    """The plaintext token is returned once, for the admin to hand over out-of-band."""

    reset_token: str
    reset_endpoint: str
    expires_at: datetime


class PasswordResetPerformInput(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class BalanceUpsertInput(BaseModel):
    """Admin-authored balance corrections; utilized columns are never writable."""

    annual_credited: Decimal | None = None
    contingency_credited: Decimal | None = None
    opening_annual: Decimal | None = None
    annual_cap: Decimal | None = None
    contingency_cap: Decimal | None = None


class CarryForwardInput(BaseModel):
    year: int

    model_config = ConfigDict(strict=False)
