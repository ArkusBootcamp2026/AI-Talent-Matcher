"""Storage service for CV files in Supabase Storage"""

from datetime import datetime, timezone
from typing import Optional
from supabase import Client
import json
import logging
from httpx import RemoteProtocolError, ConnectError, TimeoutException

from app.core.config import settings
from app.utils.retry import retry_supabase_operation

logger = logging.getLogger(__name__)


def generate_timestamp() -> str:
    """Generate timestamp in format YYYYMMDD_HHMMSS"""
    now = datetime.now()
    return now.strftime("%Y%m%d_%H%M%S")


def store_raw_pdf(
    supabase: Client,
    user_id: str,
    pdf_content: bytes,
    cv_name: str,
    timestamp: str
) -> str:
    """
    Store raw PDF to Supabase Storage.
    
    Args:
        supabase: Supabase client
        user_id: User ID
        pdf_content: PDF file content as bytes
        cv_name: Original CV filename (without extension)
        timestamp: Timestamp string (YYYYMMDD_HHMMSS)
        
    Returns:
        Storage path
    """
    storage_path = f"{user_id}/raw/{timestamp}_{cv_name}.pdf"
    
    supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
        storage_path,
        pdf_content,
        file_options={"content-type": "application/pdf", "upsert": "false"}
    )
    
    return storage_path


def store_parsed_cv(
    supabase: Client,
    user_id: str,
    cv_data: dict,
    cv_name: str,
    timestamp: str
) -> str:
    """
    Store parsed CV JSON to Supabase Storage.
    
    Args:
        supabase: Supabase client
        user_id: User ID
        cv_data: Parsed CV data as dictionary
        cv_name: Original CV filename (without extension)
        timestamp: Timestamp string (YYYYMMDD_HHMMSS)
        
    Returns:
        Storage path
    """
    storage_path = f"{user_id}/parsed/{timestamp}_{cv_name}.json"
    json_content = json.dumps(cv_data, indent=2, ensure_ascii=False).encode('utf-8')
    
    try:
        supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
            storage_path,
            json_content,
            file_options={"content-type": "application/json", "upsert": "false"}
        )
    except Exception as e:
        error_msg = str(e)
        # If JSON MIME type is not allowed, try without content-type
        if "application/json is not supported" in error_msg or "mime type" in error_msg.lower():
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "JSON MIME type not allowed in bucket. "
                "Trying upload without content-type. "
                "Please add 'application/json' to bucket allowed MIME types."
            )
            # Try without content-type specification
            supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
                storage_path,
                json_content,
                file_options={"upsert": "false"}
            )
        else:
            raise
    
    return storage_path


@retry_supabase_operation(max_retries=3, initial_delay=0.5)
def _list_storage_files(supabase: Client, path: str):
    """List storage files with retry logic"""
    return supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(path)


@retry_supabase_operation(max_retries=3, initial_delay=0.5)
def _download_storage_file(supabase: Client, file_path: str):
    """Download storage file with retry logic"""
    return supabase.storage.from_(settings.SUPABASE_CV_BUCKET).download(file_path)


def get_latest_cv_file_info(
    supabase: Client,
    user_id: str
) -> Optional[dict]:
    """
    Get the latest CV file information (path and timestamp) for a user.
    
    Returns:
        Dictionary with 'file_path' and 'timestamp' (YYYYMMDD_HHMMSS format) if CV exists,
        None if no CV found
    """
    list_path = f"{user_id}/parsed"
    
    try:
        files = _list_storage_files(supabase, list_path)
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error listing CV files for user {user_id}: {str(e)}")
        return None
    
    if not files:
        return None
    
    # Extract timestamp from filename for sorting
    def extract_timestamp(filename: str) -> str:
        try:
            parts = filename.split('_', 2)
            if len(parts) >= 2:
                return f"{parts[0]}_{parts[1]}"
        except:
            pass
        return filename
    
    # Sort by filename timestamp (newest first)
    files.sort(key=lambda x: extract_timestamp(x.get("name", "")), reverse=True)
    
    # Also try to use updated_at if available
    files_with_metadata = []
    for file_info in files:
        updated_at = file_info.get("updated_at") or file_info.get("created_at")
        files_with_metadata.append((file_info, updated_at if updated_at and updated_at.strip() else ""))
    
    files_with_metadata.sort(
        key=lambda x: x[1] if x[1] and x[1].strip() else extract_timestamp(x[0].get("name", "")),
        reverse=True
    )
    
    latest_file = files_with_metadata[0][0]
    filename = latest_file.get("name", "")
    
    # Extract timestamp from filename
    timestamp = None
    try:
        parts = filename.split('_', 2)
        if len(parts) >= 2:
            timestamp = f"{parts[0]}_{parts[1]}"  # YYYYMMDD_HHMMSS
    except:
        pass
    
    file_path = f"{user_id}/parsed/{filename}"
    
    return {
        "file_path": file_path,
        "timestamp": timestamp,
        "filename": filename,
    }


