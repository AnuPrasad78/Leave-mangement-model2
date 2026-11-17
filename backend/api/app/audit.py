"""Append-only audit trail writer for admin actions.

Rows are never updated or deleted; the table has no read endpoint logic here —
read endpoints live in routes.py. Call record_audit on an open session, just
before the enclosing commit, so the row lands atomically with the action.
"""

import ipaddress

from sqlalchemy.orm import Session

from app.models import AuditLog, Employee


def _parsed_ip(value: str | None) -> str | None:
    """The `request_ip` column is INET; TestClients and proxies can report
    hostnames, which are dropped rather than crashing the write."""
    if value is None:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def record_audit(
    session: Session,
    *,
    actor: Employee,
    action: str,
    target_type: str,
    target_id: str | None = None,
    detail: dict | None = None,
    request_ip: str | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_user_id=actor.user_id,
            actor_employee_id=actor.id,
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id is not None else None,
            detail_json=detail,
            request_ip=_parsed_ip(request_ip),
        )
    )
