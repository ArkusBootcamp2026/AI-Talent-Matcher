from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date

class JobCreate(BaseModel):
    job_title: str
    job_description: Optional[str] = None
    job_requirements: Optional[str] = None
    job_skills: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    optional_salary: Optional[int] = None
    optional_salary_max: Optional[int] = None
    closing_date: Optional[date] = None
    sprint_duration: Optional[str] = None
    status: Optional[str] = "open"

    @field_validator("closing_date", mode="before")
    @classmethod
    def parse_closing_date(cls, v):
        if not v:
            return None
        if isinstance(v, str):
            if v.strip() == "":
                return None
            return date.fromisoformat(v)
        return v

    @field_validator("job_description", "job_requirements", "job_skills", "location", "employment_type", "sprint_duration", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("optional_salary", "optional_salary_max", mode="before")
    @classmethod
    def parse_salary(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return None
        return v


class JobUpdate(BaseModel):
    job_title: Optional[str] = None
    job_description: Optional[str] = None
    job_requirements: Optional[str] = None
    job_skills: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    optional_salary: Optional[int] = None
    optional_salary_max: Optional[int] = None
    closing_date: Optional[date] = None
    sprint_duration: Optional[str] = None
    status: Optional[str] = None

    @field_validator("closing_date", mode="before")
    @classmethod
    def parse_closing_date(cls, v):
        if not v:
            return None
        if isinstance(v, str):
            if v.strip() == "":
                return None
            return date.fromisoformat(v)
        return v

    @field_validator("job_description", "job_requirements", "job_skills", "location", "employment_type", "sprint_duration", "status", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("optional_salary", "optional_salary_max", mode="before")
    @classmethod
    def parse_salary(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return None
        return v
