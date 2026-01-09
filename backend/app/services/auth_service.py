"""
Authentication Service

Purpose:
--------
Contains domain-level authentication logic.

Responsibilities:
- Create fully initialized users during signup
- Enforce role-specific onboarding rules
- Authenticate users during login
"""

from fastapi import HTTPException, status
from supabase import create_client, AuthApiError

from app.core.config import settings
from app.schemas.auth import (
    CandidateSignupRequest,
    RecruiterSignupRequest,
)

# Service-role client (required for signup and admin operations)
supabase_admin = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)

# Anon client (required for user login to generate RLS-compatible tokens)
supabase_anon = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY or settings.SUPABASE_SERVICE_ROLE_KEY,  # Fallback to service role if anon not set
)


def signup_candidate(payload: CandidateSignupRequest):
    """
    Creates a fully initialized candidate account.
    """

    # 1. Create auth user (admin)
    try:
        auth_response = supabase_admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create auth user: {exc}",
        )

    user = auth_response.user
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Auth user was not created",
        )

    user_id = user.id

    # 2. Create base profile
    try:
        supabase_admin.table("profiles").insert(
            {
                "id": user_id,
                "full_name": payload.full_name,
                "phone": payload.phone,
                "role": "candidate",
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create profile: {exc}",
        )

    # 3. Create candidate profile
    try:
        supabase_admin.table("candidate_profiles").insert(
            {
                "profile_id": user_id,
                "location": payload.location,
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create candidate profile: {exc}",
        )

    # 4. Create session explicitly
    session_response = supabase_admin.auth.sign_in_with_password(
        {
            "email": payload.email,
            "password": payload.password,
        }
    )

    if not session_response.session:
        raise HTTPException(
            status_code=500,
            detail="User created but session could not be established",
        )

    return {
        "access_token": session_response.session.access_token,
        "token_type": "bearer",
    }


def signup_recruiter(payload: RecruiterSignupRequest):
    """
    Creates a fully initialized recruiter account.
    """

    try:
        auth_response = supabase_admin.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create auth user: {exc}",
        )

    user = auth_response.user
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Auth user was not created",
        )

    user_id = user.id

    try:
        supabase_admin.table("profiles").insert(
            {
                "id": user_id,
                "full_name": payload.full_name,
                "phone": payload.phone,
                "role": "recruiter",
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create profile: {exc}",
        )

    try:
        supabase_admin.table("recruiter_profiles").insert(
            {
                "profile_id": user_id,
                "company_name": payload.company_name,
                "company_size": payload.company_size,
            }
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create recruiter profile: {exc}",
        )

    session_response = supabase_admin.auth.sign_in_with_password(
        {
            "email": payload.email,
            "password": payload.password,
        }
    )

    if not session_response.session:
        raise HTTPException(
            status_code=500,
            detail="User created but session could not be established",
        )

    return {
        "access_token": session_response.session.access_token,
        "token_type": "bearer",
    }


def login_user(payload):
    """
    Authenticates a user with email and password.

    Uses the anon key client to generate tokens that work with RLS policies.
    This ensures tokens are properly scoped for user-level operations.

    Raises:
    -------
    HTTP 401 if credentials are invalid.
    """

    try:
        # Use anon client for login to generate RLS-compatible tokens
        auth_response = supabase_anon.auth.sign_in_with_password(
            {
                "email": payload.email,
                "password": payload.password,
            }
        )
    except AuthApiError as e:
        # Supabase explicitly rejected credentials
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not auth_response.session:
        # Defensive fallback (should not normally happen)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return {
        "access_token": auth_response.session.access_token,
        "token_type": "bearer",
    }
