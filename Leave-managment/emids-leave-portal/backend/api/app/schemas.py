from datetime import date
from decimal import Decimal
from typing import Literal
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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
