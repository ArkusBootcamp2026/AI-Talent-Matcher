#!/bin/bash
# Run both backend and frontend in development mode
# This script starts both servers concurrently

set -e

# Get the project root (parent of deps folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting AI Talent Matcher (Backend + Frontend)...${NC}"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment not found. Run deps/macos-linux/setup.sh first.${NC}"
    exit 1
fi

# Check if node_modules exists in frontend
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Frontend dependencies not installed. Run deps/macos-linux/setup.sh first.${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "${YELLOW}🛑 Stopping servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}📡 Starting backend server...${NC}"
source .venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend
echo -e "${BLUE}🎨 Starting frontend server...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✅ Both servers are running!${NC}"
echo -e "${BLUE}📝 Access points:${NC}"
echo -e "   Backend API: http://localhost:8000"
echo -e "   Frontend:    http://localhost:8080"
echo -e "   API Docs:    http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Wait for both processes
wait
