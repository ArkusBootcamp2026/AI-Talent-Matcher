# Setup script for AI Talent Matcher using UV (PowerShell)
# This script sets up the project on a new machine
#
# Usage:
#   .\setup.ps1              # Uses requirements.txt (default)
#   .\setup.ps1 -UsePyProject # Uses pyproject.toml instead

param(
    [switch]$UsePyProject = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up AI Talent Matcher project with UV..." -ForegroundColor Blue

# Step 1: Check Python version
Write-Host "`n📋 Checking Python version..." -ForegroundColor Blue
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ $pythonVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed. Please install Python 3.10 or higher." -ForegroundColor Yellow
    Write-Host "   Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Step 2: Install UV if not present
Write-Host "`n📦 Checking for UV..." -ForegroundColor Blue
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  UV not found. Installing UV..." -ForegroundColor Yellow
    
    # Try to install UV using PowerShell
    $uvInstallScript = "https://astral.sh/uv/install.ps1"
    try {
        Invoke-WebRequest -Uri $uvInstallScript -UseBasicParsing | Invoke-Expression
    } catch {
        Write-Host "❌ Failed to install UV automatically." -ForegroundColor Yellow
        Write-Host "   Please install manually:" -ForegroundColor Yellow
        Write-Host "   1. Install Rust: https://rustup.rs/" -ForegroundColor Yellow
        Write-Host "   2. Run: cargo install uv" -ForegroundColor Yellow
        Write-Host "   Or visit: https://github.com/astral-sh/uv" -ForegroundColor Yellow
        exit 1
    }
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    # Verify installation
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        Write-Host "❌ UV installation failed. Please install manually." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ UV installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ UV is already installed" -ForegroundColor Green
}

# Step 3: Create virtual environment with UV
Write-Host "`n🔧 Creating virtual environment with UV..." -ForegroundColor Blue
uv venv

# Step 4: Activate virtual environment
Write-Host "`n🔌 Activating virtual environment..." -ForegroundColor Blue
& .\.venv\Scripts\Activate.ps1

# Step 5: Install dependencies
# Get the project root (parent of deps folder)
# Script is in deps/windows/, so we need to go up 2 levels
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

if ($UsePyProject) {
    Write-Host "`n📥 Installing dependencies from pyproject.toml..." -ForegroundColor Blue
    Write-Host "   (Alternative method - using pyproject.toml)" -ForegroundColor Cyan
    # Install from pyproject.toml
    # Note: pyproject.toml is in deps/ folder
    # We need to change to deps directory or specify the path
    Set-Location deps
    uv pip install -e .
    Set-Location ..
} else {
    Write-Host "`n📥 Installing dependencies from requirements.txt..." -ForegroundColor Blue
    Write-Host "   (Default method - using requirements.txt)" -ForegroundColor Cyan
    # Default: use requirements.txt for dependency installation
    # Note: requirements.txt is in deps/ folder
    uv pip install -r deps/requirements.txt
}

# Step 6: Verify Python installation
Write-Host "`n✅ Verifying Python installation..." -ForegroundColor Blue
try {
    python -c "import fastapi; import uvicorn; print('✅ Core dependencies installed successfully')"
    Write-Host "✅ Verification successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Verification failed. Some dependencies may be missing." -ForegroundColor Yellow
    exit 1
}

# Step 7: Check Node.js for frontend
Write-Host "`n📋 Checking Node.js version for frontend..." -ForegroundColor Blue
$frontendSetup = $false
try {
    $nodeVersion = node --version
    $nodeVersionNumber = $nodeVersion -replace 'v', ''
    $versionParts = $nodeVersionNumber -split '\.'
    $nodeMajor = [int]$versionParts[0]
    $nodeMinor = [int]$versionParts[1]
    
    if ($nodeMajor -gt 22 -or ($nodeMajor -eq 22 -and $nodeMinor -ge 12)) {
        Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
        $frontendSetup = $true
    } else {
        Write-Host "⚠️  Node.js version $nodeVersion is too old. Frontend requires >=22.12.0" -ForegroundColor Yellow
        Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Node.js is not installed. Frontend setup will be skipped." -ForegroundColor Yellow
    Write-Host "   Install Node.js 22.12.0 or higher from: https://nodejs.org/" -ForegroundColor Yellow
}

# Step 8: Setup frontend if Node.js is available
if ($frontendSetup) {
    Write-Host "`n📦 Setting up frontend dependencies..." -ForegroundColor Blue
    Push-Location frontend
    
    if (Test-Path "package-lock.json" -or Test-Path "package.json") {
        Write-Host "   Installing dependencies with npm..." -ForegroundColor Blue
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Frontend installation had issues. You may need to run 'npm install' manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   No package.json found in frontend directory" -ForegroundColor Yellow
    }
    
    Pop-Location
}

Write-Host "`n🎉 Setup complete!" -ForegroundColor Green
Write-Host "`n📝 Next steps:" -ForegroundColor Blue
Write-Host ""
Write-Host "Backend:" -ForegroundColor Blue
Write-Host "   1. Copy .env.example to backend/.env and configure your environment variables"
Write-Host "   2. Activate the virtual environment: .\.venv\Scripts\Activate.ps1"
Write-Host "   3. Navigate to backend directory: cd backend"
Write-Host "   4. Run the backend: uvicorn app.main:app --reload"
Write-Host ""
if ($frontendSetup) {
    Write-Host "Frontend:" -ForegroundColor Blue
    Write-Host "   1. Navigate to frontend directory: cd frontend"
    Write-Host "   2. Run the frontend: npm run dev"
    Write-Host ""
}
Write-Host "💡 To activate the virtual environment later, run:" -ForegroundColor Yellow
Write-Host "   .\.venv\Scripts\Activate.ps1"
