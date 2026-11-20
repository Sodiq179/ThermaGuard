# ThermaGuard one-click launcher for Windows (PowerShell).
# Usage: right-click > Run with PowerShell, or run .\start.ps1 in a terminal.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "Checking Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Start Docker Desktop, wait for it to say 'Running', then try again." -ForegroundColor Red
    exit 1
}

Write-Host "Building and starting ThermaGuard (the first run downloads images and can take a few minutes)..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Waiting for the dashboard to come up..." -ForegroundColor Cyan
$url = "http://localhost:8080"
for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-WebRequest -UseBasicParsing "$url/api/v1/health" -TimeoutSec 2 *> $null
        Write-Host "ThermaGuard is running at $url" -ForegroundColor Green
        Start-Process $url
        exit 0
    } catch { Start-Sleep -Seconds 2 }
}
Write-Host "The dashboard did not respond yet. Check 'docker compose logs' for details." -ForegroundColor Yellow
