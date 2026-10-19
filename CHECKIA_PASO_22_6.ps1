param([string]$ProjectRoot="C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference="Stop"
function ContentHash([string]$Text){$sha=[System.Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text.Replace("`r`n","`n").Trim())))).Replace('-','')}finally{$sha.Dispose()}}
$files=@(
@{Path='backend/src/admin.js';Previous='81A69EA939C769F2EE3DD7115BF7776BCCDDCFC2F2199BE6E8E74B3412851B49';Next='CE4D83FE47CA0D6DB5EDEE7A4385147D07F45D7B5EB6EDFF6F9D39F2E423E869';Content=@'
import {simpleExport,simpleText} from './simple-exports.js';
import {randomUUID} from 'node:crypto';
import {buildSummary} from './summary.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function requireAdmin(req,res,next){if(req.identity?.admin!==true)return res.status(403).json({error:'Esta cuenta no tiene permiso de administrador.'});next();}
const DAY=86400000,MAX_SCAN=200,MAX_METRICS=500;
const fields=['id','ownerUid','createdAt','updatedAt','expiresAt','status','messageCount','clinicalState.phase','clinicalState.protocolId','clinicalState.revision','orientation.status','orientation.basedOnRevision','orientation.model','orientation.usage','orientation.rag.status','orientation.rag.usage','orientationRun.status'];
const number=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:0;
function date(value,end=false){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(400,'Escribe una fecha válida.');
 const d=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(d)||new Date(d).toISOString().slice(0,10)!==value)fail(400,'Escribe una fecha válida.');
 // Calendario de Cancún (UTC-5); los documentos conservan milisegundos UTC.
 return d+5*3600000+(end?DAY:0);
}
export function parseFilters(input={},now=Date.now()){
 const allowed=new Set(['from','to','status','phase','owner','limit','cursor']);
 if(Object.keys(input).some(k=>!allowed.has(k)||typeof input[k]!=='string'))fail(400,'Filtro no válido.');
 const today=date(new Date(now-5*3600000).toISOString().slice(0,10));
 const from=input.from?date(input.from):today-29*DAY,to=input.to?date(input.to,true):today+DAY;
 if(from>=to||to-from>93*DAY)fail(400,'Selecciona un periodo de hasta 93 días, con inicio anterior al final.');
 const status=input.status||'all',phase=input.phase||'all',owner=input.owner||'';
 if(!['all','open','closed'].includes(status)||!['all','collecting','complete','safety_alert'].includes(phase))fail(400,'Estado no válido.');
 if(owner&&!/^[A-Za-z0-9_-]{1,128}$/.test(owner))fail(400,'El identificador de cuenta no es válido.');
 if(input.limit&&!/^\d+$/.test(input.limit))fail(400,'Límite no válido.');
 const limit=input.limit?Number(input.limit):20;if(!Number.isInteger(limit)||limit<1||limit>50)fail(400,'El límite debe ser de 1 a 50 consultas.');
 const normalized={from,to,status,phase,owner,limit};
 if(input.cursor){
  if(input.cursor.length>1800||!/^[A-Za-z0-9_-]+$/.test(input.cursor))fail(400,'Paginación no válida.');
  let c;try{c=JSON.parse(Buffer.from(input.cursor,'base64url').toString('utf8'));}catch{fail(400,'Paginación no válida.');}
  if(!c||!Number.isFinite(c.time)||c.time<from||c.time>=to||!/^[a-f0-9-]{36}$/.test(c.id)||c.filter!==filterKey(normalized))fail(400,'Los filtros cambiaron. Vuelve a la primera página.');
  normalized.after={time:c.time,id:c.id};
 }
 return normalized;
}
function filterKey(f){return JSON.stringify([f.from,f.to,f.status,f.phase,f.owner]);}
function row(d,id,now){return {id,ownerUid:d.ownerUid||'',createdAt:number(d.createdAt),updatedAt:number(d.updatedAt),expiresAt:number(d.expiresAt),expired:number(d.expiresAt)<=now,status:d.status==='closed'?'closed':'open',phase:d.clinicalState?.phase||'legacy',protocol:d.clinicalState?.protocolId||'legacy',messageCount:number(d.messageCount),orientationCurrent:d.orientation?.status==='ready'&&d.orientation.basedOnRevision===(d.clinicalState?.revision||0),orientationSaved:d.orientation?.status==='ready',model:typeof d.orientation?.model==='string'?d.orientation.model.slice(0,160):null,ragStatus:d.orientation?.rag?.status||'not_generated',tokens:{input:number(d.orientation?.usage?.inputTokens),output:number(d.orientation?.usage?.outputTokens),embedding:number(d.orientation?.rag?.usage?.inputTokens)},lastRunFailed:d.orientationRun?.status==='failed'};}
const matches=(r,f)=>(f.status==='all'||r.status===f.status)&&(f.phase==='all'||r.phase===f.phase)&&(!f.owner||r.ownerUid===f.owner);
export function csv(rows){
 const cell=v=>{let s=String(v??'');if(/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const data=[['consulta','creada_utc','estado','fase','vencida','mensajes','orientacion_vigente','modelo','estado_rag'],...rows.map(r=>[r.id,new Date(r.createdAt).toISOString(),r.status,r.phase,r.expired,r.messageCount,r.orientationCurrent,r.model||'',r.ragStatus])];
 return '\ufeff'+data.map(r=>r.map(cell).join(',')).join('\r\n');
}
export function publicSession(s,messages,now){return {id:s.id,createdAt:s.createdAt,updatedAt:s.updatedAt,expiresAt:s.expiresAt,status:s.status,expired:s.expiresAt<=now,clinicalState:s.clinicalState||null,messages,summary:buildSummary(s),orientation:s.orientation||null,orientationAttempts:number(s.orientationAttempts),lastOrientationRun:s.orientationRun?{status:s.orientationRun.status,updatedAt:s.orientationRun.updatedAt}:null};}
export function textExport(s){return simpleText(s);}
export class AdminService{
 constructor(db,{now=()=>Date.now()}={}){this.db=db;this.now=now;}
 async audit(actor,action,detail={}){
  try{await this.db.collection('checkia_admin_audit').doc(randomUUID()).create({actorUid:actor,action,createdAt:this.now(),...detail});}
  catch{fail(503,'No se pudo registrar el acceso administrativo. Intenta nuevamente.');}
 }
 query(f){let q=this.db.collection('checkia_sessions').where('createdAt','>=',f.from).where('createdAt','<',f.to).orderBy('createdAt','desc').orderBy('__name__','desc');if(f.after)q=q.startAfter(f.after.time,f.after.id);return q.select(...fields);}
 async scan(f,cap,wanted=Infinity){
  const snap=await this.query(f).limit(cap+1).get(),rows=[];let examined=0,last=null;
  for(const d of snap.docs){if(examined>=cap||rows.length>=wanted)break;const value=d.data(),id=d.id||d.ref.id;examined++;last={time:value.createdAt,id};const r=row(value,id,this.now());if(matches(r,f))rows.push(r);}
  const more=examined<snap.docs.length;
  return {rows,scanned:examined,partial:more,nextCursor:more&&last?Buffer.from(JSON.stringify({...last,filter:filterKey(f)})).toString('base64url'):null};
 }
 async list(actor,input={}){
  const f=parseFilters(input,this.now()),page=await this.scan(f,MAX_SCAN,f.limit);
  await this.audit(actor,'list',{scanned:page.scanned,returned:page.rows.length,filters:{from:f.from,to:f.to,status:f.status,phase:f.phase,...(f.owner?{ownerUid:f.owner}:{})}});
  return {...page,window:{from:f.from,to:f.to},limit:f.limit};
 }
 async metrics(actor,input={}){
  const f=parseFilters(input,this.now());if(f.after)fail(400,'Las métricas se calculan desde la primera página.');
  const page=await this.scan(f,MAX_METRICS),r=page.rows;
  const result={scanned:page.scanned,matched:r.length,partial:page.partial,maxScanned:MAX_METRICS,window:{from:f.from,to:f.to},counts:{open:r.filter(s=>s.status==='open').length,closed:r.filter(s=>s.status==='closed').length,complete:r.filter(s=>s.phase==='complete').length,alarms:r.filter(s=>s.phase==='safety_alert').length,expired:r.filter(s=>s.expired).length,orientationSaved:r.filter(s=>s.orientationSaved).length,orientationCurrent:r.filter(s=>s.orientationCurrent).length,ragMatched:r.filter(s=>s.orientationCurrent&&s.ragStatus==='matched').length,ragInsufficient:r.filter(s=>s.orientationCurrent&&s.ragStatus==='insufficient_evidence').length,lastRunFailed:r.filter(s=>s.lastRunFailed).length},storedTokens:r.reduce((a,s)=>({input:a.input+s.tokens.input,output:a.output+s.tokens.output,embedding:a.embedding+s.tokens.embedding}),{input:0,output:0,embedding:0})};
  await this.audit(actor,'metrics',{scanned:page.scanned,matched:r.length,partial:page.partial});return result;
 }
 async detail(actor,id,action='view',format=null){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))fail(404,'Consulta no disponible.');
  const ref=this.db.collection('checkia_sessions').doc(id),auditRef=this.db.collection('checkia_admin_audit').doc(randomUUID());
  return this.db.runTransaction(async tx=>{
   const snap=await tx.get(ref);if(!snap.exists)fail(404,'Consulta no disponible.');
   const messages=await tx.get(ref.collection('messages').orderBy('sequence').limit(201));
   if(messages.docs.length>200)fail(409,'La consulta supera el límite de lectura de esta etapa.');
   const s=snap.data();
   tx.create(auditRef,{actorUid:actor,action,createdAt:this.now(),sessionId:id,...(format?{format}:{})});
   return publicSession({...s,id},messages.docs.map(m=>m.data()),this.now());
  });
 }
 async exportSession(actor,id,format){if(!['json','txt'].includes(format))fail(400,'Selecciona JSON o TXT.');const s=await this.detail(actor,id,'export',format);return {filename:'checkia-'+id+'.'+format,type:format==='json'?'application/json; charset=utf-8':'text/plain; charset=utf-8',content:format==='json'?JSON.stringify(simpleExport(s),null,2):textExport(s)};}
 async exportPage(actor,input){const f=parseFilters(input,this.now()),page=await this.scan(f,MAX_SCAN,f.limit);await this.audit(actor,'export_page',{format:'csv',returned:page.rows.length,scanned:page.scanned});return {filename:'checkia-consultas.csv',type:'text/csv; charset=utf-8',content:csv(page.rows)};}
}
'@
},
@{Path='backend/src/simple-exports.js';Previous='';Next='53DB54824422913C65D02220B626BB12C241ABFE2B8D87A6EC284934E87529BE';Content=@'
const states={unknown:'Desconocido',declined:'Prefirió no responder',not_collected:'Sin responder',not_applicable:'No aplica',none_reported:'Ninguno referido'};
const title=s=>String(s||'Dato').replace(/ aproximad[oa]$/gi,'').replace(/ referidos?\b| referidas?\b/gi,'');
function datum(f){return {dato:title(f.label||f.question||f.key),respuesta:f.text??'Sin responder',...(states[f.status]?{estado:states[f.status]}:{}),...(f.measurement?{medida_registrada:f.measurement.value+' '+f.measurement.unit}:{}),...(f.provisional?{pendiente_de_confirmar:true}:{}),...((f.details||[]).length?{aclaraciones:f.details.map(datum)}:{})};}
export function simpleExport(s){
 const groups=s.summary?.groups||[],o=s.orientation,r=o?.result;
 return {formato:'checkia-resumen-v1',nota:'Resumen de datos referidos, sin confirmación clínica. El registro original permanece guardado.',estado:s.status==='closed'?'Cerrada':'Abierta',
 secciones:groups.map(g=>({titulo:g.id==='basic'?'Datos básicos':'Motivo, síntomas y antecedentes',datos:(g.fields||[]).filter(f=>!f.autoSkipped&&f.key!=='answers_confirmation').map(datum)})),
 por_revisar:(s.summary?.warnings||[]).map(w=>w.text),preguntas_pendientes:(s.summary?.pendingQuestions||[]).map(q=>q.text),
 señales:{respuesta:s.summary?.safety?.screenText??'Sin respuesta',alerta:s.summary?.safety?.alertText??null,nota:'La respuesta registrada no descarta una emergencia.'},
 orientacion:r?{vigencia:o.status==='ready'&&o.basedOnRevision===(s.clinicalState?.revision||0)?'Corresponde a la revisión actual':'Revisión anterior o resultado no vigente',general:r.orientacion_general??'',siguiente_paso:r.siguiente_paso??'',preguntas:r.preguntas_para_profesional||[],datos_por_aclarar:r.datos_por_aclarar||[]}:null,
 fuentes:[...new Map((o?.rag?.sources||[]).map(f=>[JSON.stringify([f.title,f.url]),{titulo:f.title,enlace:f.url}])).values()]};
}
export function simpleText(s){
 const d=simpleExport(s),lines=['CHECKIA — RESUMEN DE CONSULTA',d.nota,'Estado: '+d.estado];
 function add(f,indent=''){lines.push(indent+f.dato+': '+f.respuesta+(f.estado?' ('+f.estado+')':'')+(f.medida_registrada?' · Medida registrada: '+f.medida_registrada:'')+(f.pendiente_de_confirmar?' · Pendiente de confirmar':''));for(const a of f.aclaraciones||[])add(a,indent+'  ');}
 for(const section of d.secciones){if(!section.datos.length)continue;lines.push('',section.titulo.toUpperCase());section.datos.forEach(f=>add(f));}
 if(d.por_revisar.length||d.preguntas_pendientes.length)lines.push('','POR REVISAR',...d.por_revisar,...d.preguntas_pendientes);
 lines.push('','SEÑALES REGISTRADAS',d.señales.respuesta,d.señales.nota);if(d.señales.alerta)lines.push(d.señales.alerta);
 lines.push('','ORIENTACIÓN GUARDADA');if(!d.orientacion)lines.push('Sin orientación guardada.');else{const o=d.orientacion;lines.push(o.vigencia,'Orientación general: '+o.general,'Siguiente paso: '+o.siguiente_paso);if(o.datos_por_aclarar.length)lines.push('Datos por aclarar:',...o.datos_por_aclarar.map(t=>'- '+t));if(o.preguntas.length)lines.push('Preguntas para tu consulta:',...o.preguntas.map(t=>'- '+t));}
 if(d.fuentes.length)lines.push('','FUENTES',...d.fuentes.map(f=>f.titulo+' — '+f.enlace));
 return lines.join('\n');
}
'@
},
@{Path='frontend/src/main.jsx';Previous='343AC82352B5D21771C6D9EE2FCD8071107AFE08E219AA081DA8BDC8C46949A8';Next='B1E27AAE31C7248491481903E38A648412B1A5134440E5D42C3F85DA1F00CAC9';Content=@'
import {AdminPanel} from './AdminPanel.jsx';
import './admin.css';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase.js';
import './style.css';
import './refinement.css';
import './responsive.css';
import './experience.css';
import './mobile.css';
import {WelcomeIntro,HealthMark} from './Experience.jsx';
import {ConsultationSummary} from './ConsultationSummary.jsx';
import {createdInterview,friendlyApiError} from './interview-client.mjs';
import {OrientationPanel} from './OrientationPanel.jsx';
import {EmergencyHelp} from './EmergencyHelp.jsx';
const legacyQuestionNumbers = {alarm_screen:'1',reason:'2',age:'3',onset:'4',onset_when:'4.1',location:'5',severity:'6',associated:'7',history:'8',medications:'9',medications_formulation:'9.1',medications_amount:'9.2',medications_frequency:'9.3',allergies:'10',allergies_substance:'10.1',allergies_reaction:'10.2',allergies_when:'10.3'};
const currentQuestionNumbers = {name:'1',age:'2',sex:'3',weight:'4',height:'5',alarm_screen:'6',reason:'7',onset:'8',onset_when:'8.1',onset_evolution:'8.2',location:'9',location_detail:'9.1',severity:'10',associated:'11',history:'12',medications:'13',medications_formulation:'13.1',medications_amount:'13.2',medications_frequency:'13.3',allergies:'14',allergies_substance:'14.1',allergies_reaction:'14.2',allergies_since:'14.3',allergies_when:'14.4'};
const directQuestionNumbers={name:'1',age:'2',sex:'3',weight:'4',height:'5',alarm_screen:'6',reason:'7',onset:'8',onset_when:'8.1',location:'9',location_detail:'9.1',severity:'10',associated:'11',history:'12',medications:'13',medications_formulation:'13.1',medications_amount:'13.2',medications_frequency:'13.3',medications_since:'13.4',allergies:'14',allergies_substance:'14.1',allergy_reaction:'15',allergy_timing:'16',allergies_since:'16.1',allergies_when:'16.2'};
const revisedQuestionNumbers={...directQuestionNumbers,history_detail:'12.1',allergies:'15',allergy_reaction:'15.1',allergy_timing:'16'};
const betaQuestionNumbers={...revisedQuestionNumbers,location_description:'9.2',medications_identity:'13.1',remedies_use:'13.1',remedies_detail:'13.2',remedies_since:'13.3'};
const mobileQuestionNumbers={...betaQuestionNumbers,medications_details:'13.1',medications_knows_active:'13.2',medications_identity:'13.2.1',remedies_use:'13.1',remedies_detail:'13.1.1',remedies_since:'13.1.2',allergies_substance:'15.a',allergy_reaction:'15.1',allergy_timing:'15.2',answers_confirmation:'16'};
function App() {
  const inFlight = useRef(false), answerInput = useRef(null);
  function beginOperation(kind='') { if (inFlight.current) return false; inFlight.current = true; setBusy(true); setBusyOperation(kind); setErrorOperation(''); setError(''); return true; }
  function endOperation() { inFlight.current = false; setBusy(false); setBusyOperation(''); }
  function enterToSubmit(e) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    e.preventDefault();
    if (!inFlight.current && e.currentTarget.value.trim()) e.currentTarget.form?.requestSubmit();
  }
  const [adminAllowed,setAdminAllowed]=useState(false),[view,setView]=useState('consultations'),[accountInfo,setAccountInfo]=useState(null);
  const [showIntro,setShowIntro]=useState(false);
  const [user, setUser] = useState(null), [ready, setReady] = useState(false);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [busyOperation,setBusyOperation]=useState(''),[errorOperation,setErrorOperation]=useState('');
  const [authMode,setAuthMode]=useState('login'),[confirmPassword,setConfirmPassword]=useState(''),[authNotice,setAuthNotice]=useState('');
  const [sessions, setSessions] = useState([]), [selected, setSelected] = useState(null), [message, setMessage] = useState('');
  const [chosenId, setChosenId] = useState('');
  const [correctionKey, setCorrectionKey] = useState(''), [correctionText, setCorrectionText] = useState('');
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); if(!current)setShowIntro(false); setAdminAllowed(false);setView('consultations');setAccountInfo(null); setReady(true); setPassword('');setConfirmPassword('');setAuthMode('login'); setSessions([]); setSelected(null); setMessage(''); setChosenId(''); setCorrectionKey(''); setCorrectionText('');  }), []);
  useEffect(()=>{let active=true;if(!user)return;api('/me').then(data=>{if(active){setAdminAllowed(data.admin===true);setAccountInfo(data);}}).catch(()=>{});return()=>{active=false;};},[user]);
  async function refreshPermissions(){const current=auth.currentUser;if(!current)return;await current.getIdToken(true);const data=await api('/me');setAdminAllowed(data.admin===true);setAccountInfo(data);if(!data.admin)setView('consultations');}
  async function downloadAdmin(path){
    const current=auth.currentUser;if(!current)throw new Error('Inicia sesión nuevamente.');
    const token=await current.getIdToken();const response=await fetch('/api'+path,{headers:{Authorization:'Bearer '+token}});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(friendlyApiError(response.status,data.error,path.endsWith('/orientation')?'orientation':''));}
    const blob=await response.blob();if(auth.currentUser?.uid!==current.uid)throw new Error('La cuenta cambió durante la descarga.');
    const match=response.headers.get('content-disposition')?.match(/filename="([a-zA-Z0-9_.-]+)"/),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=match?.[1]||'checkia-descarga.txt';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function login(e) {
    e.preventDefault(); if (!beginOperation()) return;setAuthNotice('');
    try {
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setShowIntro(true);
    } catch (e) {
      const known = {
        'auth/invalid-credential': 'Correo o contraseña incorrectos. Usa una cuenta con contraseña configurada en Firebase; una cuenta creada solo con Google puede no tenerla.',
        'auth/user-not-found': 'Correo o contraseña incorrectos. Usa una cuenta con contraseña configurada en Firebase; una cuenta creada solo con Google puede no tenerla.',
        'auth/wrong-password': 'Correo o contraseña incorrectos. Usa una cuenta con contraseña configurada en Firebase; una cuenta creada solo con Google puede no tenerla.',
        'auth/invalid-email': 'Revisa el formato del correo.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente más tarde.',
        'auth/network-request-failed': 'No se pudo conectar con Firebase. Revisa tu conexión.',
        'auth/operation-not-allowed': 'El acceso con correo está deshabilitado en Firebase. Activa Authentication → Método de acceso → Correo electrónico/contraseña y guarda.',
        'auth/user-disabled': 'Esta cuenta está deshabilitada en Firebase.'
      };
      setError(known[e.code] || 'No se pudo iniciar sesión con correo. Código: ' + (e.code || 'no disponible'));
    } finally { setPassword(''); endOperation(); }
  }
  function changeAuthMode(mode) {
    if(inFlight.current) return;
    setAuthMode(mode);setPassword('');setConfirmPassword('');setError('');setAuthNotice('');
  }
  async function register(e) {
    e.preventDefault();if(!beginOperation()) return;setAuthNotice('');
    try {
      if(password.length<12) throw new Error('Usa una contraseña de al menos 12 caracteres. Una frase de varias palabras puede ser fácil de recordar.');
      if(password!==confirmPassword) throw new Error('Las contraseñas no coinciden.');
      await setPersistence(auth,browserSessionPersistence);
      auth.languageCode='es';
      await createUserWithEmailAndPassword(auth,email.trim(),password);
      setShowIntro(true);
      setAuthNotice('Cuenta creada. Ya puedes crear una entrevista de prueba.');
    } catch(e) {
      const errors={'auth/email-already-in-use':'No se pudo crear una cuenta con ese correo. Intenta iniciar sesión o recuperar la contraseña.',
        'auth/weak-password':'La contraseña no cumple la política de Firebase. Elige una frase más larga.',
        'auth/password-does-not-meet-requirements':'La contraseña no cumple la política configurada en Firebase.',
        'auth/operation-not-allowed':'Activa Correo electrónico/contraseña en Firebase Authentication.',
        'auth/invalid-email':'Revisa el correo electrónico.',
        'auth/network-request-failed':'No se pudo conectar con Firebase.',
        'auth/too-many-requests':'Demasiados intentos. Intenta más tarde.'};
      setError(errors[e.code] || (e.code ? 'No se pudo crear la cuenta. Código: '+e.code : e.message));
    } finally {setPassword('');setConfirmPassword('');endOperation();}
  }
  async function recoverPassword(e) {
    e.preventDefault();if(!beginOperation()) return;setAuthNotice('');
    const notice='Si ese correo puede recibir recuperación, recibirás un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.';
    try {
      auth.languageCode='es';await sendPasswordResetEmail(auth,email.trim());setAuthNotice(notice);
    } catch(e) {
      if(e.code==='auth/user-not-found') setAuthNotice(notice);
      else setError({'auth/invalid-email':'Revisa el correo electrónico.','auth/network-request-failed':'No se pudo conectar con Firebase.','auth/too-many-requests':'Demasiados intentos. Intenta más tarde.'}[e.code] || 'No se pudo solicitar la recuperación. Intenta nuevamente.');
    } finally {setPassword('');setConfirmPassword('');endOperation();}
  }
  async function loginGoogle() {
    if (!beginOperation()) return; setAuthNotice('');
    try {
      await setPersistence(auth, browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      setShowIntro(true);
      setEmail('');
    } catch (e) {
      const known = {
        'auth/popup-blocked': 'Permite las ventanas emergentes de CHECKIA y vuelve a pulsar Continuar con Google.',
        'auth/unauthorized-domain': 'Este dominio no está autorizado. Revisa Authentication → Configuración → Dominios autorizados en Firebase.',
        'auth/operation-not-allowed': 'Habilita Google en los proveedores de Authentication de Firebase.',
        'auth/account-exists-with-different-credential': 'Este correo ya tiene otro método de acceso. Inicia sesión con ese método; la vinculación con Google debe hacerse desde la cuenta autenticada.',
        'auth/network-request-failed': 'No se pudo conectar con Google. Revisa tu conexión.',
        'auth/user-disabled': 'Esta cuenta está deshabilitada.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta nuevamente más tarde.'
      };
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) {
        setError(known[e.code] || 'No se pudo iniciar sesión con Google. Revisa la configuración de Firebase.');
      }
    } finally { setPassword(''); endOperation(); }
  }
  async function logout() {
    if (!beginOperation()) return;
    try { await signOut(auth); setEmail(''); setPassword(''); setConfirmPassword('');setAuthNotice(''); } catch { setError('No se pudo cerrar sesión. Intenta nuevamente.'); }
    finally { endOperation(); }
  }
  async function api(path, method = 'GET', body) {
    const current = auth.currentUser;
    if (!current) throw new Error('Inicia sesión nuevamente.');
    const token = await current.getIdToken();
    const response = await fetch('/api' + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(friendlyApiError(response.status,data.error,path.endsWith('/orientation')?'orientation':'')); }
    if (auth.currentUser?.uid !== current.uid) throw new Error('La cuenta cambió durante la solicitud.');
    return response.status === 204 ? null : response.json();
  }
  async function action(fn,kind='') {
    if (!beginOperation(kind)) return;
    try { await fn(); } catch(e) { setErrorOperation(kind); setError(e instanceof TypeError ? 'No se pudo conectar. Revisa tu conexión e inténtalo nuevamente.' : (e.message || 'No se pudo completar la operación.')); }
    finally { endOperation(); }
  }
  async function listSessions() { const data = await api('/sessions'); setSessions(data.sessions); }
  const createSession = () => action(async () => {
    const healthResponse = await fetch('/api/health');
    const health = await healthResponse.json().catch(() => ({}));
    if (!healthResponse.ok || health.interview !== 'intake-demo-v8' || !(health.validationVersion >= 16) || health.safetyVersion !== 'alarm-demo-v2') {
      throw new Error('El servicio de entrevistas no está disponible en este momento. Actualiza la página e inténtalo nuevamente.');
    }
    const data = await api('/sessions', 'POST');
    const session=createdInterview(data,health.interview);
    setSelected(session); setView('consultations'); setChosenId(session.id); setMessage(''); setCorrectionKey(''); setCorrectionText('');
    await listSessions();
  },'create');
  const generateOrientation=body=>action(async()=>{const id=selected.id;await api('/sessions/'+id+'/orientation','POST',body);setSelected(await api('/sessions/'+id));},'orientation');
  const beginAdditional=mode=>action(async()=>{const id=selected.id;await api('/sessions/'+id+(mode==='review'?'/safety-review':'/clarifications'),'POST',{expectedRevision:selected.clinicalState.revision||0,requestId:crypto.randomUUID()});setSelected(await api('/sessions/'+id));setMessage('');setCorrectionKey('');setCorrectionText('');});
  const loadSession = id => action(async () => { setSelected(await api('/sessions/' + id)); setChosenId(id); setMessage(''); setCorrectionKey(''); setCorrectionText(''); });
  const sendMessage = e => { e.preventDefault(); if (!message.trim() || !selected || inFlight.current) return; action(async () => {
    const id = selected.id;
    await api('/sessions/' + id + '/messages','POST',{ message: message.trim(), requestId: crypto.randomUUID(), questionId: selected.clinicalState?.pendingQuestions?.[0]?.id });
    setMessage(''); setSelected(await api('/sessions/' + id));
  }); };
  const closeSession = () => action(async () => { await api('/sessions/' + selected.id + '/close','POST'); setSelected(await api('/sessions/' + selected.id)); await listSessions(); });
  const deleteSession = id => {
    if (!window.confirm('¿Eliminar esta consulta de prueba y sus mensajes? Esta acción no se puede deshacer.')) return;
    action(async () => { await api('/sessions/' + id,'DELETE'); if(selected?.id === id) setSelected(null); setChosenId(''); setMessage(''); await listSessions(); });
  };
  const correctAnswer = e => {
    e.preventDefault();
    if (!correctionKey || !correctionText.trim()) return;
    action(async()=>{
      const id=selected.id;
      await api('/sessions/'+id+'/corrections','POST',{factKey:correctionKey,answer:correctionText.trim(),expectedRevision:selected.clinicalState.revision || 0,requestId:crypto.randomUUID()});
      setSelected(await api('/sessions/'+id)); setCorrectionKey(''); setCorrectionText(''); setMessage('');
    });
  };
  const cleanProtocol=selected?.clinicalState?.protocolId==='intake-demo-v8';
  const freeTextProtocol=['intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const mobileProtocol=selected?.clinicalState?.protocolId==='intake-demo-v6';
  const betaProtocol = selected?.clinicalState?.protocolId === 'intake-demo-v5';
  const revisedProtocol = ['intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const directProtocol = ['intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const currentProtocol = ['intake-demo-v2','intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const interview = ['intake-demo-v1','intake-demo-v2','intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const questionNumbers = {...(cleanProtocol ? {...mobileQuestionNumbers,allergy_timing:'16',family_history:'17',family_history_condition:'17.a',family_history_relative:'17.1',answers_confirmation:'18',location_description:'9.2'} : freeTextProtocol ? {...mobileQuestionNumbers,family_history:'17',family_history_condition:'17.a',family_history_relative:'17.1'} : mobileProtocol ? mobileQuestionNumbers : betaProtocol ? betaQuestionNumbers : revisedProtocol ? revisedQuestionNumbers : directProtocol ? directQuestionNumbers : currentProtocol ? currentQuestionNumbers : legacyQuestionNumbers),alarm_recheck:'R',...Object.fromEntries((selected?.clinicalState?.additionalAnswers||[]).map(a=>[a.key,a.number])),...Object.fromEntries((selected?.clinicalState?.pendingQuestions||[]).filter(q=>q.number).map(q=>[q.id,q.number]))};
  const numbered = (key,text) => questionNumbers[key] ? `${questionNumbers[key]}. ${text}` : text;
  const totalAnswers = freeTextProtocol ? 17 : mobileProtocol ? 16 : directProtocol ? 15 : currentProtocol ? 13 : 9;
  const alarm = selected?.clinicalState?.assessment?.type === 'safety_alert';
  const safety = selected?.clinicalState?.safety;
  const pending = interview ? selected.clinicalState.pendingQuestions?.[0] : null;
  const canAnswer = selected?.status === 'open' && interview && selected.clinicalState.phase === 'collecting' && pending;
  const answers = selected?.clinicalState?.facts?.length || 0;
  const lastMessage = selected?.messages?.at(-1);
  const statusLabel = status => ({reported:'Referido por el usuario',unknown:'Desconocido',declined:'Prefirió no responder',not_applicable:'No corresponde',none_reported:'Ninguno referido'}[status] || status);
  const questionNumber = questionNumbers[pending?.id] || '?';
  const knownQuestions = [...(selected?.clinicalState?.additionalAnswers||[]).map(a=>({id:a.key,text:a.question})),...(selected?.clinicalState?.facts || []).flatMap(f => [{id:f.key,text:f.question}, ...(f.clarifications || []).map(d=>({id:d.key,text:d.question}))]), ...(selected?.clinicalState?.pendingQuestions || [])];
  const historyQuestion = m => m.role === 'assistant' ? (m.nextQuestionId || knownQuestions.find(q=>m.text === q.text || m.text.endsWith(q.text))?.id) : null;
  useEffect(() => { if (!busy && canAnswer) answerInput.current?.focus({preventScroll:true}); }, [busy, canAnswer, selected?.id, pending?.id]);
  useEffect(()=>{
    const input=answerInput.current;if(!input)return;
    input.style.height='auto';
    const visibleHeight=window.visualViewport?.height||window.innerHeight;
    input.style.height=Math.min(Math.max(input.scrollHeight,72),Math.max(80,visibleHeight*.22))+'px';
  },[message,pending?.id]);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const update=()=>{
      const focused=document.activeElement?.id==='answer'&&window.matchMedia('(max-width:900px)').matches;
      document.body.classList.toggle('answer-focus',focused);
      document.documentElement.style.setProperty('--visible-height',(viewport?.height||window.innerHeight)+'px');
      document.documentElement.style.setProperty('--visible-top',(viewport?.offsetTop||0)+'px');
    };
    const deferred=()=>requestAnimationFrame(update);
    document.addEventListener('focusin',update);document.addEventListener('focusout',deferred);
    viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);update();
    return()=>{document.body.classList.remove('answer-focus');document.removeEventListener('focusin',update);document.removeEventListener('focusout',deferred);viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
  const clarification = lastMessage?.role === 'assistant' && lastMessage.kind === 'clarification' && lastMessage.nextQuestionId===pending?.id && lastMessage.text!==pending?.text && !lastMessage.text.endsWith(pending?.text||'__none__') ? lastMessage.text : '';
  if(user&&showIntro)return <WelcomeIntro onDone={()=>{setShowIntro(false);requestAnimationFrame(()=>document.getElementById('main-content')?.focus({preventScroll:true}));}}/>;
  return <main className={user ? 'workspace' : 'login-page'}>
    <a className="skip-link" href="#main-content">Ir al contenido</a>
    <header className="topbar">
      <div><p className="eyebrow">ASISTENTE VIRTUAL</p><h1>check<span>IA</span></h1></div>
      {user && <div className="account"><span>{user.email}</span><button className="secondary" disabled={busy} onClick={logout}>Cerrar sesión</button></div>}
    </header>
    {authNotice && <div className="notice success" role="status">{authNotice}</div>}
    {error && <div className="notice error" role="alert">{error}</div>}
    {user&&view==='consultations'&&selected?.status==='closed'&&<div className="consultation-heading compact-heading closed-consultation-heading"><div className="consultation-title"><h2>Diagnóstico cerrado</h2><span className="session-id">Consulta {selected.id.slice(0,8)}</span></div></div>}
    {!ready ? <p role="status">Comprobando acceso…</p> : user ? (<div className={"layout"+(!selected&&view==='consultations'?" waiting-consultation":" has-content")}>
      {view==='consultations'&&selected&&<div className="primary-orientation">
          <OrientationPanel key={selected.id+":"+(selected.clinicalState?.revision||0)} session={selected} busy={busy} generating={busyOperation==='orientation'} error={errorOperation==='orientation'?error:''} onGenerate={generateOrientation} onBegin={beginAdditional}/>
      </div>}
      <div className="controls-column">
      <aside className={"panel controls"+(selected?" has-session":"")}>
        <h2>Consultas</h2><p className="muted">Empieza el diagnóstico de checkIA</p>
        <button disabled={busy} aria-busy={busyOperation==='create'} onClick={createSession}>Nueva consulta</button>
        {busyOperation==='create'&&<p className="request-status" role="status">Preparando tu consulta…</p>}
        {errorOperation==='create'&&error&&<p className="operation-error" role="alert">{error}</p>}
        <details className="consultation-library"><summary>Consultas guardadas</summary><div className="history-picker">
          <button className="secondary" disabled={busy} onClick={() => action(listSessions)}>Actualizar mis consultas</button>
          <label htmlFor="session-picker">Consulta guardada</label>
          <select id="session-picker" value={chosenId} onChange={e=>setChosenId(e.target.value)} disabled={busy}>
            <option value="">Selecciona una consulta</option>
            {selected && !sessions.some(s=>s.id === selected.id) && <option value={selected.id}>{selected.id} · {selected.status === 'closed' ? 'Cerrada' : 'Abierta'}</option>}
            {sessions.map(s=><option key={s.id} value={s.id}>{s.id.slice(0,8)} · {s.status === 'closed' ? 'Cerrada' : 'Abierta'} · {new Date(s.createdAt).toLocaleString('es-MX')}</option>)}
          </select>
          <button className="secondary" disabled={busy || !chosenId} onClick={()=>loadSession(chosenId)}>Abrir consulta</button>
          <p className="small muted">Se muestran hasta 20 consultas.</p>
        </div></details>
        <p className="small muted">Puedes retomar tus consultas durante 24 horas.</p>
      </aside>
      <nav className="admin-nav" aria-label="Secciones de CHECKIA"><button type="button" className="secondary" disabled={busy} aria-pressed={view==='consultations'} onClick={()=>setView('consultations')}>Mis consultas</button>{adminAllowed&&<button type="button" className="secondary" disabled={busy} aria-pressed={view==='admin'} onClick={()=>setView('admin')}>Panel de administrador</button>}</nav>
      </div>
      {view==='admin'&&adminAllowed?<div id="main-content" tabIndex={-1}><AdminPanel key={user.uid} api={api} download={downloadAdmin}/></div>:<section id="main-content" tabIndex={-1} className={"panel consultation"+(!selected?" no-selected-consultation":"")} aria-label="Entrevista">
        
        {!selected ? null : <>
          {selected.status!=='closed'&&<div className="consultation-heading compact-heading"><div className="consultation-title"><h2>Diagnóstico</h2><span className="session-id">Consulta {selected.id.slice(0,8)}</span></div></div>}
          {interview && answers===0 && !selected.messages?.length && <p className="welcome welcome-compact" role="note"><HealthMark/><span>¡Hola! Soy tu asistente virtual CHECKIA. Responde estas preguntas para comenzar.</span></p>}
          {interview && !currentProtocol && <p className="small muted">Esta consulta conserva sus preguntas originales.</p>}
          {alarm && <div className="notice error" role="alert"><h3>Posible señal de alarma</h3><EmergencyHelp key={selected.id}/><p>{selected.clinicalState.assessment.reply}</p><ul>{selected.clinicalState.assessment.signals.map(signal=><li key={signal.id}>{signal.label}</li>)}</ul><p className="small">Prototipo sin validación clínica. La alerta se conserva al recargar y la entrevista no continúa.</p><details><summary>Fuentes de estas señales</summary>{selected.clinicalState.assessment.signals.map(signal=><p key={signal.id}><a href={signal.source.url} target="_blank" rel="noopener noreferrer">{signal.source.title}</a></p>)}</details></div>}
          {!alarm && interview && safety?.status === 'unknown' && <div className="notice">La comprobación inicial quedó como desconocida. No se han descartado señales de alarma y la urgencia sigue sin determinar.</div>}
          {!alarm && interview && !safety && <div className="notice">Esta consulta anterior no incluye la comprobación inicial de señales de alarma.</div>}
          {canAnswer ? <div className={"question-card"+(pending.id==='alarm_screen'?' alarm-question-compact':'')}>
            <button type="button" className="finish-writing secondary" onClick={()=>{answerInput.current?.blur();document.body.classList.remove('answer-focus');}}>Listo</button><p className="eyebrow">{'PREGUNTA ' + questionNumber + (pending.id==='alarm_recheck' ? ' · SEÑALES ACTUALES' : pending.id==='alarm_screen' ? ' · COMPROBACIÓN INICIAL' : pending.parentKey ? ' · ACLARACIÓN' : '')}</p><h3 style={{whiteSpace:'pre-line'}}>{pending.text}</h3>
            {clarification && <div className="notice" role="status">{clarification}</div>}
            <form onSubmit={sendMessage}>
              {error && <p className="inline-answer-error" role="alert">{error}</p>}
              <label htmlFor="answer">Tu respuesta</label>
              <textarea enterKeyHint="send" ref={answerInput} onKeyDown={enterToSubmit} id="answer" value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} required disabled={busy} rows={3} inputMode={!freeTextProtocol && revisedProtocol && ['age','weight','height'].includes(pending.id) ? 'decimal' : 'text'} placeholder={freeTextProtocol && ['age','weight','height'].includes(pending.id) ? 'Escribe tu respuesta con texto o números.' : revisedProtocol && pending.id === 'height' ? 'Solo número en cm, por ejemplo 175.' : revisedProtocol && pending.id === 'weight' ? 'Solo número en kg, por ejemplo 70.' : pending.id === 'name' ? 'Solo tus nombres o un alias, por ejemplo Luis Alejandro.' : pending.id === 'reason' ? 'Por ejemplo: molestia en el abdomen.' : 'Escribe tu respuesta a la pregunta actual.'}/>
              <div className="answer-footer"><button type="submit" onPointerDown={e=>e.preventDefault()} onMouseDown={e=>e.preventDefault()} disabled={busy || !message.trim()}>Guardar respuesta</button></div>
            </form>
          </div> : alarm ? <p className="muted">Entrevista detenida. Puedes revisar el historial o cerrar esta consulta de prueba.</p> : selected.status === 'closed' ? null : !interview ? <div className="notice">Esta consulta no contiene una entrevista. Pulsa “Nueva consulta” para comenzar.</div> : selected.clinicalState.phase === 'complete' ? <p className="completion-state">Respuestas guardadas.</p> : <div className="notice error">No se pudo cargar la siguiente pregunta. Pulsa “Recargar mensajes” e inténtalo nuevamente.</div>}

          {selected.summary?.supported && <ConsultationSummary summary={selected.summary} canCorrect={selected.status==='open' && !alarm && !selected.clinicalState.clarificationContext && !selected.clinicalState.pendingQuestions?.[0]?.customFlow} onCorrect={key=>{setCorrectionKey(key);setCorrectionText(selected.clinicalState.facts.find(f=>f.key===key)?.text || '');document.getElementById('answers-corrections')?.setAttribute('open','');setTimeout(()=>document.getElementById('correction-text')?.focus(),0);}}/>}
          {selected.clinicalState.qualityEvents?.length > 0 && <details className="technical"><summary>Respuestas que necesitaron aclaración ({selected.clinicalState.qualityEvents.length})</summary>
            <p className="small muted">Estas respuestas permanecen en el historial; no sustituyen el dato finalmente registrado.</p>
            {selected.clinicalState.qualityEvents.map((event,i)=><div key={event.sourceMessageId || i}><p><strong>Pregunta {questionNumbers[event.questionId] || event.questionId}</strong><br/>{event.text}</p><p className="small muted">{event.reason}</p></div>)}
          </details>}
          {interview && <details id="answers-corrections" className="technical"><summary>Respuestas registradas y correcciones</summary>
            {selected.clinicalState.facts.filter(f=>!f.autoSkipped).map(f=><div key={f.key} style={{overflowWrap:'anywhere'}}><p><strong>{numbered(f.key, f.question)}</strong><br/>{f.text}{f.autoSkipped && <span className="small muted"> · No se preguntó por tu respuesta anterior</span>}{f.measurement && <span className="small muted"> · Aproximado: {f.measurement.value} {f.measurement.unit}</span>} <span className="small muted">({statusLabel(f.status)}){f.revisions?.length ? ' · corregida '+f.revisions.length+' vez/veces' : ''}</span></p>
              {f.clarifications?.map(d=><p className="small" key={d.key}><strong>{numbered(d.key, d.question)}</strong><br/>{d.text} <span className="muted">({statusLabel(d.status)})</span></p>)}
            </div>)}
            {selected.status === 'open' && selected.clinicalState.facts.length>0 && !alarm && !selected.clinicalState.clarificationContext && !selected.clinicalState.pendingQuestions?.[0]?.customFlow && <form onSubmit={correctAnswer}>
              <label htmlFor="correction-key">Respuesta que deseas corregir</label><select id="correction-key" disabled={busy} value={correctionKey} onChange={e=>{setCorrectionKey(e.target.value);setCorrectionText(selected.clinicalState.facts.find(f=>f.key===e.target.value)?.text || '');}}><option value="">Selecciona una respuesta</option>{selected.clinicalState.facts.filter(f=>!f.autoSkipped).map(f=><option key={f.key} value={f.key}>{numbered(f.key, f.question)}</option>)}</select>
              {correctionKey && <><label htmlFor="correction-text">Respuesta corregida</label><textarea onKeyDown={enterToSubmit} id="correction-text" disabled={busy} required maxLength={4000} value={correctionText} onChange={e=>setCorrectionText(e.target.value)} rows={3}/><p className="small muted">El historial original se conserva. Una corrección puede requerir nuevas aclaraciones.</p><button type="submit" disabled={busy || !correctionText.trim()}>Guardar corrección</button></>}
            </form>}
            {selected.clinicalState.clarificationContext && <p className="small muted">Termina la aclaración pendiente antes de corregir otra respuesta.</p>}
          </details>}
          <div className="consultation-actions"><button className="secondary" disabled={busy || selected.status !== 'open'} onClick={closeSession}>Cerrar consulta</button><button className="danger" disabled={busy} onClick={()=>deleteSession(selected.id)}>Eliminar consulta</button></div>
          {selected.orientation?.status==='ready'&&selected.orientation.basedOnRevision===(selected.clinicalState?.revision||0)&&<footer className="orientation-attribution"><span>Orientación médica</span><p>Orientación generada con IA. Revísala con un profesional de salud.</p></footer>}
          <div className="consultation-footer"><button type="button" className="secondary reload-messages" disabled={busy} onClick={()=>loadSession(selected.id)}>Recargar mensajes</button></div>
        </>}
      </section>}
    </div>) : <section id="main-content" tabIndex={-1} className="panel login-card"><h2>{authMode==='register'?'Crear cuenta':authMode==='reset'?'Recuperar contraseña':'Inicia sesión'}</h2>
      <p className="muted">{authMode==='reset'?'Escribe el correo de tu cuenta para solicitar el enlace de recuperación.':'Accede para crear y recuperar tus consultas de prueba.'}</p>
      <form onSubmit={authMode==='register'?register:authMode==='reset'?recoverPassword:login}>
        <label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
        {authMode!=='reset' && <><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete={authMode==='register'?'new-password':'current-password'} minLength={authMode==='register'?12:undefined} maxLength={authMode==='register'?128:undefined} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></>}
        {authMode==='register' && <><p className="auth-help">Usa una frase de varias palabras que puedas recordar, de al menos 12 caracteres. Firebase puede solicitar requisitos adicionales.</p><label htmlFor="confirm-password">Repite la contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={busy}/></>}
        <button type="submit" disabled={busy}>{busy?'Procesando…':authMode==='register'?'Crear mi cuenta':authMode==='reset'?'Enviar enlace de recuperación':'Iniciar sesión con correo'}</button>
      </form>
      <div className="auth-options">
        {authMode!=='register' && <button type="button" className="secondary" disabled={busy} onClick={()=>changeAuthMode('register')}>Crear cuenta</button>}
        {authMode!=='reset' && <button type="button" className="secondary" disabled={busy} onClick={()=>changeAuthMode('reset')}>Olvidé mi contraseña</button>}
        {authMode!=='login' && <button type="button" className="secondary" disabled={busy} onClick={()=>changeAuthMode('login')}>Volver a iniciar sesión</button>}
      </div>
      <div className="divider">o</div><button type="button" className="secondary" disabled={busy} onClick={loginGoogle}>Continuar con Google</button>
    </section>}

    {user && <details className="account-settings"><summary>Mi cuenta</summary><p>Identificador de cuenta (UID): {accountInfo?.uid||user.uid}</p><p>{adminAllowed?'Permiso de administrador activo.':'Cuenta de usuario.'}</p><button type="button" className="secondary" disabled={busy} onClick={()=>action(refreshPermissions)}>Actualizar permisos</button></details>}
    {busy && !['create','orientation'].includes(busyOperation) && <p className="busy-status" role="status">Procesando…</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
'@
},
@{Path='frontend/src/mobile.css';Previous='D75C8CB9C9A834B663871B9EF4CFDDB1345DFA744CFB602F5D1F464F870B086C';Next='D77D5FD23E0EEDF5989880ABED01C3E0C973672DFE83C7AD8EF000D873690B2E';Content=@'
/* CHECKIA paso 22: prioridad a lectura y escritura en móvil. */
.workspace,.login-page{max-width:1140px;padding-top:14px}
.topbar{padding-bottom:10px;margin-bottom:12px;gap:10px}
.topbar h1{font-size:1.3rem;line-height:1.1;letter-spacing:-.04em;margin:0}
.topbar .eyebrow{font-size:.6rem;letter-spacing:.12em;margin:0 0 3px}
.account{gap:6px;align-items:flex-end}.account span{font-size:.68rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.account button{font-size:.72rem;padding:6px 9px;min-height:40px;border-radius:9px}
button.secondary{background:rgba(217,235,250,.38);border:1px solid rgba(76,124,166,.23);color:#1a4e76;box-shadow:none}
button:not(.secondary):not(.danger){background:rgba(19,100,158,.88)}
button.danger{background:rgba(255,245,246,.55)}
button:hover:not(:disabled){filter:brightness(.96)}
button:focus-visible,summary:focus-visible{outline:3px solid #377eaf;outline-offset:2px}
.layout{gap:14px}.panel{border-radius:14px}.consultation{padding:16px 18px}.controls{padding:16px}
.controls h2{font-size:1rem}.controls p{font-size:.8rem}.controls>button{font-size:.84rem;min-height:40px;padding:8px 12px}
.admin-nav{margin-bottom:10px}.admin-nav button{font-size:.76rem;min-height:40px;padding:7px 10px}
.account-settings{margin:18px 0 4px;padding:8px 12px;font-size:.75rem}.account-settings button{font-size:.72rem;min-height:40px}
.compact-heading{align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.consultation-title{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.consultation-title h2{font-size:1rem;line-height:1.25;margin:0}
.consultation-title .session-id{font-size:.67rem;margin:0;color:#526b80}
.compact-heading .reload-messages{font-size:.68rem;min-height:40px;padding:6px 9px;margin-left:auto;border-radius:9px;width:auto}
.consultation .welcome.welcome-compact{font-size:.85rem;line-height:1.35;padding:9px 10px;gap:8px;margin:8px 0}
.welcome-compact .health-mark{font-size:1rem}.welcome-compact svg{width:24px;height:24px}.welcome-compact .health-plus{font-size:1.2rem}
.question-card,.question-card.alarm-question-compact{padding:13px 14px;margin:12px 0;border-radius:12px;position:relative}
.question-card>.eyebrow{font-size:.64rem;letter-spacing:.07em;margin:0 0 7px}
.question-card>h3,.question-card.alarm-question-compact>h3{font-size:1rem;font-weight:600;line-height:1.35;margin:0 0 12px;max-width:none}
.question-card.alarm-question-compact>h3{color:#a6192e;font-size:.9rem;line-height:1.3}
.question-card label{font-size:.8rem;margin:0 0 5px}
.question-card textarea{font-size:16px;line-height:1.4;min-height:72px;max-height:30svh;padding:9px 11px;resize:vertical;border-radius:10px}
.answer-footer{justify-content:flex-end;margin-top:8px;gap:6px}
.answer-footer button{font-size:.8rem;min-height:40px;padding:7px 14px;width:auto!important;border-radius:10px}
.completion-state{font-size:.8rem;margin:12px 0;color:#365e7c}
.progress{margin:10px 0 14px;gap:7px}.progress span{font-size:.7rem}
.consultation-summary.compact-summary{padding:11px 12px;margin:12px 0;border-radius:11px}
.consultation-summary.compact-summary>summary{font-size:.86rem;line-height:1.35}
.compact-summary section{margin-top:10px}.compact-summary h3{font-size:.8rem;line-height:1.3;margin:8px 0 4px}
.compact-summary .summary-field{display:flex;flex-direction:row;align-items:flex-start;gap:8px;padding:7px 0;font-size:.8rem;line-height:1.4}
.compact-summary .summary-field>div{min-width:0;flex:1}.compact-summary .summary-field>button{width:auto;flex:0 0 auto;font-size:.68rem;min-height:40px;max-width:75px;padding:5px 8px;border-radius:8px}
.compact-summary .summary-field p{margin:3px 0}.compact-summary .summary-detail{font-size:.76rem;padding-left:7px;line-height:1.4}
.compact-summary .small{font-size:.7rem}.compact-summary .notice{font-size:.8rem;padding:9px}
.technical{padding:10px 12px;margin:12px 0;font-size:.8rem;border-radius:11px}
.technical>summary{font-size:.84rem;line-height:1.4}.technical p{margin:5px 0;line-height:1.4}.technical .small{font-size:.72rem}.technical>div{padding-top:5px;margin-top:7px}
.technical label,.technical select,.technical button{font-size:.8rem}.technical textarea{font-size:16px}
.conversation-history{margin:14px 0;border:1px solid #d2e2ee;border-radius:11px;padding:10px 12px}
.conversation-history>summary{font-weight:650;font-size:.82rem;color:#285777;cursor:pointer;min-height:32px;display:list-item;align-content:center}
.conversation-history .transcript{gap:8px;margin:8px 0 0}.conversation-history .bubble{padding:8px 10px;max-width:96%;border-radius:10px}.conversation-history .bubble p{font-size:.84rem;line-height:1.45;margin-top:3px}.conversation-history .speaker{font-size:.65rem}
.consultation-actions{gap:8px;margin-top:14px;padding-top:12px;flex-direction:row;justify-content:space-between}
.consultation-actions button{width:auto;font-size:.73rem;padding:7px 10px;min-height:40px;border-radius:9px}
.orientation-panel{padding:14px;margin:14px 0}.orientation-panel h3{font-size:1rem}.orientation-panel h4{font-size:.9rem;margin:12px 0 5px}.orientation-panel p,.orientation-panel li{font-size:.88rem;line-height:1.5}.orientation-panel button{font-size:.8rem;min-height:40px;padding:8px 12px}
.login-card{max-width:400px;padding:22px 24px;margin:14px auto}.login-card h2{font-size:1.2rem;margin-bottom:8px}.login-card p,.login-card label{font-size:.82rem}.login-card label{margin-top:10px}.login-card input{font-size:16px;min-height:42px;padding:8px 10px}.login-card button,.login-card .auth-options button{min-height:40px;font-size:.78rem;padding:8px 10px}.login-card form>button{margin-top:14px}.login-card .auth-options{gap:6px;margin-top:10px}.login-card .divider{margin:14px 0;font-size:.75rem}
.finish-writing,.inline-answer-error{display:none}
@media(max-width:900px){
 .workspace,.login-page{padding:10px 10px 18px}.layout{gap:10px}.account{max-width:50%;flex-direction:column;gap:0}.account span{max-width:100%;font-size:.65rem}.account button{min-height:40px}
 .controls.has-session{padding:10px;gap:8px}.consultation{padding:12px}.empty-state{padding:26px 8px}.empty-state h2{font-size:1.1rem}.empty-state p{font-size:.85rem}
 .answer-footer{flex-direction:row}.answer-footer button{width:auto}.question-card>h3{font-size:.96rem}
 .compact-summary .summary-field{flex-direction:row}.compact-summary .summary-field>button{width:auto}
 /* The visual viewport follows the visible area above the software keyboard. */
 body.answer-focus .question-card{position:fixed;top:var(--visible-top,0px);left:0;right:0;height:var(--visible-height,100dvh);max-height:var(--visible-height,100dvh);margin:0;padding:12px 12px max(10px,env(safe-area-inset-bottom));z-index:50;display:flex;flex-direction:column;background:#f5f9ff;border-radius:0;overflow:hidden;border:0;box-shadow:0 0 0 100vmax #f5f9ff}
 body.answer-focus .question-card>.eyebrow{padding-right:65px;min-height:30px;margin-bottom:4px;display:flex;align-items:center;flex-shrink:0}
 body.answer-focus .question-card>h3{flex:0 1 auto;min-height:28px;max-height:42%;overflow:auto;overscroll-behavior:contain;margin:0 0 8px;font-size:.96rem;line-height:1.3}
 body.answer-focus .question-card.alarm-question-compact>h3{font-size:.86rem}
 body.answer-focus .question-card>form{min-height:0;flex:1;display:flex;flex-direction:column}
 body.answer-focus .question-card textarea{height:auto!important;min-height:48px;max-height:none;flex:1;resize:none;font-size:16px}
 body.answer-focus .answer-footer{flex:0 0 auto;position:sticky;bottom:0;background:#f5f9ff;padding-top:4px;margin-top:6px;justify-content:flex-end}
 body.answer-focus .answer-footer button{min-height:40px}
 body.answer-focus .finish-writing{display:block;position:absolute;top:8px;right:10px;font-size:.75rem;padding:5px 10px;min-height:36px}
 body.answer-focus .inline-answer-error{display:block;flex:0 0 auto;color:#a6192e;font-size:.8rem;margin:4px 0;max-height:50px;overflow:auto}
 body.answer-focus .question-card>.notice{max-height:18%;overflow:auto;font-size:.8rem;padding:7px;margin:4px 0 8px}
 body.answer-focus .busy-status{z-index:60;bottom:auto;top:calc(var(--visible-top,0px) + 4px);font-size:.7rem;padding:5px 10px}
}

.compact-heading{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center}.compact-heading .reload-messages{max-width:100px;font-size:.65rem;line-height:1.2}.compact-heading .consultation-title{min-width:0}.compact-heading .consultation-title h2{font-size:.95rem}

/* Paso 22.2: controles y desplegables mas compactos. */
.account button{font-size:.67rem;padding:4px 7px;min-height:36px}
.admin-nav button{font-size:.7rem;padding:5px 8px;min-height:36px}
.controls>button,.controls.has-session>button{font-size:.75rem;padding:5px 9px;min-height:36px}
.consultation-library>summary{font-size:.74rem;line-height:1.25;padding:4px 0;min-height:36px;align-content:center}
.consultation-library button,.consultation-library label,.consultation-library select{font-size:.75rem}
.orientation-panel .check-current-signals{font-size:.72rem;min-height:36px;padding:6px 9px;width:auto}
.consultation-summary.compact-summary,.technical,.conversation-history{padding:7px 10px;margin:9px 0}
.consultation-summary.compact-summary>summary,.technical>summary,.conversation-history>summary{font-size:.75rem;line-height:1.3;min-height:36px;align-content:center}

/* Paso 22.3: espacios compactos sin alterar los accesos de emergencia. */
.consultation.no-selected-consultation{display:none}
.workspace .admin-nav button,.workspace .controls>button,.workspace .consultation-library>summary{font-size:.70rem!important;padding:4px 6px!important;min-height:32px!important;line-height:1.25}
.question-card.alarm-question-compact>h3{font-size:.8rem!important;line-height:1.35!important}
.question-card.alarm-question-compact textarea#answer{height:56px!important;min-height:48px!important;max-height:70px!important;flex:0 0 auto!important}
.question-card.alarm-question-compact form{justify-content:flex-start}
body.answer-focus .question-card.alarm-question-compact>h3{max-height:none;flex:1 1 auto;min-height:0;overflow:auto}
body.answer-focus .question-card.alarm-question-compact form{flex:0 0 auto}
.emergency-help{font-size:.875rem;line-height:1.4}
.emergency-help h3{font-size:1rem!important;line-height:1.35!important;margin:8px 0!important}
.emergency-help p,.emergency-help label{font-size:.875rem!important}
.consultation-footer{display:flex;justify-content:flex-end;margin:12px 0 0}
.consultation-footer .reload-messages{font-size:.72rem;min-height:36px;padding:6px 10px}
.orientation-attribution{font-size:.75rem;line-height:1.35;margin-top:16px;padding-top:8px;border-top:1px solid #ccdbea;color:#465a6b}
.orientation-attribution p{font-size:inherit!important;margin:4px 0!important}
/* Paso 22.4: controles primero, navegación debajo y espera por operación. */
.controls-column{min-width:0;align-self:start}
.controls-column>.admin-nav{display:flex;flex-wrap:wrap;justify-content:flex-start;gap:6px;margin:10px 0 14px}
.closed-consultation-heading{padding:8px 0;margin:0 0 10px}
.closed-consultation-heading h2{font-size:.95rem;margin:0}
.consultation .compact-summary>summary,.consultation #answers-corrections>summary{font-size:.70rem!important;padding:5px 7px!important;min-height:32px!important;line-height:1.3!important}
.consultation .consultation-actions button{font-size:.70rem!important;padding:5px 7px!important;min-height:32px!important;line-height:1.3!important}
.orientation-panel .orientation-consent{margin:0 0 12px;align-items:flex-start}
.operation-error{font-size:.8rem;line-height:1.4;color:#a6192e;margin:8px 0}
/* Paso 22.5: escritorio delimitado y centrado; sin animaciones de espera. */
.request-status{font-size:.8rem;line-height:1.4;margin:8px 0;color:#205e91;text-align:center}
.workspace{width:100%;max-width:1180px;margin-inline:auto}
.workspace .layout{display:grid;grid-template-columns:minmax(0,1fr);width:100%;min-width:0;align-items:start}
.workspace .layout>*{min-width:0;max-width:100%}
.workspace .controls-column{width:100%;min-width:0;max-width:100%}
.workspace .controls-column>.controls{position:static;max-width:100%;width:100%;margin:0}
.workspace .consultation{width:100%;max-width:100%;min-width:0;margin:0}
.workspace .question-card,.workspace .orientation-panel,.workspace .consultation-summary,.workspace .technical{width:100%;max-width:100%;min-width:0}
.workspace .closed-consultation-heading{width:100%;max-width:100%}
.workspace .layout.waiting-consultation{grid-template-columns:minmax(0,1fr)}
.workspace .layout.waiting-consultation>.controls-column{width:min(100%,560px);justify-self:center}
@media(min-width:901px){
 .workspace .layout.has-content{grid-template-columns:minmax(220px,260px) minmax(0,1fr);gap:20px}
 .workspace .layout.has-content>.controls-column{position:sticky;top:14px;align-self:start}
 .workspace .controls-column>.controls{display:block;padding:16px}
 .workspace .controls-column>.controls>button{width:100%}
 .workspace .controls-column>.admin-nav{display:flex;flex-direction:column;gap:7px;width:100%}
 .workspace .controls-column>.admin-nav>button{width:100%;flex:none}
 .workspace .consultation{padding:18px 20px}
 .workspace .question-card{margin:14px 0;padding:16px 18px}
 .workspace .question-card>h3{max-width:none;font-size:1rem;line-height:1.45}
 .workspace .question-card textarea{width:100%;min-height:96px;max-height:260px}
 .workspace .question-card.alarm-question-compact textarea#answer{min-height:48px}
 .workspace .consultation-actions{display:flex;flex-wrap:wrap;gap:8px}
}
@media(max-width:900px){.workspace .layout.has-content{grid-template-columns:minmax(0,1fr)}.workspace .controls-column{position:static}.workspace .controls-column>.admin-nav{flex-direction:row}}

/* La orientación precede en el DOM a los demás módulos. */
.layout > .primary-orientation{grid-column:1 / -1;min-width:0;width:100%;}
.layout > .primary-orientation:empty{display:none;}
.primary-orientation .orientation-panel{margin:0;max-width:100%;box-sizing:border-box;}
'@
},
@{Path='frontend/src/AdminPanel.jsx';Previous='4A8B8975EB358DD87BEDF1C23B31EC9AB67C6B077CC0E05BBDAA6D2C4E5E2E33';Next='287521ECADFAAC0215C25A69667FD125B91AEABAB259056CF111448BCC8D9E79';Content=@'
import React,{useState,useRef,useEffect} from 'react';
import {ConsultationSummary} from './ConsultationSummary.jsx';
const dateText=value=>Number.isFinite(value)?new Date(value).toLocaleString('es-MX',{timeZone:'America/Cancun'}):'Sin fecha';
const phaseText=value=>({collecting:'En entrevista',complete:'Completada',safety_alert:'Alerta',legacy:'Anterior'}[value]||value);
const day=value=>new Date(value-5*3600000).toISOString().slice(0,10);
function initialFilters(){const now=Date.now();return {from:day(now-29*86400000),to:day(now),status:'all',phase:'all',owner:'',limit:'20'};}
function search(filters,cursor=null){const p=new URLSearchParams(Object.entries(filters).filter(([,v])=>v!==''));if(cursor)p.set('cursor',cursor);return p.toString();}
export function AdminPanel({api,download}){
 const [filters,setFilters]=useState(initialFilters),[applied,setApplied]=useState(null),[page,setPage]=useState(null),[cursor,setCursor]=useState(null),[trail,setTrail]=useState([]),[detail,setDetail]=useState(null),[metrics,setMetrics]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function action(fn){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();}catch(e){if(alive.current)setError(e.message||'No se pudo completar la operación.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 async function load(f,c=null,t=[]){const data=await api('/admin/sessions?'+search(f,c));if(!alive.current)return;setPage(data);setApplied({...f});setCursor(c);setTrail(t);setDetail(null);setMetrics(null);}
 function change(key,value){setFilters(f=>({...f,[key]:value}));}
 return <section className="panel admin-panel" aria-label="Panel de administración">
  <p className="eyebrow">ACCESO ADMINISTRATIVO</p><h2>Consultas y métricas</h2>
  <p>Revisa registros y descarga información de las pruebas. JSON y TXT incluyen respuestas personales. Los accesos y descargas quedan registrados.</p>
  {error&&<div className="notice error" role="alert">{error}</div>}
  <form className="admin-filters" onSubmit={e=>{e.preventDefault();action(()=>load(filters));}}>
   <label>Desde<input type="date" required value={filters.from} disabled={busy} onChange={e=>change('from',e.target.value)}/></label>
   <label>Hasta<input type="date" required value={filters.to} disabled={busy} onChange={e=>change('to',e.target.value)}/></label>
   <label>Estado<select value={filters.status} disabled={busy} onChange={e=>change('status',e.target.value)}><option value="all">Todos</option><option value="open">Abiertas</option><option value="closed">Cerradas</option></select></label>
   <label>Entrevista<select value={filters.phase} disabled={busy} onChange={e=>change('phase',e.target.value)}><option value="all">Todas</option><option value="collecting">En entrevista</option><option value="complete">Completadas</option><option value="safety_alert">Con alerta</option></select></label>
   <label>Cuenta (UID opcional)<input value={filters.owner} maxLength={128} disabled={busy} autoComplete="off" onChange={e=>change('owner',e.target.value.trim())}/></label>
   <button disabled={busy} type="submit">{busy?'Procesando…':'Buscar consultas'}</button>
  </form>
  <p className="small muted">Fechas de Cancún. Periodo máximo: 93 días. Incluye registros vencidos que todavía existan.</p>
  <p className="small muted">Las métricas y el CSV utilizan el último filtro aplicado con Buscar consultas.</p>
  {page&&applied&&<>
   <div className="admin-actions"><button className="secondary" type="button" disabled={busy} onClick={()=>action(()=>download('/admin/export?'+search(applied,cursor)))}>Descargar esta página en CSV</button><button className="secondary" type="button" disabled={busy} onClick={()=>action(async()=>{const data=await api('/admin/metrics?'+search(applied));if(alive.current)setMetrics(data);})}>Calcular métricas del filtro</button></div>
   <p role="status">{page.rows.length} consultas en esta página. Se examinaron {page.scanned} registros.{page.nextCursor?' Hay más registros por revisar.':''}</p>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Consulta</th><th>Creación</th><th>Estado</th><th>Entrevista</th><th>Mensajes</th><th>Orientación</th><th>Acción</th></tr></thead><tbody>{page.rows.map(r=><tr key={r.id}><td>{r.id.slice(0,8)}</td><td>{dateText(r.createdAt)}</td><td>{r.status==='closed'?'Cerrada':'Abierta'}{r.expired?' · Vencida':''}</td><td>{phaseText(r.phase)}</td><td>{r.messageCount}</td><td>{r.orientationCurrent?'Vigente':r.orientationSaved?'Anterior':'Sin generar'}</td><td><button className="secondary" type="button" disabled={busy} aria-label={'Ver consulta '+r.id.slice(0,8)} onClick={()=>action(async()=>{const data=await api('/admin/sessions/'+r.id);if(alive.current)setDetail(data);})}>Ver</button></td></tr>)}</tbody></table></div>
   {!page.rows.length&&<p>No hay coincidencias en este bloque.{page.nextCursor?' Pulsa Siguiente para seguir buscando.':''}</p>}
   <div className="admin-actions"><button type="button" className="secondary" disabled={busy||!trail.length} onClick={()=>action(()=>load(applied,trail.at(-1),trail.slice(0,-1)))}>Anterior</button><button type="button" className="secondary" disabled={busy||!page.nextCursor} onClick={()=>action(()=>load(applied,page.nextCursor,[...trail,cursor]))}>Siguiente</button></div>
  </>}
  {metrics&&<section aria-label="Métricas internas"><h3>Métricas del periodo y filtro aplicado</h3><p>Coincidencias analizadas: {metrics.matched}. Registros examinados: {metrics.scanned}.{metrics.partial?' Resultado parcial: se alcanzó el límite de 500 registros más recientes. Reduce el periodo para revisar el resto.':' Se examinó el conjunto disponible dentro del periodo.'}</p><div className="admin-metrics">{[['Abiertas','open'],['Cerradas','closed'],['Entrevistas completadas','complete'],['Consultas con alerta','alarms'],['Vencidas','expired'],['Orientaciones vigentes','orientationCurrent'],['Orientación vigente con fuentes','ragMatched'],['Orientación vigente sin evidencia','ragInsufficient'],['Último intento fallido','lastRunFailed']].map(([title,key])=><div className="admin-metric" key={key}><span>{title}</span><strong>{metrics.counts[key]}</strong></div>)}</div><p>Tokens en resultados guardados: entrada {metrics.storedTokens.input}, salida {metrics.storedTokens.output}, búsqueda {metrics.storedTokens.embedding}.</p><p className="small muted">No representan facturación total, todos los intentos históricos ni exactitud clínica.</p></section>}
  {detail&&<section className="admin-detail" aria-label="Detalle administrativo"><h3>Consulta {detail.id.slice(0,8)}</h3><p>Identificador: {detail.id}</p><p>Creada: {dateText(detail.createdAt)}. {detail.expired?'Vencida; se conserva en la base.':''}</p><div className="admin-actions">{['json','txt'].map(format=><button type="button" className="secondary" disabled={busy} key={format} onClick={()=>action(()=>download('/admin/sessions/'+detail.id+'/export?format='+format))}>Descargar resumen (.{format})</button>)}</div><ConsultationSummary summary={detail.summary} canCorrect={false}/><details><summary>Historial completo</summary>{detail.messages.map(m=><div className="bubble" key={m.id}><strong>{m.role==='user'?'Usuario':'CHECKIA'}</strong><p>{m.text}</p></div>)}</details>{detail.orientation&&<details><summary>Orientación guardada</summary><p>{detail.orientation.basedOnRevision===(detail.clinicalState?.revision||0)?'Corresponde a la revisión actual.':'Corresponde a una revisión anterior; no debe interpretarse como vigente.'}</p><pre>{JSON.stringify(detail.orientation.result,null,2)}</pre></details>}</section>}
 </section>;
}
'@
},
@{Path='backend/test/admin.test.js';Previous='BB9D6CEE5CF8AB0B5D7EF76D17A269DC19FB8E69B1989DB1A2B9F7A59D07D50C';Next='CF861CF40DD1355405BEB460933B8FA8E86B20E4E319EE59D5755B9CC82699CF';Content=@'
import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {AdminService,parseFilters,csv} from '../src/admin.js';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {createApp} from '../src/app.js';
import {AdminDB} from '../test-support/admin-db.js';
import {changeAdminRole} from '../src/admin-roles.js';
const now=()=>Date.parse('2026-10-14T18:00:00Z');
function seed(db,{id=randomUUID(),at=now()-1000,owner='A',status='open',phase='complete',expiresAt=now()+1000,orientation=null}={}){db.data.set('checkia_sessions/'+id,{id,ownerUid:owner,createdAt:at,updatedAt:at,expiresAt,status,messageCount:2,clinicalState:{schemaVersion:2,protocolId:'intake-demo-v5',phase,revision:2,facts:[{key:'name',text:'Nombre privado',status:'reported'},{key:'reason',text:'Molestia privada',status:'reported'}],pendingQuestions:[],safety:{status:'unknown'}},...(orientation?{orientation}:{}),orientationRun:{status:'ready',token:'token-interno-privado'}});return id;}
const logs=db=>[...db.data].filter(([path])=>path.startsWith('checkia_admin_audit/')).map(([,v])=>v);
test('asignación local conserva otros permisos; revocar retira admin e invalida sesiones',async()=>{
 let account={customClaims:{reviewer:true}},events=[];
 const auth={getUser:async()=>account,setCustomUserClaims:async(uid,claims)=>events.push(['set',uid,claims]),revokeRefreshTokens:async uid=>events.push(['revoke',uid])};
 await changeAdminRole(auth,'ADMIN',true);assert.deepEqual(events,[['set','ADMIN',{reviewer:true,admin:true}]]);assert.deepEqual(account.customClaims,{reviewer:true});
 events=[];account={customClaims:{reviewer:true,admin:true}};await changeAdminRole(auth,'ADMIN',false);assert.deepEqual(events,[['set','ADMIN',{reviewer:true}],['revoke','ADMIN']]);
 events=[];account={disabled:true};await assert.rejects(changeAdminRole(auth,'ADMIN',true));assert.equal(events.length,0);await assert.rejects(changeAdminRole(auth,'../invalid',true));
});
test('filtros: fechas válidas de Cancún, límite, periodo y cursor ligado al filtro',()=>{
 const f=parseFilters({from:'2026-10-13',to:'2026-10-14',limit:'50'},now());assert.equal(new Date(f.from).toISOString(),'2026-10-13T05:00:00.000Z');assert.equal(new Date(f.to).toISOString(),'2026-10-15T05:00:00.000Z');
 for(const bad of [{from:'2026-02-30'},{from:'2020-01-01'},{limit:'51'},{limit:'2x'},{status:'other'},{phase:'other'},{owner:'../../'},{admin:'true'},{cursor:'%xx'},{status:['open','closed']}])assert.throws(()=>parseFilters(bad,now()),{status:400});
 assert.deepEqual(parseFilters({},now()),parseFilters({},now()+1000));
});
test('lista: paginación estable con fechas iguales, sin textos clínicos y con auditoría',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now}),ids=[];
 for(let i=0;i<6;i++)ids.push(seed(db,{at:now()-1000}));ids.sort().reverse();
 const first=await service.list('ADMIN',{limit:'2'});assert.deepEqual(first.rows.map(r=>r.id),ids.slice(0,2));assert.equal(first.scanned,2);assert.ok(first.nextCursor);
 const second=await service.list('ADMIN',{limit:'2',cursor:first.nextCursor}),third=await service.list('ADMIN',{limit:'2',cursor:second.nextCursor});assert.deepEqual([...first.rows,...second.rows,...third.rows].map(r=>r.id),ids);assert.equal(third.nextCursor,null);
 assert.doesNotMatch(JSON.stringify(first),/Nombre privado|Molestia privada|token-interno/);assert.equal(logs(db).length,3);assert.ok(logs(db).every(e=>e.actorUid==='ADMIN'&&e.action==='list'));
 await assert.rejects(service.list('ADMIN',{status:'closed',cursor:first.nextCursor}),{status:400});
});
test('filtro escaso: límite de escaneo y continuación sin perder coincidencias',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now});for(let i=0;i<205;i++)seed(db,{at:now()-i-1000,status:i>=202?'closed':'open'});
 const one=await service.list('ADMIN',{status:'closed'});assert.equal(one.rows.length,0);assert.equal(one.scanned,200);assert.ok(one.nextCursor);
 const two=await service.list('ADMIN',{status:'closed',cursor:one.nextCursor});assert.equal(two.rows.length,3);assert.equal(two.nextCursor,null);
 assert.ok(two.rows.every(s=>s.status==='closed'));
});
test('métricas: recuento de registros, vigencia, tokens guardados y muestra parcial explícita',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now});
 const orientation={status:'ready',basedOnRevision:2,model:'fake',usage:{inputTokens:10,outputTokens:20},rag:{status:'matched',usage:{inputTokens:2}}};
 seed(db,{orientation,phase:'complete'});seed(db,{status:'closed',phase:'safety_alert',expiresAt:now()-1});seed(db,{orientation:{...orientation,basedOnRevision:1}});
 let m=await service.metrics('ADMIN',{});assert.equal(m.matched,3);assert.equal(m.counts.orientationCurrent,1);assert.equal(m.counts.ragMatched,1);assert.equal(m.counts.alarms,1);assert.equal(m.counts.expired,1);assert.deepEqual(m.storedTokens,{input:20,output:40,embedding:4});assert.equal(m.partial,false);
 for(let i=0;i<501;i++)seed(db,{at:now()-i-2000});m=await service.metrics('ADMIN',{});assert.equal(m.scanned,500);assert.equal(m.partial,true);assert.equal(m.matched,500);assert.doesNotMatch(JSON.stringify(m),/Nombre privado|Molestia privada|ownerUid/);
});
test('detalle: lectura coherente de otra cuenta y vencida, historial ordenado y sin tokens internos',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now}),id=seed(db,{owner:'B',expiresAt:now()-10});
 db.data.set('checkia_sessions/'+id+'/messages/b',{id:'b',sequence:1,role:'assistant',text:'Respuesta privada'});db.data.set('checkia_sessions/'+id+'/messages/a',{id:'a',sequence:0,role:'user',text:'Mensaje privado'});
 const detail=await service.detail('ADMIN',id);assert.equal(detail.expired,true);assert.equal(detail.messages[0].id,'a');assert.equal(detail.summary.supported,true);assert.doesNotMatch(JSON.stringify(detail),/token-interno-privado|ownerUid/);
 assert.equal(logs(db)[0].sessionId,id);assert.equal(logs(db)[0].action,'view');assert.doesNotMatch(JSON.stringify(logs(db)),/Mensaje privado|Nombre privado|Molestia privada/);
 await assert.rejects(service.detail('ADMIN',randomUUID()),{status:404});await assert.rejects(service.detail('ADMIN','../'),{status:404});
});
test('exportaciones: JSON/TXT con respuestas, CSV acotado sin identidad ni texto y fórmulas neutralizadas',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now}),id=seed(db);const json=await service.exportSession('ADMIN',id,'json');assert.equal(JSON.parse(json.content).formato,'checkia-resumen-v1');assert.match(json.content,/Molestia privada/);assert.match(json.filename,/\.json$/);
 const txt=await service.exportSession('ADMIN',id,'txt');assert.match(txt.content,/DATOS BÁSICOS/);assert.match(txt.content,/Nombre privado/);
 const page=await service.exportPage('ADMIN',{});assert.match(page.content,/consulta/);assert.doesNotMatch(page.content,/Nombre privado|Molestia privada|ownerUid/);
 assert.throws(()=>parseFilters({limit:'1000'},now()),{status:400});await assert.rejects(service.exportSession('ADMIN',id,'html'),{status:400});
 const value=csv([{id,createdAt:now(),status:'open',phase:'complete',model:' =HYPERLINK("evil")'}]);assert.match(value,/' =HYPERLINK/);assert.equal(logs(db).filter(l=>l.action.startsWith('export')).length,3);
});
test('fallo de auditoría impide entregar datos y no modifica la consulta',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now}),id=seed(db);const original=structuredClone(db.data.get('checkia_sessions/'+id));db.failAudit=true;
 await assert.rejects(service.list('ADMIN',{}),{status:503});await assert.rejects(service.exportPage('ADMIN',{}),{status:503});await assert.rejects(service.detail('ADMIN',id));assert.deepEqual(db.data.get('checkia_sessions/'+id),original);assert.equal(logs(db).length,0);
});
test('todas las rutas administrativas exigen token y claim booleano; no basta body ni header',async()=>{
 const db=new AdminDB(),service=new AdminService(db,{now}),id=seed(db,{owner:'B'}),store=new FirestoreStore(db,{now});let calls=0;const verifyToken=async token=>{calls++;if(token==='admin')return {uid:'ADMIN',admin:true};if(token==='string')return {uid:'A',admin:'true'};if(token==='user')return {uid:'A'};throw new Error();};
 const server=createApp({store,adminService:service,verifyToken}).listen(0,'127.0.0.1');await once(server,'listening');
 try{const base='http://127.0.0.1:'+server.address().port+'/api';
 for(const path of ['/admin/me','/admin/sessions','/admin/metrics','/admin/export','/admin/sessions/'+id,'/admin/sessions/'+id+'/export?format=json']){
  for(const [token,status]of [['',401],['bad',401],['user',403],['string',403]]){const res=await fetch(base+path,{headers:{...(token?{Authorization:'Bearer '+token}:{}),'X-Admin':'true'}});assert.equal(res.status,status);}
 }
 assert.equal(logs(db).length,0);
 let res=await fetch(base+'/me',{headers:{Authorization:'Bearer user'}});assert.equal((await res.json()).admin,false);
 res=await fetch(base+'/admin/sessions',{headers:{Authorization:'Bearer admin'}});assert.equal(res.status,200);assert.equal((await res.json()).rows.length,1);
 res=await fetch(base+'/admin/sessions/'+id+'/export?format=json',{headers:{Authorization:'Bearer admin'}});assert.equal(res.status,200);assert.match(res.headers.get('content-disposition'),/attachment/);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('x-content-type-options'),'nosniff');assert.equal((await res.json()).formato,'checkia-resumen-v1');
 res=await fetch(base+'/sessions/'+id,{headers:{Authorization:'Bearer user'}});assert.equal(res.status,404);
 res=await fetch(base+'/admin/sessions/'+id,{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json'},body:JSON.stringify({admin:true})});assert.equal(res.status,404);assert.ok(calls>0);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
'@
},
@{Path='backend/test/simple-exports.test.js';Previous='';Next='2D28FC1CBB0144BE1A5A0CA0CB07B2E45B901E6015BBB37E26A29A8EF306ABAB';Content=@'
import assert from 'node:assert/strict';
import {simpleExport,simpleText} from '../src/simple-exports.js';
import test from 'node:test';
test('exportaciones breves conservan los datos y evitan duplicar el historial',()=>{
const s={status:'closed',summary:{groups:[{id:'basic',fields:[{key:'height',label:'Estatura',text:'56 cm',status:'reported',details:[{label:'Confirmación',text:'No sé',status:'unknown'}]}]}],warnings:[{text:'Dato pendiente de revisar'}],safety:{screenText:'No'}},messages:[{text:'HISTORIAL NO REPETIR'}]};
const original=JSON.stringify(s),j=simpleExport(s),t=simpleText(s);assert.equal(JSON.stringify(s),original);assert.equal(j.secciones[0].datos[0].respuesta,'56 cm');assert.equal(j.secciones[0].datos[0].aclaraciones[0].estado,'Desconocido');assert.match(t,/56 cm/);assert.doesNotMatch(t,/156|HISTORIAL NO REPETIR/);assert.equal(j.orientacion,null);assert.ok(simpleText({}).length);});
'@
},
@{Path='LEEME_PASO_22_6.txt';Previous='';Next='AEEE10E4A89351EDD2545527FC05E0898E9B151977EE48B3889AFE35564DD553';Content=@'
CHECKIA 22.6 — DESCARGAS BREVES Y MÓDULO PRINCIPAL
Aplicar sobre 22.5. Detener backend y frontend antes de aplicar.
El instalador verifica los archivos y crea respaldo en respaldos/paso22_6_FECHA.
Solo cambia las representaciones descargadas en JSON/TXT y el orden de los módulos.
JSON y TXT contienen los mismos datos vigentes, aclaraciones, observaciones guardadas,
señales registradas, orientación y títulos/enlaces de fuentes. No duplican el historial.
El formato JSON cambia a checkia-resumen-v1: es un resumen derivado, no una exportación
completa para auditoría ni la entrada exacta enviada al LLM. Se conservan los originales
y el historial en la base y en el detalle del panel administrativo.
No interpreta síntomas ni corrige valores. No usa OpenAI para descargar.
No incorpora la captura de solicitudes ni una tercera descarga de evaluación.
La orientación, consentimiento y comprobación se muestran antes de Consultas y los demás
controles cuando la consulta reúne los requisitos existentes. Durante la entrevista y
ante alertas se mantienen las restricciones originales. El consentimiento sigue siendo
necesario para generar orientación. No se cambian las preguntas ni reglas de seguridad.
ARCHIVOS
backend/src/admin.js
backend/src/simple-exports.js (nuevo)
frontend/src/main.jsx
frontend/src/mobile.css
frontend/src/AdminPanel.jsx
backend/test/admin.test.js (expectativas del nuevo formato)
backend/test/simple-exports.test.js (nuevo)
LEEME_PASO_22_6.txt
VERIFICACIÓN
143 pruebas backend pasaron; comprobación adicional de resumen determinista, valor 56 cm,
aclaraciones desconocidas, ausencia de historial duplicado y consulta sin orientación.
JSX compilado. La comprobación visual utiliza autenticación, CSS base y proveedor simulados.
No se comprueba una llamada real a OpenAI ni se publica automáticamente.
LOCAL
En backend: npm test (si existe script) o node --test test/*.test.js; después npm start.
En frontend: npm run build; si termina correctamente, npm run dev.
WEB
Esta entrega cambia backend y frontend. Despliega Cloud Run con la configuración existente,
comprueba /api/health y luego despliega Firebase Hosting. No cambies claves ni modelo.
La versión de health se conserva porque no se cambia su código.
REVERSIÓN
Detén ambos servicios y restaura los archivos del respaldo en sus rutas originales.
ARCHIVOS_NUEVOS.txt enumera archivos que deben eliminarse al revertir.
'@
}
)
# Verificar todos los destinos antes de escribir.
foreach($f in $files){$dest=Join-Path $ProjectRoot $f.Path;if(Test-Path -LiteralPath $dest){$hash=ContentHash ([IO.File]::ReadAllText($dest));if($hash -ne $f.Previous -and $hash -ne $f.Next){throw "El archivo $($f.Path) tiene una versión diferente a 22.5. No se modificó nada. Conserva tus cambios para adaptar el ajuste."}}elseif($f.Previous){throw "Falta $($f.Path). Aplica primero el paso 22.5."}}
$backup=Join-Path $ProjectRoot ('respaldos/paso22_6_'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$newFiles=@()
foreach($f in $files){$dest=Join-Path $ProjectRoot $f.Path;if(Test-Path -LiteralPath $dest){$saved=Join-Path $backup $f.Path;New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null;Copy-Item -LiteralPath $dest -Destination $saved}else{$newFiles+=$f.Path}}
$encoding=New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllLines((Join-Path $backup 'ARCHIVOS_NUEVOS.txt'),[string[]]$newFiles,$encoding)
foreach($f in $files){$dest=Join-Path $ProjectRoot $f.Path;New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null;[IO.File]::WriteAllText($dest,$f.Content+"`n",$encoding);Write-Host ('Actualizado: '+$f.Path)}
Write-Host "Paso 22.6 aplicado. Respaldo: $backup"
Write-Host 'Reinicia backend. En frontend ejecuta npm run build y npm run dev.'
Write-Host 'Para actualizar la web debes publicar backend en Cloud Run y frontend en Firebase Hosting.'
Write-Host 'No se publico automaticamente. Revisa LEEME_PASO_22_6.txt.'
