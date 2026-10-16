# Prepara archivos locales de Hosting. No publica ni crea recursos remotos.
param(
 [string]$ProjectRoot = "C:\Users\cancu\Documents\GitHub\checkIA",
 [string]$SiteId = "checkia-project",
 [string]$Region = "us-central1",
 [string]$ServiceId = "checkia-api"
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectRoot 'frontend\src\main.jsx'))) { throw 'No se encontro el frontend.' }
if ($SiteId -notmatch '^[a-z0-9][a-z0-9-]{2,28}[a-z0-9]$') { throw 'SiteId debe tener 4 a 30 caracteres: minusculas, numeros o guiones; sin guion al principio o final.' }
if ($Region -notmatch '^[a-z]+-[a-z]+[0-9]$' -or $ServiceId -notmatch '^[a-z][a-z0-9-]{0,47}[a-z0-9]$') { throw 'Region o ServiceId invalido.' }
$config = @{
 hosting = @{
  site = $SiteId
  public = 'frontend/dist'
  ignore = @('firebase.checkia.json', '**/.*', '**/node_modules/**')
  headers = @(
   @{ source='**'; headers=@(
    @{ key='X-Content-Type-Options'; value='nosniff' },
    @{ key='Referrer-Policy'; value='no-referrer' },
    @{ key='X-Frame-Options'; value='DENY' },
    @{ key='Permissions-Policy'; value='camera=(), microphone=(), geolocation=()' }
   )},
   @{ source='/assets/**'; headers=@(@{key='Cache-Control';value='public,max-age=31536000,immutable'}) },
   @{ source='/index.html'; headers=@(@{key='Cache-Control';value='no-cache'}) }
  )
  rewrites = @(
   @{ source='/api/**'; run=@{serviceId=$ServiceId;region=$Region;pinTag=$true} },
   @{ source='**'; destination='/index.html' }
  )
 }
}
$path=Join-Path $ProjectRoot 'firebase.checkia.json'
if (Test-Path $path) { Copy-Item -LiteralPath $path -Destination ($path+'.'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff')+'.bak') }
$encoding=New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path,($config|ConvertTo-Json -Depth 12)+[Environment]::NewLine,$encoding)
Write-Host "Configuracion local creada: $path"
Write-Host "URL prevista: https://$SiteId.web.app (solo funcionara despues de crear/verificar el sitio y desplegar)."
Write-Host 'No se publico ningun recurso. Sigue PUBLICAR_CHECKIA.txt.'
