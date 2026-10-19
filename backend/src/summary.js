import {isPaso23,integratedSummary} from '../paso23/integrated-protocol.mjs';
import {currentAdditionalAnswers} from './adaptive.js';
// Resumen determinista de datos referidos. No extrae hechos del chat ni diagnostica.
import {normalize} from './response-quality.js';
export const SUMMARY_VERSION=2;
const labels={family_history:'Enfermedad hereditaria',answers_confirmation:'Confirmación de respuestas',name:'Nombre o alias',age:'Edad',sex:'Sexo referido',weight:'Peso aproximado',height:'Altura aproximada',reason:'Motivo de consulta',onset:'Inicio y evolución',location:'Ubicación',severity:'Intensidad referida',associated:'Otros síntomas',history:'Antecedentes referidos',medications:'Medicamentos referidos',allergies:'Alergias que reportas',allergy_reaction:'Reacción y medicamentos para aliviarla',allergy_timing:'Desde cuándo y última reacción'};
const detailLabels={family_history_condition:'Enfermedad que reportas',family_history_relative:'Familiar que la tuvo o tiene',medications_details:'Uso, dosis y desde cuándo',medications_knows_active:'Conoce el principio activo',medications_identity:'Tipo y principio activo referidos',location_description:'Descripción del dolor o afectación',remedies_use:'Uso de remedios caseros, naturistas o botánicos',remedies_detail:'Remedio e ingredientes referidos',remedies_since:'Desde cuándo y por qué lo consume',history_detail:'Enfermedad o dolor anterior',onset_when:'Cuándo comenzó',onset_evolution:'Evolución',location_detail:'Zona específica',medications_formulation:'Presentación y concentración',medications_amount:'Cantidad referida',medications_frequency:'Frecuencia referida',allergies_substance:'Sustancia referida',allergies_reaction:'Reacción e intensidad referidas',allergies_since:'Desde cuándo ocurre',allergies_when:'Última reacción referida'};
function sites(text) {
 const groups={cabeza:/\b(?:cabeza|frente|sien|nuca)\b/,brazo:/\b(?:brazo|antebrazo)\b/,abdomen:/\b(?:abdomen|estomago|vientre)\b/,pecho:/\b(?:pecho|torax)\b/,espalda:/\bespalda\b/,pierna:/\b(?:pierna|rodilla)\b/};
 const clauses=normalize(text).split(/[.;!?\n]+|\b(?:pero|aunque)\b/).filter(c=>! /\b(?:no tengo|no me duele|sin dolor|niego)\b/.test(c));
 return Object.entries(groups).filter(([,pattern])=>clauses.some(c=>pattern.test(c))).map(([key])=>key);
}
export function buildSummary(session) {
 if(isPaso23(session.clinicalState))return integratedSummary(session);
 const state=session.clinicalState || {},direct=['intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId),current=['intake-demo-v2','intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId);
 const supported=current || state.protocolId==='intake-demo-v1';
 const keys=current?['name','age','sex','weight','height','reason','onset','location','severity','associated','history','medications','allergies']:['reason','age','onset','location','severity','associated','history','medications','allergies'];
 if(direct) keys.push('allergy_reaction','allergy_timing');
 if(['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId))keys.push('answers_confirmation');
 if(state.protocolId==='intake-demo-v7')keys.push('family_history');
 if(state.protocolId==='intake-demo-v8'){keys.splice(keys.indexOf('answers_confirmation'),1);keys.push('family_history','answers_confirmation');}
 const draft=state.clarificationContext?.draft;
 const facts=(state.facts || []).filter(f=>!draft || f.key!==draft.key);
 if(draft) facts.push(draft);
 const fields=supported?keys.map(key=>{
   const f=facts.find(row=>row.key===key);
   return {key,label:['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId)&&key==='allergy_reaction'?'Medicamento o remedio para alergia':key==='sex' && f?.dataType==='self_reported_identity'?'Identidad referida (H/M/X)':labels[key],text:f?.text ?? null,status:f?.status || 'not_collected',source:f?.source || null,sourceMessageId:f?.sourceMessageId || null,provisional:draft?.key===key,autoSkipped:!!f?.autoSkipped,pain:f?.pain || null,numericValue:f?.numericValue ?? null,measurement:f?.measurement || null,correctionCount:f?.revisions?.length || 0,details:(f?.clarifications || []).map(d=>({key:d.key,label:detailLabels[d.key] || d.question,text:d.text,status:d.status,sourceMessageId:d.sourceMessageId || null}))};
 }):[];
 for(const a of currentAdditionalAnswers(state)){const parent=fields.find(f=>f.key===a.parentKey);if(parent)parent.details.push({key:a.key,label:a.question,text:a.text,status:a.status,sourceMessageId:a.sourceMessageId,adaptive:true});}
 const warnings=[],reason=fields.find(f=>f.key==='reason'),location=fields.find(f=>f.key==='location');
 if(reason?.status==='reported' && location?.status==='reported') {
   const a=sites(reason.text),b=sites(location.text);
   if(a.length && b.length && !a.some(site=>b.includes(site))) warnings.push({id:'reason_location_review',keys:['reason','location'],sourceMessageIds:[reason.sourceMessageId,location.sourceMessageId],text:`Revisa motivo y ubicación: el motivo menciona ${a.join(', ')} y la ubicación menciona ${b.join(', ')}. Puede tratarse de dos molestias o de un dato que deseas corregir. No se ha elegido una interpretación.`});
 }
 const alarm=state.assessment?.type==='safety_alert';
 return {version:SUMMARY_VERSION,supported,sessionId:session.id,protocolId:state.protocolId || null,revision:state.revision || 0,phase:state.phase || null,sessionStatus:session.status,progress:{answered:state.facts?.length || 0,expected:supported?keys.length:0,autoSkipped:(state.facts||[]).filter(f=>f.autoSkipped).length,complete:state.phase==='complete'},groups:[{id:'basic',title:'Datos básicos referidos',fields:fields.filter(f=>['name','age','sex','weight','height'].includes(f.key))},{id:'interview',title:'Información referida de la entrevista',fields:fields.filter(f=>!['name','age','sex','weight','height'].includes(f.key))}],warnings,pendingQuestions:(state.pendingQuestions || []).map(q=>({id:q.id,text:q.text})),unknownKeys:fields.filter(f=>f.status==='unknown').map(f=>f.key),safety:{status:alarm?'possible_alarm':state.safety?.status || 'not_screened',screenText:state.safety?.screenAnswer?.text || null,alertText:alarm?state.assessment.reply:null},clinicalInterpretation:false,notice:'Resumen de respuestas referidas por el usuario, sin confirmación clínica. No determina diagnóstico, alergias ni urgencia. Los datos desconocidos no significan ausencia de síntomas. Los saltos automáticos de preguntas se identifican como tales.'};
}
