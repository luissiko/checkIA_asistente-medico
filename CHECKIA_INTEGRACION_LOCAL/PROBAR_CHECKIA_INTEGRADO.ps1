$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
foreach ($puerto in @(3001,5173)) {
    $conexion = New-Object Net.Sockets.TcpClient
    try {
        $espera = $conexion.ConnectAsync("127.0.0.1", $puerto)
        try { [void]$espera.Wait(300) } catch {}
        if ($conexion.Connected) { throw "El puerto $puerto está ocupado. Cierra con Ctrl+C la terminal anterior que lo utiliza y repite este script." }
    } finally { $conexion.Dispose() }
}
node --test .\backend\paso23\paso23.test.mjs .\backend\paso23\integrated.test.mjs
if ($LASTEXITCODE -ne 0) { throw "Fallaron las pruebas del formulario integrado." }
npm --prefix .\frontend run build
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación. Revisa los mensajes anteriores. No se iniciaron los servidores." }
$backend = Join-Path $PSScriptRoot "INICIAR_BACKEND_CHECKIA_PASO23.ps1"
$frontend = Join-Path $PSScriptRoot "INICIAR_FRONTEND_CHECKIA_PASO23.ps1"
Start-Process powershell.exe -ArgumentList "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$backend`""
$listo = $false
for ($intento = 0; $intento -lt 30; $intento++) {
    try {
        $estado = Invoke-RestMethod "http://127.0.0.1:3001/api/health" -TimeoutSec 2
        if ($estado.interview -like "paso23-local-*") { $listo = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $listo) { throw "El backend no está listo. Revisa la nueva ventana del backend antes de continuar." }
Start-Process powershell.exe -ArgumentList "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$frontend`""
Write-Host "Abre http://127.0.0.1:5173 y presiona Ctrl+F5. Inicia sesión y crea una NUEVA CONSULTA."
Write-Host "Conserva abiertas las dos terminales. No se publicó ningún cambio en internet."
