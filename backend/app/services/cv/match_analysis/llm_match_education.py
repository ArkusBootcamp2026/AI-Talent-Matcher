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

class EducationMatchOutput(BaseModel):
    """Output schema for education-job position matching"""
    match_score: float = Field(
        description="Relevance score from 0.0 to 1.0",
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Brief explanation of how the education relates to the job position"
    )
    relevant_degrees: list[str] = Field(
        description="List of degrees that are relevant to the job position"
    )
    missing_qualifications: list[str] = Field(
        description="List of educational qualifications that would strengthen the match"
    )


# ============================================================================
# TEMPLATE
# ============================================================================

TEMPLATE_EDUCATION_MATCH = """
You are an expert recruiter analyzing how well a candidate's EDUCATION background matches a job position.

Your task is to evaluate the relevance of the candidate's education (degrees, institutions, academic projects, certifications) 
to the requirements and expectations of the job position.

EVALUATION CRITERIA:
- Degree relevance: How well do the degrees align with the job requirements?
- Institution quality: Consider the prestige/reputation of institutions (if relevant)
- Academic projects: Do academic projects demonstrate relevant skills?
- Certifications: Are certifications relevant to the job position?
- Overall fit: Provide a normalized score from 0.0 to 1.0

SCORING GUIDELINES:
- 0.9-1.0: Excellent match - education directly aligns with job requirements
- 0.7-0.8: Good match - education is relevant with minor gaps
- 0.5-0.6: Moderate match - some relevance but significant gaps
- 0.3-0.4: Weak match - limited relevance
- 0.0-0.2: Poor match - education doesn't align with job requirements

Return a JSON structure EXACTLY matching this format:
{format_instructions}

JOB POSITION:
<<<
{job_position}
>>>

CANDIDATE EDUCATION DATA (JSON):
<<<
{education_data}
>>>
"""


# ============================================================================
# AGENT
# ============================================================================

class EducationMatchAgent:
    """Agent for matching candidate education with job position requirements"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.3):
        self.output_parser = PydanticOutputParser(
            pydantic_object=EducationMatchOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_EDUCATION_MATCH,
            input_variables=["job_position", "education_data"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, job_position: str, education_data: dict) -> EducationMatchOutput:
        """
        Analyze how well candidate's education matches the job position.

        Args:
            job_position: Description of the job position/role
            education_data: Dictionary containing education information from parsed CV

        Returns:
            EducationMatchOutput with match score and analysis
        """
        import json
        education_json = json.dumps(education_data, indent=2, ensure_ascii=False)
        
        return self.chain.invoke({
            "job_position": job_position,
            "education_data": education_json
        })
