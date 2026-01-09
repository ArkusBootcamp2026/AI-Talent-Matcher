"""
Me API

Purpose:
--------
Provides information about the currently authenticated user.
This endpoint is used by the frontend to hydrate the session
and route the user based on their role.
"""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.api.deps import get_current_user
from app.db.supabase import get_supabase

router = APIRouter(tags=["Me"])


@router.get("/me")
def get_me(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Returns the authenticated user's profile information.

    Base data is always returned from `profiles`.
    Role-specific data is conditionally appended based on role.

    This endpoint assumes:
    - Users are fully initialized at signup time
    - Role-specific profiles always exist
    """

    # ------------------------------------------------------------------
    # Base profile (shared identity)
    # ------------------------------------------------------------------
    # Try to select with optional columns first, fallback if they don't exist
    try:
        profile_response = (
            supabase.table("profiles")
            .select("id, full_name, role, role_title, phone, avatar_url")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        # If role_title or avatar_url columns don't exist yet, select without them
        error_msg = str(e).lower()
        if "does not exist" in error_msg or "column" in error_msg:
            # Fallback: select only columns that definitely exist
            profile_response = (
                supabase.table("profiles")
                .select("id, full_name, role, phone")
                .eq("id", user_id)
                .single()
                .execute()
            )
        else:
            # Re-raise if it's a different error
            raise

    if profile_response.data is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = profile_response.data

    result = {
        "id": profile["id"],
        "full_name": profile["full_name"],
        "role": profile["role"],
        "role_title": profile.get("role_title"),
        "phone": profile.get("phone"),
        "avatar_url": profile.get("avatar_url"),
    }

    # ------------------------------------------------------------------
    # Role-specific profile enrichment
    # ------------------------------------------------------------------
    if profile["role"] == "candidate":
        candidate_profile_response = (
            supabase.table("candidate_profiles")
            .select("location, last_upload_file")
            .eq("profile_id", user_id)
            .single()
            .execute()
        )

        result["candidate_profile"] = candidate_profile_response.data

    elif profile["role"] == "recruiter":
        recruiter_profile_response = (
            supabase.table("recruiter_profiles")
            .select("company_name, company_size")
            .eq("profile_id", user_id)
            .single()
            .execute()
        )

        result["recruiter_profile"] = recruiter_profile_response.data

    return result
