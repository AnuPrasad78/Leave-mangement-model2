from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Identity,
    Index,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    literal_column,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SystemRole(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ADMIN = "admin"


class LeaveStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"


class LeaveMode(str, Enum):
    FULL_DAY = "Full Day"
    FIRST_HALF = "First Half"
    SECOND_HALF = "Second Half"


class SeparationStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"


def enum_type(enum_class: type[Enum], name: str) -> SqlEnum:
    return SqlEnum(
        enum_class,
        name=name,
        native_enum=True,
        values_callable=lambda members: [member.value for member in members],
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (Index("employees_manager_id_idx", "manager_id"),)

    id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), unique=True
    )
    emp_no: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        unique=True,
        server_default=text(
            "('EM-'::text || lpad((nextval('emp_no_seq'::regclass))::text, 5, '0'::text))"
        ),
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    initials: Mapped[str | None] = mapped_column(String(8))
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    job_title: Mapped[str | None] = mapped_column(Text)
    doj: Mapped[date | None] = mapped_column(Date)
    account: Mapped[str | None] = mapped_column(Text)
    project_name: Mapped[str | None] = mapped_column(Text)
    function_name: Mapped[str | None] = mapped_column(Text)
    manager_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("employees.id", ondelete="SET NULL")
    )
    delivery_partner_name: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    system_role: Mapped[SystemRole] = mapped_column(
        enum_type(SystemRole, "system_role"), nullable=False, server_default=text("'employee'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LeaveType(Base):
    __tablename__ = "leave_types"

    id: Mapped[int] = mapped_column(SmallInteger, Identity(), primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    __table_args__ = (
        CheckConstraint("days > 0", name="leave_requests_days_positive"),
        CheckConstraint("end_date >= start_date", name="leave_requests_span_sanity"),
        CheckConstraint(
            "days <= (end_date - start_date + 1)", name="leave_requests_days_within_span"
        ),
        ExcludeConstraint(
            ("employee_id", "="),
            (literal_column("daterange(start_date, end_date, '[]')"), "&&"),
            where=text("status IN ('Pending', 'Approved')"),
            using="gist",
            name="leave_requests_no_active_overlap",
        ),
        Index("leave_requests_employee_idx", "employee_id"),
        Index("leave_requests_status_idx", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    request_no: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        unique=True,
        server_default=text(
            "('LV-'::text || lpad((nextval('leave_request_no_seq'::regclass))::text, 5, '0'::text))"
        ),
    )
    employee_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    leave_type_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("leave_types.id"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    mode: Mapped[LeaveMode] = mapped_column(
        enum_type(LeaveMode, "leave_mode"), nullable=False, server_default=text("'Full Day'")
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[LeaveStatus] = mapped_column(
        enum_type(LeaveStatus, "leave_status"), nullable=False, server_default=text("'Pending'")
    )
    approver_id: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("employees.id", ondelete="SET NULL")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_on: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    __table_args__ = (
        CheckConstraint("year BETWEEN 2000 AND 2999", name="leave_balances_year_range"),
        UniqueConstraint("employee_id", "year", name="leave_balances_employee_year_key"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    opening_annual: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("0"))
    annual_credited: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("0"))
    annual_utilized: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("0"))
    contingency_credited: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("0"))
    contingency_utilized: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("0"))
    annual_cap: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("18"))
    contingency_cap: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, server_default=text("10"))


class Holiday(Base):
    __tablename__ = "holidays"
    __table_args__ = (
        CheckConstraint("year BETWEEN 2000 AND 2999", name="holidays_year_range"),
        CheckConstraint("kind IN ('fixed', 'optional')", name="holidays_kind_valid"),
        UniqueConstraint(
            "country",
            "location",
            "year",
            "kind",
            "holiday_date",
            "name",
            name="holidays_unique_entry",
            postgresql_nulls_not_distinct=True,
        ),
        Index("holidays_country_year_idx", "country", "year"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    country: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class OptionalHolidayPick(Base):
    __tablename__ = "optional_holiday_picks"

    employee_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False),
        ForeignKey("employees.id", ondelete="CASCADE"),
        primary_key=True,
    )
    holiday_id: Mapped[int] = mapped_column(
        ForeignKey("holidays.id", ondelete="CASCADE"), primary_key=True
    )
    picked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class SeparationRequest(Base):
    __tablename__ = "separation_requests"
    __table_args__ = (
        CheckConstraint(
            "reason IN ('Better Opportunity', 'Higher Studies', 'Personal Reasons', "
            "'Health Reasons', 'Relocation', 'Entrepreneurship', 'Career Break', 'Other')",
            name="separation_requests_reason_valid",
        ),
        CheckConstraint(
            "remarks IS NULL OR char_length(remarks) <= 800",
            name="separation_requests_remarks_length",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    status: Mapped[SeparationStatus] = mapped_column(
        enum_type(SeparationStatus, "separation_status"),
        nullable=False,
        server_default=text("'Pending'"),
    )
    reviewed_by: Mapped[str | None] = mapped_column(
        Uuid(as_uuid=False), ForeignKey("employees.id", ondelete="SET NULL")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )