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
 raw=advance(raw,key,text);
 // Reutiliza respuestas existentes en la ruta corregida, sin repetir preguntas.
 const saved=new Map([...(original.retainedAnswers??[]),...original.answers].map(a=>[a.key,a]));
 saved.set(key,{...original.answers[index],text});
 while(raw.phase==='collecting'&&saved.has(raw.questionId)){
  const a=saved.get(raw.questionId);
  const next=advance(raw,a.key,a.text);
  if(next.questionId===raw.questionId)break;
  raw=next;
 }
 raw.retainedAnswers=[...saved.values()];
 raw.revision=original.revision+1;
 raw.extraInformation=structuredClone(original.extraInformation??[]);
 raw.generationPending=false;
 raw.orientation=null;
 const corrected=raw.answers.find(a=>a.key===key);
 raw.answers=raw.answers.map(a=>a.key===key?a:(saved.get(a.key)??a));
 raw.journal=[...original.journal,{...corrected,operation:'correction'}];
 raw.orientationHistory=[...(original.orientationHistory??[]),...(previousOrientation?[previousOrientation]:[])];
 raw.correctionHistory=[...(original.correctionHistory??[]),{questionId:key,previousAnswers:original.answers.slice(index),previousExtraInformation:original.extraInformation??[],previousOrientation,at:new Date().toISOString()}];
 return clinicalState(raw);
}
export function advanceIntegrated(state,key,text){
 const raw=advance(state,key,text), revision=raw.revision, journal=raw.journal;
 const saved=new Map((state.retainedAnswers??[]).map(a=>[a.key,a]));
 saved.set(key,raw.answers.find(a=>a.key===key));
 let result=raw;
 while(result.phase==='collecting'&&saved.has(result.questionId)){
  const a=saved.get(result.questionId), next=advance(result,a.key,a.text);
  if(next.questionId===result.questionId)break;
  result=next;
 }
 result.answers=result.answers.map(a=>saved.get(a.key)??a);
 result.revision=revision;result.journal=journal;
 if(state.retainedAnswers)result.retainedAnswers=[...saved.values()];
 return clinicalState(result);
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
