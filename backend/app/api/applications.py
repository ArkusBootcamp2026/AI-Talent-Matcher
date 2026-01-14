"""
Applications API

Purpose:
--------
Handles job application workflows for both candidates and recruiters.

Guarantees:
-----------
- Applications are always linked to a valid candidate profile
- Candidates can only manage their own applications
- Recruiters can only view applications for jobs they own
- All access is enforced by RLS and ownership constraints
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from postgrest.exceptions import APIError
from typing import Optional

from app.api.deps import get_current_user, require_recruiter
from app.db.supabase import get_supabase
from app.schemas.application import ApplicationCreate, StartDateUpdate
from app.services.cv.storage_service import get_latest_cv_file_info
from app.services.cv.match_service import calculate_match_score
from app.core.config import settings
from supabase import create_client
import threading

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
)

# ---------------------------------------------------------------------
# Candidate-side endpoints
# ---------------------------------------------------------------------

@router.post("/", status_code=201)
def apply_to_job(
    payload: ApplicationCreate,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Creates a new job application for the authenticated candidate.

    Business rules:
    ----------------
    - A candidate can apply to a job only once
    - Candidates cannot apply to closed jobs
    - Applications are immutable except for status transitions
    """

    # ------------------------------------------------------------------
    # 1. Validate candidate profile exists
    # ------------------------------------------------------------------
    try:
        candidate_profile = (
            supabase.table("candidate_profiles")
            .select("profile_id")
            .eq("profile_id", user_id)
            .maybe_single()
            .execute()
        )

        if candidate_profile is None:
            logger.error(f"Candidate profile check returned None for user_id: {user_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to validate candidate profile - no response from database",
            )
        
        if not hasattr(candidate_profile, 'data'):
            logger.error(f"Candidate profile check returned invalid response structure for user_id: {user_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to validate candidate profile - invalid response structure",
            )
        
        if candidate_profile.data is None:
            logger.warning(f"Candidate profile not found for user_id: {user_id}")
            raise HTTPException(
                status_code=400,
                detail="Candidate profile not found. Please complete your profile first.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Exception validating candidate profile for user_id {user_id}: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to validate candidate profile: {str(exc)}",
        )

    # ------------------------------------------------------------------
    # 2. Validate job exists and is open
    # ------------------------------------------------------------------
    try:
        job_response = (
            supabase.table("job_position")
            .select("id, status")
            .eq("id", payload.job_position_id)
            .maybe_single()
            .execute()
        )

        if job_response is None:
            logger.error(f"Job check returned None for job_id: {payload.job_position_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to validate job position - no response from database",
            )
        
        if not hasattr(job_response, 'data'):
            logger.error(f"Job check returned invalid response structure for job_id: {payload.job_position_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to validate job position - invalid response structure",
            )
        
        if job_response.data is None:
            logger.warning(f"Job position not found for job_id: {payload.job_position_id}")
            raise HTTPException(
                status_code=404,
                detail="Job position not found",
            )

        if job_response.data.get("status") != "open":
            logger.warning(f"Attempt to apply to closed job: job_id={payload.job_position_id}, status={job_response.data.get('status')}")
            raise HTTPException(
                status_code=400,
                detail="You cannot apply to a closed job",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Exception validating job position for job_id {payload.job_position_id}: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to validate job position: {str(exc)}",
        )

    # ------------------------------------------------------------------
    # 3. Check if application already exists
    # ------------------------------------------------------------------
    try:
        # Use normal query instead of maybe_single() to avoid 406 errors with multiple filters
        # Include match_score to check if calculation is needed
        existing_app_response = (
            supabase.table("applications")
            .select("id, status, match_score")
            .eq("candidate_profile_id", user_id)
            .eq("job_position_id", payload.job_position_id)
            .limit(1)
            .execute()
        )
        
        if existing_app_response is None:
            logger.error(f"Existing application check returned None for user_id: {user_id}, job_id: {payload.job_position_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to check existing application - no response from database",
            )
        
        if not hasattr(existing_app_response, 'data'):
            logger.error(f"Existing application check returned invalid response structure for user_id: {user_id}, job_id: {payload.job_position_id}")
            raise HTTPException(
                status_code=500,
                detail="Failed to check existing application - invalid response structure",
            )
        
        # Check if any applications exist
        existing_app_data = existing_app_response.data[0] if existing_app_response.data and len(existing_app_response.data) > 0 else None
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Exception checking existing application: {type(exc).__name__}: {str(exc)}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to check existing application: {str(exc)}",
        )

    # ------------------------------------------------------------------
    # 4. Create or update application
    # ------------------------------------------------------------------
    response = None
    try:
        # Check if application exists
        # existing_app_data will be None if no application found (normal case)
        # existing_app_data will be a dict if application exists
        if existing_app_data is not None:
            logger.info(f"Application exists for user_id: {user_id}, job_id: {payload.job_position_id}, updating...")
            # Application exists - update it
            app_data = existing_app_data
            if not isinstance(app_data, dict):
                logger.error(f"Existing application data is not a dict: {type(app_data)}")
                raise HTTPException(
                    status_code=500,
                    detail="Invalid application data structure",
                )
            
            update_data = {}
            if payload.cover_letter is not None:
                cover_letter_str = str(payload.cover_letter).strip()
                if cover_letter_str:
                    update_data["cover_letter"] = cover_letter_str
            # If status was withdrawn, allow re-application by resetting to 'applied'
            if app_data.get("status") == "withdrawn":
                update_data["status"] = "applied"
            
            # Note: updated_at has a default of now() in the database, so we don't need to set it
            # If we need to update it explicitly, we would use datetime.now().isoformat()

            if not update_data:
                # No changes to make, fetch full application data and return it
                logger.info(f"No changes to make for existing application, fetching full data...")
                full_app_response = (
                    supabase.table("applications")
                    .select("*")
                    .eq("id", app_data["id"])
                    .maybe_single()
                    .execute()
                )
                if full_app_response and full_app_response.data:
                    return full_app_response.data
                return app_data
            
            # For existing applications, check if match_score exists before triggering calculation
            # Only trigger if match_score is NULL (to avoid wasting tokens on recalculation)
            existing_match_score = app_data.get("match_score")
            if existing_match_score is None and cv_file_timestamp:
                # Trigger match score calculation for existing application that doesn't have a score yet
                application_id = app_data["id"]
                job_position_id = payload.job_position_id
                
                def calculate_match_in_background():
                    """Background task to calculate match score for existing application"""
                    try:
                        logger.info(f"Starting background match score calculation for existing application {application_id}")
                        
                        supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
                        
                        # Double-check that match_score still doesn't exist
                        app_check = (
                            supabase_client.table("applications")
                            .select("match_score")
                            .eq("id", application_id)
                            .maybe_single()
                            .execute()
                        )
                        
                        if app_check.data and app_check.data.get("match_score") is not None:
                            logger.info(f"Match score already exists for application {application_id}, skipping calculation")
                            return
                        
                        job_response = (
                            supabase_client.table("job_position")
                            .select("id, job_title, job_description")
                            .eq("id", job_position_id)
                            .maybe_single()
                            .execute()
                        )
                        
                        if not job_response.data:
                            logger.warning(f"Job {job_position_id} not found for match calculation")
                            return
                        
                        job_title = job_response.data.get("job_title", "")
                        job_description = job_response.data.get("job_description")
                        
                        match_result = calculate_match_score(
                            user_id=user_id,
                            job_position_id=job_position_id,
                            job_title=job_title,
                            job_description=job_description,
                            cv_timestamp=cv_file_timestamp,
                            supabase=supabase_client,
                        )
                        
                        final_score = match_result.get("final_score", 0.0)
                        if final_score is not None:
                            supabase_client.table("applications").update({
                                "match_score": final_score
                            }).eq("id", application_id).execute()
                            
                            logger.info(f"Match score {final_score} saved for existing application {application_id}")
                    except Exception as e:
                        logger.error(f"Error calculating match score in background: {e}", exc_info=True)
                
                thread = threading.Thread(target=calculate_match_in_background, daemon=True)
                thread.start()
                logger.info(f"Background match score calculation started for existing application {application_id}")

            logger.info(f"Updating application with data: {update_data}")
            response = (
                supabase.table("applications")
                .update(update_data)
                .eq("id", app_data["id"])
                .execute()
            )
        else:
            # Application doesn't exist - create it
            logger.info(f"Creating new application for user_id: {user_id}, job_id: {payload.job_position_id}")
            
            # Get the latest CV file info at the time of application
            cv_file_info = get_latest_cv_file_info(supabase, user_id)
            cv_file_path = None
            cv_file_timestamp = None
            if cv_file_info:
                cv_file_path = cv_file_info.get("file_path")
                cv_file_timestamp = cv_file_info.get("timestamp")
                logger.info(f"Captured CV file info for application: path={cv_file_path}, timestamp={cv_file_timestamp}")
            else:
                logger.warning(f"No CV found for user {user_id} at application time")
            
            insert_data = {
                "candidate_profile_id": user_id,
                "job_position_id": payload.job_position_id,
                "status": "applied",
            }
            
            # Only include cover_letter if it's provided and not None/empty
            if payload.cover_letter is not None:
                cover_letter_str = str(payload.cover_letter).strip()
                if cover_letter_str:
                    insert_data["cover_letter"] = cover_letter_str
            
            # Store CV file path and timestamp if available
            if cv_file_path:
                insert_data["cv_file_path"] = cv_file_path
            if cv_file_timestamp:
                insert_data["cv_file_timestamp"] = cv_file_timestamp
            
            logger.info(f"Inserting application with data: {insert_data}")
            response = (
                supabase.table("applications")
                .insert(insert_data)
                .execute()
            )
            logger.info(f"Insert response received: {response is not None}, has data: {hasattr(response, 'data') if response else False}, data type: {type(response.data) if response and hasattr(response, 'data') else 'N/A'}")

    except HTTPException:
        raise
    except Exception as exc:
        error_msg = str(exc)
        error_type = type(exc).__name__
        error_lower = error_msg.lower()
        
        # Log the full error for debugging
        logger.error(f"Error creating/updating application: {error_type}: {error_msg}")
        
        # Check for foreign key constraint violation
        if "foreign key" in error_lower or "candidate_profile" in error_lower:
            raise HTTPException(
                status_code=400,
                detail="Candidate profile not found. Please complete your profile first.",
            )
        
        # Check for unique constraint violation (already applied)
        if "unique" in error_lower or "uq_candidate_job_application" in error_lower:
            raise HTTPException(
                status_code=409,
                detail="You have already applied to this job.",
            )
        
        # Check for check constraint violation (invalid status)
        if "check constraint" in error_lower or "applications_status_check" in error_lower:
            raise HTTPException(
                status_code=400,
                detail="Invalid application status. Allowed values: applied, reviewing, shortlisted, rejected, hired, withdrawn",
            )
        
        # Generic error with more context
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create/update application: {error_msg}",
        )

    # Validate response
    if response is None:
        logger.error("Response from insert/update is None")
        raise HTTPException(
            status_code=500,
            detail="No response from database",
        )

    if not hasattr(response, 'data'):
        logger.error(f"Response object missing 'data' attribute. Response type: {type(response)}, attributes: {dir(response)}")
        raise HTTPException(
            status_code=500,
            detail="Application was not created/updated - invalid response structure",
        )
    
    if response.data is None:
        logger.error("Response.data is None")
        raise HTTPException(
            status_code=500,
            detail="Application was not created/updated - response data is None",
        )

    if not response.data:
        logger.error(f"Response.data is empty. Type: {type(response.data)}, Value: {response.data}")
        raise HTTPException(
            status_code=500,
            detail="Application was not created/updated - empty response",
        )

    # response.data is a list, get the first element
    logger.info(f"Application successfully created/updated. Response data length: {len(response.data)}")
    application_data = response.data[0]
    
    # Trigger match score calculation in background (only for new applications)
    # Only calculate if match_score doesn't already exist (avoid wasting tokens on recalculation)
    if existing_app_data is None:
        application_id = application_data.get("id")
        job_position_id = payload.job_position_id
        
        # Check if match_score already exists to avoid unnecessary recalculation
        existing_match_score = application_data.get("match_score")
        
        if existing_match_score is None:
            def calculate_match_in_background():
                """Background task to calculate match score - only runs if score doesn't exist"""
                try:
                    logger.info(f"Starting background match score calculation for application {application_id}")
                    
                    # Create new Supabase client for background thread
                    supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
                    
                    # Double-check that match_score still doesn't exist (race condition protection)
                    app_check = (
                        supabase_client.table("applications")
                        .select("match_score")
                        .eq("id", application_id)
                        .maybe_single()
                        .execute()
                    )
                    
                    if app_check.data and app_check.data.get("match_score") is not None:
                        logger.info(f"Match score already exists for application {application_id}, skipping calculation")
                        return
                    
                    job_response = (
                        supabase_client.table("job_position")
                        .select("id, job_title, job_description")
                        .eq("id", job_position_id)
                        .maybe_single()
                        .execute()
                    )
                    
                    if not job_response.data:
                        logger.warning(f"Job {job_position_id} not found for match calculation")
                        return
                    
                    job_title = job_response.data.get("job_title", "")
                    job_description = job_response.data.get("job_description")
                    
                    # Calculate match score (this uses LLM tokens)
                    match_result = calculate_match_score(
                        user_id=user_id,
                        job_position_id=job_position_id,
                        job_title=job_title,
                        job_description=job_description,
                        cv_timestamp=cv_file_timestamp,
                        supabase=supabase_client,
                    )
                    
                    # Update application with match score
                    final_score = match_result.get("final_score", 0.0)
                    if final_score is not None:
                        supabase_client.table("applications").update({
                            "match_score": final_score
                        }).eq("id", application_id).execute()
                        
                        logger.info(f"Match score {final_score} saved for application {application_id}")
                    else:
                        logger.warning(f"No final_score in match result for application {application_id}")
                        
                except Exception as e:
                    logger.error(f"Error calculating match score in background: {e}", exc_info=True)
            
            # Start background thread
            thread = threading.Thread(target=calculate_match_in_background, daemon=True)
            thread.start()
            logger.info(f"Background match score calculation started for application {application_data.get('id')}")
        else:
            logger.info(f"Match score already exists ({existing_match_score}) for application {application_id}, skipping calculation")
    
    return application_data


