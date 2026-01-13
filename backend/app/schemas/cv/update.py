"""CV update request schema"""

from typing import Optional, List
from pydantic import BaseModel


class CVUpdateRequest(BaseModel):
    """Request schema for updating parsed CV data"""
    full_name: Optional[str] = None
    headline: Optional[str] = None
    introduction: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    selected_skills: Optional[List[str]] = None


class CVUpdateResponse(BaseModel):
    """Response schema for CV update"""
    status: str
    message: str
    storage_path: str
