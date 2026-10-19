$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Instala Node.js 22 o posterior." }
node --test .\backend\paso23\paso23.test.mjs
if ($LASTEXITCODE -ne 0) { throw "Fallaron las pruebas del Paso 23." }
Write-Host "Abre http://127.0.0.1:3023 en tu navegador. Ctrl+C para cerrar."
node .\backend\paso23\server.mjs
if ($LASTEXITCODE -ne 0) { throw "No se pudo ejecutar la prueba local." }
