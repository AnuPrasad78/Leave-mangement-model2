#Requires -Version 5.1
<#
.SYNOPSIS
  Runs the backend pytest suite against a real, throwaway PostgreSQL 16 — no Docker required.

.DESCRIPTION
  Portable-binaries approach (nothing is installed system-wide):
    1. (first run) downloads the PostgreSQL 16 Windows binaries ZIP into tools\ and extracts it
    2. initializes a data cluster in .test-data\ (once)
    3. starts postgres on 127.0.0.1:<Port> (default 55432)
    4. sets TEST_DATABASE_URL and runs pytest
    5. stops postgres when done (unless -KeepRunning)

  To remove everything again: delete the tools\ and .test-data\ folders.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-backend-tests.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-backend-tests.ps1 -KeepRunning   # stay up, faster loop
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-backend-tests.ps1 -m "unit"       # extra args go to pytest
#>
param(
  # Optional: path to an already-downloaded binaries ZIP (skips the download).
  # Get it from https://www.enterprisedb.com/download-postgresql-binaries
  # ("PostgreSQL 16 -> Windows x86-64 -> Binaries"), then pass it here once.
  [string]$ArchivePath,
  [int]$Port = 55432,
  [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"
$apiDir    = Split-Path -Parent $PSScriptRoot          # backend\api
$toolsDir  = Join-Path $apiDir "tools"
$dataDir   = Join-Path $apiDir ".test-data"
$pgExe     = Join-Path $toolsDir "pgsql\bin\postgres.exe"
$pgCtl     = Join-Path $toolsDir "pgsql\bin\pg_ctl.exe"
$initDb    = Join-Path $toolsDir "pgsql\bin\initdb.exe"

function Test-PortListening([int]$p) {
  return $null -ne (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}

# --- 1. locate or download binaries ------------------------------------------------
if (-not (Test-Path $pgExe)) {
  if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir | Out-Null }
  $zip = if ($ArchivePath) { $ArchivePath } else { Join-Path $toolsDir "postgresql-16-binaries.zip" }
  if (-not (Test-Path $zip)) {
    # Pinned EDB build; if the link moves (they do), download the zip manually from
    # https://www.enterprisedb.com/download-postgresql-binaries and pass -ArchivePath.
    $url = "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip"
    Write-Host "Downloading PostgreSQL 16 binaries (~350 MB, first run only)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $zip
  }
  Write-Host "Extracting to $toolsDir ..."
  Expand-Archive -Path $zip -DestinationPath $toolsDir -Force
}

# --- 2. initialize the throwaway cluster (once) ------------------------------------
if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  Write-Host "Initializing test cluster in $dataDir ..." -ForegroundColor Cyan
  $pwFile = Join-Path $env:TEMP "pg_test_pw.txt"
  Set-Content -Path $pwFile -Value "leave_test"
  & $initDb -D $dataDir -U leave_test --pwfile=$pwFile -A password -E UTF8 --locale=C | Out-Null
  Remove-Item $pwFile
}

# --- 3. start (or reuse a running) server -----------------------------------------
$preExisting = Test-PortListening -p $Port
if (-not $preExisting) {
  Write-Host "Starting postgres on 127.0.0.1:$Port ..." -ForegroundColor Cyan
  & $pgCtl -D $dataDir -l (Join-Path $dataDir "server.log") -o "-p $Port -c listen_addresses=127.0.0.1" start | Out-Null
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-PortListening -p $Port) { break }
    Start-Sleep -Milliseconds 500
  }
  if (-not (Test-PortListening -p $Port)) {
    throw "Postgres did not start within 30s. See log: $dataDir\server.log"
  }
}
else {
  Write-Host "Reusing postgres already listening on port $Port." -ForegroundColor Yellow
}

# --- 4. run the suite --------------------------------------------------------------
try {
  $env:TEST_DATABASE_URL = "postgresql+psycopg://leave_test:leave_test@127.0.0.1:$Port/leave_test"
  Write-Host ""
  Write-Host "Running pytest (TEST_DATABASE_URL=$env:TEST_DATABASE_URL) ..." -ForegroundColor Cyan
  Write-Host ""
  Push-Location $apiDir
  & python -m pytest @args
  $script:exitCode = $LASTEXITCODE
}
finally {
  Pop-Location
  if (-not ($KeepRunning -or $preExisting)) {
    Write-Host "Stopping postgres ..." -ForegroundColor Cyan
    & $pgCtl -D $dataDir stop -m fast | Out-Null
  }
}

Write-Host ""
if ($script:exitCode -eq 0) { Write-Host "Backend suite PASSED." -ForegroundColor Green }
else { Write-Host "Backend suite FAILED (exit $script:exitCode)." -ForegroundColor Red }
exit ([int]($script:exitCode -ne 0))
