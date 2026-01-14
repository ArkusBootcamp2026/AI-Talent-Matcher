"""Pydantic models for skills analysis"""

from pydantic import BaseModel
from typing import List


class SkillsAnalysis(BaseModel):
    explicit_skills: List[str]
    related_roles: List[str]
    job_related_skills: List[str]
