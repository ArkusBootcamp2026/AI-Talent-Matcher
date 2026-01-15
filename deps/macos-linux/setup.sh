#!/bin/bash
# Setup script for AI Talent Matcher using UV
# This script sets up the project on a new machine
#
# Usage:
#   ./setup.sh              # Uses requirements.txt (default)
#   ./setup.sh --pyproject  # Uses pyproject.toml instead

set -e  # Exit on error

# Check for --pyproject flag
USE_PYPROJECT=false
if [[ "$1" == "--pyproject" ]]; then
    USE_PYPROJECT=true
fi

echo "🚀 Setting up AI Talent Matcher project with UV..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Python version
echo -e "${BLUE}📋 Checking Python version...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}❌ Python 3 is not installed. Please install Python 3.10, 3.11, or 3.12.${NC}"
    echo -e "${YELLOW}   Recommended: Python 3.11 or 3.12 for best compatibility${NC}"
    exit 1
fi

PYTHON_VERSION_FULL=$(python3 --version | cut -d' ' -f2)
PYTHON_VERSION=$(echo $PYTHON_VERSION_FULL | cut -d'.' -f1,2)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

echo -e "${GREEN}✅ Python $PYTHON_VERSION_FULL detected${NC}"

# Check if version is supported (3.10 - 3.12)
if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo -e "${YELLOW}❌ Python 3.10 or higher is required. You have Python $PYTHON_VERSION_FULL${NC}"
    echo -e "${YELLOW}   Please install Python 3.10, 3.11, or 3.12${NC}"
    exit 1
fi

# Store detected version for later use
DETECTED_PYTHON_VERSION="$PYTHON_VERSION_FULL"
DETECTED_MAJOR="$PYTHON_MAJOR"
DETECTED_MINOR="$PYTHON_MINOR"

# Warn about Python 3.13+ compatibility
if [ "$PYTHON_MAJOR" -gt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -gt 12 ]); then
    echo -e "${YELLOW}⚠️  Python $PYTHON_VERSION_FULL detected. This project is tested with Python 3.10-3.12.${NC}"
    echo -e "${YELLOW}   Python 3.13+ may have compatibility issues with C extensions (e.g., pyroaring).${NC}"
    echo -e "${BLUE}   UV will try to find and use Python 3.11 or 3.12 for the virtual environment.${NC}"
fi

# Step 2: Install UV if not present
echo -e "${BLUE}📦 Checking for UV...${NC}"
if ! command -v uv &> /dev/null; then
    echo -e "${YELLOW}⚠️  UV not found. Installing UV...${NC}"
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.cargo/bin:$PATH"
    
    # Verify installation
    if ! command -v uv &> /dev/null; then
        echo -e "${YELLOW}❌ Failed to install UV. Please install manually: https://github.com/astral-sh/uv${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ UV installed successfully${NC}"
else
    echo -e "${GREEN}✅ UV is already installed${NC}"
fi

# Step 3: Determine Python version for virtual environment
echo -e "${BLUE}🔧 Preparing virtual environment...${NC}"
PYTHON_VERSION_FOR_VENV=""

# Check if detected Python version is compatible (3.10-3.12)
if [ "$DETECTED_MAJOR" -eq 3 ] && [ "$DETECTED_MINOR" -ge 10 ] && [ "$DETECTED_MINOR" -le 12 ]; then
    # Use the detected Python version
    PYTHON_VERSION_FOR_VENV="$DETECTED_PYTHON_VERSION"
    echo -e "${GREEN}✅ Using Python $PYTHON_VERSION_FOR_VENV for virtual environment${NC}"
else
    # Try to find a compatible Python version using UV
    echo -e "${BLUE}   Detected Python version may have compatibility issues. Checking for Python 3.11 or 3.12...${NC}"
    
    # Preferred versions in order of preference
    PREFERRED_VERSIONS=("3.12" "3.11" "3.10")
    
    for pref_version in "${PREFERRED_VERSIONS[@]}"; do
        echo -e "${BLUE}   Checking for Python $pref_version...${NC}"
        if uv python find "$pref_version" >/dev/null 2>&1; then
            PYTHON_VERSION_FOR_VENV="$pref_version"
            echo -e "${GREEN}✅ Found Python $pref_version via UV${NC}"
            break
        fi
    done
    
    if [ -z "$PYTHON_VERSION_FOR_VENV" ]; then
        # Try to install Python 3.12 via UV
        echo -e "${BLUE}   Attempting to install Python 3.12 via UV...${NC}"
        if uv python install 3.12 >/dev/null 2>&1; then
            PYTHON_VERSION_FOR_VENV="3.12"
            echo -e "${GREEN}✅ Installed Python 3.12 via UV${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not install Python 3.12 via UV automatically${NC}"
        fi
    fi
    
    if [ -z "$PYTHON_VERSION_FOR_VENV" ]; then
        echo -e "${YELLOW}⚠️  No compatible Python version found automatically.${NC}"
        echo -e "${YELLOW}   The virtual environment will use your system Python ($DETECTED_PYTHON_VERSION).${NC}"
        echo -e "${YELLOW}   If you encounter build errors, please install Python 3.11 or 3.12 manually:${NC}"
        echo -e "${YELLOW}   - Download from: https://www.python.org/downloads/${NC}"
        echo -e "${YELLOW}   - Or run manually: uv python install 3.12${NC}"
        PYTHON_VERSION_FOR_VENV="$DETECTED_PYTHON_VERSION"
    fi