def get_parsed_cv_at_datetime(
    supabase: Client,
    user_id: str,
    target_datetime: str
) -> dict:
    """
    Retrieve the parsed CV that was the latest at a specific datetime.
    
    This is useful for getting the CV version that existed when a candidate
    applied to a job position.
    
    Args:
        supabase: Supabase client
        user_id: User ID
        target_datetime: ISO format datetime string (e.g., "2024-01-15T10:30:00")
        
    Returns:
        Parsed CV data as dictionary (the latest CV that existed at target_datetime)
    """
    try:
        target_dt = datetime.fromisoformat(target_datetime.replace('Z', '+00:00'))
        # Ensure target_dt is timezone-aware (if it's naive, assume UTC)
        if target_dt.tzinfo is None:
            target_dt = target_dt.replace(tzinfo=timezone.utc)
    except:
        # Fallback to latest if datetime parsing fails
        return get_parsed_cv(supabase, user_id, timestamp=None)
    
    list_path = f"{user_id}/parsed"
    logger.info(f"[Storage] get_parsed_cv_at_datetime: Listing files in path: {list_path} for user_id: {user_id}, target_datetime: {target_datetime}")
    
    try:
        files = _list_storage_files(supabase, list_path)
        logger.info(f"[Storage] get_parsed_cv_at_datetime: Found {len(files) if files else 0} files for user {user_id}")
        if files:
            for i, file_info in enumerate(files):
                logger.info(f"[Storage] get_parsed_cv_at_datetime: File {i+1}: {file_info.get('name', 'Unknown')} (path: {list_path})")
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error listing CV files for user {user_id}: {str(e)}")
        raise ValueError(f"Failed to retrieve CV files due to connection error: {str(e)}")

    if not files:
        raise ValueError(f"No parsed CVs found for user {user_id}")

    # Filter files that were created before or at target_datetime
    # Use filename timestamp as primary source (more reliable than Supabase metadata)
    valid_files = []
    for file_info in files:
        filename = file_info.get("name", "")
        file_dt = None
        
        # Try to extract timestamp from filename first (most reliable)
        try:
            # Filename format: YYYYMMDD_HHMMSS_filename.json
            parts = filename.split('_', 2)
            if len(parts) >= 2:
                date_str = parts[0]  # YYYYMMDD
                time_str = parts[1]  # HHMMSS
                # Parse as naive datetime, then make it timezone-aware (assume UTC)
                file_dt_naive = datetime.strptime(f"{date_str}_{time_str}", "%Y%m%d_%H%M%S")
                # Make timezone-aware by assuming UTC (since we don't know the timezone, UTC is safest)
                file_dt = file_dt_naive.replace(tzinfo=timezone.utc)
        except:
            pass
        
        # Fallback to Supabase metadata if filename parsing fails
        if file_dt is None:
            file_created_at = file_info.get("created_at") or file_info.get("updated_at")
            if file_created_at:
                try:
                    file_dt = datetime.fromisoformat(file_created_at.replace('Z', '+00:00'))
                    # Ensure file_dt is timezone-aware
                    if file_dt.tzinfo is None:
                        file_dt = file_dt.replace(tzinfo=timezone.utc)
                except:
                    pass
        
        # Only add file if we successfully parsed a datetime and it's before or at target
        # Both datetimes should now be timezone-aware
        if file_dt:
            # Ensure file_dt is timezone-aware (should already be, but double-check)
            if file_dt.tzinfo is None:
                file_dt = file_dt.replace(tzinfo=timezone.utc)
            
            if file_dt <= target_dt:
                valid_files.append((file_info, file_dt))
                logger.info(f"[Storage] get_parsed_cv_at_datetime: File {filename} has datetime {file_dt} (<= {target_dt}) - VALID")
            else:
                logger.info(f"[Storage] get_parsed_cv_at_datetime: File {filename} has datetime {file_dt} (> {target_dt}) - SKIPPED")
    
    if not valid_files:
        raise ValueError(f"No CV found for user {user_id} at datetime {target_datetime}")
    
    # Get the latest file from valid files
    valid_files.sort(key=lambda x: x[1], reverse=True)
    latest_file = valid_files[0][0]
    latest_file_dt = valid_files[0][1]
    
    logger.info(f"[Storage] get_parsed_cv_at_datetime: Selected latest file: {latest_file['name']} with datetime {latest_file_dt} from {len(valid_files)} valid files")
    if len(valid_files) > 1:
        logger.info(f"[Storage] get_parsed_cv_at_datetime: Other valid files: {[(f[0]['name'], f[1]) for f in valid_files[1:]]}")
    
    file_path = f"{user_id}/parsed/{latest_file['name']}"
    
    logger.info(f"[Storage] get_parsed_cv_at_datetime: Downloading file from path: {file_path} for user_id: {user_id}")

    try:
        file_content = _download_storage_file(supabase, file_path)
        cv_data = json.loads(file_content.decode('utf-8'))
        cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
        logger.info(f"[Storage] get_parsed_cv_at_datetime: Downloaded CV from {file_path} - CV name: {cv_name} (expected user_id: {user_id})")
        return cv_data
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error downloading CV file {file_path}: {str(e)}")
        raise ValueError(f"Failed to download CV file due to connection error: {str(e)}")


