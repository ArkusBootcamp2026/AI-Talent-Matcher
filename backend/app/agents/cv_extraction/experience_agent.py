"""Agent for extracting professional work experience from CV"""

from typing import List, Optional
from pydantic import BaseModel, field_validator

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser


class ExperienceItem(BaseModel):
    company: Optional[str]
    role: Optional[str]
    responsibilities: List[str]
    start_date: Optional[str]
    end_date: Optional[str]

    @field_validator("responsibilities", mode="before")
    @classmethod
    def clean_responsibilities(cls, v):
        if not v:
            return []
        return [r.strip() for r in v if isinstance(r, str) and r.strip()]


class ExperienceOutput(BaseModel):
    experiences: List[ExperienceItem]


TEMPLATE_EXPERIENCE = """
You are an ATS-grade CV parser.

Extract ONLY real professional work experience.

STRICT RULES:
- DO NOT paraphrase.
- DO NOT invent companies, roles, or dates.
- Copy text EXACTLY as written in the CV.
- Fix only spelling or duplicated spaces.
- Exclude academic projects, certifications, and summaries.

Return a JSON structure EXACTLY matching this format:
{format_instructions}

CV TEXT:
<<<
{cv_text}
>>>
"""


class ExperienceAgent:
    """Primary agent for extracting professional work experience"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0):
        self.output_parser = PydanticOutputParser(
            pydantic_object=ExperienceOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_EXPERIENCE,
            input_variables=["cv_text"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, cv_text: str) -> ExperienceOutput:
        """
        Extract professional experience from CV text.

        Args:
            cv_text: Raw text extracted from PDF

        Returns:
            ExperienceOutput (validated)
        """
        return self.chain.invoke({"cv_text": cv_text})
