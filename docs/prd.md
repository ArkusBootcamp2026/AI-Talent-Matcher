# PRD – Intelligent Technical Recruitment Platform (AI Talent Matcher)

## 1. Product Overview

The Intelligent Technical Recruitment Platform is a recruiter-centric system designed to automate
technical candidate screening and vacancy creation using AI agents. The platform parses
candidate CVs, evaluates their alignment with job requirements, and produces an objective Match
Score to support faster, data-driven hiring decisions.

## 2. Problem Statement

Technical recruiters face high volumes of CVs, inconsistent candidate evaluation, and
time-consuming vacancy creation. Manual screening introduces subjectivity, slows hiring cycles,
and limits the ability to objectively compare candidates across multiple roles.

## 3. Product Goals & Objectives

• Reduce time-to-hire through automated CV parsing and ranking.  
• Standardize candidate evaluation using explainable Match Scores.  
• Enable recruiters to focus on decision-making rather than manual review.

## 4. Scope Definition (3-Week MVP)

### In Scope:

• AI-assisted vacancy description and skill generation.  
• CV upload, parsing, and structured JSON snapshot storage in Supabase Storage buckets.  
• Multi-agent Match Score evaluation (experience, education, skills).  
• Recruiter dashboard with ranked candidate profiles.  
• Candidate application tracking and status management.

### Out of Scope:

• Automated coding assessments.  
• Full ATS integrations.  
• CSV export functionality.  
• Interview scheduling system.  
• Public profile data extraction.

## 6. Core Features / Functional Requirements

• AI Vacancy Generator: Generates editable job descriptions and skill lists using GPT-4o-mini via LangChain with PydanticOutputParser for structured responses.  
• CV Parsing Engine: Extracts experience, education, and skills into structured JSON using multiple specialized agents with PydanticOutputParser validation.  
• NER-based Skill Matching: Uses SpaCy (en_core_web_sm) for Named Entity Recognition to extract explicit skills and match experience roles to CSV job titles.  
• Match Scoring Engine: Compares candidate CV data with job requirements to produce a percentage score (0-100).  
• Recruiter Actions: Accept candidate, update application status, view candidate profiles.  
• Candidate Application Tracking: Displays application status progression per vacancy.

## 7. User Flows

• Recruiter creates vacancy → AI suggests description and skills → Vacancy published.  
• Candidate uploads CV → FastAPI endpoint processes synchronously → PDF text extracted → Multiple extraction agents run → NER-based skill matching → Profile stored in Supabase Storage.  
• Candidate applies to job → Match score calculated (when implemented) → Application created.  
• Recruiter reviews ranked candidates → Updates status → Views candidate profiles.  
• Candidate views application status progression per vacancy.

## 8. Non-Functional Requirements

• System supports asynchronous processing and retry mechanisms.  
• Secure handling of CV files and personal data.  
• FastAPI backend with async operations for database and external API calls.  
• React frontend with TypeScript and TailwindCSS for UI components.  
• Structured output validation using Pydantic models and PydanticOutputParser.

## 9. Data Model Overview

Key entities include Candidate, CV Snapshot, Job Requisition, and Match Score. CVs are stored as
immutable files in Supabase Storage buckets, parsed JSON snapshots are versioned with timestamps, and operational data is stored in
PostgreSQL (via Supabase).

## 10. Detailed Flows (Updated)

CV Upload Flow:  
CV uploaded via FastAPI /api/cv/extract endpoint → File validated (PDF, max 10MB) → 
PDF text extracted using pypdf (PyMuPDF as fallback) → 
Multiple specialized extraction agents process CV text sequentially:
  - IdentityAgent (GPT-4o-mini, temperature: 0) extracts personal information
  - ExperienceAgent (GPT-4o-mini, temperature: 0) extracts work experience
  - EducationAgent (GPT-4o-mini, temperature: 0) extracts education history
  - CertificationsAgent (GPT-4o-mini, temperature: 0) extracts certifications
  - ProjectsAgent (GPT-4o-mini, temperature: 0) extracts projects
