"""Storage service for CV files in Supabase Storage"""

from datetime import datetime
from typing import Optional
from supabase import Client
import json

from app.core.config import settings


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
                file_content = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).download(file_path)
                return json.loads(file_content.decode('utf-8'))
        
        raise ValueError(f"CV with timestamp {timestamp} not found")
    
    # Get latest version
    files = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).list(
        f"{user_id}/parsed"
    )
    
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
    
    file_content = supabase.storage.from_(settings.SUPABASE_CV_BUCKET).download(file_path)
    return json.loads(file_content.decode('utf-8'))


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

