# Main application entry point

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, me, jobs, applications, candidate_profiles, recruiter_profiles, llm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(title="AI Talent Matcher API")

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
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
app.include_router(llm.router)