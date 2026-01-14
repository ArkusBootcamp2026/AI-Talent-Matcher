"""
Authentication API

Purpose:
--------
Handles authentication-related endpoints, including:
- Role-specific signup (candidate, recruiter)
- User login

Signup is treated as a domain operation:
- Each signup endpoint fully initializes the user
- No partial or role-less users are allowed
"""

from fastapi import APIRouter, HTTPException

from app.schemas.auth import (
    CandidateSignupRequest,
    RecruiterSignupRequest,
    LoginRequest,
    AuthResponse,
    PasswordResetRequest,
)
from app.services.auth_service import (
    signup_candidate,
    signup_recruiter,
    login_user,
    reset_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/signup/candidate", status_code=201)
def signup_candidate_endpoint(payload: CandidateSignupRequest):
    """
    Candidate signup.

    Creates:
    - Supabase Auth user
    - profiles row (role = candidate)
    - candidate_profiles row
    """
    return signup_candidate(payload)


@router.post("/signup/recruiter", status_code=201)
def signup_recruiter_endpoint(payload: RecruiterSignupRequest):
    """
    Recruiter signup.

    Creates:
    - Supabase Auth user
    - profiles row (role = recruiter)
    - recruiter_profiles row
    """
    return signup_recruiter(payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    """
    User login.

    Authenticates with Supabase Auth and returns an access token.
    """
    return login_user(payload)


@router.post("/reset-password")
def reset_password_endpoint(payload: PasswordResetRequest):
    """
    Reset user password.

    Updates the password for a user identified by email.
    Requires new_password and confirm_password to match.
    """
    return reset_password(payload)
