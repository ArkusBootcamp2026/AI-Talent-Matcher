# CV Extraction Integration - Implementation Summary

## 📁 Final Folder Organization

### Implemented Structure
```
backend/app/
├── api/
│   └── cv.py                          # CV extraction endpoints
├── agents/
│   └── cv_extraction/                 # LLM extraction agents
│       ├── __init__.py
│       ├── identity_agent.py
│       ├── experience_agent.py
│       ├── education_agent.py
│       ├── projects_agent.py
│       └── certifications_agent.py
├── services/
│   └── cv/                            # CV processing services
│       ├── __init__.py
│       ├── extraction_service.py      # Orchestrates extraction
│       └── storage_service.py         # Supabase Storage operations
├── schemas/
│   └── cv/                            # CV-related schemas
│       ├── __init__.py
│       ├── extraction.py              # CV extraction response schemas
│       └── update.py                  # CV update request/response schemas
├── utils/
│   └── pdf_extractor.py               # PDF text extraction with fallbacks
├── ner_skill_matcher/                 # NER-based skill matching
│   ├── __init__.py
│   ├── job_skill_db.py
│   ├── models.py
│   ├── ner_filter.py
│   └── skill_scoring.py
├── data/
│   └── db/
│       └── it_job_roles_skills.csv    # CSV database for skill matching
└── core/
    └── config.py                       # Configuration (includes CV bucket settings)
```

---

## 🔌 API Endpoints

### 1. CV Extraction (`POST /cv/extract`)

**Location**: `backend/app/api/cv.py`

**Flow**:
1. Receives PDF file upload (multipart/form-data)
2. Validates file type (PDF, DOC, DOCX) and size (10MB max)
3. Generates timestamp: `{YYYYMMDD}_{HHMMSS}`
4. Extracts text using `utils/pdf_extractor.py` (with PyMuPDF fallback for bbox errors)
5. Runs extraction agents (identity, experience, education, projects, certifications)
6. Performs NER-based skill matching
7. Stores raw PDF to: `cvs/{user_id}/raw/{timestamp}_{cv_name}.pdf`
8. Stores parsed JSON to: `cvs/{user_id}/parsed/{timestamp}_{cv_name}.json`
9. Returns parsed CV JSON with metadata

**Response Schema**: `CVExtractionResponse`
- `status`: "success"
- `cv_data`: Complete extracted CV data (identity, experience, education, projects, certifications, skills_analysis)
- `metadata`: Extraction timestamp information
- `storage_paths`: Paths to stored raw PDF and parsed JSON

---

### 2. CV Update (`PATCH /cv/update`)

**Location**: `backend/app/api/cv.py`

**Flow**:
1. Receives partial CV updates (identity fields, selected_skills)
2. Retrieves latest parsed CV JSON from storage
3. Merges updates with existing data
4. Overwrites parsed JSON file in storage (using upsert)
5. Returns success confirmation

**Request Schema**: `CVUpdateRequest`
- Optional fields: `full_name`, `headline`, `introduction`, `email`, `phone`, `location`, `selected_skills`

**Response Schema**: `CVUpdateResponse`
- `status`: "success"
- `message`: Confirmation message
- `storage_path`: Path to updated JSON file

---

### 3. Get Latest CV (`GET /cv/latest`)

**Location**: `backend/app/api/cv.py`

**Flow**:
1. Retrieves latest parsed CV JSON for authenticated user
2. Uses robust sorting (prioritizes `updated_at` metadata, falls back to filename timestamp)
3. Returns complete CV data

**Response Schema**: `CVExtractionResponse`

---

## 🗄️ Supabase Storage Organization

### Bucket Name: `cvs`

### Structure:
```
cvs/
├── {user_id}/
│   ├── raw/                                    # Raw PDF files
│   │   └── {YYYYMMDD}_{HHMMSS}_{cv_name}.pdf
│   └── parsed/                                 # Parsed CV JSON files
│       └── {YYYYMMDD}_{HHMMSS}_{cv_name}.json
```

### File Naming Convention:
- **Raw PDFs**: `cvs/{user_id}/raw/{YYYYMMDD}_{HHMMSS}_{cv_name}.pdf`
- **Parsed JSON**: `cvs/{user_id}/parsed/{YYYYMMDD}_{HHMMSS}_{cv_name}.json`