@router.get("/me")
def get_my_applications(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Returns all applications belonging to the authenticated candidate with job details.
    Includes job position information and company name from the recruiter who created the job.
    Only returns applications for job positions that exist in the recruiter portal.

    Security:
    ---------
    - Filtered by candidate_profile_id = auth.uid()
    - Prevents exposure of other candidates' applications
    """

    # First, get all applications for this candidate
    response = (
        supabase.table("applications")
        .select("id, status, applied_at, updated_at, cover_letter, job_position_id, start_date")
        .eq("candidate_profile_id", user_id)
        .order("applied_at", desc=True)
        .execute()
    )

    if not response.data:
        return []

    # Extract unique job position IDs from applications
    job_position_ids = list(set([row.get("job_position_id") for row in response.data if row.get("job_position_id")]))

    # Fetch job positions directly to get all job details and recruiter_profile_id
    jobs_map = {}
    recruiter_ids = []
    if job_position_ids:
        try:
            jobs_response = (
                supabase.table("job_position")
                .select("id, recruiter_profile_id, job_title, job_description, job_requirements, job_skills, location, employment_type, optional_salary, optional_salary_max, closing_date, created_at")
                .in_("id", job_position_ids)
                .execute()
            )
            if jobs_response.data:
                for job in jobs_response.data:
                    jobs_map[job["id"]] = job
                    recruiter_profile_id = job.get("recruiter_profile_id")
                    if recruiter_profile_id and recruiter_profile_id not in recruiter_ids:
                        recruiter_ids.append(recruiter_profile_id)
                        logger.info(f"Found recruiter_profile_id: {recruiter_profile_id} for job {job['id']}")
        except Exception as e:
            logger.error(f"Error fetching job positions: {e}")

    # Fetch recruiter profiles to get company names
    recruiters_map = {}
    if recruiter_ids:
        try:
            logger.info(f"Fetching recruiter profiles for {len(recruiter_ids)} IDs: {recruiter_ids}")
            recruiters_response = (
                supabase.table("recruiter_profiles")
                .select("profile_id, company_name")
                .in_("profile_id", recruiter_ids)
                .execute()
            )
            
            logger.info(f"Recruiter profiles query returned {len(recruiters_response.data) if recruiters_response.data else 0} results")
            if recruiters_response.data:
                for recruiter in recruiters_response.data:
                    profile_id = recruiter.get("profile_id")
                    company_name = recruiter.get("company_name")
                    logger.info(f"Recruiter data: profile_id={profile_id}, company_name={repr(company_name)}, type={type(company_name)}, full record keys: {list(recruiter.keys())}")
                    if profile_id:
                        # Handle both None and empty string cases
                        company_name_value = company_name if company_name else None
                        recruiters_map[profile_id] = company_name_value
                        logger.info(f"Mapped recruiter {profile_id} -> company_name: {repr(company_name_value)}")
            else:
                logger.warning(f"No recruiter profiles found for IDs: {recruiter_ids}")
        except Exception as e:
            logger.error(f"Error fetching recruiter profiles: {e}")

    # Transform response to include job details at top level
    applications = []
    for row in response.data or []:
        job_position_id = row.get("job_position_id")
        job_position = jobs_map.get(job_position_id, {}) if job_position_id else {}
        
        # Get recruiter_profile_id from job position and lookup company name
        recruiter_profile_id = job_position.get("recruiter_profile_id")
        company_name = recruiters_map.get(recruiter_profile_id) if recruiter_profile_id else None
        
        # Debug logging - check if company_name is None, empty string, or has value
        if recruiter_profile_id:
            mapped_value = recruiters_map.get(recruiter_profile_id)
            logger.info(f"Application {row['id']}: recruiter_profile_id={recruiter_profile_id}, mapped company_name={repr(mapped_value)}, final company_name={repr(company_name)}")
            if not company_name:
                logger.warning(f"No company name found for recruiter_profile_id: {recruiter_profile_id}, available IDs in map: {list(recruiters_map.keys())}, mapped value: {repr(mapped_value)}")
        
        application_data = {
            "id": row["id"],
            "status": row["status"],
            "applied_at": row["applied_at"],
            "updated_at": row["updated_at"],
            "cover_letter": row.get("cover_letter"),
            "job_position_id": row["job_position_id"],
            "start_date": row.get("start_date"),
            "job_title": job_position.get("job_title"),
            "job_description": job_position.get("job_description"),
            "job_requirements": job_position.get("job_requirements"),
            "job_skills": job_position.get("job_skills"),
            "location": job_position.get("location"),
            "employment_type": job_position.get("employment_type"),
            "optional_salary": job_position.get("optional_salary"),
            "optional_salary_max": job_position.get("optional_salary_max"),
            "closing_date": job_position.get("closing_date"),
            "job_created_at": job_position.get("created_at"),
            "company_name": company_name,
        }
        applications.append(application_data)
    
    return applications

@router.patch("/{application_id}/status")
def update_application_status(
    application_id: int,
    status: str,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Updates the status of an application.

    Notes:
    ------
    - Recruiters can only update applications for jobs they own
    - Status transitions are controlled at the API level
    """

    allowed_statuses = {
        "applied",
        "reviewing",
        "shortlisted",
        "interview",
        "rejected",
        "hired",
    }

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid application status. Allowed values: {', '.join(sorted(allowed_statuses))}",
        )

    try:
        response = (
            supabase.table("applications")
            .update({"status": status})
            .eq("id", application_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update application status: {exc}",
        )

    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Application not found or not authorized",
        )

    return {
        "application_id": application_id,
        "status": status,
    }


