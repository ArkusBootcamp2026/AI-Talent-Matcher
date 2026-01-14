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

class CertificationsMatchOutput(BaseModel):
    """Output schema for certifications-job position matching"""
    match_score: float = Field(
        description="Relevance score from 0.0 to 1.0",
        ge=0.0,
        le=1.0
    )
    reasoning: str = Field(
        description="Brief explanation of how the certifications relate to the job position"
    )
    relevant_certifications: list[str] = Field(
        description="List of certifications that are most relevant to the job"
    )
    certification_value: list[str] = Field(
        description="List explaining the value of each relevant certification for the job"
    )
    recommended_certifications: list[str] = Field(
        description="List of certifications that would strengthen the match"
    )


# ============================================================================
# TEMPLATE
# ============================================================================

TEMPLATE_CERTIFICATIONS_MATCH = """
You are an expert recruiter analyzing how well a candidate's CERTIFICATIONS match a job position.

Your task is to evaluate the relevance of the candidate's certifications to the requirements and expectations of the job position.

EVALUATION CRITERIA:
- Certification relevance: How well do certifications align with job requirements?
- Industry recognition: Consider the prestige/recognition of certification providers
- Skill validation: Do certifications validate required technical/domain skills?
- Recency: Consider how recent the certifications are (if dates available)
- Overall fit: Provide a normalized score from 0.0 to 1.0

SCORING GUIDELINES:
- 0.9-1.0: Excellent match - certifications directly validate required skills
- 0.7-0.8: Good match - certifications are relevant with minor gaps
- 0.5-0.6: Moderate match - some relevance but significant gaps
- 0.3-0.4: Weak match - limited relevance
- 0.0-0.2: Poor match - certifications don't align with job requirements

Return a JSON structure EXACTLY matching this format:
{format_instructions}

JOB POSITION:
<<<
{job_position}
>>>

CANDIDATE CERTIFICATIONS DATA (JSON):
<<<
{certifications_data}
>>>
"""


# ============================================================================
# AGENT
# ============================================================================

class CertificationsMatchAgent:
    """Agent for matching candidate certifications with job position requirements"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0.3):
        self.output_parser = PydanticOutputParser(
            pydantic_object=CertificationsMatchOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_CERTIFICATIONS_MATCH,
            input_variables=["job_position", "certifications_data"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, job_position: str, certifications_data: dict) -> CertificationsMatchOutput:
        """
        Analyze how well candidate's certifications match the job position.

        Args:
            job_position: Description of the job position/role
            certifications_data: Dictionary containing certifications information from parsed CV

        Returns:
            CertificationsMatchOutput with match score and analysis
        """
        import json
        certifications_json = json.dumps(certifications_data, indent=2, ensure_ascii=False)
        
        return self.chain.invoke({
            "job_position": job_position,
            "certifications_data": certifications_json
        })