fi

# Step 4: Create virtual environment with UV
echo -e "${BLUE}🔧 Creating virtual environment with UV...${NC}"
if [ -n "$PYTHON_VERSION_FOR_VENV" ] && [ "$PYTHON_VERSION_FOR_VENV" != "$DETECTED_PYTHON_VERSION" ]; then
    echo -e "${BLUE}   Using Python $PYTHON_VERSION_FOR_VENV (via UV) instead of system Python $DETECTED_PYTHON_VERSION${NC}"
    uv venv --python "$PYTHON_VERSION_FOR_VENV"
elif [ -n "$PYTHON_VERSION_FOR_VENV" ]; then
    echo -e "${BLUE}   Using Python $PYTHON_VERSION_FOR_VENV for virtual environment${NC}"
    uv venv --python "$PYTHON_VERSION_FOR_VENV"
else
    uv venv
fi

# Step 5: Activate virtual environment
echo -e "${BLUE}🔌 Activating virtual environment...${NC}"
source .venv/bin/activate

# Step 5: Install dependencies
# Get the project root (parent of deps folder)
# Script is in deps/macos-linux/, so we need to go up 2 levels
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

INSTALL_SUCCESS=false

if [ "$USE_PYPROJECT" = true ]; then
    echo -e "${BLUE}📥 Installing dependencies from pyproject.toml...${NC}"
    echo -e "${BLUE}   (Alternative method - using pyproject.toml)${NC}"
    # Install from pyproject.toml
    # Note: pyproject.toml is in deps/ folder
    # We need to change to deps directory
    cd deps
    if uv pip install -e .; then
        INSTALL_SUCCESS=true
    else
        INSTALL_SUCCESS=false
    fi
    cd ..
else
    echo -e "${BLUE}📥 Installing dependencies from requirements.txt...${NC}"
    echo -e "${BLUE}   (Default method - using requirements.txt)${NC}"
    # Default: use requirements.txt for dependency installation
    # Note: requirements.txt is in deps/ folder
    if uv pip install -r deps/requirements.txt; then
        INSTALL_SUCCESS=true
    else
        INSTALL_SUCCESS=false
    fi
fi

if [ "$INSTALL_SUCCESS" = false ]; then
    echo -e "${YELLOW}❌ Dependency installation failed!${NC}"
    echo ""
    echo -e "${YELLOW}Common causes:${NC}"
    echo -e "${YELLOW}   1. Python version too new (3.13+) - Use Python 3.11 or 3.12 instead${NC}"
    echo -e "${YELLOW}   2. Missing build tools (gcc, make, python3-dev)${NC}"
    echo -e "${YELLOW}   3. Network issues or package registry problems${NC}"
    echo ""
    echo -e "${BLUE}Solutions:${NC}"
    echo -e "${BLUE}   - If using Python 3.13+, downgrade to Python 3.11 or 3.12${NC}"
    echo -e "${BLUE}   - Install build tools: sudo apt-get install build-essential python3-dev (Ubuntu/Debian)${NC}"
    echo -e "${BLUE}   - Install build tools: brew install python3 (macOS)${NC}"
    echo -e "${BLUE}   - Try again: uv pip install -r deps/requirements.txt${NC}"
    exit 1
fi

# Step 7: Verify Python installation
echo -e "${BLUE}✅ Verifying Python installation...${NC}"
if python -c "import fastapi; import uvicorn; print('✅ Core dependencies installed successfully')" 2>&1; then
    echo -e "${GREEN}✅ Verification successful${NC}"
else
    echo -e "${YELLOW}❌ Verification failed. Some dependencies may be missing.${NC}"
    echo -e "${YELLOW}   Try running: uv pip install -r deps/requirements.txt manually${NC}"
    exit 1
fi

# Step 6.5: Ensure pip is installed and upgraded
echo -e "${BLUE}📦 Checking pip installation...${NC}"