@router.patch("/{application_id}/withdraw")
def withdraw_application(
    application_id: int,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Withdraws (soft-cancels) an application owned by the authenticated candidate.

    Security:
    ---------
    - Ownership enforced via candidate_profile_id
    - RLS acts as final authority
    """

    response = (
        supabase.table("applications")
        .update({"status": "withdrawn"})
        .eq("id", application_id)
        .eq("candidate_profile_id", user_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=403,
            detail="Not allowed",
        )

    return {"status": "withdrawn"}


@router.patch("/{application_id}/start-date")
def update_application_start_date(
    application_id: int,
    payload: StartDateUpdate,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Updates the start date for a hired candidate.
    
    Security:
    ---------
    - Only recruiters can update start dates
    - Only applications with status='hired' can have start dates updated
    - Recruiter must own the job for this application
    """
    from datetime import datetime
    
    start_date = payload.start_date
    
    # Validate date format
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD format.",
        )
    
    # Verify application exists and is hired
    app_check = (
        supabase.table("applications")
        .select("id, status, job_position_id")
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    
    if not app_check.data:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )
    
    if app_check.data.get("status") != "hired":
        raise HTTPException(
            status_code=400,
            detail="Start date can only be set for applications with 'hired' status",
        )
    
    # Verify recruiter owns the job
    job_check = (
        supabase.table("job_position")
        .select("id")
        .eq("id", app_check.data["job_position_id"])
        .eq("recruiter_profile_id", recruiter["id"])
        .maybe_single()
        .execute()
    )
    
    if not job_check.data:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this application",
        )
    
    # Update start date
    try:
        response = (
            supabase.table("applications")
            .update({"start_date": start_date})
            .eq("id", application_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to update start date: {exc}",
        )
    
    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )
    
    return {
        "application_id": application_id,
        "start_date": start_date,
    }


