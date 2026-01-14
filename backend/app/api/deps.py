# API dependencies

import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from httpx import RemoteProtocolError, ConnectError, TimeoutException

from app.db.supabase import get_supabase
from app.utils.retry import retry_supabase_operation

logger = logging.getLogger(__name__)

security = HTTPBearer()


@retry_supabase_operation(max_retries=3, initial_delay=0.5)
def _get_user_with_retry(supabase: Client, token: str):
    """Get user with retry logic for connection errors"""
    return supabase.auth.get_user(token)


@retry_supabase_operation(max_retries=3, initial_delay=0.5)
def _get_profile_with_retry(supabase: Client, user_id: str):
    """Get profile with retry logic for connection errors"""
    return (
        supabase.table("profiles")
        .select("id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase),
) -> str:
    """
    Resolves the authenticated user ID from the JWT and validates
    that a corresponding profile exists.

    Returns:
    --------
    user_id (str)
    """

    token = credentials.credentials

    # 1. Validate JWT and extract user (with retry logic)
    try:
        user_response = _get_user_with_retry(supabase, token)
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error during authentication: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable. Please try again.",
        )

    if user_response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user_id = user_response.user.id

    # 2. Validate profile existence (RLS-protected) (with retry logic)
    try:
        profile_response = _get_profile_with_retry(supabase, user_id)
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error during profile lookup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable. Please try again.",
        )

    if profile_response.data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    return user_id


@retry_supabase_operation(max_retries=3, initial_delay=0.5)
def _get_recruiter_profile_with_retry(supabase: Client, user_id: str):
    """Get recruiter profile with retry logic for connection errors"""
    return (
        supabase.table("profiles")
        .select("id, role")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )


def require_recruiter(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Ensures the authenticated user is a recruiter.

    Returns:
    --------
    A minimal recruiter identity dict for downstream use.
    """

    try:
        response = _get_recruiter_profile_with_retry(supabase, user_id)
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error during recruiter verification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable. Please try again.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify recruiter role: {exc}",
        )

    profile = response.data

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    if profile["role"] != "recruiter":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter access required",
        )

    return profile
