let config, session, busy = false;
const $ = id => document.getElementById(id);
const normal = x => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
function node(tag, text, className) { const e = document.createElement(tag); e.textContent = text; if(className)e.className=className; return e; }
async function api(path, body, method = body ? 'POST' : 'GET') {
  const r = await fetch(path, {method, headers: body ? {'Content-Type':'application/json'} : {}, ...(body ? {body:JSON.stringify(body)} : {})});
  const data = await r.json(); if(!r.ok)throw new Error(data.error || 'No se pudo completar la operación.'); return data;
}
async function operation(fn) {
  if(busy)return; busy=true; $('error').textContent='';
  document.querySelectorAll('button').forEach(b => b.disabled=true);
  try{await fn();}catch(e){$('error').textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
function eligible(s) { return s.phase==='emergency' && s.alert?.requiresRag || s.phase==='complete' && normal(s.answers.find(a=>a.key==='answers_confirmation')?.text || '')==='si'; }
function render() {
  $('workspace').hidden=!session; $('start').hidden=Boolean(session);
  if(!session)return;
  sessionStorage.setItem('checkia-paso23-id',session.id);
  $('alert').hidden=!session.alert;
  $('advice').replaceChildren(); $('hospitals').replaceChildren();
  for(const p of session.alert?.content?.paragraphs || []) $('advice').append(node('p',p,/No hacer/i.test(p)?'do-not':''));
  if(session.alert)for(const h of config.content.hospitals){const a=node('a',h.label);a.href=h.url;a.target='_blank';a.rel='noopener noreferrer';$('hospitals').append(a);}
  const q=session.pending;
  $('question').hidden=!q; $('done').hidden=Boolean(q);
  if(q){
    $('number').textContent='PREGUNTA '+q.number; $('question-text').textContent=q.text;
    $('answer').value='';$('choices').replaceChildren();
    let options=[];
    if(q.kind==='options')options=[...config.content.emergencyOptions.map(o=>({value:o.value,label:o.question ? o.label+'\n'+o.question : o.label})),{value:'no',label:'No'}];
    if(q.kind==='condition')options=q.choices;
    if(q.kind==='group')options=[{value:'1',label:'bebe(1)'},{value:'2',label:'embarazada(2)'},{value:'3',label:'adulto tercera edad(3)'},{value:'4',label:'discapacitado(4)'},{value:'5',label:'no es emergencia(5)'}];
    if(q.kind==='yesno'||q.kind==='recheck')options=[{value:'si',label:'si'},{value:'no',label:'no'}];
    if(q.kind==='recheck')for(const text of config.content.recheckOptions)$('choices').append(node('p',text));
    for(const o of options){const b=node('button',o.label);b.type='button';b.addEventListener('click',()=>submit(o.value));$('choices').append(b);}
    requestAnimationFrame(()=>$('answer').focus({preventScroll:true}));
  }
  $('done-text').textContent=session.phase==='emergency'?'Ruta de emergencia seleccionada. Las indicaciones del documento aparecen arriba.':'Puedes revisar y descargar tus respuestas.';
  $('bmi-result').hidden=!session.bmi;
  $('bmi').textContent=session.bmi?.bmi!==null && session.bmi?.bmi!==undefined ? 'IMC calculado: '+session.bmi.display+' kg/m² · '+session.bmi.classification.replaceAll('_',' ')+(session.bmi.reference?'. Referencia: '+session.bmi.reference:'')+'. '+(session.bmi.note||'') : 'IMC no evaluable con las mediciones disponibles.';
  $('answers').replaceChildren();
  for(const a of session.answers){const article=document.createElement('article');article.append(node('strong',a.number+'. '+a.question),node('p',a.text));const b=node('button','Corregir desde aquí','secondary');b.addEventListener('click',()=>{if(!confirm('Volverás a esta pregunta y responderás nuevamente las posteriores. Las respuestas previas se conservarán en el historial exportable.'))return;operation(async()=>{session=await api('/api/sessions/'+session.id+'/edit',{expectedRevision:session.revision,questionId:a.key});render();});});article.append(b);$('answers').append(article);}
  $('orientation').hidden=!eligible(session);$('generated').replaceChildren();
  $('generate').hidden=Boolean(session.orientation);
  if(session.orientation){
    $('generation-status').textContent='Resultado generado · '+session.orientation.model;
    for(const [key,value] of Object.entries(session.orientation.result))if(value && key!=='fuentes_usadas' && key!=='aclaraciones_sugeridas')$('generated').append(node('h3',key.replaceAll('_',' ')),node('p',Array.isArray(value)?value.join('\n'):value));
    for(const source of session.orientation.rag.sources){const a=node('a',source.title+' — '+source.section);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';$('generated').append(node('p','Fuente recuperada:'),a);}
  }else $('generation-status').textContent=!session.consent?'Envío a OpenAI no autorizado para esta prueba.':!config.llm.configured?'OpenAI no configurado: el formulario funciona sin generación.':!config.rag.ready?'El corpus necesita preparación o revisión: '+config.rag.state:'Listo para solicitar orientación.';
}
async function generate(){
  $('generation-status').textContent='Consultando biblioteca y generando orientación…';
  try{session=await api('/api/sessions/'+session.id+'/orientation',{expectedRevision:session.revision});render();}catch(e){$('generation-status').textContent=e.message;}
}
async function submit(text){await operation(async()=>{session=await api('/api/sessions/'+session.id+'/answer',{questionId:session.pending.id,answer:text,expectedRevision:session.revision});render();if(eligible(session)&&session.consent&&config.llm.configured&&config.rag.ready)await generate();});}
$('answer-form').addEventListener('submit',e=>{e.preventDefault();submit($('answer').value);});
$('answer').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!busy&&$('answer').value.trim())submit($('answer').value);}});
$('new').addEventListener('click',()=>operation(async()=>{session=await api('/api/sessions',{consent:$('consent').checked});render();}));
$('restart').addEventListener('click',()=>{session=null;sessionStorage.removeItem('checkia-paso23-id');render();});
$('reload').addEventListener('click',()=>operation(async()=>{session=await api('/api/sessions/'+session.id);render();}));
$('generate').addEventListener('click',()=>operation(generate));
$('metrics').addEventListener('click',()=>operation(async()=>{$('metrics-output').textContent=JSON.stringify(await api('/api/metrics'),null,2);}));
$('download').addEventListener('click',()=>operation(async()=>{const data=await api('/api/sessions/'+session.id+'/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='checkia-paso23-'+session.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
await operation(async()=>{config=await api('/api/config');$('services').textContent='OpenAI: '+(config.llm.configured?'configurado':'sin configurar')+' · Biblioteca: '+config.rag.state;const id=sessionStorage.getItem('checkia-paso23-id');if(id){try{session=await api('/api/sessions/'+id);}catch{sessionStorage.removeItem('checkia-paso23-id');}}render();});