### Versioning Strategy:
- All files are versioned by timestamp (no automatic overwrites)
- Each CV upload creates new files
- Latest file is determined by `updated_at` metadata or filename timestamp
- CV updates use `upsert: true` to overwrite the latest parsed JSON

### MIME Types Required:
- `application/pdf` (for raw PDFs)
- `application/json` (for parsed JSON files)
- `application/msword` (for DOC files - future)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (for DOCX files - future)

---

## 🔧 PDF Extraction with PyMuPDF Fallback

### Implementation: `backend/app/utils/pdf_extractor.py`

**Primary Method**: `pypdf` library
- Standard extraction with `PdfReader`
- Fallback to `PdfReader(pdf_file, strict=False)` for malformed PDFs

**PyMuPDF Fallback Logic**:
- **Trigger**: When first page extraction fails with `KeyError: 'bbox'` or `AttributeError` even with `strict=False`
- **Process**:
  1. Attempts standard `pypdf` extraction first
  2. If first page fails (bbox/font errors), switches entire document to `strict=False` mode
  3. If first page still fails after `strict=False`, uses PyMuPDF (`fitz`) as fallback
  4. Extracts first page with PyMuPDF to ensure identity information is never lost
  5. For consistency, re-extracts remaining pages with PyMuPDF if first page required it
- **Benefits**:
  - Handles malformed PDFs with missing font descriptors
  - Ensures critical first page (identity info) is always extracted
  - Provides robust fallback for edge cases

**Dependencies**:
- `pypdf>=3.0.0` (primary)
- `pymupdf>=1.23.0` (fallback, optional but recommended)

**Error Handling**:
- Graceful degradation: falls back to PyMuPDF if available
- Logs warnings if PyMuPDF is not installed
- Provides user-friendly error messages for password-protected or corrupted PDFs

---

## 📊 Service Layer

### `backend/app/services/cv/extraction_service.py`

**Functions**:
- `extract_cv_from_pdf(pdf_content: bytes) -> dict`
  - Orchestrates PDF text extraction
  - Runs all extraction agents (identity, experience, education, projects, certifications)
  - Performs NER-based skill matching
  - Returns structured CV data with metadata

### `backend/app/services/cv/storage_service.py`

**Functions**:
- `store_raw_pdf(supabase, user_id, pdf_content, cv_name, timestamp) -> str`
  - Stores PDF to `cvs/{user_id}/raw/{timestamp}_{cv_name}.pdf`
  - Returns storage path

- `store_parsed_cv(supabase, user_id, cv_data, cv_name, timestamp) -> str`
  - Stores JSON to `cvs/{user_id}/parsed/{timestamp}_{cv_name}.json`
  - Handles MIME type fallback if `application/json` is not allowed
  - Returns storage path

- `get_parsed_cv(supabase, user_id, timestamp=None) -> dict`
  - If timestamp provided: retrieves specific version
  - If None: retrieves latest parsed CV (sorts by `updated_at` or filename timestamp)
  - Returns parsed CV data

- `update_parsed_cv(supabase, user_id, updates, timestamp=None) -> str`
  - Retrieves latest parsed CV
  - Merges updates with existing data
  - Overwrites file using `upsert: true`
  - Returns storage path

- `generate_timestamp() -> str`
  - Generates timestamp in format `YYYYMMDD_HHMMSS`

---

## 🤖 LLM Extraction Agents

### Location: `backend/app/agents/cv_extraction/`

**Agents**:
1. **IdentityAgent** (`identity_agent.py`)
   - Extracts: `full_name`, `headline`, `introduction`, `email`, `phone`, `location`
   - Uses LangChain with OpenAI GPT-4o-mini
   - Enhanced prompt for better first-page extraction

2. **ExperienceAgent** (`experience_agent.py`)
   - Extracts work experience entries
   - Returns: `experiences` list with role, company, dates, responsibilities

3. **EducationAgent** (`education_agent.py`)
   - Extracts education entries
   - Returns: `education` list with degree, institution, dates

4. **ProjectsAgent** (`projects_agent.py`)
   - Extracts project entries
   - Returns: `projects` list with name, description, technologies

5. **CertificationsAgent** (`certifications_agent.py`)
   - Extracts certification entries
   - Returns: `certifications` list with name, issuer, date

**Common Features**:
- All agents use LangChain `PydanticOutputParser` for structured output
- Use `langchain_core` imports (compatible with LangChain 0.3.0+)
- Temperature set to 0 for consistent results

