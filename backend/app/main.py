# Main application entry point

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, me, jobs, applications, candidate_profiles, recruiter_profiles, llm, profiles, cv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Reduce verbosity of HTTP client libraries
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

app = FastAPI(title="AI Talent Matcher API")

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