from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session, settings
from app.models import Employee, SystemRole, User

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)

SESSION_COOKIE_NAME = settings.SESSION_COOKIE_NAME


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expires_at}, settings.JWT_SECRET, algorithm="HS256")


def set_session_cookie(response: Response, token: str) -> None:
    """Send the session JWT as an HttpOnly cookie (js cannot read it)."""
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.ACCESS_TOKEN_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_MINUTES * 60,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        domain=settings.SESSION_COOKIE_DOMAIN or None,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Delete the session cookie using the attributes it was set with."""
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        domain=settings.SESSION_COOKIE_DOMAIN or None,
    )


def _decode_token(token: str) -> str:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            raise unauthorized
    except jwt.InvalidTokenError as error:
        raise unauthorized from error
    return user_id


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Resolve the signed-in user from the session cookie (browser flow) or,
    as a fallback for non-browser clients, the Authorization Bearer header.
    Signature, expiration and active-user checks are identical for both."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None and settings.AUTH_BEARER_FALLBACK:
        token = credentials.credentials if credentials else None
    if not token:
        raise unauthorized
    user_id = _decode_token(token)
    user = session.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if user is None:
        raise unauthorized
    return user


def require_admin(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> Employee:
    """FastAPI dependency for admin-only endpoints: resolves the signed-in user
    to their Employee row and requires system_role == admin."""
    employee = session.scalar(select(Employee).where(Employee.user_id == user.id))
    if employee is None or employee.system_role != SystemRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return employee
