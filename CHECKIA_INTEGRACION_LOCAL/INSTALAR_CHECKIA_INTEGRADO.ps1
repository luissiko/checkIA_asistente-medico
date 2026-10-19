param([string]$Proyecto = "C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference = "Stop"
$origen = [IO.Path]::GetFullPath($PSScriptRoot)
$destino = [IO.Path]::GetFullPath($Proyecto).TrimEnd('\')
if ($origen.TrimEnd('\') -eq $destino) { throw "Extrae el paquete fuera del proyecto, por ejemplo en Descargas, y vuelve a ejecutarlo." }
if (-not (Test-Path -LiteralPath (Join-Path $destino "frontend\src\main.jsx"))) { throw "No se encontró CHECKIA en $destino." }
$manifest = Get-Content -LiteralPath (Join-Path $origen "manifest-integracion.json") -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($archivo in $manifest.files) {
    $fuente = Join-Path $origen $archivo.path
    $objetivo = [IO.Path]::GetFullPath((Join-Path $destino $archivo.path))
    if (-not $objetivo.StartsWith($destino + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Ruta de destino no permitida." }
    if (-not (Test-Path -LiteralPath $fuente -PathType Leaf)) { throw "El paquete está incompleto: $fuente" }
    if ((Get-FileHash -LiteralPath $fuente -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archivo.sha256) { throw "El archivo del paquete no coincide: $fuente" }
    if (Test-Path -LiteralPath $objetivo) {
        if (-not (Test-Path -LiteralPath $objetivo -PathType Leaf)) { throw "El destino no es un archivo: $objetivo" }
        $hashActual = (Get-FileHash -LiteralPath $objetivo -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hashActual -ne $archivo.sha256 -and $hashActual -notin @($archivo.allowedBefore)) {
            throw "El archivo cambió respecto al código enviado: $objetivo. No se modificó ningún archivo. Conserva esta versión y comparte el archivo actualizado para adaptar la integración."
        }
    }
}
$respaldo = $destino + "-respaldo-integracion-" + (Get-Date -Format "yyyyMMdd-HHmmss-fff")
New-Item -ItemType Directory -Path $respaldo -Force | Out-Null
$registros = @()
foreach ($archivo in $manifest.files) {
    $objetivo = Join-Path $destino $archivo.path
    $existia = Test-Path -LiteralPath $objetivo -PathType Leaf
    if ($existia) {
        $copia = Join-Path $respaldo $archivo.path
        New-Item -ItemType Directory -Path (Split-Path -Parent $copia) -Force | Out-Null
        Copy-Item -LiteralPath $objetivo -Destination $copia
    }
    $registros += [pscustomobject]@{ path=$archivo.path; existed=$existia; installedHash=$archivo.sha256 }
}
[pscustomobject]@{ project=$destino; files=$registros } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $respaldo "respaldo.json") -Encoding UTF8
$escritos = @()
try {
    foreach ($archivo in $manifest.files) {
        $objetivo = Join-Path $destino $archivo.path
        New-Item -ItemType Directory -Path (Split-Path -Parent $objetivo) -Force | Out-Null
        $escritos += $archivo.path
        Copy-Item -LiteralPath (Join-Path $origen $archivo.path) -Destination $objetivo -Force
    }
} catch {
    foreach ($relativa in $escritos) {
        $previo = Join-Path $respaldo $relativa
        $objetivo = Join-Path $destino $relativa
        if (Test-Path -LiteralPath $previo -PathType Leaf) { Copy-Item -LiteralPath $previo -Destination $objetivo -Force }
        elseif (Test-Path -LiteralPath $objetivo -PathType Leaf) { Remove-Item -LiteralPath $objetivo }
    }
    throw
}
Write-Host "Integración instalada. Respaldo de los archivos anteriores: $respaldo"
Write-Host "Set-Location `"$destino`""
Write-Host "powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_CHECKIA_INTEGRADO.ps1"
