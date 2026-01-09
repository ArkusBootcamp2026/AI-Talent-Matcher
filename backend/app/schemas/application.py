# schemas/application.py

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime

class ApplicationCreate(BaseModel):
    job_position_id: int
    cover_letter: Optional[str] = None

    @field_validator("cover_letter", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        return v

    @field_validator("job_position_id", mode="before")
    @classmethod
    def validate_job_id(cls, v):
        if v is None:
            raise ValueError("job_position_id is required")
        try:
            return int(v)
        except (ValueError, TypeError):
            raise ValueError("job_position_id must be an integer")


class ApplicationOut(BaseModel):
    id: int
    job_position_id: int
    status: str
    applied_at: datetime
