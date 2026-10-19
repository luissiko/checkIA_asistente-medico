# CHECKIA 22.7: enlace al directorio proporcionado por el usuario.
# Solo modifica frontend/src/OrientationPanel.jsx. Crea respaldo antes de escribir.
param([string]$ProjectRoot="C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference='Stop'
$relative='frontend/src/OrientationPanel.jsx'
$target=Join-Path $ProjectRoot $relative
if(!(Test-Path -LiteralPath $target)){throw "No se encontro $relative. Revisa ProjectRoot."}
$content=[IO.File]::ReadAllText($target)
if($content.Contains('className="qroo-health-directory"')){Write-Host 'El enlace ya esta instalado. No se modifico nada.';exit 0}
$anchor=@'
   {saved.rag?.status==='matched'&&saved.rag.sources?.length>0&&<section
'@
$block=@'
   <p className="qroo-health-directory" style={{margin:'1.25rem 0',lineHeight:1.45}}><a href="https://docs.google.com/document/d/18OXmmfO2w8QtXOLRd38TrUhuiEJpRiuEiLxNpM32OjA/edit?usp=sharing" target="_blank" rel="noopener noreferrer" style={{color:'#b91c1c',fontSize:'1.2em',fontWeight:800,textDecoration:'underline',textUnderlineOffset:'0.18em',overflowWrap:'anywhere'}}>LISTA DE INSTITUCIONES DE SALUD DE QUINTANA ROO</a></p>
'@
if(([regex]::Matches($content,[regex]::Escape($anchor))).Count -ne 1){throw 'No se encontro una unica seccion de referencias compatible. No se modifico nada.'}
$updated=$content.Replace($anchor,$block+[Environment]::NewLine+$anchor)
$backup=Join-Path $ProjectRoot ('respaldos/paso22_7_'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
$saved=Join-Path $backup $relative
New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null
Copy-Item -LiteralPath $target -Destination $saved
$encoding=New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($target,$updated,$encoding)
Write-Host 'Enlace agregado antes de las referencias: rojo, mayusculas y letra mas grande.'
Write-Host "Respaldo: $backup"
Write-Host 'Desde frontend ejecuta npm run build; para probar localmente, npm run dev.'
Write-Host 'Para la web publicada, despliega solo Firebase Hosting despues de compilar.'