# Check if pip exists
if ! python -m pip --version >/dev/null 2>&1; then
    echo -e "${BLUE}   Pip is not installed. Installing pip...${NC}"
    if python -m ensurepip --upgrade >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Pip installed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to install pip via ensurepip. Trying alternative method...${NC}"
        # Try installing pip using get-pip.py as fallback
        if command -v curl >/dev/null 2>&1; then
            if curl -sSL https://bootstrap.pypa.io/get-pip.py | python - >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Pip installed successfully via get-pip.py${NC}"
            else
                echo -e "${YELLOW}⚠️  Failed to install pip. SpaCy model download may fail.${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  curl not found. Cannot install pip via get-pip.py. SpaCy model download may fail.${NC}"
        fi
    fi
fi

# Upgrade pip if it exists
if python -m pip --version >/dev/null 2>&1; then
    echo -e "${BLUE}   Upgrading pip to latest version...${NC}"
    if python -m pip install --upgrade pip --quiet >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Pip upgraded successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to upgrade pip. Continuing anyway...${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Pip is still not available. Some operations may fail.${NC}"
fi

# Step 7.6: Download SpaCy model (required for match score calculation)
echo -e "${BLUE}📥 Downloading SpaCy language model (en_core_web_sm)...${NC}"
echo -e "${BLUE}   This is required for match score calculation and may take a few minutes...${NC}"
echo -e "${BLUE}   Note: SpaCy models are downloaded separately from Python packages.${NC}"

# Verify pip is available before attempting SpaCy download
if ! python -m pip --version >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Pip is not available. Cannot download SpaCy model.${NC}"
    echo -e "${YELLOW}   Please install pip manually, then run: python -m spacy download en_core_web_sm${NC}"
    echo -e "${YELLOW}   Match score calculation will fail without this model.${NC}"
else
    if python -m spacy download en_core_web_sm 2>&1; then
        echo -e "${GREEN}✅ SpaCy model downloaded successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Failed to download SpaCy model automatically.${NC}"
        echo -e "${YELLOW}   You may need to run manually: python -m spacy download en_core_web_sm${NC}"
        echo -e "${YELLOW}   Match score calculation will fail without this model.${NC}"
        echo -e "${YELLOW}   The backend will start, but match scores cannot be calculated until the model is installed.${NC}"
    fi
fi

# Step 7: Check Node.js for frontend
echo -e "${BLUE}📋 Checking Node.js version for frontend...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed. Frontend setup will be skipped.${NC}"
    echo -e "${YELLOW}   Install Node.js 22.12.0 or higher from: https://nodejs.org/${NC}"
    FRONTEND_SETUP=false
else
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    NODE_MINOR=$(echo $NODE_VERSION | cut -d'.' -f2)
    
    if [ "$NODE_MAJOR" -ge 22 ] || ([ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 12 ]); then
        echo -e "${GREEN}✅ Node.js $NODE_VERSION detected${NC}"
        FRONTEND_SETUP=true
    else
        echo -e "${YELLOW}⚠️  Node.js version $NODE_VERSION is too old. Frontend requires >=22.12.0${NC}"
        FRONTEND_SETUP=false
    fi
fi

# Step 9: Setup frontend if Node.js is available
if [ "$FRONTEND_SETUP" = true ]; then
    echo -e "${BLUE}📦 Setting up frontend dependencies...${NC}"
    cd frontend
    
    if [ -f "package-lock.json" ]; then
        echo -e "${BLUE}   Installing dependencies with npm...${NC}"
        npm install
    elif [ -f "package.json" ]; then
        echo -e "${BLUE}   Installing dependencies with npm...${NC}"
        npm install
    else
        echo -e "${YELLOW}   No package.json found in frontend directory${NC}"
    fi
    
    cd ..
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
fi

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${BLUE}📝 Next steps:${NC}"
echo -e ""
echo -e "${BLUE}Backend:${NC}"
echo -e "   1. Copy .env.example to backend/.env and configure your environment variables"
echo -e "   2. Activate the virtual environment: source .venv/bin/activate"
echo -e "   3. Navigate to backend directory: cd backend"
echo -e "   4. Run the backend: uvicorn app.main:app --reload"
echo ""
if [ "$FRONTEND_SETUP" = true ]; then
    echo -e "${BLUE}Frontend:${NC}"
    echo -e "   1. Navigate to frontend directory: cd frontend"
    echo -e "   2. Run the frontend: npm run dev"
    echo ""
fi
echo -e "${YELLOW}💡 To activate the virtual environment later, run:${NC}"
echo -e "   source .venv/bin/activate"
