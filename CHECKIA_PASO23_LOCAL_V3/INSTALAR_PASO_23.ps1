param([string]$Proyecto = "C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference = "Stop"
$origen = [IO.Path]::GetFullPath($PSScriptRoot)
$destino = [IO.Path]::GetFullPath($Proyecto)
if (-not (Test-Path -LiteralPath (Join-Path $destino "backend\src\openai-client.js") -PathType Leaf)) {
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
# Solo se actualizan los archivos de esta prueba separada. Respaldar antes de escribir.
$cambios = @()
foreach ($relativo in $relativos) {
    $objetivo = Join-Path $destino $relativo
    if (Test-Path -LiteralPath $objetivo) {
        if (-not (Test-Path -LiteralPath $objetivo -PathType Leaf)) { throw "El destino no es un archivo: $objetivo" }
        $nuevo = (Get-FileHash -LiteralPath (Join-Path $origen $relativo) -Algorithm SHA256).Hash
        $previo = (Get-FileHash -LiteralPath $objetivo -Algorithm SHA256).Hash
        if ($nuevo -ne $previo) { $cambios += $relativo }
    }
}
$respaldo = $destino.TrimEnd('\') + "-respaldo-paso23-" + (Get-Date -Format "yyyyMMdd-HHmmss-fff")
foreach ($relativo in $cambios) {
    $copia = Join-Path $respaldo $relativo
    New-Item -ItemType Directory -Path (Split-Path -Parent $copia) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $destino $relativo) -Destination $copia
}
foreach ($relativo in $relativos) {
    $objetivo = Join-Path $destino $relativo
    New-Item -ItemType Directory -Path (Split-Path -Parent $objetivo) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $origen $relativo) -Destination $objetivo -Force
}
if ($cambios.Count -gt 0) { Write-Host "Versión anterior respaldada en: $respaldo" }
Write-Host "Paso 23 v3 instalado. Solo se actualizaron archivos del demo local."
Write-Host "Set-Location `"$destino`""
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_PASO_23.ps1"
