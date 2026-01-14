"""Match analysis schemas"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class MatchAnalysisRequest(BaseModel):
    """Request schema for match analysis"""
    job_position_id: int = Field(..., description="Job position ID")
    cv_timestamp: Optional[str] = Field(None, description="Optional CV timestamp to use specific CV version")


class MatchAnalysisResponse(BaseModel):
    """Response schema for match analysis"""
    final_score: float = Field(..., description="Final weighted match score (0.0 to 1.0)", ge=0.0, le=1.0)
    component_scores: Dict[str, float] = Field(..., description="Individual component scores")
    component_weights: Dict[str, float] = Field(..., description="Weights used for each component")
    component_results: Dict[str, Any] = Field(..., description="Detailed results for each component")
    score_breakdown: Dict[str, Dict[str, float]] = Field(..., description="Breakdown of weighted scores")
    metadata: Dict[str, Any] = Field(..., description="Metadata about the analysis")
    error: Optional[str] = Field(None, description="Error message if calculation failed")
