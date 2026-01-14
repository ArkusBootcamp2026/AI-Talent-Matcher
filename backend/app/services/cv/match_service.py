"""Match analysis service for CV-Job matching"""

import logging
import sys
from typing import Optional, Dict, Any
from datetime import datetime

# Add compatibility layer for langchain imports
# match_analysis modules use old import paths (langchain.prompts) but LangChain 0.3+ uses langchain_core.prompts
# We need to inject compatibility shims into sys.modules before any imports happen
try:
    # Import langchain_core first to get the actual modules
    import langchain_core
    from langchain_core import prompts as _core_prompts
    from langchain_core import output_parsers as _core_output_parsers
    
    # Directly inject into sys.modules - this is the key to making 'from langchain.prompts import ...' work
    # Python's import system will check sys.modules first
    sys.modules['langchain.prompts'] = _core_prompts
    sys.modules['langchain.output_parsers'] = _core_output_parsers
    
    # Also ensure langchain module itself has these attributes
    import langchain
    langchain.prompts = _core_prompts
    langchain.output_parsers = _core_output_parsers
    
except ImportError as langchain_error:
    raise ImportError(
        f"LangChain packages not available: {langchain_error}. "
        f"Please install: pip install langchain langchain-core langchain-openai"
    )
except Exception as e:
    raise ImportError(f"Error setting up langchain compatibility: {e}")

# Import match analysis agents and skill matchers
from app.services.cv.match_analysis.llm_match_education import EducationMatchAgent
from app.services.cv.match_analysis.llm_match_experience import ExperienceMatchAgent
from app.services.cv.match_analysis.llm_match_projects import ProjectsMatchAgent
from app.services.cv.match_analysis.llm_match_certifications import CertificationsMatchAgent
from app.services.cv.ner_skill_matcher.skill_scoring import compute_skill_weights
from app.services.cv.ner_skill_matcher.job_skill_db import get_skills_for_job_positions, get_all_job_titles
from app.services.cv.ner_skill_matcher.ner_filter import match_roles_to_csv_titles

from app.services.cv.storage_service import get_parsed_cv, store_match_result, generate_timestamp

logger = logging.getLogger(__name__)

# Weights for different match components
WEIGHTS = {
    "education": 0.20,
    "experience": 0.40,
    "projects": 0.20,
    "certifications": 0.10,
    "skills": 0.10,
}


def calculate_skills_match_score(cv_data: dict, job_position: str) -> dict:
    """
    Calculate skills match score using NER-based matching.
    
    Returns dict with match_score and matched_skills.
    """
    skills_analysis = cv_data.get("skills_analysis", {})
    explicit_skills = set(skills_analysis.get("explicit_skills", []))
    job_related_skills = set(skills_analysis.get("job_related_skills", []))
    
    # Try to match job position to CSV titles
    csv_titles = get_all_job_titles()
    matched_roles = match_roles_to_csv_titles([job_position], csv_titles)
    
    if matched_roles:
        # Get skills for matched job position
        position_skills = get_skills_for_job_positions(matched_roles)
        position_skills_set = set(position_skills)
        
        # Calculate overlap
        matched_skills = explicit_skills & position_skills_set
        
        # Calculate weighted score
        if position_skills:
            skill_weights = compute_skill_weights(position_skills)
            match_score = sum(skill_weights.get(skill, 0.0) for skill in matched_skills)
            # Normalize to 0-1 range
            match_score = min(1.0, match_score)
        else:
            match_score = 0.0
    else:
        # Fallback: use job_related_skills if available
        if job_related_skills:
            matched_skills = explicit_skills & job_related_skills
            skill_weights = compute_skill_weights(list(job_related_skills))
            match_score = sum(skill_weights.get(skill, 0.0) for skill in matched_skills)
            match_score = min(1.0, match_score)
        else:
            matched_skills = set()
            match_score = 0.0
    
    return {
        "match_score": round(match_score, 3),
        "matched_skills": sorted(list(matched_skills)),
        "total_cv_skills": len(explicit_skills),
        "total_job_skills": len(position_skills) if matched_roles else len(job_related_skills),
    }


