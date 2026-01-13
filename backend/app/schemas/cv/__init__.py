"""CV processing schemas"""

from .extraction import CVExtractionResponse
from .update import CVUpdateRequest, CVUpdateResponse

__all__ = [
    "CVExtractionResponse",
    "CVUpdateRequest",
    "CVUpdateResponse",
]
