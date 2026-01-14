"""CV extraction request and response schemas"""

from typing import Optional
from pydantic import BaseModel


class CVExtractionResponse(BaseModel):
    """Response schema for CV extraction"""
    status: str
    cv_data: dict
    metadata: dict
    storage_paths: dict
