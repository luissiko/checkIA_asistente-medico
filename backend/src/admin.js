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