@router.patch("/{application_id}/remove-hired")
def remove_hired_candidate(
    application_id: int,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Removes a candidate from the hired list by changing status back to 'applied'.
    
    Security:
    ---------
    - Only recruiters can remove hired candidates
    - Only applications with status='hired' can be removed
    - Recruiter must own the job for this application
    """
    # Verify application exists and is hired
    app_check = (
        supabase.table("applications")
        .select("id, status, job_position_id")
        .eq("id", application_id)
        .maybe_single()
        .execute()
    )
    
    if not app_check.data:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )
    
    if app_check.data.get("status") != "hired":
        raise HTTPException(
            status_code=400,
            detail="Only hired candidates can be removed",
        )
    
    # Verify recruiter owns the job
    job_check = (
        supabase.table("job_position")
        .select("id")
        .eq("id", app_check.data["job_position_id"])
        .eq("recruiter_profile_id", recruiter["id"])
        .maybe_single()
        .execute()
    )
    
    if not job_check.data:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this application",
        )
    
    # Change status back to 'applied' and clear start_date
    try:
        response = (
            supabase.table("applications")
            .update({"status": "applied", "start_date": None})
            .eq("id", application_id)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to remove hired candidate: {exc}",
        )
    
    if not response.data:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )
    
    return {"status": "removed"}


# ---------------------------------------------------------------------
# Recruiter-side endpoints
# ---------------------------------------------------------------------

@router.get("/recruiter/applications")
def get_all_applications_for_recruiter(
    job_id: Optional[int] = Query(None),
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Returns all applications for jobs owned by the recruiter.
    If job_id is provided, returns applications for that specific job only.
    
    Notes:
    ------
    - Recruiters can only access applications for jobs they own
    - Candidate data is exposed only through applications
    """
    # If job_id is provided, verify ownership
    if job_id:
        job_check = (
            supabase.table("job_position")
            .select("id")
            .eq("id", job_id)
            .eq("recruiter_profile_id", recruiter["id"])
            .maybe_single()
            .execute()
        )
        if not job_check.data:
            raise HTTPException(
                status_code=404,
                detail="Job not found or not authorized",
            )

    try:
        # First, get all job IDs and titles owned by recruiter
        jobs_response = (
            supabase.table("job_position")
            .select("id, job_title")
            .eq("recruiter_profile_id", recruiter["id"])
            .execute()
        )
        
        if not jobs_response.data:
            return []
        
        job_ids = [job["id"] for job in jobs_response.data]
        job_titles_map = {job["id"]: job["job_title"] for job in jobs_response.data}
        
        if job_id:
            job_ids = [job_id]  # Filter to specific job if provided
        
        # Fetch applications for these jobs
        # Include candidate_profile_id for match score calculation
        response = (
            supabase.table("applications")
            .select(
                """
                id,
                status,
                applied_at,
                cover_letter,
                job_position_id,
                candidate_profile_id,
                cv_file_timestamp,
                cv_file_path,
                start_date,
                match_score,
                candidate_profiles (
                    profile_id,
                    location,
                    last_upload_file,
                    profiles (
                        id,
                        full_name
                    )
                )
                """
            )
            .in_("job_position_id", job_ids)
            .order("applied_at", desc=True)
            .execute()
        )
        
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch applications: {exc}",
        )

    applications = []
    
    # Trigger match score calculation for applications without scores (background task)
    # This ensures ALL candidates in the pipeline get match analysis
    applications_needing_scores = []
    total_applications = len(response.data or [])
    applications_with_scores = 0
    
    for row in response.data or []:
        match_score = row.get("match_score")
        cv_file_timestamp = row.get("cv_file_timestamp")
        candidate_profile_id = row.get("candidate_profile_id")
        
        if match_score is not None:
            applications_with_scores += 1
        elif candidate_profile_id:
            # Application needs match score calculation
            # If cv_file_timestamp is missing, we'll use the latest CV available for the candidate
            applications_needing_scores.append({
                "application_id": row["id"],
                "candidate_profile_id": candidate_profile_id,
                "job_position_id": row.get("job_position_id"),
                "cv_file_timestamp": cv_file_timestamp,  # Can be None - will use latest CV
            })
        else:
            logger.warning(f"Application {row.get('id')} has no candidate_profile_id - cannot calculate")
    
    logger.info(f"Match score status: {applications_with_scores} with scores, {len(applications_needing_scores)} need calculation out of {total_applications} total applications")
    
    # Trigger background calculations for applications without scores
    if applications_needing_scores:
        logger.info(f"Found {len(applications_needing_scores)} applications without match scores, triggering background calculations")
        
        def calculate_missing_scores():
            """Background task to calculate match scores for applications that don't have them"""
            try:
                supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
                
                total_to_process = len(applications_needing_scores)
                processed = 0
                skipped = 0
                errors = 0
                
                logger.info(f"Starting background calculation for {total_to_process} applications")
                
                for idx, app_info in enumerate(applications_needing_scores, 1):
                    try:
                        application_id = app_info["application_id"]
                        candidate_profile_id = app_info["candidate_profile_id"]
                        job_position_id = app_info["job_position_id"]
                        cv_file_timestamp = app_info["cv_file_timestamp"]
                        
                        logger.info(f"[{idx}/{total_to_process}] Processing application {application_id} (candidate {candidate_profile_id}, job {job_position_id})")
                        
                        # Double-check that match_score still doesn't exist
                        app_check = (
                            supabase_client.table("applications")
                            .select("match_score")
                            .eq("id", application_id)
                            .maybe_single()
                            .execute()
                        )
                        
                        if app_check.data and app_check.data.get("match_score") is not None:
                            logger.info(f"Application {application_id} already has match_score, skipping")
                            skipped += 1
                            continue
                        
                        # Get job details
                        job_response = (
                            supabase_client.table("job_position")
                            .select("id, job_title, job_description")
                            .eq("id", job_position_id)
                            .maybe_single()
                            .execute()
                        )
                        
                        if not job_response.data:
                            logger.warning(f"Job {job_position_id} not found for match calculation (application {application_id})")
                            errors += 1
                            continue
                        
                        job_title = job_response.data.get("job_title", "")
                        job_description = job_response.data.get("job_description")
                        
                        # If cv_file_timestamp is None, we'll use the latest CV available
                        # calculate_match_score will handle None timestamp by using the latest CV
                        if cv_file_timestamp:
                            logger.info(f"Calculating match score for application {application_id} (candidate {candidate_profile_id}, job {job_position_id} - {job_title}) using CV timestamp {cv_file_timestamp}")
                        else:
                            logger.info(f"Calculating match score for application {application_id} (candidate {candidate_profile_id}, job {job_position_id} - {job_title}) using latest CV (no timestamp stored)")
                        
                        # Calculate match score
                        # If cv_timestamp is None, calculate_match_score will use the latest CV
                        match_result = calculate_match_score(
                            user_id=candidate_profile_id,
                            job_position_id=job_position_id,
                            job_title=job_title,
                            job_description=job_description,
                            cv_timestamp=cv_file_timestamp,  # Can be None - will use latest CV
                            supabase=supabase_client,
                        )
                        
                        # Update application with match score
                        final_score = match_result.get("final_score", 0.0)
                        if final_score is not None:
                            supabase_client.table("applications").update({
                                "match_score": final_score
                            }).eq("id", application_id).execute()
                            
                            processed += 1
                            logger.info(f"✓ Match score {final_score} saved for application {application_id} ({processed}/{total_to_process} completed)")
                        else:
                            logger.warning(f"No final_score in match result for application {application_id}")
                            errors += 1
                            
                    except Exception as e:
                        errors += 1
                        logger.error(f"Error calculating match score for application {app_info.get('application_id')}: {e}", exc_info=True)
                        continue
                
                logger.info(f"Background calculation complete: {processed} processed, {skipped} skipped, {errors} errors out of {total_to_process} total")
                        
            except Exception as e:
                logger.error(f"Error in calculate_missing_scores background task: {e}", exc_info=True)
        
        # Start background thread to calculate missing scores
        thread = threading.Thread(target=calculate_missing_scores, daemon=True)
        thread.start()
        logger.info(f"Background match score calculation thread started for {len(applications_needing_scores)} applications")

    for row in response.data or []:
        candidate_profile = row.get("candidate_profiles") or {}
        profile = candidate_profile.get("profiles") or {}

        # Map status for UI: "applied" -> "new", "reviewing" -> "reviewed", "hired" -> "accepted"
        status = row["status"]
        display_status = status
        if status == "applied":
            display_status = "new"
        elif status == "reviewing":
            display_status = "reviewed"
        elif status == "hired":
            display_status = "accepted"

        applications.append(
            {
                "application_id": row["id"],
                "status": status,  # Keep original status for API operations
                "display_status": display_status,  # UI-friendly status
                "applied_at": row["applied_at"],
                "cover_letter": row["cover_letter"],
                "job_position_id": row["job_position_id"],
                "job_title": job_titles_map.get(row["job_position_id"], ""),
                "cv_file_timestamp": row.get("cv_file_timestamp"),
                "cv_file_path": row.get("cv_file_path"),
                "start_date": row.get("start_date"),
                "match_score": row.get("match_score"),
                "candidate": {
                    "id": profile.get("id"),
                    "full_name": profile.get("full_name"),
                    "location": candidate_profile.get("location"),
                    "last_upload_file": candidate_profile.get("last_upload_file"),
                },
            }
        )

    return applications