→ All agents use PydanticOutputParser for structured output validation →
Experience roles matched to CSV job titles using SpaCy NER (match_roles_to_csv_titles) →
Skills extracted from CV text using SpaCy NER (extract_explicit_skills) →
Skills matched against CSV database (it_job_roles_skills.csv) →
Raw PDF stored in Supabase Storage bucket "cvs" (path: user_id/raw/timestamp_filename.pdf) →
Parsed JSON stored in Supabase Storage bucket "cvs" (path: user_id/parsed/timestamp_filename.json) →
CV data available for profile editing and job applications.

Note: All processing is synchronous via FastAPI endpoints. No Lambda functions or S3 storage are used. CV files and parsed data are stored in Supabase Storage buckets.

Job Application Flow:  
Candidate applies to job position via /api/applications/ endpoint → 
Application record created in PostgreSQL (via Supabase) → 
Match score calculation triggered (when implemented) → 
Score stored with application in PostgreSQL → 
Recruiter views applications sorted by match score in Candidate Pipeline.

Note: Match score calculation will compare candidate CV data (retrieved from Supabase Storage) with job requirements stored in PostgreSQL.

Vacancy Generation Flow:  
Recruiter enters job title and employment type → 
JobDescriptionAgent (GPT-4o-mini, temperature: 0.3) generates description using PydanticOutputParser →
RequirementsAgent (GPT-4o-mini, temperature: 0.2) generates requirements using PydanticOutputParser →
SkillsAgent (GPT-4o-mini, temperature: 0) generates skills list using PydanticOutputParser →
All generated content is editable before submission →
Vacancy saved to PostgreSQL with status (draft/open/closed).

## 11. Technology Stack

### Backend:
- FastAPI (Python) with async/await patterns
- Supabase (PostgreSQL database + Storage buckets)
- LangChain with GPT-4o-mini for AI generation
- Pydantic v2 for data validation
- PydanticOutputParser for structured LLM responses
- SpaCy (en_core_web_sm) for Named Entity Recognition
- pypdf (PyPDF2) for PDF text extraction with PyMuPDF fallback
- pandas for CSV database operations (job roles and skills)
- Multiple specialized agents for CV extraction:
  - IdentityAgent
  - ExperienceAgent
  - EducationAgent
  - CertificationsAgent
  - ProjectsAgent
- LLM agents for vacancy generation:
  - JobDescriptionAgent
  - RequirementsAgent
  - SkillsAgent

### Frontend:
- React with TypeScript
- Vite as build tool
- TailwindCSS for styling
- Shadcn UI components
- React Query for data fetching and caching
- React Router for navigation

### Storage:
- Supabase Storage buckets for CV files (raw PDFs and parsed JSON)
- PostgreSQL (via Supabase) for operational data
- CSV files (it_job_roles_skills.csv) for job role and skill database

### AI/ML:
- OpenAI GPT-4o-mini for LLM operations
- LangChain for prompt management and chain orchestration
- SpaCy en_core_web_sm model for NER-based skill and role extraction
- PydanticOutputParser for structured output validation from LLM responses

## 12. Current Implementation Status

### Fully Implemented:
- AI-assisted vacancy description and skill generation (using PydanticOutputParser)
- CV upload and parsing with multiple extraction agents (all using PydanticOutputParser)
- NER-based skill matching using SpaCy (en_core_web_sm)
- CSV database integration for job roles and skills matching
- PDF text extraction with pypdf and PyMuPDF fallback
- Job vacancy management (create, edit, view, delete)
- Job application submission
- Application status tracking (candidate view)
- Recruiter candidate pipeline management
- Profile management for candidates and recruiters
- Supabase Storage integration for CV file storage

### Partially Implemented:
- Match score calculation (UI ready, backend calculation pending)
- Application status tracking (UI exists, needs API integration for real-time updates)
- Skill Coach feature (UI exists, backend integration pending)

### Not Implemented:
- CSV export functionality
- Interview scheduling system
- Public profile data extraction
- Match score calculation backend logic
