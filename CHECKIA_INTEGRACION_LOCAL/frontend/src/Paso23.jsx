import React,{useEffect,useRef,useState} from 'react';
import {LoadingDots} from './Interactions.jsx';
export const isPaso23Protocol=id=>typeof id==='string'&&id.startsWith('paso23-local-');
const red={color:'#b01928'},blue={color:'#003bb3'};
export function Paso23Options({question,onSelect,disabled}){
 if(!question?.choices?.length)return null;
 return <div className="checkia-options" role="group" aria-label="Opciones de respuesta" style={{maxHeight:'min(45svh, 28rem)',overflowY:'auto',flexShrink:1,minHeight:0}}>{question.choices.map(o=><button key={o.value} type="button" disabled={disabled} onClick={()=>onSelect(o.value)} style={{whiteSpace:'normal',textAlign:'left',maxWidth:'100%'}}><strong>{o.label}</strong>{o.question&&<span style={{display:'block',marginTop:8}}>{o.question}</span>}</button>)}</div>;
}
export function Paso23Bmi({state,pause,onContinue,busy}){
 const el=useRef(null);useEffect(()=>{if(pause){el.current?.focus({preventScroll:true});el.current?.scrollIntoView({block:'nearest',behavior:'smooth'});}},[pause]);
 const bmi=state.bmi;if(!bmi)return null;
 return <section ref={el} tabIndex={-1} className="notice" aria-label="Índice de masa corporal"><h3>Índice de masa corporal</h3>{bmi.bmi===null?<p>No se puede calcular el IMC con las mediciones proporcionadas. Revisa el peso y la altura en tus respuestas.</p>:<><p>Tu IMC es <strong>{bmi.display} kg/m²</strong>. {bmi.classification.replaceAll('_',' ')}.</p><p>IMC = {Number(bmi.weightKg.toFixed(3))} kg / (({bmi.heightCm} cm / 100)²) = {bmi.display} kg/m².</p>{bmi.note&&<p>{bmi.note}</p>}</>}{pause&&<button type="button" disabled={busy} onClick={onContinue}>Continuar</button>}</section>;
}
export function Paso23Emergency({state}){
 const e=state.emergency;if(!e)return null;
 return <section className="notice error" role="alert"><h3>Ayuda de emergencia</h3><a href="tel:911" className="secondary">Llamar al 911</a><p>En una situación real no esperes una respuesta de la IA para pedir ayuda. En una simulación no llames.</p>{e.content&&<><h3 style={blue}>{e.content.label}</h3><p style={blue}>{e.content.question}</p>{e.content.paragraphs?.map((p,i)=><p key={i} style={{...blue,whiteSpace:'pre-line',overflowWrap:'anywhere'}}>{p}</p>)}</>}<ul>{e.hospitals.map(h=><li key={h.url}><a href={h.url} target="_blank" rel="noopener noreferrer">{h.label}</a></li>)}</ul><p className="small">Los enlaces no confirman disponibilidad hospitalaria en tiempo real.</p></section>;
}
export function Paso23Orientation({session,busy,generating,error,onGenerate,onExtra}){
 const [extra,setExtra]=useState(''),[adding,setAdding]=useState(false),state=session.clinicalState;
 if(!state.canGenerate)return null;
 const saved=session.orientation,current=saved?.status==='ready'&&saved.basedOnRevision===state.revision;
 const canGenerate=session.status==='open';
 const titles={siguiente_paso:'Siguiente paso',resumen:'Resumen',orientacion_general:'Orientación general',datos_por_aclarar:'Datos por aclarar'};
 return <section className="orientation-panel" aria-label="Orientación de la consulta">
  {generating&&<p className="request-status" role="status">Se esta generando la respuesta espere por favor<LoadingDots/></p>}
  {current?<div className="checkia-result">{Object.entries(titles).map(([key,title])=>{const value=saved.result[key];return value&&(!Array.isArray(value)||value.length)?<React.Fragment key={key}><h4>{title}</h4>{Array.isArray(value)?<ul>{value.map((p,i)=><li key={i}>{p}</li>)}</ul>:<p style={{whiteSpace:'pre-line'}}>{value}</p>}</React.Fragment>:null;})}
   <div className="qroo-health-directory" style={red}><p>Le invito a que visite un centro de salud publico o privado en los siguientes enlaces:</p><ul>{state.institutions.map((h,i)=><li key={h.url}><a style={red} href={h.url} target="_blank" rel="noopener noreferrer">{i===3?'HOSPITALES PUBLICOS DE QUINTAN ROO':h.label}</a></li>)}</ul></div>
   <p className="small muted">La respuesta fue generada por una biblioteca de corpus medico pequeña y el modelo de {saved.model}, es una versión de prueba, no es una evaluación profesional, consulte a un medico profesional</p>
   {canGenerate&&<><button type="button" disabled={busy} onClick={()=>setAdding(true)}>Añadir mas información extra</button>{adding&&<form onSubmit={async e=>{e.preventDefault();const ok=await onExtra(extra);if(ok){setExtra('');setAdding(false);}}}><label htmlFor="paso23-extra">Información extra para ampliar tu relato</label><textarea id="paso23-extra" value={extra} onChange={e=>setExtra(e.target.value)} maxLength={4000} disabled={busy} required rows={4}/><button disabled={busy||!extra.trim()} type="submit">Enviar y volver a evaluar</button><button type="button" className="secondary" disabled={busy} onClick={()=>setAdding(false)}>Cancelar</button></form>}</>}
  </div>:canGenerate?<button type="button" className="generate-orientation" disabled={busy} onClick={()=>onGenerate({consent:true,expectedRevision:state.revision})}>Generar respuesta</button>:null}
  {error&&<p className="operation-error" role="alert">{error}</p>}
 </section>;
}
