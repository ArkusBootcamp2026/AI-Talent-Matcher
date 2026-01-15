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

Write-Host "[INFO] Setting up AI Talent Matcher project with UV..." -ForegroundColor Blue

# Step 1: Check Python version
Write-Host "`n[INFO] Checking Python version..." -ForegroundColor Blue
try {
    $pythonVersionOutput = python --version 2>&1
    $pythonVersion = ($pythonVersionOutput -replace 'Python ', '').Trim()
    Write-Host "[OK] Python $pythonVersion detected" -ForegroundColor Green
    
    # Parse version to check compatibility
    $versionParts = $pythonVersion -split '\.'
    $major = [int]$versionParts[0]
    $minor = [int]$versionParts[1]
    
    # Check if version is supported (3.10 - 3.12)
    if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 10)) {
        Write-Host "[ERROR] Python 3.10 or higher is required. You have Python $pythonVersion" -ForegroundColor Red
        Write-Host "   Please install Python 3.10, 3.11, or 3.12 from: https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host "   Note: Python 3.13+ may have compatibility issues with some C extensions." -ForegroundColor Yellow
        exit 1
    }
    
    # Store the detected Python version for later use
    $script:detectedPythonVersion = $pythonVersion
    $script:detectedMajor = $major
    $script:detectedMinor = $minor
    
    if ($major -gt 3 -or ($major -eq 3 -and $minor -gt 12)) {
        Write-Host "[WARNING] Python $pythonVersion detected. This project is tested with Python 3.10-3.12." -ForegroundColor Yellow
        Write-Host "   Python 3.13+ may have compatibility issues with C extensions (e.g., pyroaring)." -ForegroundColor Yellow
        Write-Host "   UV will try to find and use Python 3.11 or 3.12 for the virtual environment." -ForegroundColor Blue
    }
} catch {
    Write-Host "[ERROR] Python is not installed. Please install Python 3.10, 3.11, or 3.12." -ForegroundColor Yellow
    Write-Host "   Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "   Recommended: Python 3.11 or 3.12 for best compatibility" -ForegroundColor Yellow
    exit 1
}

# Step 2: Install UV if not present
Write-Host "`n[INFO] Checking for UV..." -ForegroundColor Blue
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "[WARNING] UV not found. Installing UV..." -ForegroundColor Yellow
    
    # Try to install UV using PowerShell
    $uvInstallScript = "https://astral.sh/uv/install.ps1"
    try {
        Invoke-WebRequest -Uri $uvInstallScript -UseBasicParsing | Invoke-Expression
    } catch {
        Write-Host "[ERROR] Failed to install UV automatically." -ForegroundColor Yellow
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
        Write-Host "[ERROR] UV installation failed. Please install manually." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] UV installed successfully" -ForegroundColor Green
} else {
    Write-Host "[OK] UV is already installed" -ForegroundColor Green
}

# Step 3: Determine Python version for virtual environment
Write-Host "`n[INFO] Preparing virtual environment..." -ForegroundColor Blue
$pythonVersionForVenv = $null

# Check if detected Python version is compatible (3.10-3.12)
if ($script:detectedMajor -eq 3 -and $script:detectedMinor -ge 10 -and $script:detectedMinor -le 12) {
    # Use the detected Python version
    $pythonVersionForVenv = $script:detectedPythonVersion
    Write-Host "[OK] Using Python $pythonVersionForVenv for virtual environment" -ForegroundColor Green
} else {
    # Try to find a compatible Python version using UV
    Write-Host "[INFO] Detected Python version may have compatibility issues. Checking for Python 3.11 or 3.12..." -ForegroundColor Blue
    
    # Preferred versions in order of preference
    $preferredVersions = @("3.12", "3.11", "3.10")
    
    foreach ($prefVersion in $preferredVersions) {
        # Try to find or install Python version via UV
        Write-Host "   Checking for Python $prefVersion..." -ForegroundColor Cyan
        $pythonCheck = uv python find $prefVersion 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonVersionForVenv = $prefVersion
            Write-Host "[OK] Found Python $prefVersion via UV" -ForegroundColor Green
            break
        }
    }
    
    if (-not $pythonVersionForVenv) {
        # Try to install Python 3.12 via UV
        Write-Host "[INFO] Attempting to install Python 3.12 via UV..." -ForegroundColor Blue
        try {
            uv python install 3.12 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $pythonVersionForVenv = "3.12"
                Write-Host "[OK] Installed Python 3.12 via UV" -ForegroundColor Green
            } else {
                Write-Host "[WARNING] Could not install Python 3.12 via UV automatically" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "[WARNING] Could not install Python 3.12 via UV automatically" -ForegroundColor Yellow
        }
    }
    
    if (-not $pythonVersionForVenv) {
        Write-Host "[WARNING] No compatible Python version found automatically." -ForegroundColor Yellow
        Write-Host "   The virtual environment will use your system Python ($script:detectedPythonVersion)." -ForegroundColor Yellow
        Write-Host "   If you encounter build errors, please install Python 3.11 or 3.12 manually:" -ForegroundColor Yellow
        Write-Host "   - Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
        Write-Host "   - Or run manually: uv python install 3.12" -ForegroundColor Yellow
        $pythonVersionForVenv = $script:detectedPythonVersion
    }
}

