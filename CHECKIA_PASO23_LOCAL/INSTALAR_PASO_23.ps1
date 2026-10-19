param([string]$Proyecto = "C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference = "Stop"
$origen = [IO.Path]::GetFullPath($PSScriptRoot)
$destino = [IO.Path]::GetFullPath($Proyecto)
if (-not (Test-Path (Join-Path $destino "backend\src\openai-client.js"))) {
    throw "No se encontró CHECKIA en $destino. Indica la carpeta correcta con -Proyecto."
}
if ($origen.TrimEnd('\') -eq $destino.TrimEnd('\')) {
    Write-Host "Los archivos ya están en la raíz del proyecto. Ejecuta PROBAR_PASO_23.ps1."
    exit 0
}
$relativos = @("PROBAR_PASO_23.ps1")
foreach ($carpeta in @("backend\paso23", "docs\paso23")) {
    $relativos += Get-ChildItem -LiteralPath (Join-Path $origen $carpeta) -File -Recurse |
        ForEach-Object { $_.FullName.Substring($origen.Length + 1) }
}
# Comprobar todos los destinos antes de copiar; nunca reemplazar contenido distinto.
foreach ($relativo in $relativos) {
    $objetivo = Join-Path $destino $relativo
    if (Test-Path -LiteralPath $objetivo) {
        $nuevo = (Get-FileHash -LiteralPath (Join-Path $origen $relativo) -Algorithm SHA256).Hash
        $previo = (Get-FileHash -LiteralPath $objetivo -Algorithm SHA256).Hash
        if ($nuevo -ne $previo) { throw "Ya existe un archivo diferente: $objetivo. No se ha copiado nada. Revísalo antes de instalar." }
    }
}
foreach ($relativo in $relativos) {
    $objetivo = Join-Path $destino $relativo
    if (-not (Test-Path -LiteralPath $objetivo)) {
        New-Item -ItemType Directory -Path (Split-Path -Parent $objetivo) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $origen $relativo) -Destination $objetivo
    }
}
Write-Host "Paso 23 instalado como prueba separada. No se reemplazaron archivos existentes."
Write-Host "Para probar:"
Write-Host "Set-Location `"$destino`""
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_PASO_23.ps1"
