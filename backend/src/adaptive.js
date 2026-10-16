import {normalize,answerStatus} from './response-quality.js';
import {DIRECT_SCREEN_QUESTION,MOBILE_SCREEN_QUESTION,COMPACT_SCREEN_QUESTION,CLEAN_SCREEN_QUESTION,recordScreen} from './safety.js';
export const CLARIFICATION_BANK=Object.freeze({
 onset_time:{parentKey:'onset',text:'¿A qué hora o hace cuánto empezó? Puedes dar un aproximado o escribir No sé.'},
 onset_course:{parentKey:'onset',text:'Desde que empezó, ¿mejoró, empeoró o sigue igual? Si no sabes, escribe No sé.'},
 symptoms_now:{parentKey:'associated',text:'¿Qué otros síntomas tienes ahora? Si no tienes otros, escribe Ninguno; si no sabes, No sé.'},
 medication_amount:{parentKey:'medications',text:'De cada medicamento que mencionaste, ¿qué cantidad tomas cada vez? Describe lo que ya tomas; si no sabes, escribe No sé.'},
 medication_frequency:{parentKey:'medications',text:'¿Cada cuánto tomas cada medicamento que mencionaste? Si no sabes, escribe No sé.'},
 medication_since:{parentKey:'medications',text:'¿Desde cuándo tomas cada medicamento que mencionaste? Puedes dar un aproximado o escribir No sé.'},
 history_details:{parentKey:'history',text:'¿Qué recuerdas de la enfermedad que mencionaste y de su seguimiento? Si no sabes, escribe No sé.'},
 allergy_substance:{parentKey:'allergies',text:'¿Qué alimento, medicamento u otra sustancia relacionas con esa reacción? Si no sabes, escribe No sé.'},
 allergy_last_time:{parentKey:'allergy_timing',text:'¿Cuándo ocurrió la última reacción que mencionaste? Puedes dar un aproximado o escribir No sé.'}
});
export const RECHECK_ID='alarm_recheck';
const none=text=>/^(?:no|ninguno|ninguna|ninguno referido|ninguna referida|no tomo nada|no tengo alergias|sin alergias conocidas)$/.test(normalize(text));
export function currentAdditionalAnswers(state){
 return (state.additionalAnswers||[]).filter(a=>a.parentSourceMessageId===state.facts?.find(f=>f.key===a.parentKey)?.sourceMessageId);
}
export function availableClarifications(state){
 const answered=currentAdditionalAnswers(state);
 return Object.entries(CLARIFICATION_BANK).filter(([key,q])=>{
  const f=state.facts?.find(f=>f.key===q.parentKey);
  return f?.status==='reported'&&!none(f.text)&&!f.autoSkipped&&!answered.some(a=>a.target===key);
 }).map(([id,q])=>({id,question:q.text,parentKey:q.parentKey}));
}
export function safetyReviewCurrent(state){return state?.safety?.reviewedRevision===(state?.revision||0);}
export function advanceAdditional(state,questionId,answer,sourceMessageId,at){
 const q=state.pendingQuestions?.[0];
 if(!q?.customFlow)return null;
 const fail=message=>{throw Object.assign(new Error(message),{status:409});};
 if(q.id!==questionId||state.phase!=='collecting')fail('La pregunta cambió. Recarga la consulta.');
 if(q.id===RECHECK_ID){
  const review=recordScreen(state,answer,sourceMessageId,at);
  const reviewHistory=[...(state.safety?.reviewHistory||[]),...(state.safety?.screenAnswer?[state.safety.screenAnswer]:[])].slice(-10);
  return {clinicalState:{...state,phase:'complete',pendingQuestions:[],safety:{...review,reviewedRevision:(state.revision||0)+1,reviewHistory}},reply:'Comprobación actual guardada. Esto no descarta otras emergencias. Puedes revisar el resumen y generar la orientación.',needsClarification:false};
 }
 const active=state.adaptive?.active;
 if(!active||q.id!==active.questions[active.index]?.id)fail('No se encontró la aclaración pendiente. Recarga la consulta.');
 const status=answerStatus(answer);
 if(status==='reported'&&/^(?:si|hola|ok|bien|gracias)$/.test(normalize(answer)))return {clinicalState:state,reply:'Describe el dato que conoces, o escribe No sé o Prefiero no responder.',needsClarification:true};
 const additional={key:q.id,question:q.text,number:q.number,target:q.target,parentKey:q.parentKey,parentSourceMessageId:q.parentSourceMessageId,text:answer,status,source:'user_report',sourceMessageId,recordedAt:at};
 const nextIndex=active.index+1,next=active.questions[nextIndex];
 const completed=[...(state.adaptive.completed||[]),...(!next?[{...active,status:'complete',completedAt:at}]:[])];
 return {clinicalState:{...state,additionalAnswers:[...(state.additionalAnswers||[]),additional],adaptive:{completed,active:next?{...active,index:nextIndex}:null},phase:next?'collecting':'complete',pendingQuestions:next?[next]:[]},reply:next?next.text:'Aclaraciones guardadas. Revisa el resumen y vuelve a comprobar las señales actuales antes de generar una orientación actualizada.',needsClarification:!!next};
}
export function reviewQuestion(state){return {id:RECHECK_ID,kind:'safety',customFlow:true,number:'R',text:'Antes de generar la orientación, vuelve a revisar cómo te sientes ahora.\n'+(state?.protocolId==='intake-demo-v8'?CLEAN_SCREEN_QUESTION:state?.protocolId==='intake-demo-v7'?COMPACT_SCREEN_QUESTION:state?.protocolId==='intake-demo-v6'?MOBILE_SCREEN_QUESTION:DIRECT_SCREEN_QUESTION).text};}
