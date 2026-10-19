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