@router.get("/job/{job_id}")
def get_applications_for_job(
    job_id: int,
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Returns all applications for a specific job owned by the recruiter.

    Notes:
    ------
    - Recruiters can only access applications for jobs they own
    - Candidate data is exposed only through applications
    - This endpoint is the main entry point for recruiter candidate review
    """

    # ------------------------------------------------------------------
    # 1. Verify recruiter owns the job
    # ------------------------------------------------------------------
    job_check = (
        supabase.table("job_position")
        .select("id")
        .eq("id", job_id)
        .eq("recruiter_profile_id", recruiter["id"])
        .maybe_single()
        .execute()
    )

    if not job_check.data:
        raise HTTPException(
            status_code=404,
            detail="Job not found or not authorized",
        )

    # ------------------------------------------------------------------
    # 2. Fetch applications with candidate profile data
    # ------------------------------------------------------------------
    try:
        response = (
            supabase.table("applications")
            .select(
                """
                id,
                status,
                applied_at,
                cover_letter,
                cv_file_timestamp,
                cv_file_path,
                start_date,
                match_score,
                candidate_profiles (
                    profile_id,
                    location,
                    last_upload_file,
                    profiles (
                        id,
                        full_name
                    )
                )
                """
            )
            .eq("job_position_id", job_id)
            .order("applied_at", desc=True)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch applications: {exc}",
        )

    applications = []

    for row in response.data or []:
        candidate_profile = row.get("candidate_profiles") or {}
        profile = candidate_profile.get("profiles") or {}

        # Map status for UI: "applied" -> "new", "reviewing" -> "reviewed", "hired" -> "accepted"
        status = row["status"]
        display_status = status
        if status == "applied":
            display_status = "new"
        elif status == "reviewing":
            display_status = "reviewed"
        elif status == "hired":
            display_status = "accepted"

        applications.append(
            {
                "application_id": row["id"],
                "status": status,  # Keep original status for API operations
                "display_status": display_status,  # UI-friendly status
                "applied_at": row["applied_at"],
                "cover_letter": row["cover_letter"],
                "cv_file_timestamp": row.get("cv_file_timestamp"),
                "cv_file_path": row.get("cv_file_path"),
                "start_date": row.get("start_date"),
                "match_score": row.get("match_score"),
                "candidate": {
                    "id": profile.get("id"),
                    "full_name": profile.get("full_name"),
                    "location": candidate_profile.get("location"),
                    "last_upload_file": candidate_profile.get("last_upload_file"),
                },
            }
        )

    return applications
