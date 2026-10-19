$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "frontend")
npm run dev
if ($LASTEXITCODE -ne 0) { Write-Host "El frontend no pudo iniciarse. Revisa el mensaje anterior." -ForegroundColor Red }