# Step 4: Create virtual environment with UV
Write-Host "`n[INFO] Creating virtual environment with UV..." -ForegroundColor Blue
if ($pythonVersionForVenv -and ($pythonVersionForVenv -ne $script:detectedPythonVersion)) {
    Write-Host "   Using Python $pythonVersionForVenv (via UV) instead of system Python $script:detectedPythonVersion" -ForegroundColor Cyan
    uv venv --python $pythonVersionForVenv
} elseif ($pythonVersionForVenv) {
    Write-Host "   Using Python $pythonVersionForVenv for virtual environment" -ForegroundColor Cyan
    uv venv --python $pythonVersionForVenv
} else {
    uv venv
}

# Step 5: Activate virtual environment
Write-Host "`n[INFO] Activating virtual environment..." -ForegroundColor Blue
& .\.venv\Scripts\Activate.ps1

# Step 5: Install dependencies
# Get the project root (parent of deps folder)
# Script is in deps/windows/, so we need to go up 2 levels
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

Write-Host "`n[INFO] Installing dependencies..." -ForegroundColor Blue
$installSuccess = $false

if ($UsePyProject) {
    Write-Host "   (Alternative method - using pyproject.toml)" -ForegroundColor Cyan
    # Install from pyproject.toml
    # Note: pyproject.toml is in deps/ folder
    # We need to change to deps directory or specify the path
    Set-Location deps
    try {
        uv pip install -e .
        $installSuccess = $true
    } catch {
        Write-Host "[ERROR] Failed to install dependencies from pyproject.toml" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        $installSuccess = $false
    }
    Set-Location ..
} else {
    Write-Host "   (Default method - using requirements.txt)" -ForegroundColor Cyan
    # Default: use requirements.txt for dependency installation
    # Note: requirements.txt is in deps/ folder
    try {
        uv pip install -r deps/requirements.txt
        if ($LASTEXITCODE -eq 0) {
            $installSuccess = $true
        } else {
            $installSuccess = $false
        }
    } catch {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        $installSuccess = $false
    }
}

if (-not $installSuccess) {
    Write-Host "`n[ERROR] Dependency installation failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common causes:" -ForegroundColor Yellow
    Write-Host "   1. Python version too new (3.13+) - Use Python 3.11 or 3.12 instead" -ForegroundColor Yellow
    Write-Host "   2. Missing C++ build tools (Visual Studio Build Tools)" -ForegroundColor Yellow
    Write-Host "   3. Network issues or package registry problems" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Cyan
    Write-Host "   - If using Python 3.13+, downgrade to Python 3.11 or 3.12" -ForegroundColor Cyan
    Write-Host "   - Install Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022" -ForegroundColor Cyan
    Write-Host "   - Install the 'Desktop development with C++' workload" -ForegroundColor Cyan
    Write-Host "   - Try again: uv pip install -r deps/requirements.txt" -ForegroundColor Cyan
    exit 1
}

# Step 7: Verify Python installation
Write-Host "`n[INFO] Verifying Python installation..." -ForegroundColor Blue
try {
    $verifyOutput = python -c "import fastapi; import uvicorn; print('[OK] Core dependencies installed successfully')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Verification successful" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Verification failed. Some dependencies may be missing." -ForegroundColor Red
        Write-Host "   Output: $verifyOutput" -ForegroundColor Yellow
        Write-Host "   Try running: uv pip install -r deps/requirements.txt manually" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "[ERROR] Verification failed. Some dependencies may be missing." -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Yellow
    Write-Host "   Try running: uv pip install -r deps/requirements.txt manually" -ForegroundColor Yellow
    exit 1
}

# Step 6.5: Ensure pip is installed and upgraded
Write-Host "`n[INFO] Checking pip installation..." -ForegroundColor Blue

# Check if pip exists (suppress all output and errors)
$pipExists = $false
try {
    $null = python -m pip --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        $pipExists = $true
    }
} catch {
    $pipExists = $false
}

if (-not $pipExists) {
    Write-Host "[INFO] Pip is not installed. Installing pip..." -ForegroundColor Blue
    try {
        $null = python -m ensurepip --upgrade 2>$null
        $ensurepipSuccess = ($LASTEXITCODE -eq 0)
    } catch {
        $ensurepipSuccess = $false
    }
    
    if ($ensurepipSuccess) {
        Write-Host "[OK] Pip installed successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Failed to install pip via ensurepip. Trying alternative method..." -ForegroundColor Yellow
        # Try installing pip using get-pip.py as fallback
        $getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
        try {
            $getPipScript = Invoke-WebRequest -Uri $getPipUrl -UseBasicParsing
            $null = $getPipScript.Content | python - 2>$null
            $getpipSuccess = ($LASTEXITCODE -eq 0)
        } catch {
            $getpipSuccess = $false
            Write-Host "[WARNING] Could not download get-pip.py. SpaCy model download may fail." -ForegroundColor Yellow
        }
        
        if ($getpipSuccess) {
            Write-Host "[OK] Pip installed successfully via get-pip.py" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Failed to install pip. SpaCy model download may fail." -ForegroundColor Yellow
        }
    }
}

