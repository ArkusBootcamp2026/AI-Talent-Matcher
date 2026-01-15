"""
Authentication Schemas

Purpose:
--------
Defines request and response schemas for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr


class CandidateSignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    location: str | None = None


class RecruiterSignupRequest(BaseModel):
    """
    Payload for recruiter signup.

    Fields are split across domain tables:
    - email, password -> auth.users
    - full_name, phone -> profiles
    - company_name, company_size -> recruiter_profiles
    """
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    company_name: str
    company_size: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordResetRequest(BaseModel):
    email: EmailStr
    new_password: str
    confirm_password: str


class EmailUpdateRequest(BaseModel):
    new_email: EmailStr