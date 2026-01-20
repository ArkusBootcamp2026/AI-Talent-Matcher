# Main application entry point

import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from app.api import auth, me, jobs, applications, candidate_profiles, recruiter_profiles, llm, profiles, cv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Reduce verbosity of HTTP client libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# Hide debug/info logs from storage and analysis services
logging.getLogger("app.services.cv.storage_service").setLevel(logging.WARNING)
logging.getLogger("app.services.cv.match_service").setLevel(logging.WARNING)

# Hide debug/info logs from API endpoints (applications, CV, profiles)
logging.getLogger("app.api.applications").setLevel(logging.WARNING)
logging.getLogger("app.api.cv").setLevel(logging.WARNING)
logging.getLogger("app.api.profiles").setLevel(logging.WARNING)

# Hide debug/info logs from utility modules
logging.getLogger("app.utils.pdf_extractor").setLevel(logging.WARNING)

app = FastAPI(title="AI Talent Matcher API")

# Get logger for exception handling
logger = logging.getLogger(__name__)

# Global exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle request validation errors (422).
    FastAPI already handles these well, but we can customize the response format.
    """
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({
            "detail": exc.errors(),
            "body": exc.body,
        }),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler to catch all unhandled exceptions.
    Prevents runtime handler errors from crashing the application.
    """
    # Log the full exception with traceback
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}\n"
        f"Path: {request.url.path}\n"
        f"Method: {request.method}\n"
        f"Traceback:\n{traceback.format_exc()}"
    )
    
    # Return a standardized error response
    # In production, don't expose internal error details
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Please try again later.",
            "error_type": type(exc).__name__,
        },
    )

# CORS configuration for frontend
# Allow all localhost variations for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",  # Vite default port
        "http://127.0.0.1:5173",
        "http://localhost:3000",  # Common React dev port
        "http://127.0.0.1:3000",
        "http://[::1]:8080",  # IPv6 localhost
        "http://[::1]:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(candidate_profiles.router)
app.include_router(recruiter_profiles.router)
app.include_router(profiles.router)
app.include_router(llm.router)
app.include_router(cv.router)