def get_parsed_cv(
    supabase: Client,
    user_id: str,
    timestamp: Optional[str] = None
) -> dict:
    """
    Retrieve parsed CV JSON from Supabase Storage.
    
    Args:
        supabase: Supabase client
        user_id: User ID
        timestamp: Optional timestamp to get specific version. If None, gets latest.
        
    Returns:
        Parsed CV data as dictionary
    """
    if timestamp:
        # Get specific version - need to list files to find exact match
        files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
            f"{user_id}/parsed"
        )
        
        # Find file with matching timestamp
        for file_info in files:
            if file_info.get("name", "").startswith(timestamp):
                file_path = f"{user_id}/parsed/{file_info['name']}"
                try:
                    file_content = _download_storage_file(supabase, file_path)
                except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
                    logger.error(f"Supabase connection error downloading CV file {file_path}: {str(e)}")
                    raise ValueError(f"Failed to download CV file due to connection error: {str(e)}")
                return json.loads(file_content.decode('utf-8'))
        
        raise ValueError(f"CV with timestamp {timestamp} not found")
    
    # Get latest version
    list_path = f"{user_id}/parsed"
    logger.info(f"[Storage] get_parsed_cv: Listing files in path: {list_path} for user_id: {user_id}")
    
    try:
        files = _list_storage_files(supabase, list_path)
        logger.info(f"[Storage] get_parsed_cv: Found {len(files) if files else 0} files for user {user_id}")
        if files:
            for i, file_info in enumerate(files):
                logger.info(f"[Storage] get_parsed_cv: File {i+1}: {file_info.get('name', 'Unknown')} (path: {list_path})")
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error listing CV files for user {user_id}: {str(e)}")
        raise ValueError(f"Failed to retrieve CV files due to connection error: {str(e)}")

    if not files:
        raise ValueError(f"No parsed CVs found for user {user_id}")
    
    # Sort by timestamp extracted from filename (format: YYYYMMDD_HHMMSS_filename.json)
    # Extract timestamp from filename for more reliable sorting
    def extract_timestamp(filename: str) -> str:
        """Extract timestamp from filename (format: YYYYMMDD_HHMMSS_filename.json)"""
        try:
            # Filename format: {timestamp}_{cv_name}.json
            parts = filename.split('_', 2)
            if len(parts) >= 2:
                # Combine date and time parts: YYYYMMDD_HHMMSS
                timestamp_str = f"{parts[0]}_{parts[1]}"
                return timestamp_str
        except:
            pass
        # Fallback to filename for sorting if extraction fails
        return filename
    
    # Sort by extracted timestamp (newest first)
    files.sort(key=lambda x: extract_timestamp(x.get("name", "")), reverse=True)
    
    # Also try to use updated_at if available (more reliable)
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
    
    latest_file = files_with_metadata[0][0]
    file_path = f"{user_id}/parsed/{latest_file['name']}"
    
    logger.info(f"[Storage] get_parsed_cv: Downloading file from path: {file_path} for user_id: {user_id}")

    try:
        file_content = _download_storage_file(supabase, file_path)
        cv_data = json.loads(file_content.decode('utf-8'))
        cv_name = cv_data.get('identity', {}).get('full_name', 'Unknown') if isinstance(cv_data, dict) else 'Unknown'
        logger.info(f"[Storage] get_parsed_cv: Downloaded CV from {file_path} - CV name: {cv_name} (expected user_id: {user_id})")
        return cv_data
    except (RemoteProtocolError, ConnectError, TimeoutException, ConnectionError) as e:
        logger.error(f"Supabase connection error downloading CV file {file_path}: {str(e)}")
        raise ValueError(f"Failed to download CV file due to connection error: {str(e)}")


