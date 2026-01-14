"""CV extraction API endpoints"""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from supabase import Client
from pathlib import Path

from app.api.deps import get_current_user, require_recruiter
from app.db.supabase import get_supabase
from app.services.cv.extraction_service import extract_cv_from_pdf
from app.services.cv.storage_service import (
    store_raw_pdf,
    store_parsed_cv,
    generate_timestamp,
    update_parsed_cv,
    get_parsed_cv,
    get_parsed_cv_at_datetime,
)
from app.services.cv.match_service import calculate_match_score
from app.schemas.cv.extraction import CVExtractionResponse
from app.schemas.cv.update import CVUpdateRequest, CVUpdateResponse
from app.schemas.cv.match import MatchAnalysisRequest, MatchAnalysisResponse
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cv", tags=["CV"])


@router.post("/extract", response_model=CVExtractionResponse)
async def extract_cv(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Extract structured data from uploaded CV (PDF or DOC/DOCX).
    
    Validates file type, extracts text, runs extraction agents,
    and stores both raw file and parsed JSON to Supabase Storage.
    """
    logger.info(f"CV extraction: {file.filename}")
    # Validate file type
    allowed_types = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    allowed_extensions = [".pdf", ".doc", ".docx"]
    
    # Check content type
    if file.content_type and file.content_type not in allowed_types:
        # Also check file extension as fallback
        file_ext = Path(file.filename or "").suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid file type. Allowed types: PDF, DOC, DOCX. "
                    f"Received: {file.content_type or 'unknown'}"
                ),
            )
    
    # Check file extension
    file_ext = Path(file.filename or "").suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid file extension. Allowed: {', '.join(allowed_extensions)}. "
                f"Received: {file_ext or 'no extension'}"
            ),
        )
    
    # Read file content
    file_content = await file.read()
    
    # Validate file size (10MB limit)
    max_size = 10 * 1024 * 1024  # 10MB in bytes
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds 10MB limit",
        )
    
    # For now, only support PDF extraction
    # DOC/DOCX support can be added later
    if file_ext != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Currently only PDF files are supported. DOC/DOCX support coming soon.",
        )
    
    try:
        # Generate timestamp and clean filename
        timestamp = generate_timestamp()
        cv_name = Path(file.filename or "cv").stem
        
        # Extract CV data
        cv_data = await extract_cv_from_pdf(file_content)
        
        # Store raw PDF
        raw_path = store_raw_pdf(
            supabase=supabase,
            user_id=user_id,
            pdf_content=file_content,
            cv_name=cv_name,
            timestamp=timestamp,
        )
        
        # Store parsed JSON
        parsed_path = store_parsed_cv(
            supabase=supabase,
            user_id=user_id,
            cv_data=cv_data,
            cv_name=cv_name,
            timestamp=timestamp,
        )
        
        logger.info(f"CV extraction completed: {file.filename}")
        return CVExtractionResponse(
            status="success",
            cv_data=cv_data,
            metadata=cv_data.get("metadata", {}),
            storage_paths={
                "raw": raw_path,
                "parsed": parsed_path,
            },
        )
        
    except ValueError as e:
        # ValueError from PDF extraction or validation
        error_message = str(e)
        logger.error(f"CV extraction validation error: {error_message}")
        
        # Check if it's a PDF extraction error
        if "pdf" in error_message.lower() or "extract" in error_message.lower():
            raise HTTPException(
                status_code=400,
                detail=error_message,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"CV extraction failed: {error_message}",
            )
    except Exception as e:
        error_message = str(e)
        logger.error(f"CV extraction error for user {user_id}: {error_message}", exc_info=True)
        
        # Check if bucket doesn't exist
        if "bucket" in error_message.lower() and ("not found" in error_message.lower() or "404" in error_message):
            logger.error(f"Storage bucket '{settings.SUPABASE_CV_BUCKET}' not found")
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Storage bucket '{settings.SUPABASE_CV_BUCKET}' not found. "
                    "Please create the bucket in Supabase Storage dashboard. "
                    "See docs/cv_bucket_setup.md for instructions."
                ),
            )
        
        # Check if it's a PDF-related error
        if "pdf" in error_message.lower() or "bbox" in error_message.lower() or "font" in error_message.lower():
            raise HTTPException(
                status_code=400,
                detail=(
                    "The PDF file has formatting issues that prevent text extraction. "
                    "Please try converting the PDF to a newer format or use a different PDF file."
                ),
            )
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract CV: {error_message}",
        )


@router.patch("/update", response_model=CVUpdateResponse)
async def update_cv(
    updates: CVUpdateRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Update parsed CV JSON with edited identity information.
    
    Only updates fields that are provided in the request.
    Updates the latest parsed CV JSON file for the user.
    """
    # Filter out None values
    update_dict = updates.dict(exclude_unset=True, exclude_none=True)
    
    if not update_dict:
        raise HTTPException(
            status_code=400,
            detail="No fields provided for update",
        )
    
    try:
        storage_path = update_parsed_cv(
            supabase=supabase,
            user_id=user_id,
            updates=update_dict,
            timestamp=None,  # Update latest
        )
        
        logger.info(f"CV updated: {list(update_dict.keys())}")
        
        return CVUpdateResponse(
            status="success",
            message="CV data updated successfully",
            storage_path=storage_path,
        )
        
    except ValueError as e:
        logger.error(f"CV update error: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except Exception as e:
        error_message = str(e)
        logger.error(f"CV update error for user {user_id}: {error_message}", exc_info=True)
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update CV: {error_message}",
        )


@router.get("/latest", response_model=CVExtractionResponse)
async def get_latest_cv(
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Get the latest parsed CV data for the current user.
    
    Returns the most recent parsed CV JSON from Supabase Storage.
    """
    try:
        cv_data = get_parsed_cv(supabase, user_id, timestamp=None)
        
        # Get the file path for metadata
        files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
            f"{user_id}/parsed"
        )
        if not files:
            raise HTTPException(
                status_code=404,
                detail="No parsed CV found for user",
            )
        
        # Sort by timestamp extracted from filename for more reliable sorting
        def extract_timestamp(filename: str) -> str:
            """Extract timestamp from filename (format: YYYYMMDD_HHMMSS_filename.json)"""
            try:
                parts = filename.split('_', 2)
                if len(parts) >= 2:
                    return f"{parts[0]}_{parts[1]}"
            except:
                pass
            return filename
        
        # Sort by updated_at if available, otherwise by timestamp
        files_with_metadata = []
        for file_info in files:
            updated_at = file_info.get("updated_at") or file_info.get("created_at")
            # Only use updated_at if it's a non-empty string
            files_with_metadata.append((file_info, updated_at if updated_at and updated_at.strip() else ""))
        
        # Sort by updated_at if available (most recent first), otherwise by timestamp
        # updated_at is more reliable as it changes when file is updated
        files_with_metadata.sort(
            key=lambda x: x[1] if x[1] and x[1].strip() else extract_timestamp(x[0].get("name", "")),
            reverse=True
        )
        
        parsed_path = f"{user_id}/parsed/{files_with_metadata[0][0]['name']}"
        
        # Try to get raw PDF path
        raw_files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
            f"{user_id}/raw"
        )
        raw_path = None
        if raw_files:
            # Sort raw files the same way
            raw_files_with_metadata = []
            for file_info in raw_files:
                updated_at = file_info.get("updated_at") or file_info.get("created_at")
                # Only use updated_at if it's a non-empty string
                raw_files_with_metadata.append((file_info, updated_at if updated_at and updated_at.strip() else ""))
            
            # Sort by updated_at if available (most recent first), otherwise by timestamp
            raw_files_with_metadata.sort(
                key=lambda x: x[1] if x[1] and x[1].strip() else extract_timestamp(x[0].get("name", "")),
                reverse=True
            )
            raw_path = f"{user_id}/raw/{raw_files_with_metadata[0][0]['name']}"
        
        return CVExtractionResponse(
            status="success",
            cv_data=cv_data,
            metadata=cv_data.get("metadata", {}),
            storage_paths={
                "raw": raw_path or "",
                "parsed": parsed_path,
            },
        )
        
    except ValueError as e:
        logger.error(f"CV retrieval error: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except Exception as e:
        error_message = str(e)
        logger.error(f"CV retrieval error for user {user_id}: {error_message}", exc_info=True)
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve CV: {error_message}",
        )


@router.get("/candidate/{candidate_id}", response_model=CVExtractionResponse)
async def get_candidate_cv(
    candidate_id: str,
    applied_at: Optional[str] = Query(None, description="ISO datetime to get CV version at application time (deprecated, use cv_file_timestamp)"),
    cv_file_timestamp: Optional[str] = Query(None, description="CV file timestamp in YYYYMMDD_HHMMSS format (exact file to retrieve)"),
    recruiter=Depends(require_recruiter),
    supabase: Client = Depends(get_supabase),
):
    """
    Get parsed CV data for a specific candidate.
    
    Priority order:
    1. If cv_file_timestamp is provided, retrieves the exact CV file with that timestamp
    2. If applied_at is provided, returns the CV version that existed at that datetime (fallback)
    3. Otherwise, returns the latest CV version
    
    This endpoint is for recruiters to view candidate CVs.
    Only accessible by authenticated recruiters.
    
    Args:
        candidate_id: Candidate user ID
        cv_file_timestamp: Optional CV file timestamp (YYYYMMDD_HHMMSS format) - most precise
        applied_at: Optional ISO datetime string (e.g., "2024-01-15T10:30:00") - fallback method
    """
    logger.info(f"[CV API] Getting CV for candidate {candidate_id} (requested by recruiter {recruiter['id']}, cv_file_timestamp={cv_file_timestamp}, applied_at={applied_at})")
    
    try:
        # First check if files exist before calling get_parsed_cv
        # Import retry utilities for storage operations
        from app.services.cv.storage_service import _list_storage_files
        from httpx import RemoteProtocolError, ConnectError, TimeoutException
        
        try:
            files = _list_storage_files(supabase, f"{candidate_id}/parsed")
            logger.info(f"[CV API] Storage list returned {len(files) if files else 0} files for candidate {candidate_id}")
        except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
            logger.error(f"Supabase connection error listing files for candidate {candidate_id}: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail="CV storage service temporarily unavailable. Please try again.",
            )
        except Exception as list_error:
            logger.error(f"Error listing files for candidate {candidate_id}: {str(list_error)}")
            raise HTTPException(
                status_code=404,
                detail=f"Error accessing candidate CV storage: {str(list_error)}",
            )
        
        if not files or len(files) == 0:
            logger.warning(f"No parsed CV files found for candidate {candidate_id} in path {candidate_id}/parsed")
            raise HTTPException(
                status_code=404,
                detail="No parsed CV found for candidate",
            )
        
        # Get CV data - priority: cv_file_timestamp > applied_at > latest
        try:
            if cv_file_timestamp:
                # Use exact timestamp to get specific CV file (most precise)
                logger.info(f"[CV API] Fetching CV with exact timestamp {cv_file_timestamp} for candidate {candidate_id}")
                cv_data = get_parsed_cv(supabase, candidate_id, timestamp=cv_file_timestamp)
                cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
                logger.info(f"[CV API] Retrieved CV with timestamp {cv_file_timestamp} for candidate {candidate_id} - CV name: {cv_name}")
            elif applied_at:
                # Fallback to datetime-based lookup
                try:
                    cv_data = get_parsed_cv_at_datetime(supabase, candidate_id, applied_at)
                    cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
                    logger.info(f"[CV API] Retrieved CV at application time {applied_at} for candidate {candidate_id} - CV name: {cv_name}")
                except ValueError as ve:
                    # If no CV exists at application time, fallback to latest CV
                    logger.warning(f"[CV API] No CV found at application time {applied_at} for candidate {candidate_id}, using latest CV: {str(ve)}")
                    cv_data = get_parsed_cv(supabase, candidate_id, timestamp=None)
                    cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
                    logger.info(f"[CV API] Using latest CV for candidate {candidate_id} - CV name: {cv_name}")
            else:
                # Get latest CV
                cv_data = get_parsed_cv(supabase, candidate_id, timestamp=None)
                cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
                logger.info(f"[CV API] Retrieved latest CV for candidate {candidate_id} - CV name: {cv_name}")
        except ValueError as ve:
            logger.error(f"get_parsed_cv raised ValueError for candidate {candidate_id}: {str(ve)}")
            raise HTTPException(
                status_code=404,
                detail=str(ve),
            )
        
        # Sort by timestamp extracted from filename for more reliable sorting
        def extract_timestamp(filename: str) -> str:
            """Extract timestamp from filename (format: YYYYMMDD_HHMMSS_filename.json)"""
            try:
                parts = filename.split('_', 2)
                if len(parts) >= 2:
                    return f"{parts[0]}_{parts[1]}"
            except:
                pass
            return filename
        
        # Sort by updated_at if available, otherwise by timestamp
        files_with_metadata = []
        for file_info in files:
            updated_at = file_info.get("updated_at") or file_info.get("created_at")
            files_with_metadata.append((file_info, updated_at if updated_at and updated_at.strip() else ""))
        
        files_with_metadata.sort(
            key=lambda x: x[1] if x[1] and x[1].strip() else extract_timestamp(x[0].get("name", "")),
            reverse=True
        )
        
        parsed_path = f"{candidate_id}/parsed/{files_with_metadata[0][0]['name']}"
        
        # Try to get raw PDF path
        raw_files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
            f"{candidate_id}/raw"
        )
        raw_path = None
        if raw_files:
            raw_files_with_metadata = []
            for file_info in raw_files:
                updated_at = file_info.get("updated_at") or file_info.get("created_at")
                raw_files_with_metadata.append((file_info, updated_at if updated_at and updated_at.strip() else ""))
            
            raw_files_with_metadata.sort(
                key=lambda x: x[1] if x[1] and x[1].strip() else extract_timestamp(x[0].get("name", "")),
                reverse=True
            )
            raw_path = f"{candidate_id}/raw/{raw_files_with_metadata[0][0]['name']}"
        
        # Log the CV name being returned
        final_cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
        logger.info(f"[CV API] Successfully retrieved CV for candidate {candidate_id} - CV name in response: {final_cv_name}")
        
        return CVExtractionResponse(
            status="success",
            cv_data=cv_data,
            metadata=cv_data.get("metadata", {}),
            storage_paths={
                "raw": raw_path or "",
                "parsed": parsed_path,
            },
        )
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"CV retrieval error (ValueError): {str(e)}")
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except Exception as e:
        error_message = str(e)
        logger.error(f"CV retrieval error for candidate {candidate_id}: {error_message}", exc_info=True)
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve CV: {error_message}",
        )


@router.post("/match", response_model=MatchAnalysisResponse)
async def analyze_match(
    request: MatchAnalysisRequest,
    user_id: str = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Calculate match score between candidate's CV and a job position.
    
    This endpoint runs match analysis agents to calculate how well
    the candidate's CV matches the job requirements.
    """
    logger.info(f"Match analysis request: user_id={user_id}, job_position_id={request.job_position_id}")
    
    try:
        # Get job position details
        job_response = (
            supabase.table("job_position")
            .select("id, job_title, job_description")
            .eq("id", request.job_position_id)
            .maybe_single()
            .execute()
        )
        
        if not job_response.data:
            raise HTTPException(
                status_code=404,
                detail="Job position not found",
            )
        
        job_title = job_response.data.get("job_title", "")
        job_description = job_response.data.get("job_description")
        
        # Calculate match score
        match_result = calculate_match_score(
            user_id=user_id,
            job_position_id=request.job_position_id,
            job_title=job_title,
            job_description=job_description,
            cv_timestamp=request.cv_timestamp,
            supabase=supabase,
        )
        
        return MatchAnalysisResponse(**match_result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Match analysis error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate match score: {str(e)}",
        )
