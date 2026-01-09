"""
Jobs API

Purpose:
--------
Handles job position management for recruiters and public job discovery
for candidates.

Guarantees:
-----------
- Only recruiters can create and manage jobs
- Recruiters can only manage their own jobs
- Candidates can only view open jobs
- Ownership is enforced via RLS and recruiter identity
"""

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.schemas.job import JobCreate, JobUpdate
from app.api.deps import require_recruiter
from app.db.supabase import get_supabase

router = APIRouter(prefix="/jobs", tags=["Jobs"])


# ---------------------------------------------------------------------
# Recruiter-side endpoints
# ---------------------------------------------------------------------

@router.post("/", status_code=201)
def create_job(
    payload: JobCreate,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Creates a new job position owned by the authenticated recruiter.
    """

    # Prepare data, excluding None values for optional fields
    job_data = payload.model_dump(exclude_none=True)
    job_data["recruiter_profile_id"] = recruiter["id"]
    
    # Set status to 'open' by default if not provided
    if "status" not in job_data or not job_data["status"]:
        job_data["status"] = "open"

    # Convert date object to ISO string format for Supabase
    if "closing_date" in job_data and job_data["closing_date"]:
        if hasattr(job_data["closing_date"], "isoformat"):
            job_data["closing_date"] = job_data["closing_date"].isoformat()

    try:
        response = (
            supabase.table("job_position")
            .insert(job_data)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to create job: {exc}",
        )

    if not response.data:
        raise HTTPException(
            status_code=500,
            detail="Job was not created",
        )

    return response.data[0]


@router.get("/me")
def list_my_jobs(
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Returns all jobs owned by the authenticated recruiter.
    """

    response = (
        supabase.table("job_position")
        .select("*")
        .eq("recruiter_profile_id", recruiter["id"])
        .execute()
    )

    return response.data


@router.get("/{job_id}")
def get_job(
    job_id: int,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Returns a specific job owned by the authenticated recruiter.
    """

    response = (
        supabase.table("job_position")
        .select("*")
        .eq("id", job_id)
        .eq("recruiter_profile_id", recruiter["id"])
        .maybe_single()
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Job not found or not authorized",
        )

    return response.data


@router.patch("/{job_id}")
def update_job(
    job_id: int,
    payload: JobUpdate,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Updates a job position owned by the authenticated recruiter.
    """

    # First verify ownership
    check_response = (
        supabase.table("job_position")
        .select("id")
        .eq("id", job_id)
        .eq("recruiter_profile_id", recruiter["id"])
        .maybe_single()
        .execute()
    )

    if not check_response.data:
        raise HTTPException(
            status_code=404,
            detail="Job not found or not authorized",
        )

    # Prepare update data, excluding None values
    update_data = payload.model_dump(exclude_none=True)

    # Convert date object to ISO string format for Supabase
    if "closing_date" in update_data and update_data["closing_date"]:
        if hasattr(update_data["closing_date"], "isoformat"):
            update_data["closing_date"] = update_data["closing_date"].isoformat()

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No fields provided for update",
        )

    try:
        response = (
            supabase.table("job_position")
            .update(update_data)
            .eq("id", job_id)
            .eq("recruiter_profile_id", recruiter["id"])
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Job was not updated",
            )

        return response.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update job: {exc}",
        )


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Deletes a job position owned by the authenticated recruiter.
    This will cascade delete related applications.
    """

    # First verify ownership
    check_response = (
        supabase.table("job_position")
        .select("id")
        .eq("id", job_id)
        .eq("recruiter_profile_id", recruiter["id"])
        .maybe_single()
        .execute()
    )

    if not check_response.data:
        raise HTTPException(
            status_code=404,
            detail="Job not found or not authorized",
        )

    try:
        # Delete related applications first (CASCADE should handle this, but being explicit)
        supabase.table("applications").delete().eq("job_position_id", job_id).execute()

        # Delete the job
        response = (
            supabase.table("job_position")
            .delete()
            .eq("id", job_id)
            .eq("recruiter_profile_id", recruiter["id"])
            .execute()
        )

        return {"message": "Job deleted successfully", "job_id": job_id}
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to delete job: {exc}",
        )


# ---------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------

@router.get("/")
def list_open_jobs(supabase: Client = Depends(get_supabase)):
    """
    Returns all open job positions with recruiter company information.

    Notes:
    ------
    - Accessible by candidates and unauthenticated users
    - RLS restricts visibility to jobs with status = 'open'
    - Includes company name from recruiter_profiles via JOIN
    """

    # First get all open jobs
    jobs_response = (
        supabase.table("job_position")
        .select("id, job_title, job_description, job_requirements, job_skills, location, employment_type, optional_salary, optional_salary_max, closing_date, sprint_duration, status, created_at, recruiter_profile_id")
        .eq("status", "open")
        .execute()
    )

    if not jobs_response.data:
        return []

    # Get unique recruiter profile IDs
    recruiter_ids = list(set([job["recruiter_profile_id"] for job in jobs_response.data if job.get("recruiter_profile_id")]))

    # Fetch recruiter profiles
    recruiters_map = {}
    if recruiter_ids:
        recruiters_response = (
            supabase.table("recruiter_profiles")
            .select("profile_id, company_name")
            .in_("profile_id", recruiter_ids)
            .execute()
        )

        if recruiters_response.data:
            recruiters_map = {
                recruiter["profile_id"]: recruiter.get("company_name")
                for recruiter in recruiters_response.data
            }

    # Combine job data with company names
    jobs = []
    for job in jobs_response.data:
        job_data = dict(job)
        job_data["company_name"] = recruiters_map.get(job["recruiter_profile_id"])
        jobs.append(job_data)

    return jobs