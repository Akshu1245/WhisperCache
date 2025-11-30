<# 
.SYNOPSIS
    WhisperCache Demo Startup Script
    
.DESCRIPTION
    Starts server & client, warms up, and prepares for demo
    
.USAGE
    .\scripts\start-demo.ps1
#>

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "           WhisperCache Demo Startup" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

# Kill any existing processes on our ports
Write-Host "🔄 Cleaning up old processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | ForEach-Object { 
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
}
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { 
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue 
}
Start-Sleep -Seconds 2

# Build server if needed
Write-Host "🔨 Building server..." -ForegroundColor Yellow
Set-Location "$rootDir\server"
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Server build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Server built" -ForegroundColor Green

# Build client if needed
Write-Host "🔨 Building client..." -ForegroundColor Yellow
Set-Location "$rootDir\client"
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Client build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Client built" -ForegroundColor Green

# Start server in background
Write-Host "🚀 Starting server..." -ForegroundColor Yellow
Set-Location "$rootDir\server"
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:rootDir\server
    node dist/index.js 2>&1
}
Start-Sleep -Seconds 3

# Check if server is running
$serverReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:4000/api/ready" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.ready) {
            $serverReady = $true
            break
        }
    } catch { }
    Start-Sleep -Seconds 1
}

if (-not $serverReady) {
    Write-Host "❌ Server failed to start!" -ForegroundColor Red
    Receive-Job $serverJob
    exit 1
}
Write-Host "✅ Server running on port 4000" -ForegroundColor Green

# Start client preview server
Write-Host "🚀 Starting client preview..." -ForegroundColor Yellow
Set-Location "$rootDir\client"
$clientJob = Start-Job -ScriptBlock {
    Set-Location $using:rootDir\client
    npx vite preview --port 5173 2>&1
}
Start-Sleep -Seconds 3
Write-Host "✅ Client running on port 5173" -ForegroundColor Green

# Run warmup
Write-Host ""
Write-Host "🔥 Running warmup..." -ForegroundColor Yellow
Set-Location $rootDir
node scripts/warmup-demo.js

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "           ✅ DEMO READY!" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "   🌐 Open: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   📡 API:  http://localhost:4000/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Press Ctrl+C to stop demo" -ForegroundColor Yellow
Write-Host ""

# Wait for user to stop
try {
    while ($true) {
        Start-Sleep -Seconds 60
        # Heartbeat check
        try {
            Invoke-RestMethod -Uri "http://localhost:4000/api/ready" -TimeoutSec 2 | Out-Null
        } catch {
            Write-Host "⚠️ Server may have stopped" -ForegroundColor Yellow
        }
    }
} finally {
    Write-Host "Stopping demo..." -ForegroundColor Yellow
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Stop-Job $clientJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $clientJob -ErrorAction SilentlyContinue
}
