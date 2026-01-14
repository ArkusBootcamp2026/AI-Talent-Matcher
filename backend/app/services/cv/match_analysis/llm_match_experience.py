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

class ExperienceMatchOutput(BaseModel):
    """Output schema for experience-job position matching"""
    match_score: float = Field(
        description="Relevance score from 0.0 to 1.0",
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Brief explanation of how the experience relates to the job position"
    )
    relevant_roles: list[str] = Field(
        description="List of roles/positions that are most relevant to the job"
    )
    relevant_responsibilities: list[str] = Field(
        description="List of key responsibilities that match the job requirements"
    )
    experience_gaps: list[str] = Field(
        description="List of experience areas that would strengthen the match"
    )
    years_of_relevant_experience: Optional[float] = Field(
        description="Estimated years of relevant experience for this job position",
        default=None
    )


# ============================================================================
# TEMPLATE
# ============================================================================

TEMPLATE_EXPERIENCE_MATCH = """
You are an expert recruiter analyzing how well a candidate's WORK EXPERIENCE matches a job position.

Your task is to evaluate the relevance of the candidate's professional experience (roles, companies, responsibilities, duration) 
to the requirements and expectations of the job position.

EVALUATION CRITERIA:
- Role relevance: How well do past roles align with the target job?
- Responsibility match: Do past responsibilities demonstrate required skills?
- Industry/domain experience: Is there relevant industry experience?
- Duration and progression: Consider years of experience and career progression
- Overall fit: Provide a normalized score from 0.0 to 1.0

SCORING GUIDELINES:
- 0.9-1.0: Excellent match - experience directly aligns with job requirements
- 0.7-0.8: Good match - experience is relevant with minor gaps
- 0.5-0.6: Moderate match - some relevance but significant gaps
- 0.3-0.4: Weak match - limited relevance
- 0.0-0.2: Poor match - experience doesn't align with job requirements

Return a JSON structure EXACTLY matching this format:
{format_instructions}

JOB POSITION:
<<<
{job_position}
>>>

CANDIDATE EXPERIENCE DATA (JSON):
<<<
{experience_data}
>>>
"""


# ============================================================================
# AGENT
# ============================================================================

class ExperienceMatchAgent:
    """Agent for matching candidate experience with job position requirements"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.3):
        self.output_parser = PydanticOutputParser(
            pydantic_object=ExperienceMatchOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_EXPERIENCE_MATCH,
            input_variables=["job_position", "experience_data"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, job_position: str, experience_data: dict) -> ExperienceMatchOutput:
        """
        Analyze how well candidate's experience matches the job position.

        Args:
            job_position: Description of the job position/role
            experience_data: Dictionary containing experience information from parsed CV

        Returns:
            ExperienceMatchOutput with match score and analysis
        """
        import json
        experience_json = json.dumps(experience_data, indent=2, ensure_ascii=False)
        
        return self.chain.invoke({
            "job_position": job_position,
            "experience_data": experience_json
        })
