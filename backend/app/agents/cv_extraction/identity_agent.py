"""Agent for extracting candidate identity information from CV"""

import logging
from typing import Optional
from pydantic import BaseModel, field_validator

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

logger = logging.getLogger(__name__)


class IdentityOutput(BaseModel):
    full_name: Optional[str]
    headline: Optional[str]
    introduction: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    location: Optional[str]

    @field_validator("headline", mode="before")
    @classmethod
    def clean_headline(cls, v):
        if not v:
            return None
        return " ".join(v.split())


TEMPLATE_IDENTITY = """
You are extracting CANDIDATE IDENTITY information from a CV.

Rules:
- You may lightly normalize wording.
- Do NOT invent information.
- Extract only what is explicitly present.
- Headline must not contain duplicated spaces.
- Pay special attention to the beginning of the CV text where name, email, phone, and contact information are typically located.
- Look for email addresses (containing @ symbol).
- Look for phone numbers (sequences of digits, possibly with dashes, spaces, parentheses, or country codes).
- Extract the full name which is usually the first prominent text at the top of the CV.

Return a JSON object EXACTLY matching this format:
{format_instructions}

CV TEXT:
<<<
{cv_text}
>>>
"""


class IdentityAgent:
    """Agent for extracting candidate identity data"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0):
        self.output_parser = PydanticOutputParser(
            pydantic_object=IdentityOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_IDENTITY,
            input_variables=["cv_text"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, cv_text: str) -> IdentityOutput:
        result = self.chain.invoke({"cv_text": cv_text})
        return result
