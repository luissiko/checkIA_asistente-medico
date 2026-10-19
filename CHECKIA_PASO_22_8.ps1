# CHECKIA 22.8 - Siete interacciones visuales. Compatible con 22.6 y 22.7.
param([string]$ProjectRoot="C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference='Stop'
$encoding=New-Object System.Text.UTF8Encoding($false)
$updates=@{}
function Replace-Once([string]$Text,[string]$Before,[string]$After){
 if($Text.Contains($After)){return $Text}
 if(([regex]::Matches($Text,[regex]::Escape($Before))).Count -ne 1){throw 'La interfaz no coincide con la version compatible. No se modifico nada.'}
 return $Text.Replace($Before,$After)
}
$relative='frontend/src/main.jsx'
$target=Join-Path $ProjectRoot $relative
if(!(Test-Path -LiteralPath $target)){throw "Falta $relative. Revisa ProjectRoot."}
$text=[IO.File]::ReadAllText($target).Replace("`r`n","`n")
$before=@'
import './mobile.css';
'@
$after=@'
import './mobile.css';
import './interactions.css';
import {AnswerOptions,InterviewProgress,LoadingDots} from './Interactions.jsx';
'@
$text=Replace-Once $text $before $after
$before=@'
{canAnswer ? <div className={"question-card"+(pending.id==='alarm_screen'?' alarm-question-compact':'')}>
'@
$after=@'
{interview&&!alarm&&selected.status==='open'&&<InterviewProgress state={selected.clinicalState} numbers={questionNumbers}/>}
          {canAnswer ? <div key={selected.id+':'+pending.id} className={"question-card"+(['alarm_screen','alarm_recheck'].includes(pending.id)?' alarm-question-compact checkia-safety-question':'')}>
'@
$text=Replace-Once $text $before $after
$before=@'
{error && <p className="inline-answer-error" role="alert">{error}</p>}
'@
$after=@'
{error && <p id="answer-feedback" className="inline-answer-error" role="alert">{error}</p>}
'@
$text=Replace-Once $text $before $after
$before=@'
<textarea enterKeyHint="send"
'@
$after=@'
<AnswerOptions questionId={pending.id} value={message} onChange={setMessage} disabled={busy}/><textarea aria-invalid={!!error} aria-describedby={error?"answer-feedback":undefined} enterKeyHint="send"
'@
$text=Replace-Once $text $before $after
$before=@'
role="status">Preparando tu consulta…</p>
'@
$after=@'
role="status">Preparando tu consulta…<LoadingDots/></p>
'@
$text=Replace-Once $text $before $after
$before=@'
role="status">Procesando…</p>
'@
$after=@'
role="status">Procesando…<LoadingDots/></p>
'@
$text=Replace-Once $text $before $after
$updates[$relative]=$text
$relative='frontend/src/OrientationPanel.jsx'
$target=Join-Path $ProjectRoot $relative
if(!(Test-Path -LiteralPath $target)){throw "Falta $relative. Revisa ProjectRoot."}
$text=[IO.File]::ReadAllText($target).Replace("`r`n","`n")
$before=@'
import React,{useState} from 'react';
'@
$after=@'
import React,{useState} from 'react';
import {LoadingDots} from './Interactions.jsx';
'@
$text=Replace-Once $text $before $after
$before=@'
{current?<>{saved.rag?
'@
$after=@'
{current?<div className="checkia-result">{saved.rag?
'@
$text=Replace-Once $text $before $after
$before=@'
  </>:<>
'@
$after=@'
  </div>:<>
'@
$text=Replace-Once $text $before $after
$before=@'
role="status">Preparando tu orientación…</p>
'@
$after=@'
role="status">Preparando tu orientación…<LoadingDots/></p>
'@
$text=Replace-Once $text $before $after
$updates[$relative]=$text
$relative='frontend/src/interactions.css'
$content=@'
/* CHECKIA: interacciones discretas, sin dependencias externas. */
@keyframes checkia-fade {from {opacity:.6} to {opacity:1}}
@keyframes checkia-rise {from {transform:translateY(6px)} to {transform:translateY(0)}}
@keyframes checkia-dot {0%,80%,100% {opacity:.3} 40% {opacity:1}}
.workspace .question-card:not(.alarm-question-compact):not(.checkia-safety-question) {animation:checkia-fade 280ms ease-out}
.workspace button {transition:background-color 180ms ease,border-color 180ms ease,box-shadow 180ms ease,scale 150ms ease}
.workspace button:active:not(:disabled) {scale:.98}
.workspace button:focus-visible,.workspace textarea:focus-visible,.workspace input:focus-visible {outline:3px solid #0e7490;outline-offset:3px}
@media (hover:hover) and (pointer:fine) {.workspace button:hover:not(:disabled) {box-shadow:0 2px 7px #0f172a20}}
.workspace .checkia-options {display:flex;flex-wrap:wrap;gap:.5rem;margin:.75rem 0}
.workspace .checkia-options button {min-height:44px;padding:.5rem 1rem;border:2px solid #64748b;border-radius:10px;background:#fff;color:#1e293b}
.workspace .checkia-options button[aria-pressed="true"] {background:#e0f2fe;border-color:#0369a1;color:#0c4a6e;box-shadow:inset 0 0 0 1px #0369a1}
.workspace .orientation-consent {transition:background-color 180ms ease,box-shadow 180ms ease}
.workspace .orientation-consent:has(input:checked) {background:#e0f2fe;box-shadow:inset 3px 0 #0369a1}
.workspace .checkia-progress {margin:.5rem 0 1rem;font-size:.875rem;color:#334155}
.workspace .checkia-progress-track {height:6px;border-radius:6px;background:#e2e8f0;overflow:hidden;margin-top:.4rem}
.workspace .checkia-progress-fill {height:100%;background:#0e7490;transition:width 280ms ease-out}
.workspace .checkia-result {animation:checkia-rise 300ms ease-out}
.checkia-dots {display:inline-flex;gap:4px;margin-left:.4rem;vertical-align:middle}
.checkia-dots span {width:5px;height:5px;border-radius:50%;background:currentColor;animation:checkia-dot 1.2s infinite}
.checkia-dots span:nth-child(2) {animation-delay:.15s}
.checkia-dots span:nth-child(3) {animation-delay:.3s}
.workspace textarea[aria-invalid="true"] {border:2px solid #b91c1c}
.workspace .inline-answer-error {color:#991b1b;font-weight:600}
@media (prefers-reduced-motion:reduce) {
 .workspace .question-card,.workspace .checkia-result,.checkia-dots span {animation:none!important}
 .workspace button,.workspace .orientation-consent,.workspace .checkia-progress-fill {transition:none!important}
}
'@
$target=Join-Path $ProjectRoot $relative
if((Test-Path -LiteralPath $target) -and ([IO.File]::ReadAllText($target).Replace("`r`n","`n").Trim() -ne $content.Trim())){throw "Ya existe $relative con otros cambios. No se modifico nada."}
$updates[$relative]=$content+"`n"
$relative='frontend/src/Interactions.jsx'
$content=@'
import React from 'react';
export function LoadingDots(){return <span className="checkia-dots" aria-hidden="true"><span/><span/><span/></span>;}
export function AnswerOptions({questionId,value,onChange,disabled}){
 const options=questionId==='answers_confirmation'?['Sí','No']:questionId==='medications_knows_active'?['Sí','No','No sé']:[];
 if(!options.length)return null;
 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 return <div className="checkia-options" role="group" aria-label="Respuestas rápidas">{options.map(option=><button key={option} type="button" disabled={disabled} aria-pressed={normalize(value)===normalize(option)} onClick={()=>onChange(option)}>{option}</button>)}</div>;
}
export function InterviewProgress({state,numbers}){
 // Los subapartados y rondas adaptativas no representan pasos de duración fija.
 const keys=Object.keys(numbers).filter(k=>/^\d+$/.test(String(numbers[k])));
 const done=new Set((state.facts||[]).filter(f=>!f.autoSkipped&&keys.includes(f.key)).map(f=>f.key)).size;
 const complete=state.phase==='complete';
 const percent=complete?100:Math.min(95,Math.round(done/Math.max(1,keys.length)*100));
 return <div className="checkia-progress"><span>{complete?'Entrevista inicial completada. Puedes revisar tus respuestas.':`${done} respuestas principales guardadas · Avance aproximado`}</span><div className="checkia-progress-track" role="progressbar" aria-label="Avance aproximado de la entrevista inicial" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={complete?'Entrevista inicial completada; pueden aparecer aclaraciones':`${done} respuestas principales guardadas; pueden aparecer aclaraciones`}><div className="checkia-progress-fill" style={{width:percent+'%'}}/></div></div>;
}
'@
$target=Join-Path $ProjectRoot $relative
if((Test-Path -LiteralPath $target) -and ([IO.File]::ReadAllText($target).Replace("`r`n","`n").Trim() -ne $content.Trim())){throw "Ya existe $relative con otros cambios. No se modifico nada."}
$updates[$relative]=$content+"`n"
$backup=Join-Path $ProjectRoot ('respaldos/paso22_8_'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$newFiles=@()
foreach($relative in $updates.Keys){
 $target=Join-Path $ProjectRoot $relative
 if(Test-Path -LiteralPath $target){$saved=Join-Path $backup $relative;New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null;Copy-Item -LiteralPath $target -Destination $saved}else{$newFiles+=$relative}
}
[IO.File]::WriteAllLines((Join-Path $backup 'ARCHIVOS_NUEVOS.txt'),[string[]]$newFiles,$encoding)
try {foreach($relative in $updates.Keys){$target=Join-Path $ProjectRoot $relative;[IO.File]::WriteAllText($target,$updates[$relative],$encoding)}}
catch {foreach($relative in $updates.Keys){$saved=Join-Path $backup $relative;$target=Join-Path $ProjectRoot $relative;if(Test-Path -LiteralPath $saved){Copy-Item -LiteralPath $saved -Destination $target -Force}elseif($newFiles -contains $relative){Remove-Item -LiteralPath $target -ErrorAction SilentlyContinue}};throw}
Write-Host 'Interacciones instaladas. Ejecuta npm run build desde frontend y luego npm run dev.'
Write-Host "Respaldo: $backup"
Write-Host 'Solo se cambio el frontend. La web publicada requiere compilar y desplegar Hosting con tu configuracion existente.'