---

## 🎯 NER Skill Matching

### Location: `backend/app/ner_skill_matcher/`

**Components**:
- `job_skill_db.py`: Loads CSV database, provides skill matching functions
- `ner_filter.py`: NER-based skill extraction from text
- `skill_scoring.py`: Skill scoring algorithms
- `models.py`: Data models for skill analysis

**CSV Database**: `backend/app/data/db/it_job_roles_skills.csv`
- Maps job roles to required skills
- Used for matching candidate experience to job requirements

**Integration**:
- `extraction_service.py` uses NER matcher to:
  1. Match experience roles to CSV job titles
  2. Extract explicit skills from CV text
  3. Get job-related skills based on matched roles
  4. Combine into `SkillsAnalysis` object

---

## ⚙️ Configuration

### `backend/app/core/config.py`

**Added Settings**:
```python
# Supabase Storage
SUPABASE_CV_BUCKET = "cvs"

# CSV Database Location
CSV_DB_DIR = Path(__file__).parent.parent / "data" / "db"
```

---

## 📦 Dependencies

### Added to `deps/requirements.txt` and `deps/pyproject.toml`:
- `langchain>=0.3.0`
- `langchain-openai>=1.1.7`
- `langchain-core>=1.2.6`
- `openai>=2.14.0`
- `pypdf>=3.0.0`
- `pymupdf>=1.23.0` (PyMuPDF - fallback for malformed PDFs)
- `spacy>=3.7.0`
- `pandas>=2.0.0`

---

## 🔐 Authentication & Authorization

- All CV endpoints require authenticated user
- User ID extracted from JWT token via `get_current_user` dependency
- Storage operations scoped to user's own bucket path (`{user_id}/`)
- Supabase RLS policies ensure users can only access their own files

---

## 🎨 Frontend Integration

### Profile Completion Feature

**Hook**: `frontend/src/hooks/useProfileCompletion.ts`
- Checks if CV exists via `getLatestCV()`
- Returns 100% if CV uploaded, 75% otherwise
- Used by Dashboard and Sidebar to show progress

**Components Updated**:
- `frontend/src/pages/candidate/Dashboard.tsx`: Shows profile completion progress
- `frontend/src/components/layout/CandidateSidebar.tsx`: Shows profile completion in sidebar

**Cache Invalidation**:
- After CV upload: Invalidates `["cv", "latest"]` query
- After CV update: Invalidates `["cv", "latest"]` query
- Ensures progress bars update immediately

---

## ✅ Implementation Checklist

- [x] Move CV extraction agents to `agents/cv_extraction/`
- [x] Move NER skill matcher to `ner_skill_matcher/`
- [x] Move CSV database file to `backend/app/data/db/`
- [x] Update `ner_skill_matcher/job_skill_db.py` to use `CSV_DB_DIR` from config
- [x] Create PDF extractor with PyMuPDF fallback in `utils/pdf_extractor.py`
- [x] Create CV service layer (extraction, storage)
- [x] Create CV API routes (`POST /cv/extract`, `PATCH /cv/update`, `GET /cv/latest`)
- [x] Create CV schemas (extraction, update)
- [x] Update `main.py` to include CV routes
- [x] Configure Supabase bucket `cvs` with folder structure
- [x] Update dependencies (pypdf, pymupdf, langchain, spacy, pandas)
- [x] Implement profile completion feature in frontend
- [x] Add cache invalidation for real-time progress updates

---

## 🔄 Key Differences from Original Plan

1. **Simplified API Structure**: Used `/cv/*` endpoints instead of `/api/v1/cv/*`
2. **No Match Analysis Yet**: Only extraction implemented; match analysis deferred
3. **PyMuPDF Fallback**: Added robust fallback for bbox errors not in original plan
4. **Update Endpoint**: Added `PATCH /cv/update` for editing parsed CV data
5. **Get Latest Endpoint**: Added `GET /cv/latest` for retrieving latest CV
6. **Profile Completion**: Added frontend integration for progress tracking

---

## 📝 Notes

- **PDF Support Only**: Currently only PDF files are supported (DOC/DOCX validation exists but extraction not implemented)
- **File Size Limit**: 10MB maximum file size
- **Error Handling**: Comprehensive error handling for malformed PDFs, missing buckets, and validation errors
- **Logging**: Simplified logging to reduce console noise (httpx logs set to WARNING level)
