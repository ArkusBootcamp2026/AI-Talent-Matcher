# AI Talent Matcher

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

- **Python 3.10 or higher** - [Download Python](https://www.python.org/downloads/)
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
# Grant execution permissions and run
chmod +x deps/macos-linux/setup.sh deps/macos-linux/run-dev.sh
./deps/macos-linux/setup.sh

# Or with pyproject.toml alternative:
./deps/macos-linux/setup.sh --pyproject
```

The setup scripts automatically perform:
1. ✅ Python and Node.js verification
2. ✅ UV installation (if not present)
3. ✅ Python virtual environment creation
4. ✅ Backend dependencies installation
5. ✅ Frontend dependencies installation
6. ✅ Installation verification

### Option 2: Manual Installation

If you prefer to install manually:

#### Backend

```bash
# 1. Install UV (if not installed)
# Windows PowerShell:
irm https://astral.sh/uv/install.ps1 | iex

# Linux/macOS:
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Create virtual environment
uv venv

# 3. Activate virtual environment
# Windows:
.\.venv\Scripts\Activate.ps1
# Unix/Linux/macOS:
source .venv/bin/activate

# 4. Install backend dependencies
# Using requirements.txt (default):
uv pip install -r deps/requirements.txt

# Or using pyproject.toml (alternative):
cd deps
uv pip install -e .
cd ..
```

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
./deps/macos-linux/run-dev.sh
```

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
├── backend/                 # FastAPI Backend
│   └── app/
│       ├── api/            # API Endpoints
│       ├── agents/         # AI Agents
│       ├── core/           # Configuration and security
│       ├── db/             # Database connection
│       ├── schemas/        # Pydantic models
│       ├── services/       # Business logic
│       └── main.py         # Entry point
├── frontend/               # React + Vite Frontend
│   └── src/
│       ├── components/     # React components
│       ├── pages/          # Application pages
│       ├── services/       # API services
│       ├── hooks/          # Custom hooks
│       ├── lib/            # Utility libraries (api, auth, utils)
│       └── types/          # TypeScript definitions
├── deps/                   # Dependencies and setup scripts
│   ├── requirements.txt    # Python dependencies (default)
│   ├── pyproject.toml      # Python project configuration (alternative)
│   ├── windows/            # Windows setup scripts
│   │   ├── setup.ps1       # Setup script (Windows)
│   │   └── run-dev.ps1     # Run both servers (Windows)
│   └── macos-linux/        # macOS/Linux setup scripts
│       ├── setup.sh         # Setup script (Unix/Linux/macOS)
│       └── run-dev.sh       # Run both servers (Unix/Linux/macOS)
├── docs/                   # Documentation
├── .venv/                  # Python virtual environment (generated)
├── .env.example            # Environment variables template
└── README.md               # This file
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
- **FastAPI** - Modern and fast web framework
- **Uvicorn** - High-performance ASGI server
- **Supabase** - Backend as a service (PostgreSQL + Storage)
- **Pydantic** - Data validation
- **LangChain** - Framework for LLM applications
- **OpenAI** - AI API for content generation
- **Python-JOSE** - JWT authentication

### Frontend
- **React 18** - UI library
- **TypeScript** - Static typing
- **Vite** - Build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Shadcn UI** - UI components based on Radix UI
- **React Query** - Server state management
- **Axios** - HTTP client
- **React Router** - Routing

### Development Tools
- **UV** - Ultra-fast Python package manager
- **npm** - Node.js package manager

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

3. **Node.js**:
   - Requires Node.js >=22.12.0 (according to `package.json`)
   - Frontend uses Vite + React + TypeScript

4. **Database**:
   - Project uses Supabase (PostgreSQL)
   - Make sure you have Supabase environment variables configured
   - Check `docs/migrations/` for migration scripts

## 🐛 Troubleshooting

### Error: "UV not found"
- Run the setup script which will install UV automatically
- Or install manually from: https://github.com/astral-sh/uv

### Error: "Node.js version too old"
- Update Node.js to version 22.12.0 or higher
- Download from: https://nodejs.org/

### Error: "Module not found" (Backend)
- Make sure the virtual environment is activated
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

