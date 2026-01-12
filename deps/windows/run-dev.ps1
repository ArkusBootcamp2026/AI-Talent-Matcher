# Run both backend and frontend in development mode (PowerShell)
# This script starts both servers concurrently

$ErrorActionPreference = "Stop"

# Get the project root (parent of deps folder)
# Script is in deps/windows/, so we need to go up 2 levels
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

Write-Host "[INFO] Starting AI Talent Matcher (Backend + Frontend)..." -ForegroundColor Blue

# Check if virtual environment exists
if (-not (Test-Path ".venv")) {
    Write-Host "[WARNING] Virtual environment not found. Run deps\windows\setup.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists in frontend
if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "[WARNING] Frontend dependencies not installed. Run deps\windows\setup.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Function to cleanup on exit
function Cleanup {
    Write-Host "`n[STOP] Stopping servers..." -ForegroundColor Yellow
    if ($backendJob) { Stop-Job $backendJob; Remove-Job $backendJob }
    if ($frontendJob) { Stop-Job $frontendJob; Remove-Job $frontendJob }
    exit
}

# Register cleanup on Ctrl+C
[Console]::TreatControlCAsInput = $false
$null = Register-EngineEvent PowerShell.Exiting -Action { Cleanup }

# Start backend
Write-Host "`n[INFO] Starting backend server..." -ForegroundColor Blue
$backendPath = Join-Path $projectRoot "backend"
$venvPython = Join-Path $projectRoot ".venv\Scripts\python.exe"
$backendScript = {
    param($venvPython, $backendPath)
    Set-Location $backendPath
    & $venvPython -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}
$backendJob = Start-Job -ScriptBlock $backendScript -ArgumentList $venvPython, $backendPath

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend
Write-Host "[INFO] Starting frontend server..." -ForegroundColor Blue
$frontendPath = Join-Path $projectRoot "frontend"
$frontendScript = {
    param($frontendPath)
    Set-Location $frontendPath
    npm run dev
}
$frontendJob = Start-Job -ScriptBlock $frontendScript -ArgumentList $frontendPath

Write-Host "`n[OK] Both servers are running!" -ForegroundColor Green
Write-Host "`n[INFO] Access points:" -ForegroundColor Blue
Write-Host "   Backend API: http://localhost:8000"
Write-Host "   Frontend:    http://localhost:8080"
Write-Host "   API Docs:    http://localhost:8000/docs"
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow

# Monitor jobs
try {
    while ($true) {
        Start-Sleep -Seconds 1
        # Check if jobs are still running
        if ($backendJob.State -eq "Failed" -or $frontendJob.State -eq "Failed") {
            Write-Host "`n[ERROR] One of the servers failed. Check job output:" -ForegroundColor Red
            if ($backendJob.State -eq "Failed") {
                Write-Host "Backend output:" -ForegroundColor Yellow
                Receive-Job $backendJob
            }
            if ($frontendJob.State -eq "Failed") {
                Write-Host "Frontend output:" -ForegroundColor Yellow
                Receive-Job $frontendJob
            }
            Cleanup
        }
    }
} catch {
    Cleanup
}
