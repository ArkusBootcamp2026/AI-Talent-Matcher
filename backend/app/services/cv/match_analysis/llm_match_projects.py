# ============================================================================
# LIBRARIES
# ============================================================================

from typing import Optional
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
from langchain.output_parsers import PydanticOutputParser


# ============================================================================
# SCHEMA
# ============================================================================

class ProjectsMatchOutput(BaseModel):
    """Output schema for projects-job position matching"""
    match_score: float = Field(
        description="Relevance score from 0.0 to 1.0",
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Brief explanation of how the projects relate to the job position"
    )
    relevant_projects: list[str] = Field(
        description="List of projects that are most relevant to the job"
    )
    project_skills_demonstrated: list[str] = Field(
        description="List of skills demonstrated through projects that match job requirements"
    )
    missing_project_types: list[str] = Field(
        description="List of project types that would strengthen the match"
    )


# ============================================================================
# TEMPLATE
# ============================================================================

TEMPLATE_PROJECTS_MATCH = """
You are an expert recruiter analyzing how well a candidate's PROJECTS match a job position.

Your task is to evaluate the relevance of the candidate's projects to the requirements and expectations of the job position.

EVALUATION CRITERIA:
- Project relevance: How well do projects align with job requirements?
- Skills demonstrated: Do projects showcase required technical/domain skills?
- Complexity and scope: Consider the complexity and scale of projects
- Technologies used: Are technologies/tools used relevant to the job?
- Overall fit: Provide a normalized score from 0.0 to 1.0

SCORING GUIDELINES:
- 0.9-1.0: Excellent match - projects directly demonstrate required skills
- 0.7-0.8: Good match - projects are relevant with minor gaps
- 0.5-0.6: Moderate match - some relevance but significant gaps
- 0.3-0.4: Weak match - limited relevance
- 0.0-0.2: Poor match - projects don't align with job requirements

Return a JSON structure EXACTLY matching this format:
{format_instructions}

JOB POSITION:
<<<
{job_position}
>>>

CANDIDATE PROJECTS DATA (JSON):
<<<
{projects_data}
>>>
"""


# ============================================================================
# AGENT
# ============================================================================

class ProjectsMatchAgent:
    """Agent for matching candidate projects with job position requirements"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.3):
        self.output_parser = PydanticOutputParser(
            pydantic_object=ProjectsMatchOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_PROJECTS_MATCH,
            input_variables=["job_position", "projects_data"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, job_position: str, projects_data: dict) -> ProjectsMatchOutput:
        """
        Analyze how well candidate's projects match the job position.

        Args:
            job_position: Description of the job position/role
            projects_data: Dictionary containing projects information from parsed CV

        Returns:
            ProjectsMatchOutput with match score and analysis
        """
        import json
        projects_json = json.dumps(projects_data, indent=2, ensure_ascii=False)
        
        return self.chain.invoke({
            "job_position": job_position,
            "projects_data": projects_json
        })
