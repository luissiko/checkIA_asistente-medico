import React from 'react';
const statuses={unknown:'Desconocido',declined:'Prefirió no responder',not_applicable:'No aplica',none_reported:'Ninguno',not_collected:'Sin responder'};
const title=id=>id==='basic'?'Datos básicos':'Respuestas de salud';
const label=text=>text.replace(/ aproximad[oa]/gi,'').replace(/ referidos?\b/gi,'').replace(/ referidas?\b/gi,'').replace(/^Intensidad$/,'Dolor');
export function ConsultationSummary({summary,canCorrect,onCorrect}){
 return <details className="consultation-summary compact-summary"><summary>Resumen · revisar y corregir</summary>
  {summary.warnings.map(w=><div className="notice" role="status" key={w.id}><strong>Dato para revisar</strong><p>{w.text}</p></div>)}
  {summary.groups.map(group=><section key={group.id} aria-label={title(group.id)}><h3>{title(group.id)}</h3>{group.fields.filter(f=>!f.autoSkipped).map(f=><div className="summary-field" key={f.key}><div><strong>{label(f.label)}:</strong> <span>{f.measurement?f.measurement.value+' '+f.measurement.unit:(f.text??'Sin responder')}</span>{statuses[f.status]&&<span className="small muted"> · {statuses[f.status]}</span>}{f.provisional&&<span className="small muted"> · aclaración pendiente</span>}{f.details.map(d=><p className="summary-detail" key={d.key}><strong>{label(d.label)}:</strong> {d.text}{statuses[d.status]&&<span className="small muted"> · {statuses[d.status]}</span>}</p>)}</div>{canCorrect&&!f.autoSkipped&&f.status!=='not_collected'&&!f.provisional&&<button type="button" className="secondary" aria-label={'Corregir '+label(f.label)} onClick={()=>onCorrect(f.key)}>Corregir</button>}</div>)}</section>)}
 </details>;
}
