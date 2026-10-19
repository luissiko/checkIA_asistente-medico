param([Parameter(Mandatory=$true)][string]$Respaldo)
$ErrorActionPreference = "Stop"
$datos = Get-Content -LiteralPath (Join-Path $Respaldo "respaldo.json") -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($archivo in $datos.files) {
    $actual = Join-Path $datos.project $archivo.path
    if (Test-Path -LiteralPath $actual -PathType Leaf) {
        $hashActual = (Get-FileHash -LiteralPath $actual -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hashActual -ne $archivo.installedHash) { throw "Este archivo cambió después de instalar: $actual. No se restauró nada para conservar tu trabajo nuevo." }
    }
    if ($archivo.existed -and -not (Test-Path -LiteralPath (Join-Path $Respaldo $archivo.path) -PathType Leaf)) { throw "Falta un archivo en el respaldo. No se restauró nada." }
}
foreach ($archivo in $datos.files) {
    $actual = Join-Path $datos.project $archivo.path
    if ($archivo.existed) { Copy-Item -LiteralPath (Join-Path $Respaldo $archivo.path) -Destination $actual -Force }
    elseif (Test-Path -LiteralPath $actual -PathType Leaf) { Remove-Item -LiteralPath $actual }
}
Write-Host "Restaurados los archivos anteriores. La información de Firestore no fue eliminada."
