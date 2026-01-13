"""Agent for extracting project blocks from CV"""

from typing import List
from pydantic import BaseModel, field_validator

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser


class ProjectsOutput(BaseModel):
    projects: List[str]

    @field_validator("projects", mode="before")
    @classmethod
    def clean_projects(cls, v):
        if not v:
            return []
        return [p.strip() for p in v if isinstance(p, str) and p.strip()]


TEMPLATE_PROJECTS = """
You are extracting PROJECT BLOCKS from a CV.

Rules:
- Extract ONLY blocks labeled as projects (e.g. "Key Projects", "Major Projects").
- Copy text EXACTLY as written.
- Do NOT paraphrase.
- Do NOT assign projects to jobs.
- Preserve order of appearance.

Return a JSON structure EXACTLY matching this format:
{format_instructions}

CV TEXT:
<<<
{cv_text}
>>>
"""


class ProjectsAgent:
    """Agent for extracting project blocks"""

    def __init__(self, model_name: str = "gpt-4o-mini", temperature: float = 0):
        self.output_parser = PydanticOutputParser(
            pydantic_object=ProjectsOutput
        )

        self.prompt = PromptTemplate(
            template=TEMPLATE_PROJECTS,
            input_variables=["cv_text"],
            partial_variables={
                "format_instructions": self.output_parser.get_format_instructions()
            },
        )

        self.llm = ChatOpenAI(model=model_name, temperature=temperature)

        self.chain = self.prompt | self.llm | self.output_parser

    def invoke(self, cv_text: str) -> ProjectsOutput:
        return self.chain.invoke({"cv_text": cv_text})
