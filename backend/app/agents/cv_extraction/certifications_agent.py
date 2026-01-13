"""Agent for extracting certifications from CV"""

from typing import List
from pydantic import BaseModel, field_validator

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser


class CertificationsOutput(BaseModel):
    certifications: List[str]

    @field_validator("certifications", mode="before")
    @classmethod
    def clean_certifications(cls, v):
        if not v:
            return []
        return [c.strip() for c in v if isinstance(c, str) and c.strip()]


TEMPLATE_CERTIFICATIONS = """
You are extracting CERTIFICATIONS from a CV.

Rules:
- Extract ONLY certifications.
- Do NOT paraphrase.
- Do NOT invent certifications.
- Copy text as written.

Return a JSON structure EXACTLY matching this format:
{format_instructions}

CV TEXT:
<<<
{cv_text}
>>>
"""


class CertificationsAgent:
    """Agent for extracting certifications"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0):
        self.output_parser = PydanticOutputParser(
            pydantic_object=CertificationsOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_CERTIFICATIONS,
            input_variables=["cv_text"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, cv_text: str) -> CertificationsOutput:
        return self.chain.invoke({"cv_text": cv_text})