def update_parsed_cv(
    supabase: Client,
    user_id: str,
    updates: dict,
    timestamp: Optional[str] = None
) -> str:
    """
    Update parsed CV JSON in Supabase Storage.
    Only updates fields that are provided in updates dict.
    
    Args:
        supabase: Supabase client
        user_id: User ID
        updates: Dictionary with fields to update (only identity fields)
        timestamp: Optional timestamp to update specific version. If None, updates latest.
        
    Returns:
        Storage path of updated file
    """
    # Get existing CV data
    cv_data = get_parsed_cv(supabase, user_id, timestamp)
    
    # Get file path
    if timestamp:
        files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
            f"{user_id}/parsed"
        )
        for file_info in files:
            if file_info.get("name", "").startswith(timestamp):
                file_path = f"{user_id}/parsed/{file_info['name']}"
                break
        else:
            raise ValueError(f"CV with timestamp {timestamp} not found")
    else:
        files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
            f"{user_id}/parsed"
        )
        if not files:
            raise ValueError(f"No parsed CVs found for user {user_id}")
        
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
        
        file_path = f"{user_id}/parsed/{files_with_metadata[0][0]['name']}"
    
    # Update identity fields if provided
    if "identity" not in cv_data:
        cv_data["identity"] = {}
    
    identity_updates = {
        "full_name": updates.get("full_name"),
        "headline": updates.get("headline"),
        "introduction": updates.get("introduction"),
        "email": updates.get("email"),
        "phone": updates.get("phone"),
        "location": updates.get("location"),
    }
    
    # Only update fields that are provided (not None)
    for key, value in identity_updates.items():
        if value is not None:
            cv_data["identity"][key] = value
    
    # Update skills if provided
    if "selected_skills" in updates and updates["selected_skills"] is not None:
        if "skills_analysis" not in cv_data:
            cv_data["skills_analysis"] = {}
        
        # Update explicit_skills with selected_skills
        cv_data["skills_analysis"]["explicit_skills"] = updates["selected_skills"]
    
    # Save updated JSON (using upload with upsert to overwrite)
    json_content = json.dumps(cv_data, indent=2, ensure_ascii=False).encode('utf-8')
    
    try:
        supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
            file_path,
            json_content,
            file_options={"content-type": "application/json", "upsert": "true"}
        )
    except Exception as e:
        error_msg = str(e)
        # If JSON MIME type is not allowed, try without content-type
        if "application/json is not supported" in error_msg or "mime type" in error_msg.lower():
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                "JSON MIME type not allowed in bucket. "
                "Trying update without content-type. "
                "Please add 'application/json' to bucket allowed MIME types."
            )
            supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
                file_path,
                json_content,
                file_options={"upsert": "true"}
            )
        else:
            raise
    
    return file_path


def store_match_result(
    supabase: Client,
    user_id: str,
    match_data: dict,
    cv_name: str,
    job_position_id: int,
    job_title: str,
    timestamp: str
) -> str:
    """
    Store match analysis result to Supabase Storage.
    
    Each match result is uniquely identified by (user_id, job_position_id) combination.
    This ensures that the same candidate applying to different jobs gets separate analyses.
    
    Args:
        supabase: Supabase client
        user_id: User ID (candidate profile ID)
        match_data: Match analysis result dictionary
        cv_name: Original CV filename (without extension)
        job_position_id: Job position ID (ensures uniqueness per job)
        job_title: Job title/position name (for readability in filename)
        timestamp: Timestamp string (YYYYMMDD_HHMMSS)
        
    Returns:
        Storage path
    """
    # Include job_position_id in path to ensure uniqueness per job position
    # Format: {user_id}/match_results/job_{job_position_id}_{timestamp}_{cv_name}_{job_slug}.json
    job_slug = job_title.lower().replace(" ", "_").replace("/", "_")[:30]
    storage_path = f"{user_id}/match_results/job_{job_position_id}_{timestamp}_{cv_name}_{job_slug}.json"
    json_content = json.dumps(match_data, indent=2, ensure_ascii=False).encode('utf-8')
    
    try:
        supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
            storage_path,
            json_content,
            file_options={"content-type": "application/json", "upsert": "false"}
        )
    except Exception as e:
        error_msg = str(e)
        # If JSON MIME type is not allowed, try without content-type
        if "application/json is not supported" in error_msg or "mime type" in error_msg.lower():
            logger.warning(
                "JSON MIME type not allowed in bucket. "
                "Trying upload without content-type. "
                "Please add 'application/json' to bucket allowed MIME types."
            )
            # Try without content-type specification
            supabase.storage.from_(settings.SUPABASE_CV_BUCKET).upload(
                storage_path,
                json_content,
                file_options={"upsert": "false"}
            )
        else:
            raise
    
    logger.info(f"Match result stored at: {storage_path}")
    return storage_path