# Upgrade pip if it exists
$pipExistsAfter = $false
try {
    $null = python -m pip --version 2>$null
    $pipExistsAfter = ($LASTEXITCODE -eq 0)
} catch {
    $pipExistsAfter = $false
}

if ($pipExistsAfter) {
    Write-Host "[INFO] Upgrading pip to latest version..." -ForegroundColor Blue
    try {
        $null = python -m pip install --upgrade pip --quiet 2>$null
        $upgradeSuccess = ($LASTEXITCODE -eq 0)
    } catch {
        $upgradeSuccess = $false
    }
    
    if ($upgradeSuccess) {
        Write-Host "[OK] Pip upgraded successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Failed to upgrade pip. Continuing anyway..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARNING] Pip is still not available. Some operations may fail." -ForegroundColor Yellow
}

# Step 7.6: Download SpaCy model (required for match score calculation)
Write-Host "`n[INFO] Downloading SpaCy language model (en_core_web_sm)..." -ForegroundColor Blue
Write-Host "   This is required for match score calculation and may take a few minutes..." -ForegroundColor Cyan
Write-Host "   Note: SpaCy models are downloaded separately from Python packages." -ForegroundColor Cyan

# Verify pip is available before attempting SpaCy download
$pipAvailable = $false
try {
    $null = python -m pip --version 2>$null
    $pipAvailable = ($LASTEXITCODE -eq 0)
} catch {
    $pipAvailable = $false
}

if (-not $pipAvailable) {
    Write-Host "[WARNING] Pip is not available. Cannot download SpaCy model." -ForegroundColor Yellow
    Write-Host "   Please install pip manually, then run: python -m spacy download en_core_web_sm" -ForegroundColor Yellow
    Write-Host "   Match score calculation will fail without this model." -ForegroundColor Yellow
} else {
    try {
        $spacyResult = python -m spacy download en_core_web_sm 2>&1
        $spacySuccess = ($LASTEXITCODE -eq 0)
    } catch {
        $spacySuccess = $false
        $spacyResult = $_.Exception.Message
    }
    
    if ($spacySuccess) {
        Write-Host "[OK] SpaCy model downloaded successfully" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Failed to download SpaCy model automatically." -ForegroundColor Yellow
        Write-Host "   Exit code: $LASTEXITCODE" -ForegroundColor Yellow
        Write-Host "   Error output: $spacyResult" -ForegroundColor Yellow
        Write-Host "   You may need to run manually: python -m spacy download en_core_web_sm" -ForegroundColor Yellow
        Write-Host "   Match score calculation will fail without this model." -ForegroundColor Yellow
        Write-Host "   The backend will start, but match scores cannot be calculated until the model is installed." -ForegroundColor Yellow
    }
}

# Step 7: Check Node.js for frontend
Write-Host "`n[INFO] Checking Node.js version for frontend..." -ForegroundColor Blue
$frontendSetup = $false
try {
    $nodeVersion = node --version
    $nodeVersionNumber = $nodeVersion -replace 'v', ''
    $versionParts = $nodeVersionNumber -split '\.'
    $nodeMajor = [int]$versionParts[0]
    $nodeMinor = [int]$versionParts[1]
    
    if (($nodeMajor -gt 22) -or (($nodeMajor -eq 22) -and ($nodeMinor -ge 12))) {
        Write-Host "[OK] Node.js $nodeVersion detected" -ForegroundColor Green
        $frontendSetup = $true
    } else {
        Write-Host "[WARNING] Node.js version $nodeVersion is too old. Frontend requires >=22.12.0" -ForegroundColor Yellow
        Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Node.js is not installed. Frontend setup will be skipped." -ForegroundColor Yellow
    Write-Host "   Install Node.js 22.12.0 or higher from: https://nodejs.org/" -ForegroundColor Yellow
}

# Step 9: Setup frontend if Node.js is available
if ($frontendSetup) {
    Write-Host "`n[INFO] Setting up frontend dependencies..." -ForegroundColor Blue
    Push-Location frontend
    
    if ((Test-Path "package-lock.json") -or (Test-Path "package.json")) {
        Write-Host "   Installing dependencies with npm..." -ForegroundColor Blue
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Frontend dependencies installed" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Frontend installation had issues. You may need to run 'npm install' manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   No package.json found in frontend directory" -ForegroundColor Yellow
    }
    
    Pop-Location
}

Write-Host "`n[SUCCESS] Setup complete!" -ForegroundColor Green
Write-Host "`n[INFO] Next steps:" -ForegroundColor Blue
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
Write-Host "[TIP] To activate the virtual environment later, run:" -ForegroundColor Yellow
Write-Host "   .\.venv\Scripts\Activate.ps1"
