#!/bin/bash
# Setup script for AI Talent Matcher using UV
# This script sets up the project on a new machine

set -e  # Exit on error

echo "🚀 Setting up AI Talent Matcher project with UV..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check Python version
echo -e "${BLUE}📋 Checking Python version...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}❌ Python 3 is not installed. Please install Python 3.10 or higher.${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION detected${NC}"

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

# Step 3: Create virtual environment with UV
echo -e "${BLUE}🔧 Creating virtual environment with UV...${NC}"
uv venv

# Step 4: Activate virtual environment
echo -e "${BLUE}🔌 Activating virtual environment...${NC}"
source .venv/bin/activate

# Step 5: Install dependencies from pyproject.toml
echo -e "${BLUE}📥 Installing dependencies from pyproject.toml...${NC}"
uv pip install -r requirements.txt

# Step 6: Verify Python installation
echo -e "${BLUE}✅ Verifying Python installation...${NC}"
python -c "import fastapi; import uvicorn; print('✅ Core dependencies installed successfully')"

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

# Step 8: Setup frontend if Node.js is available
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
echo -e "   1. Copy .env.example to .env and configure your environment variables"
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
