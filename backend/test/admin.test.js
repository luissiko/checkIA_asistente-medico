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
 const db=new AdminDB(),service=new AdminService(db,{now}),id=seed(db);const json=await service.exportSession('ADMIN',id,'json');assert.equal(JSON.parse(json.content).id,id);assert.match(json.content,/Molestia privada/);assert.match(json.filename,/\.json$/);
 const txt=await service.exportSession('ADMIN',id,'txt');assert.match(txt.content,/RESPUESTAS/);assert.match(txt.content,/Nombre privado/);
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
 res=await fetch(base+'/admin/sessions/'+id+'/export?format=json',{headers:{Authorization:'Bearer admin'}});assert.equal(res.status,200);assert.match(res.headers.get('content-disposition'),/attachment/);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('x-content-type-options'),'nosniff');assert.equal((await res.json()).id,id);
 res=await fetch(base+'/sessions/'+id,{headers:{Authorization:'Bearer user'}});assert.equal(res.status,404);
 res=await fetch(base+'/admin/sessions/'+id,{method:'POST',headers:{Authorization:'Bearer admin','Content-Type':'application/json'},body:JSON.stringify({admin:true})});assert.equal(res.status,404);assert.ok(calls>0);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
