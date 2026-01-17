# AI Talent Matcher

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.127.0-009688?style=flat&logo=fastapi&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-2.27-3ECF8E?style=flat&logo=supabase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=flat&logo=openai&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-0.3+-1C3C3C?style=flat&logo=langchain&logoColor=white)
![SpaCy](https://img.shields.io/badge/SpaCy-3.7+-09A3D5?style=flat&logo=spacy&logoColor=white)

Intelligent technical recruitment platform that automates candidate evaluation and vacancy creation using AI agents. The system analyzes CVs, evaluates alignment with job requirements, and produces an objective Match Score to support faster, data-driven hiring decisions.

## 🚀 Main Features

- **AI-Powered Vacancy Generation**: Generates editable job descriptions and skill lists
- **CV Analysis**: Extracts experience, education, and skills into structured JSON format
- **Match Score System**: Evaluates candidates with multiple specialized agents (experience, education, skills)
- **Recruiter Dashboard**: Visualizes candidates sorted by score with accept, CSV export, and interview scheduling actions
- **Candidate Portal**: Allows candidates to upload CVs, search for jobs, and track their applications
- **Profile Management**: Profile editing with image upload, personal information and role updates

## 📋 Prerequisites

Before starting, make sure you have installed:

- **Python 3.12.2** - Automatically managed by UV via `.python-version`
  - This project uses **UV** for Python dependency management
  - Python 3.12.2 is automatically selected via `.python-version` file
  - UV will automatically download and install Python 3.12.2 if it's not present
  - ⚠️ **Note**: Python 3.13+ is not compatible with C extensions (e.g., pyroaring, SpaCy, PyMuPDF)
- **Node.js 22.12.0 or higher** - [Download Node.js](https://nodejs.org/)
- **UV** (installed automatically with setup scripts) - [More information about UV](https://github.com/astral-sh/uv)

## 🛠️ Installation

### Option 1: Automatic Installation (Recommended)

The project includes setup scripts that automate the entire installation:

**Windows (PowerShell):**
```powershell
# Run setup script
.\deps\windows\setup.ps1

# Or with pyproject.toml alternative:
.\deps\windows\setup.ps1 -UsePyProject
```

**Linux/macOS (Bash):**
```bash
# Grant execution permissions (if needed)
chmod +x deps/macos-linux/setup.sh deps/macos-linux/run-dev.sh

# Run setup script
./deps/macos-linux/setup.sh

# Or with pyproject.toml alternative:
./deps/macos-linux/setup.sh --pyproject
```

> **Note for macOS/Linux**: If you encounter "Permission denied" errors, grant execution permissions first:
> ```bash
> chmod +x deps/macos-linux/setup.sh deps/macos-linux/run-dev.sh
> ```

The setup scripts automatically perform:
1. ✅ Python and Node.js verification
2. ✅ UV installation (if not present)
3. ✅ Python virtual environment creation
4. ✅ Backend dependencies installation
5. ✅ Frontend dependencies installation
6. ✅ Installation verification

### Option 2: Manual Installation

If you prefer to install manually:

#### Backend - Windows

```powershell
# 1. Install UV (if not installed)
irm https://astral.sh/uv/install.ps1 | iex

# 2. Create virtual environment
uv venv

# 3. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 4. Upgrade pip to prevent package installation issues
python -m pip install --upgrade pip

# 5. Install backend dependencies
# Using requirements.txt (default):
uv pip install -r deps/requirements.txt

# Or using pyproject.toml (alternative):
cd deps
uv pip install -e .
cd ..

# 6. Download SpaCy language model (required for match score calculation)
# Note: SpaCy models are downloaded separately from Python packages
python -m spacy download en_core_web_sm
```

#### Backend - macOS/Linux

```bash
# 1. Install UV (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 1.1. Verify UV installation and PATH configuration
# Reload your shell to ensure UV is available
source ~/.zshrc  # or source ~/.bashrc if using bash

# Verify the PATH includes UV
echo $PATH

# UV is typically installed in:
# ~/.local/bin

# If UV is not in your PATH, add this to ~/.zshrc (or ~/.bashrc):
# export PATH="$HOME/.local/bin:$PATH"
# Then reload: source ~/.zshrc

# Verify UV is accessible
uv --version

# 2. Create virtual environment
uv venv

# 3. Activate virtual environment
source .venv/bin/activate

# 4. Upgrade pip to prevent package installation issues
python -m pip install --upgrade pip

# 5. Install backend dependencies
# Using requirements.txt (default):
uv pip install -r deps/requirements.txt

# Or using pyproject.toml (alternative):
cd deps
uv pip install -e .
cd ..

# 6. Download SpaCy language model (required for match score calculation)
# Note: SpaCy models are downloaded separately from Python packages
python -m spacy download en_core_web_sm
```

> **Note for macOS/Linux**: If you encounter permission errors when running scripts, grant execution permissions first:
> ```bash
> chmod +x deps/macos-linux/setup.sh deps/macos-linux/run-dev.sh
> ```

#### Frontend

```bash
# 1. Verify Node.js (requires >=22.12.0)
node --version

# 2. Install dependencies
cd frontend
npm install
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_JWT_SECRET=your_jwt_secret

# OpenAI (for AI agents)
OPENAI_API_KEY=your_openai_api_key

# JWT
JWT_SECRET_KEY=your_jwt_secret_key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Others
ENVIRONMENT=development
```

> **Note**: Copy `.env.example` from the project root to `backend/.env` and fill in your values. The backend loads environment variables from `backend/.env` when running.

## 🏃 Execution

### Option 1: Run Both Servers Simultaneously (Recommended)

**Windows:**
```powershell
.\deps\windows\run-dev.ps1
```

**Linux/macOS:**
```bash
# Grant execution permissions (if needed)
chmod +x deps/macos-linux/run-dev.sh

# Run development servers
./deps/macos-linux/run-dev.sh
```

> **Note for macOS/Linux**: If you encounter "Permission denied" errors, grant execution permissions first:
> ```bash
> chmod +x deps/macos-linux/run-dev.sh
> ```

This command will start:
- **Backend API** at: http://localhost:8000
- **Frontend** at: http://localhost:8080
- **API Docs** at: http://localhost:8000/docs

### Option 2: Run Servers Separately

#### Backend

```bash
# Activate virtual environment
source .venv/bin/activate  # or .\.venv\Scripts\Activate.ps1 on Windows

# Navigate to backend directory
cd backend

# Run server
uvicorn app.main:app --reload
```

#### Frontend

```bash
# Navigate to frontend directory
cd frontend

# Run development server
npm run dev
```

## 📁 Project Structure

```
AI-Talent-Matcher/
├── backend/                        # FastAPI Backend
│   └── app/
│       ├── api/                    # API Endpoints
│       ├── agents/                 # AI Agents
│       ├── core/                   # Configuration and security
│       ├── db/                     # Database connection
│       ├── schemas/                # Pydantic models
│       ├── services/               # Business logic
│       └── main.py                # Application entry point
├── frontend/                       # Frontend Application
│   └── src/
│       ├── components/            # React components
│       ├── pages/                 # Application pages
│       ├── services/              # API services
│       └── hooks/                 # Custom React hooks
├── deps/                           # Dependencies and setup scripts
│   ├── requirements.txt           # Python dependencies
│   ├── windows/                   # Windows setup scripts
│   └── macos-linux/               # macOS/Linux setup scripts
├── docs/                           # Documentation
└── .python-version                 # Python version (3.12.2)
```

## 🌐 Access URLs

Once the servers are running:

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8000
- **API Documentation (Swagger)**: http://localhost:8000/docs
- **API Documentation (ReDoc)**: http://localhost:8000/redoc

## 🧪 Installation Validation

### Verify Backend

```bash
# Activate virtual environment
source .venv/bin/activate  # or .\.venv\Scripts\Activate.ps1 on Windows

# Verify installed dependencies
uv pip list

# Verify main imports
python -c "import fastapi; import uvicorn; import supabase; print('✅ Backend dependencies OK')"
```

### Verify Frontend

```bash
# Verify Node.js
node --version  # Must be >=22.12.0

# Verify installed dependencies
cd frontend
npm list --depth=0

# Verify that the project compiles
npm run build
```

## 🛠️ Technologies Used

### Backend
- **FastAPI 0.127.0** - Modern, fast web framework for building APIs
- **Uvicorn 0.40.0** - High-performance ASGI server
- **Supabase 2.27.0** - Backend as a service (PostgreSQL database + Storage)
- **Pydantic 2.12.5** - Data validation and settings management
- **LangChain 0.3+** - Framework for LLM applications and AI agents
- **LangChain OpenAI 1.1.7** - OpenAI integration for LangChain
- **OpenAI 2.14.0** - AI API for content generation (GPT-4o-mini)
- **Python-JOSE 3.5.0** - JWT token encoding/decoding
- **SpaCy 3.7+** - Natural Language Processing for skill extraction
  - **en_core_web_sm** - English language model (downloaded separately)
- **Pandas 2.0+** - Data processing and analysis
- **PyPDF 3.0+** - PDF text extraction
- **PyMuPDF 1.23+** - Fallback PDF processor for malformed PDFs

### Frontend
- **React 18.3.1** - UI library for building user interfaces
- **Shadcn UI** - High-quality UI components based on Radix UI
- **React Query (TanStack Query) 5.83.0** - Server state management and caching
- **Axios 1.13.2** - HTTP client for API requests
- **React Router 6.30.1** - Client-side routing

### Development Tools
- **UV** - Ultra-fast Python package manager (10-100x faster than pip)
- **npm** - Node.js package manager
- **Python 3.10+** - Programming language
- **Node.js 22.12.0+** - JavaScript runtime

## 📝 Important Notes

1. **Ports**: 
   - Backend runs on port `8000`
   - Frontend runs on port `8080`
   - Make sure these ports are available

2. **UV vs pip**:
   - This project uses **UV** for Python dependency management
   - UV is 10-100x faster than pip
   - Compatible with `requirements.txt` and `pyproject.toml`
   - You can use `uv pip` as a direct replacement for `pip`
   - Python 3.12.2 is automatically selected via `.python-version` file
   - UV will automatically download and use Python 3.12.2 in the project virtual environment

3. **Node.js**:
   - Requires Node.js >=22.12.0 (according to `package.json`)

4. **Database**:
   - Project uses Supabase (PostgreSQL)
   - Make sure you have Supabase environment variables configured
   - Check `docs/supabase/migrations/` for migration scripts

## 🐛 Troubleshooting

### Error: "UV not found"
- Run the setup script which will install UV automatically
- Or install manually from: https://github.com/astral-sh/uv

### Error: "Python version too new" or "Failed to build pyroaring"
- **Cause**: Python 3.13+ may have compatibility issues with C extensions
- **Solution**: The project uses `.python-version` to enforce Python 3.12.2
  - UV will automatically download and use Python 3.12.2 when you run `uv sync` or `uv run`
  - No manual Python installation needed - UV handles it automatically
  - On Windows: Install Visual Studio Build Tools with "Desktop development with C++" workload if you encounter build errors

### Error: "Cannot open include file: 'io.h'" (Windows)
- **Cause**: Missing C++ build tools
- **Solution**: Install Visual Studio Build Tools
  - Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
  - Install "Desktop development with C++" workload
  - Restart your terminal and try again

### Error: "Node.js version too old"
- Update Node.js to version 22.12.0 or higher
- Download from: https://nodejs.org/

### Error: "Module not found" (Backend)
- Make sure the virtual environment is activated
- UV automatically uses Python 3.12.2 via `.python-version` (no manual verification needed)
- Run: `uv pip install -r deps/requirements.txt`
- Or use pyproject.toml: `cd deps && uv pip install -e . && cd ..`

### Error: "Module not found" (Frontend)
- Navigate to frontend directory: `cd frontend`
- Run: `npm install`

### Error: "Bucket not found" (Supabase Storage)
- Check `docs/supabase_storage_setup_step_by_step.md` to configure the avatars bucket

## 📚 Additional Documentation

- [docs/UV_SETUP.md](./docs/UV_SETUP.md) - UV setup guide
- [docs/prd.md](./docs/prd.md) - Product requirements document

