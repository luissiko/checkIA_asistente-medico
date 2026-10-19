$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node .\backend\paso23\integrated-server.mjs
if ($LASTEXITCODE -ne 0) { Write-Host "El backend no pudo iniciarse. Revisa el mensaje anterior." -ForegroundColor Red }
