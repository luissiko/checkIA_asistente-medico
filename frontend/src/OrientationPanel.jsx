import React,{useState} from 'react';
export {safeSourceUrl} from './source-policy.js';
import {safeSourceUrl} from './source-policy.js';
export function OrientationPanel({session,busy,generating=false,error='',onGenerate,onBegin}){
 const [consent,setConsent]=useState(false),state=session.clinicalState;
 if(state?.phase==='safety_alert'||state?.assessment?.type==='safety_alert'||state?.phase!=='complete')return null;
 if(['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId)&&!/^si[.!]?$/i.test((state.facts.find(f=>f.key==='answers_confirmation')?.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()))return <section className="orientation-panel"><p>Revisa tus respuestas y corrige la confirmación final antes de generar orientación.</p></section>;
 const saved=session.orientation,current=saved?.status==='ready'&&saved.basedOnRevision===(state.revision||0)&&saved.promptVersion==='orientation-rag-v1',canGenerate=session.status==='open';
 const reviewed=state.safety?.reviewedRevision===(state.revision||0),rounds=(state.adaptive?.completed||[]).length,suggestions=saved?.result?.aclaraciones_sugeridas||[];
 return <section className="orientation-panel" aria-label="Orientación de la consulta">
  {canGenerate&&!current&&<label className="orientation-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>Acepto enviar mi información a OpenAI para una evaluación beta de checkIA. El resultado no confirma un diagnóstico médico.</span></label>}
  {current?<>{saved.rag?.version!=='rag-library-v2'&&<div className="notice"><p>Esta orientación se generó con una versión anterior de la biblioteca. Se conserva su historial.</p>{canGenerate&&<button type="button" disabled={busy} onClick={()=>onBegin('review')}>Actualizar con las nuevas fuentes</button>}</div>}<h4>Resumen</h4><p>{saved.result.resumen}</p>
   {saved.result.datos_por_aclarar.length>0&&<><h4>Datos por aclarar</h4><ul>{saved.result.datos_por_aclarar.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
   {canGenerate&&suggestions.length>0&&rounds<2&&<div className="notice"><p>Puedes responder algunas aclaraciones y actualizar la orientación con esos datos.</p><button type="button" disabled={busy} onClick={()=>onBegin('adaptive')}>Responder aclaraciones</button></div>}
   {rounds>=2&&<p className="small muted">Se completaron las dos rondas de aclaraciones. Puedes revisar y corregir tu resumen.</p>}
   <h4>Orientación general</h4><p>{saved.result.orientacion_general}</p>
   {saved.rag?.status==='insufficient_evidence'&&<p className="notice">No se encontraron fuentes suficientes en la base disponible para este motivo.</p>}
   <h4>Siguiente paso</h4><p>{saved.result.siguiente_paso}</p>
   {saved.result.preguntas_para_profesional.length>0&&<><h4>Preguntas para tu consulta</h4><ul>{saved.result.preguntas_para_profesional.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
   {saved.rag?.status==='matched'&&saved.rag.sources?.length>0&&<section aria-label="Fuentes utilizadas"><p className="small muted">La incorporación de estas fuentes no valida un diagnóstico real y está pendiente de una revisión clínica.</p><ul>{[...new Map(saved.rag.sources.map(s=>[s.documentId||s.url,s])).values()].map(source=><li key={source.documentId||source.url}>{safeSourceUrl(source.url)?<a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title} — {source.publisher}</a>:<span>{source.title} — enlace no disponible</span>}<span className="small muted"> · Consultado: {source.checkedAt} · Versión: {source.version||'piloto'}</span></li>)}</ul><details><summary>Ver fragmentos que respaldan la orientación</summary>{saved.rag.sources.map(source=><article className="notice" key={source.id}><strong>{source.section}</strong><p>{source.text}</p><p className="small muted">{source.locator||source.section}. Revisión clínica: {source.clinicalReview==='approved'?'Registrada':'Pendiente'}.</p></article>)}</details></section>}
  </>:<>
   {canGenerate?(!reviewed?<><button type="button" disabled={busy} className="check-current-signals" title="Revisar señales actuales antes de generar la orientación; no confirma un diagnóstico." onClick={()=>onBegin('review')}>Comprobar primer diagnóstico</button></>:<><button type="button" className="generate-orientation" aria-busy={generating} disabled={busy||!consent} onClick={()=>onGenerate({consent:true,expectedRevision:state.revision||0})}>Generar orientación</button></>):<p>La consulta está cerrada y no tiene una orientación vigente.</p>}
  </>}
  {generating&&<p className="request-status" role="status">Preparando tu orientación…</p>}
  {error&&<p className="operation-error" role="alert">{error}</p>}
 </section>;
}
