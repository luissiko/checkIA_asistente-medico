import {eligible,emergencyChoices,resultSections,resultNotice,bmiText} from './view.mjs';
let config,session,busy=false,bmiAcknowledged=null;
const $=id=>document.getElementById(id);
function node(tag,text,className){const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e;}
async function api(path,body,method=body?'POST':'GET'){
 const r=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo completar la operación.');return data;
}
async function operation(fn){
 if(busy)return;busy=true;$('error').textContent='';document.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{await fn();}catch(e){$('error').textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
function render(){
 $('workspace').hidden=!session;$('start').hidden=Boolean(session);if(!session)return;
 sessionStorage.setItem('checkia-paso23-id',session.id);
 $('alert').hidden=!session.alert;$('advice').replaceChildren();$('hospitals').replaceChildren();
 $('emergency-title').textContent=session.alert?.content?.label||'';$('emergency-question').textContent=session.alert?.content?.question||'';
 for(const p of session.alert?.content?.paragraphs||[])$('advice').append(node('p',p,/No hacer/i.test(p)?'do-not':''));
 if(session.alert)for(const h of config.content.hospitals){const a=node('a',h.label);a.href=h.url;a.target='_blank';a.rel='noopener noreferrer';$('hospitals').append(a);}
 const q=session.pending,last=session.answers.at(-1);
 const showBmi=last?.key==='bmi_consent'&&Boolean(session.bmi)&&bmiAcknowledged!==last.recordedAt;
 $('bmi-result').hidden=!session.bmi;$('bmi').textContent=bmiText(session.bmi);$('bmi-continue').hidden=!showBmi;
 $('question').hidden=!q||showBmi;
 if(q&&!showBmi){
  $('number').textContent='PREGUNTA '+q.number;$('question-text').textContent=q.text;$('answer').value='';$('choices').replaceChildren();
  let options=[];
  if(q.kind==='options')options=emergencyChoices(config.content);
  if(q.kind==='condition')options=q.choices;
  if(q.kind==='group')options=[{value:'1',label:'BEBE(1)'},{value:'2',label:'MUJER EMBARAZADA(2)'},{value:'3',label:'ADULTO TERCERA EDAD(3)'},{value:'4',label:'DISCAPACITADO(4)'},{value:'5',label:'NO ES UNA EMERGENCIA(5)'}];
  if(q.kind==='yesno')options=[{value:'si',label:'si'},{value:'no',label:'no'}];
  for(const o of options){const b=node('button','');b.type='button';if(o.question)b.append(node('strong',o.label),node('span',o.question,'option-question'));else b.textContent=o.label;b.addEventListener('click',()=>submit(o.value));$('choices').append(b);}
  if(!session.alert)requestAnimationFrame(()=>$('answer').focus({preventScroll:true}));
 }
 if(showBmi)requestAnimationFrame(()=>{$('bmi-result').focus({preventScroll:true});$('bmi-result').scrollIntoView({block:'start',behavior:'smooth'});});
 $('answers').replaceChildren();
 for(const a of session.answers){
  const article=document.createElement('article');article.append(node('strong',a.number+'. '+a.question),node('p',a.text));
  const b=node('button','Corregir desde aquí','secondary');b.addEventListener('click',()=>{if(!confirm('Volverás a esta pregunta y responderás nuevamente las posteriores. El historial se conservará en la exportación.'))return;operation(async()=>{session=await api('/api/sessions/'+session.id+'/edit',{expectedRevision:session.revision,questionId:a.key});render();});});article.append(b);$('answers').append(article);
 }
 $('extra-answers').replaceChildren();for(const [i,item] of (session.extraInformation||[]).entries())$('extra-answers').append(node('strong','Información extra '+(i+1)),node('p',item.text));
 $('orientation').hidden=!eligible(session);$('generated').replaceChildren();$('generate').hidden=Boolean(session.orientation);
 $('result-institutions').hidden=!session.orientation;
 $('result-hospital-links').replaceChildren();
 if(session.orientation)for(const [i,h] of config.content.hospitals.entries()){const a=node('a',i===3?'HOSPITALES PUBLICOS DE QUINTAN ROO':h.label);a.href=h.url;a.target='_blank';a.rel='noopener noreferrer';$('result-hospital-links').append(a);}
 $('result-notice').hidden=!session.orientation;$('extra-controls').hidden=!session.orientation&&!(session.extraInformation?.length);
 if(session.orientation){
  $('generation-status').textContent='';
  for(const section of resultSections(session.orientation.result))$('generated').append(node('h3',section.title),node('p',section.text));
  $('result-notice').textContent=resultNotice(session.orientation.model);
 }else $('generation-status').textContent='';
 if(session.inputNotice)$('error').textContent=session.inputNotice;
}
async function generate(){
 $('generation-status').textContent='Se esta generando la respuesta espere por favor';
 try{session=await api('/api/sessions/'+session.id+'/orientation',{expectedRevision:session.revision});render();return true;}catch(e){$('generation-status').textContent=e.message;return false;}
}
async function submit(text){await operation(async()=>{
 session=await api('/api/sessions/'+session.id+'/answer',{questionId:session.pending.id,answer:text,expectedRevision:session.revision});render();
 if(eligible(session)&&session.consent&&config.llm.configured&&config.rag.ready)await generate();
 if(session.alert)$('alert').scrollIntoView({block:'start',behavior:'smooth'});
});}
$('answer-form').addEventListener('submit',e=>{e.preventDefault();submit($('answer').value);});
$('answer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!busy&&$('answer').value.trim())submit($('answer').value);}});
$('new').addEventListener('click',()=>operation(async()=>{session=await api('/api/sessions',{consent:true});bmiAcknowledged=null;render();}));
$('restart').addEventListener('click',()=>{session=null;bmiAcknowledged=null;sessionStorage.removeItem('checkia-paso23-id');render();});
$('reload').addEventListener('click',()=>operation(async()=>{session=await api('/api/sessions/'+session.id);render();}));
$('generate').addEventListener('click',()=>operation(generate));
$('bmi-continue').addEventListener('click',()=>{bmiAcknowledged=session.answers.at(-1)?.recordedAt;render();$('question').scrollIntoView({block:'start',behavior:'smooth'});});
$('extra-open').addEventListener('click',()=>{$('extra-form').hidden=false;$('extra-open').hidden=true;$('extra-text').focus();});
$('extra-cancel').addEventListener('click',()=>{$('extra-form').hidden=true;$('extra-open').hidden=false;});
$('extra-form').addEventListener('submit',e=>{e.preventDefault();operation(async()=>{
 session=await api('/api/sessions/'+session.id+'/extra',{text:$('extra-text').value,expectedRevision:session.revision});
 $('extra-text').value='';$('extra-form').hidden=true;$('extra-open').hidden=false;
 $('extra-status').textContent='Información añadida al relato original.';render();await generate();
});});
$('download').addEventListener('click',()=>operation(async()=>{const data=await api('/api/sessions/'+session.id+'/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=node('a','');a.href=url;a.download='checkia-paso23-'+session.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
await operation(async()=>{config=await api('/api/config');const id=sessionStorage.getItem('checkia-paso23-id');if(id){try{session=await api('/api/sessions/'+id);if(session.protocolId!==config.content.version){session=null;sessionStorage.removeItem('checkia-paso23-id');}}catch{sessionStorage.removeItem('checkia-paso23-id');}}render();});
