"""Agent for extracting education information from CV"""

from typing import List, Optional
from pydantic import BaseModel, field_validator

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser


class EducationItem(BaseModel):
    institution: Optional[str]
    degree: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    certifications: List[str]
    academic_projects: List[str]

    @field_validator("certifications", "academic_projects", mode="before")
    @classmethod
    def clean_lists(cls, v):
        if not v:
            return []
        return [i.strip() for i in v if isinstance(i, str) and i.strip()]


class EducationOutput(BaseModel):
    education: List[EducationItem]


TEMPLATE_EDUCATION = """
You are extracting EDUCATION information from a CV.

Rules:
- Education includes degrees, institutions, academic projects, and certifications.
- Academic projects must stay under education.
- Do NOT paraphrase project descriptions.
- Copy text as written.
- Do NOT invent data.

Return a JSON structure EXACTLY matching this format:
{format_instructions}

CV TEXT:
<<<
{cv_text}
>>>
"""


class EducationAgent:
    """Agent for extracting education data"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0):
        self.output_parser = PydanticOutputParser(
            pydantic_object=EducationOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_EDUCATION,
            input_variables=["cv_text"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, cv_text: str) -> EducationOutput:
        return self.chain.invoke({"cv_text": cv_text})
