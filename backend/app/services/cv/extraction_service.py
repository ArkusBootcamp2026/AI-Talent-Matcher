"""CV extraction service orchestrating all extraction agents"""

from datetime import datetime
from app.agents.cv_extraction import (
    IdentityAgent,
    ExperienceAgent,
    EducationAgent,
    ProjectsAgent,
    CertificationsAgent,
)
from app.ner_skill_matcher import (
    extract_explicit_skills,
    match_roles_to_csv_titles,
    get_skills_for_job_positions,
    get_all_job_titles,
    get_all_skills,
    SkillsAnalysis,
)
from app.utils.pdf_extractor import extract_text_from_pdf

MAX_SKILLS = 20


async def extract_cv_from_pdf(pdf_content: bytes) -> dict:
    """
    Extract structured data from PDF CV.
    
    Args:
        pdf_content: PDF file content as bytes
        
    Returns:
        Dictionary with extracted CV data and metadata
    """
    # Extract text from PDF
    cv_text = extract_text_from_pdf(pdf_content)
    
    # Initialize agents
    identity_agent = IdentityAgent()
    experience_agent = ExperienceAgent()
    education_agent = EducationAgent()
    projects_agent = ProjectsAgent()
    certifications_agent = CertificationsAgent()
    
    # Run extraction agents
    identity = identity_agent.invoke(cv_text)
    experience = experience_agent.invoke(cv_text)
    education = education_agent.invoke(cv_text)
    projects = projects_agent.invoke(cv_text)
    certifications = certifications_agent.invoke(cv_text)
    
    experiences = experience.model_dump()["experiences"]
    
    # Extract roles from experience and match to CSV using NER
    experience_roles = [exp.get("role", "") for exp in experiences if exp.get("role")]
    
    # Initialize default empty values
    matched_roles: list[str] = []
    job_skills: list[str] = []
    explicit_skills: list[str] = []
    
    if experience_roles:
        # Get all CSV job titles
        csv_titles = get_all_job_titles()
        
        # Match experience roles to CSV titles using NER
        matched_roles = match_roles_to_csv_titles(experience_roles, csv_titles)
        
        if matched_roles:
            # Retrieve skills for matched roles from CSV
            all_role_skills = get_skills_for_job_positions(matched_roles)
            
            # Limit skills based on number of roles
            if len(matched_roles) <= 2:
                job_skills = sorted(all_role_skills)[:MAX_SKILLS]
            else:
                job_skills = sorted(all_role_skills)[:MAX_SKILLS]
            
            # Extract explicit skills using NER from all CSV skills
            all_csv_skills = get_all_skills()
            explicit_skills = extract_explicit_skills(cv_text, all_csv_skills)
            explicit_skills = explicit_skills[:MAX_SKILLS]
    
    skills_analysis = SkillsAnalysis(
        explicit_skills=explicit_skills,
        related_roles=matched_roles,
        job_related_skills=job_skills,
    )
    
    # Generate timestamp
    timestamp = datetime.now()
    date_str = timestamp.strftime("%Y%m%d")
    time_str = timestamp.strftime("%H%M%S")
    
    # Build output
    output = {
        "metadata": {
            "extraction_date": date_str,
            "extraction_time": time_str,
            "extraction_datetime": timestamp.isoformat(),
        },
        "identity": identity.model_dump(),
        "experience": experiences,
        "education": education.model_dump()["education"],
        "projects": projects.model_dump()["projects"],
        "certifications": certifications.model_dump()["certifications"],
        "skills_analysis": skills_analysis.model_dump(),
    }
    
    return output