def normalize_final_score(component_scores: dict, weights: dict) -> float:
    """
    Calculate weighted final score from component scores.
    
    Args:
        component_scores: Dict with scores for each component
        weights: Dict with weights for each component
    
    Returns:
        Normalized final score (0.0 to 1.0)
    """
    total_score = 0.0
    total_weight = 0.0
    
    for component, weight in weights.items():
        score = component_scores.get(component, 0.0)
        total_score += score * weight
        total_weight += weight
    
    # Normalize by total weight
    if total_weight > 0:
        final_score = total_score / total_weight
    else:
        final_score = 0.0
    
    return round(final_score, 3)


def calculate_match_score(
    user_id: str,
    job_position_id: int,
    job_title: str,
    job_description: Optional[str] = None,
    cv_timestamp: Optional[str] = None,
    supabase=None
) -> Dict[str, Any]:
    """
    Calculate match score between candidate's CV and a job position.
    
    IMPORTANT: Each (user_id, job_position_id) combination gets its own unique analysis.
    The same candidate applying to different jobs will receive separate match analyses.
    Results are stored with job_position_id in the path to ensure uniqueness.
    
    Args:
        user_id: Candidate user ID (candidate_profile_id)
        job_position_id: Job position ID (ensures uniqueness per job)
        job_title: Job title/position name
        job_description: Optional job description (uses job_title if not provided)
        cv_timestamp: Optional CV timestamp to use specific CV version
        supabase: Supabase client instance
    
    Returns:
        Dictionary with match analysis results including final_score
    """
    logger.info(f"Calculating match score for user {user_id} and job {job_position_id}")
    
    # Get parsed CV data
    try:
        cv_data_response = get_parsed_cv(supabase, user_id, cv_timestamp)
        if not cv_data_response:
            logger.warning(f"No CV data found for user {user_id}")
            return {
                "final_score": 0.0,
                "error": "No CV data found. Please upload your CV first.",
                "component_scores": {},
                "component_results": {},
            }
        
        # Extract cv_data from response (structure may vary)
        cv_data = cv_data_response
        if isinstance(cv_data_response, dict) and "cv_data" in cv_data_response:
            cv_data = cv_data_response["cv_data"]
    except Exception as e:
        logger.error(f"Error retrieving CV data: {e}")
        return {
            "final_score": 0.0,
            "error": f"Failed to retrieve CV data: {str(e)}",
            "component_scores": {},
            "component_results": {},
        }
    
    # Use job_description if available, otherwise use job_title
    job_position_text = job_description if job_description else job_title
    
    # Initialize agents
    education_agent = EducationMatchAgent()
    experience_agent = ExperienceMatchAgent()
    projects_agent = ProjectsMatchAgent()
    certifications_agent = CertificationsMatchAgent()
    
    # Component scores
    component_scores = {}
    component_results = {}
    
    # 1. Education Match
    logger.info("Analyzing education match...")
    try:
        education_data = cv_data.get("education", [])
        if education_data:
            education_result = education_agent.invoke(job_position_text, {"education": education_data})
            component_scores["education"] = education_result.match_score
            component_results["education"] = education_result.model_dump()
        else:
            component_scores["education"] = 0.0
            component_results["education"] = {"match_score": 0.0, "reasoning": "No education data found"}
    except Exception as e:
        logger.error(f"Error in education match: {e}")
        component_scores["education"] = 0.0
        component_results["education"] = {"match_score": 0.0, "error": str(e)}
    
    # 2. Experience Match
    logger.info("Analyzing experience match...")
    try:
        experience_data = cv_data.get("experience", [])
        if experience_data:
            experience_result = experience_agent.invoke(job_position_text, {"experiences": experience_data})
            component_scores["experience"] = experience_result.match_score
            component_results["experience"] = experience_result.model_dump()
        else:
            component_scores["experience"] = 0.0
            component_results["experience"] = {"match_score": 0.0, "reasoning": "No experience data found"}
    except Exception as e:
        logger.error(f"Error in experience match: {e}")
        component_scores["experience"] = 0.0
        component_results["experience"] = {"match_score": 0.0, "error": str(e)}
    
    # 3. Projects Match
    logger.info("Analyzing projects match...")
    try:
        projects_data = cv_data.get("projects", [])
        if not projects_data:
            # Check if projects are in education (academic_projects)
            education_list = cv_data.get("education", [])
            projects_data = []
            for edu in education_list:
                projects_data.extend(edu.get("academic_projects", []))
        
        if projects_data:
            projects_result = projects_agent.invoke(job_position_text, {"projects": projects_data})
            component_scores["projects"] = projects_result.match_score
            component_results["projects"] = projects_result.model_dump()
        else:
            component_scores["projects"] = 0.0
            component_results["projects"] = {"match_score": 0.0, "reasoning": "No projects data found"}
    except Exception as e:
        logger.error(f"Error in projects match: {e}")
        component_scores["projects"] = 0.0
        component_results["projects"] = {"match_score": 0.0, "error": str(e)}
    
    # 4. Certifications Match
    logger.info("Analyzing certifications match...")
    try:
        certifications_data = cv_data.get("certifications", [])
        if not certifications_data:
            # Check if certifications are in education
            education_list = cv_data.get("education", [])
            certifications_data = []
            for edu in education_list:
                certifications_data.extend(edu.get("certifications", []))
        
        if certifications_data:
            certifications_result = certifications_agent.invoke(job_position_text, {"certifications": certifications_data})
            component_scores["certifications"] = certifications_result.match_score
            component_results["certifications"] = certifications_result.model_dump()
        else:
            component_scores["certifications"] = 0.0
            component_results["certifications"] = {"match_score": 0.0, "reasoning": "No certifications data found"}
    except Exception as e:
        logger.error(f"Error in certifications match: {e}")
        component_scores["certifications"] = 0.0
        component_results["certifications"] = {"match_score": 0.0, "error": str(e)}
    
    # 5. Skills Match (using NER-based matching)
    logger.info("Analyzing skills match...")
    try:
        skills_result = calculate_skills_match_score(cv_data, job_position_text)
        component_scores["skills"] = skills_result["match_score"]
        component_results["skills"] = skills_result
    except Exception as e:
        logger.error(f"Error in skills match: {e}")
        component_scores["skills"] = 0.0
        component_results["skills"] = {"match_score": 0.0, "error": str(e)}
    
    # Calculate final weighted score
    final_score = normalize_final_score(component_scores, WEIGHTS)
    
    logger.info(f"Match score calculation complete. Final score: {final_score}")
    
    # Prepare output
    output = {
        "metadata": {
            "user_id": user_id,
            "job_position_id": job_position_id,
            "job_title": job_title,
            "analysis_date": datetime.now().isoformat(),
            "cv_timestamp": cv_timestamp,
        },
        "component_scores": component_scores,
        "component_weights": WEIGHTS,
        "component_results": component_results,
        "final_score": final_score,
        "score_breakdown": {
            component: {
                "raw_score": score,
                "weight": WEIGHTS.get(component, 0.0),
                "weighted_score": round(score * WEIGHTS.get(component, 0.0), 3)
            }
            for component, score in component_scores.items()
        }
    }
    
    # Store match result to Supabase Storage (optional - for historical tracking)
    try:
        # Extract CV name from CV data
        cv_name = cv_data.get("identity", {}).get("full_name", "cv")
        if not cv_name or cv_name == "Unknown":
            cv_name = "cv"
        # Clean CV name for filename (remove special chars, spaces)
        cv_name = "".join(c for c in cv_name if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
        if not cv_name:
            cv_name = "cv"
        
        match_timestamp = generate_timestamp()
        store_match_result(
            supabase=supabase,
            user_id=user_id,
            match_data=output,
            cv_name=cv_name,
            job_position_id=job_position_id,
            job_title=job_title,
            timestamp=match_timestamp
        )
        logger.info(f"Match result stored to storage for user {user_id}, job {job_position_id}")
    except Exception as e:
        # Don't fail the whole operation if storage fails
        logger.warning(f"Failed to store match result to storage: {e}")
    
    return output
