import questions from './consultation-questions.mjs';
const clean=v=>String(v??'').replace(/\r/g,'').replace(/\*\*|__|`/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
const prompt=(key,fact)=>{const q=questions[key];return ((q?.number??fact?.number)?'Pregunta '+(q?.number??fact?.number)+'. ':'')+clean(fact?.question||q?.text||(q?.choices?'Selecciona una opción.':'Información adicional'));};
function response(key,text,state){
 const q=questions[key];if(key==='emergency_options'){const label=state.emergency?.content;if(label?.value===text.trim().toLowerCase())return clean(label.label);}
 const selected=q?.choices?.filter(c=>String(text).toLowerCase().split(/[,;\s]+/).includes(c.value.toLowerCase()));return selected?.length?selected.map(c=>clean(c.label)).join('; '):clean(text);
}
const resultLines=(result)=>{const out=[];for(const [k,title] of [['siguiente_paso','Siguiente paso'],['resumen','Resumen del caso'],['orientacion_general','Orientación general'],['datos_por_aclarar','Datos por aclarar']]){const value=result?.[k];if(value&&(!Array.isArray(value)||value.length))out.push(title,...(Array.isArray(value)?value.map(clean):[clean(value)]));}return out;};
export function conversationHistory(session){
 const state=session.clinicalState,raw=state.paso23??{},facts=new Map((state.facts??[]).map(f=>[f.key,f]));
 const lines=['Historial de conversación'],events=[],messages=(session.messages??[]).filter(m=>m.role==='user'||m.role==='assistant').slice().sort((a,b)=>(a.sequence??0)-(b.sequence??0));
 if(messages.length){
  const first=messages.find(m=>m.role==='user'),key=first?.questionId;
  if(key)lines.push('','CHECKIA: '+prompt(key,facts.get(key)));
  for(const m of messages){
   const k=m.questionId??m.factKey;
   const text=m.role==='assistant'?clean(m.text)||(m.nextQuestionId?prompt(m.nextQuestionId):''):response(k,m.text,state);
   if(!text)continue;
   const label=m.role==='assistant'?'CHECKIA':m.operation==='correction'?'Usuario (corrección de '+prompt(k,facts.get(k))+')':m.operation==='extra'?'Usuario (información adicional)':'Usuario';
   events.push({at:Number(m.createdAt)||0,lines:[label+': '+text]});
  }
 }else{
  // Legacy/export fixtures: every answered question remains represented, including corrections.
  const entries=raw.journal?.length?raw.journal:state.facts??[];
  for(const f of entries){const key=f.key;events.push({at:Date.parse(f.recordedAt)||0,lines:['CHECKIA: '+(f.operation==='correction'?'Corrección de ':'')+prompt(key,f),'Usuario: '+response(key,f.text,state)]});}
  if(!raw.journal?.length)for(const e of raw.extraInformation??[])events.push({at:Date.parse(e.recordedAt)||0,lines:['Usuario (información adicional): '+clean(e.text)]});
 }
 const seen=new Set();for(const o of raw.orientationHistory??[]){const id=(o.createdAt??'')+':'+o.basedOnRevision;if(o.result&&!seen.has(id)){seen.add(id);events.push({at:Number(o.createdAt)||0,lines:['CHECKIA: Resultado anterior',...resultLines(o.result)]});}}
 // Saved server timestamps order earlier generated results among messages; stable ties retain saved sequence.
 events.sort((a,b)=>a.at-b.at);for(const event of events)lines.push('',...event.lines);
 lines.push('','CHECKIA: Resultado final',...resultLines(session.orientation?.result));
 return lines;
}
