import {CONTENT,initialState,advance,pending,canGenerate} from './engine.mjs';
export const isPaso23 = state => Boolean(state?.protocolId?.startsWith('paso23-local-')&&state?.paso23);
export const jsonSafe = value => JSON.parse(JSON.stringify(value));
export function clinicalState(raw){
 const q=pending(raw);
 const choices=q?.kind==='options'?CONTENT.emergencyOptions.map(o=>({value:o.value,label:o.label,question:o.question??''})):q?.kind==='group'?[{value:'1',label:'BEBE(1)'},{value:'2',label:'MUJER EMBARAZADA(2)'},{value:'3',label:'ADULTO TERCERA EDAD(3)'},{value:'4',label:'DISCAPACITADO(4)'},{value:'5',label:'NO ES UNA EMERGENCIA(5)'}]:q?.kind==='yesno'?[{value:'si',label:'si'},{value:'no',label:'no'}]:q?.choices??[];
 return jsonSafe({schemaVersion:23,protocolId:CONTENT.version,revision:raw.revision,phase:raw.phase==='emergency'?'complete':raw.phase,
  paso23:raw,facts:raw.answers.map(a=>({...a,status:'reported',clarifications:[],source:'user_report'})),
  pendingQuestions:q?[{...q,choices}]:[],assessment:null,qualityEvents:[],
  safety:{status:raw.alert?'possible_alarm':'not_determined',reviewedRevision:raw.revision},
  canGenerate:Boolean(canGenerate(raw)),bmi:raw.bmi,emergency:raw.alert?{...raw.alert,hospitals:CONTENT.hospitals}:null,institutions:CONTENT.hospitals});
}
export const initialIntegrated=()=>clinicalState(initialState());
export function correctedIntegrated(state,key,text,previousOrientation=null){
 const original=state.paso23,index=original.answers.findIndex(a=>a.key===key);
 if(index<0)throw Object.assign(new Error('Respuesta no encontrada.'),{status:400});
 let raw=initialState();for(const a of original.answers.slice(0,index))raw=advance(raw,a.key,a.text);
 raw.revision=original.revision;raw=advance(raw,key,text);
 raw.journal=[...original.journal,raw.journal.at(-1)];
 raw.orientationHistory=original.orientationHistory??[];
 raw.correctionHistory=[...(original.correctionHistory??[]),{questionId:key,previousAnswers:original.answers.slice(index),previousExtraInformation:original.extraInformation??[],previousOrientation,at:new Date().toISOString()}];
 return clinicalState(raw);
}
export function integratedSummary(session){
 const state=session.clinicalState;
 const basic=['respondent','age','sex','weight','height'];
 const fields=state.facts.map(f=>({key:f.key,label:f.question,text:f.text,status:f.status,source:'user_report',autoSkipped:false,provisional:false,details:[],number:f.number}));
 for(const [i,e] of (state.paso23.extraInformation??[]).entries())fields.push({key:'extra_'+i,label:'Información extra '+(i+1),text:e.text,status:'reported',autoSkipped:false,details:[]});
 return{version:23,supported:true,sessionId:session.id,protocolId:state.protocolId,revision:state.revision,phase:state.phase,sessionStatus:session.status,
  progress:{answered:state.facts.length,expected:35,autoSkipped:0,complete:state.phase==='complete'},
  groups:[{id:'basic',title:'Datos básicos referidos',fields:fields.filter(f=>basic.includes(f.key))},{id:'interview',title:'Información referida de la entrevista',fields:fields.filter(f=>!basic.includes(f.key))}],
  warnings:[],pendingQuestions:state.pendingQuestions,unknownKeys:[],safety:{status:state.safety.status,screenText:state.facts.find(f=>f.key==='emergency_level')?.text??null,alertText:state.emergency?'Se reportó una posible urgencia. Solicita ayuda sin esperar la respuesta de IA.':null},clinicalInterpretation:false};
}
