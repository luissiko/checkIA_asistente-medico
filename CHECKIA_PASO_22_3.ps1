# CHECKIA paso 22.3: interfaz compacta, protocolo v8 y confirmacion final.
# Respalda archivos; no despliega ni modifica secretos, modelos o datos de Firestore.
param([string]$ProjectRoot="C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference="Stop"
foreach($required in @('backend/src/interview-v7.js','frontend/src/mobile.css','frontend/src/main.jsx')){if(!(Test-Path -LiteralPath (Join-Path $ProjectRoot $required))){throw "Falta $required. Aplica primero el paso 22.2 o revisa ProjectRoot."}}
$files=@(

@{Path='LEEME_PASO_22_3.txt';Content=@'
CHECKIA PASO 22.3 - PREGUNTAS E INTERFAZ COMPACTA
Aplicar sobre el paso 22.2. El instalador respalda los archivos antes de escribir.
No cambia .env, OPENAI_MODEL, claves, firebase.js, dependencias, datos de Firestore ni corpus/índice RAG. No publica recursos.
Consultas nuevas: intake-demo-v8, validationVersion 16, health step 22.3.
Las consultas anteriores conservan su protocolo. Crea una consulta nueva para comprobar los cambios.
Secuencia final: 15 alergias, 15.1 medicamento/remedio si corresponde, 16 desde cuándo y última reacción si corresponde, 17 antecedentes familiares y 17.1 familiar si corresponde, 18 confirmación Sí/No. La pregunta 14 continúa reservada como antes; no se crea una pregunta nueva sin contenido.
Se elimina 9.1 de las consultas nuevas; 9.2 conserva la descripción del dolor o afectación.
Una respuesta No a alergias omite los detalles, pero conserva antecedentes familiares y confirmación final. Corregir una respuesta exige confirmar de nuevo. Un No a la confirmación bloquea generar orientación.
Pantalla sin tarjeta vacía: Nueva consulta abre la primera pregunta y el campo de respuesta. No se crean consultas automáticas al recargar.
Sin contador 17/17 ni historial desplegable. Los mensajes originales continúan guardados y accesibles por la API y el panel administrativo autorizado.
Recargar mensajes pasa al pie; el panel de orientación queda después del resumen y de las correcciones.
La atribución de IA se muestra una sola vez, pequeña, al pie de la orientación generada.
Pregunta 6: título sin Antes de continuar, fuente compacta y campo corto. Se mantienen Sí, No, No sé y letras como entradas admitidas por compatibilidad. Detectar señales y bloquear el LLM no cambia.
Alerta roja: se retiran los párrafos solicitados; conserva llamada 911, hospital según seguridad social, selección Cancún/otra localidad y aviso sobre los enlaces aportados al prototipo.
Los tamaños son aproximados y conservan legibilidad y controles utilizables; el campo de entrada mantiene fuente de 16 px para evitar zoom automático móvil.
PRUEBA LOCAL
1. Detén backend y frontend con Ctrl+C en sus terminales.
2. Ejecuta el instalador desde la raíz del proyecto.
3. En backend: npm test; si pasa, npm start. Mantén abierta esa terminal.
4. En otra terminal, frontend: npm run build; si pasa, npm run dev.
5. Abre http://127.0.0.1:5173/, recarga y crea una consulta nueva.
6. Comprueba: 9 no pregunta zona 9.1; describe en 9.2; familiares antes de 18; 18 es la confirmación final. Prueba alergias No y alergias referidas.
7. Prueba pregunta 6 Sí en un caso ficticio: aparece ayuda roja y no hay generación LLM. No realices una llamada de prueba al 911.
8. Revisa Enter y un toque en Guardar respuesta, tanto en móvil como computadora.
VALIDACIÓN REALIZADA
142 pruebas automatizadas del backend, incluyendo regresiones de protocolos anteriores y seis pruebas del protocolo v8. JSX validado. Comprobación de interfaz con autenticación y proveedor simulados; no utiliza cuentas de Firebase ni llamadas reales de OpenAI. La revisión en teclado móvil real sigue siendo necesaria.
PUBLICACIÓN
Cloud Run primero y Firebase Hosting después; sigue PUBLICAR_PASO_22.txt. La comprobación health verifica configuración, no calidad clínica ni acceso efectivo a OpenAI.
RESTAURAR
Detén los servidores y copia los archivos del respaldo a sus rutas originales. ARCHIVOS_NUEVOS.txt enumera los archivos que se añadieron. Nunca restaures archivos mientras el servidor está escribiendo una consulta.
'@
},
@{Path='PUBLICAR_PASO_22.txt';Content=@'
PUBLICAR CHECKIA PASO 22.3
Ejecuta en PowerShell SOLO despues de probar localmente.
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA\backend"
npm test
if ($LASTEXITCODE -ne 0) { throw "Fallaron las pruebas del backend" }
node scripts/check-cloud.mjs
if ($LASTEXITCODE -ne 0) { throw "Fallo la preparacion del backend" }
Set-Location ..
# Conserva el archivo deploy/cloud-run.env.yaml que ya tienes configurado.
# Conserva el secreto :1 del despliegue anterior; si lo rotaste, usa la version vigente.
gcloud run deploy checkia-api --source .\backend --region us-central1 --project checkia-project --service-account checkia-runtime@checkia-project.iam.gserviceaccount.com --build-service-account projects/checkia-project/serviceAccounts/checkia-build@checkia-project.iam.gserviceaccount.com --env-vars-file .\deploy\cloud-run.env.yaml --set-secrets "OPENAI_API_KEY=checkia-openai-api-key:1" --allow-unauthenticated --memory 512Mi --cpu 1 --concurrency 8 --max-instances 3 --min-instances 0 --timeout 60
if ($LASTEXITCODE -ne 0) { throw "Fallo el despliegue Cloud Run" }
$health = Invoke-RestMethod "https://checkia-api-728407825506.us-central1.run.app/api/health"
$health | ConvertTo-Json -Depth 6
if ($health.interview -ne "intake-demo-v8" -or $health.validationVersion -lt 16 -or !$health.rag.ready -or !$health.llm.configured) { throw "Revisa el backend antes de publicar Hosting" }
Set-Location .\frontend
npm run build
if ($LASTEXITCODE -ne 0) { throw "Fallo la compilacion del frontend" }
Set-Location ..
firebase deploy --only hosting --config firebase.checkia.json --project checkia-project
if ($LASTEXITCODE -ne 0) { throw "Fallo la publicacion de Hosting" }
Invoke-RestMethod "https://checkia-project.web.app/api/health" | ConvertTo-Json -Depth 6
# Abre https://checkia-project.web.app, Ctrl+F5, y crea una consulta NUEVA.
# Las consultas guardadas antes de esta actualizacion conservan sus preguntas originales.
'@
},
@{Path='backend/src/adaptive.js';Content=@'
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
'@
},
@{Path='backend/src/app.js';Content=@'
import {requireAdmin} from './admin.js';
import express from 'express';
import { requireIdentity } from './identity.js';
export function createApp({ store, orientationService = null, adminService = null, verifyToken = async () => { throw new Error('not configured'); } } = {}) {
  const app = express(); app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => { res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'}); next(); });
  app.get('/api/health', (req, res) => res.json({ service: 'CHECKIA', stage: 22, step: '22.3', storage: 'firestore', medicalInference: false, interview: 'intake-demo-v8', validationVersion: 16, summaryVersion:2, safetyVersion: 'alarm-demo-v2', rag: orientationService?.retriever?.status || {enabled:false,ready:false,state:'not_configured'}, llm: {configured: Boolean(orientationService?.client?.configured)} }));
  app.use('/api', requireIdentity(verifyToken));
  app.get('/api/me', (req, res) => res.json({ verified: true, ...req.identity, projectId: 'checkia-project' }));
  const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  // El permiso procede del token verificado, nunca del cuerpo o del navegador.
  app.use('/api/admin',requireAdmin);
  app.get('/api/admin/me',(req,res)=>res.json({admin:true,uid:req.identity.uid,available:Boolean(adminService)}));
  const adminWrap=fn=>wrap(async(req,res)=>{if(!adminService)return res.status(503).json({error:'El panel administrativo no está disponible.'});await fn(req,res);});
  const download=(res,file)=>{res.set({'Content-Type':file.type,'Content-Disposition':'attachment; filename="'+file.filename+'"','X-Content-Type-Options':'nosniff'});res.send(file.content);};
  app.get('/api/admin/sessions',adminWrap(async(req,res)=>res.json(await adminService.list(req.identity.uid,req.query))));
  app.get('/api/admin/metrics',adminWrap(async(req,res)=>res.json(await adminService.metrics(req.identity.uid,req.query))));
  app.get('/api/admin/export',adminWrap(async(req,res)=>download(res,await adminService.exportPage(req.identity.uid,req.query))));
  app.get('/api/admin/sessions/:id/export',adminWrap(async(req,res)=>{if(Object.keys(req.query).some(k=>k!=='format'))return res.status(400).json({error:'Formato no válido.'});download(res,await adminService.exportSession(req.identity.uid,req.params.id,req.query.format));}));
  app.get('/api/admin/sessions/:id',adminWrap(async(req,res)=>res.json(await adminService.detail(req.identity.uid,req.params.id))));
  app.post('/api/sessions', wrap(async (req, res) => res.status(201).json({ session: await store.create(req.identity.uid) })));
  app.get('/api/sessions', wrap(async (req, res) => res.json({ sessions: await store.list(req.identity.uid) })));
  app.get('/api/sessions/:id', wrap(async (req, res) => res.json(await store.get(req.params.id, req.identity.uid))));
  app.post('/api/sessions/:id/safety-review',wrap(async(req,res)=>res.json(await store.beginAdditional(req.params.id,req.identity.uid,req.body,'review'))));
  app.post('/api/sessions/:id/clarifications',wrap(async(req,res)=>res.json(await store.beginAdditional(req.params.id,req.identity.uid,req.body,'adaptive'))));
  app.post('/api/sessions/:id/orientation',wrap(async(req,res)=>{
    if(!orientationService){await store.get(req.params.id,req.identity.uid);return res.status(503).json({error:'La orientación no está disponible en este momento.'});}
    res.json(await orientationService.generate(req.params.id,req.identity.uid,req.body));
  }));
  app.get('/api/sessions/:id/summary', wrap(async (req,res)=>res.json((await store.get(req.params.id,req.identity.uid)).summary)));
  app.post('/api/sessions/:id/messages', wrap(async (req, res) => {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim() || message.trim().length > 4000)
      return res.status(400).json({ error: 'message debe ser texto de 1 a 4000 caracteres.' });
    res.status(201).json(await store.append(req.params.id, req.identity.uid, message.trim(), req.body?.requestId, req.body?.questionId));
  }));
  app.post('/api/sessions/:id/close', wrap(async (req, res) => { await store.close(req.params.id, req.identity.uid); res.json({ closed: true }); }));
  app.post('/api/sessions/:id/corrections', wrap(async (req, res) => {
    const answer=req.body?.answer;
    if(typeof answer !== 'string' || !answer.trim() || answer.trim().length>4000) return res.status(400).json({error:'answer debe ser texto de 1 a 4000 caracteres.'});
    if(typeof req.body?.factKey !== 'string') return res.status(400).json({error:'factKey debe identificar una respuesta registrada.'});
    res.status(201).json(await store.correct(req.params.id,req.identity.uid,answer.trim(),req.body?.requestId,req.body.factKey,req.body?.expectedRevision));
  }));
  app.delete('/api/sessions/:id', wrap(async (req, res) => { await store.delete(req.params.id, req.identity.uid); res.status(204).end(); }));
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((err, req, res, next) => {
    const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : Number.isInteger(err.status) && [400,404,409,410,429,502,503,504].includes(err.status) ? err.status : 500;
    if (status === 500) console.error('Fallo de almacenamiento CHECKIA', { code: err.code || 'unknown' });
    res.status(status).json({ error: status === 500 ? 'No se pudo completar la operación en Firestore. Revisa permisos y conexión del backend.' : status === 413 ? 'Solicitud demasiado grande.' : err.type === 'entity.parse.failed' ? 'JSON inválido.' : err.message });
  }); return app;
}
'@
},
@{Path='backend/src/firestore-store.js';Content=@'
import {answersConfirmed} from './interview-v8.js';
import {advanceAdditional,availableClarifications,reviewQuestion} from './adaptive.js';
import { buildSummary } from './summary.js';
import { randomUUID } from 'node:crypto';
import { initialInterview, advanceInterview, correctInterview } from './interview.js';
import { assessIncoming } from './safety.js';
export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export class FirestoreStore {
  constructor(db, { now = () => Date.now(), ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    this.db = db; this.now = now; this.ttlMs = ttlMs; this.collection = db.collection('checkia_sessions');
  }
  ref(id) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) fail(404, 'Sesión no disponible.');
    return this.collection.doc(id);
  }
  owned(snapshot, uid, { allowExpired = false } = {}) {
    const s = snapshot.exists ? snapshot.data() : null;
    if (!s || s.ownerUid !== uid) fail(404, 'Sesión no disponible.');
    if (!allowExpired && s.expiresAt <= this.now()) fail(410, 'La sesión expiró. Puedes eliminarla o crear otra.');
    return s;
  }
  async create(uid) {
    const id = randomUUID(), now = this.now();
    const s = { id, ownerUid: uid, createdAt: now, updatedAt: now, expiresAt: now + this.ttlMs,
      status: 'open', messageCount: 0, clinicalState: initialInterview() };
    await this.ref(id).create(s); return { ...s, messages: [], summary:buildSummary(s) };
  }
  async list(uid) {
    const snap = await this.collection.where('ownerUid', '==', uid).limit(20).get();
    return snap.docs.map(d => d.data()).sort((a,b) => b.createdAt - a.createdAt);
  }
  async get(id, uid) {
    const ref = this.ref(id);
    return this.db.runTransaction(async tx => {
      const s = this.owned(await tx.get(ref), uid);
      const messages = await tx.get(ref.collection('messages').orderBy('sequence').limit(200));
      return { ...s, messages: messages.docs.map(d => d.data()), summary:buildSummary(s) };
    });
  }
  async append(id, uid, message, requestId, questionId) {
    const ref = this.ref(id), at = this.now();
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) fail(400, 'requestId debe ser un UUID.');
    const userRef = ref.collection('messages').doc(requestId + '-user');
    const botRef = ref.collection('messages').doc(requestId + '-assistant');
    return this.db.runTransaction(async tx => {
      const s = this.owned(await tx.get(ref), uid);
      const previous = await tx.get(userRef);
      if (previous.exists) {
        if (previous.data().operation === 'correction' || previous.data().text !== message || previous.data().questionId !== questionId) fail(409, 'requestId ya fue usado para otra respuesta.');
        const oldBot = await tx.get(botRef);
        if (!oldBot.exists) fail(409, 'Respuesta incompleta. Recarga la consulta.');
        return { reply: oldBot.data().text, duplicate: true, needsClarification: oldBot.data().kind === 'clarification' };
      }
      if ((await tx.get(botRef)).exists)fail(409,'La solicitud ya se utilizó para otra operación.');
      if (s.status !== 'open') fail(409, 'La sesión está cerrada.');
      if (s.messageCount + 2 > 200) fail(409, 'Límite de prueba alcanzado. Crea otra sesión.');
      const transition = assessIncoming(s.clinicalState, message, questionId, userRef.id, at) || advanceAdditional(s.clinicalState, questionId, message, userRef.id, at) || advanceInterview(s.clinicalState, questionId, message, userRef.id, at);
      const { reply, clinicalState, needsClarification } = transition;
      clinicalState.revision = (s.clinicalState.revision || 0) + 1;
      tx.create(userRef, { id: userRef.id, role: 'user', operation: 'answer', ...(typeof questionId === 'string' ? {questionId} : {}), text: message, createdAt: at, sequence: s.messageCount });
      tx.create(botRef, { id: botRef.id, role: 'assistant', kind: clinicalState.phase === 'safety_alert' ? 'safety_alert' : needsClarification ? 'clarification' : 'question_or_completion', nextQuestionId: clinicalState.pendingQuestions?.[0]?.id || null, text: reply, createdAt: at, sequence: s.messageCount + 1 });
      tx.update(ref, { messageCount: s.messageCount + 2, updatedAt: at, clinicalState });
      return { reply, duplicate: false, needsClarification };
    });
  }
  async correct(id, uid, answer, requestId, factKey, expectedRevision) {
    const ref=this.ref(id), at=this.now();
    if(typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) fail(400,'requestId debe ser un UUID.');
    if(!Number.isInteger(expectedRevision) || expectedRevision < 0) fail(400,'expectedRevision debe ser un entero no negativo.');
    const userRef=ref.collection('messages').doc(requestId+'-user'),botRef=ref.collection('messages').doc(requestId+'-assistant');
    return this.db.runTransaction(async tx=>{
      const s=this.owned(await tx.get(ref),uid),previous=await tx.get(userRef);
      if(previous.exists) {
        const p=previous.data();
        if(p.operation !== 'correction' || p.text !== answer || p.factKey !== factKey || p.expectedRevision !== expectedRevision) fail(409,'requestId ya fue usado para otra operación.');
        const bot=await tx.get(botRef);
        if(!bot.exists) fail(409,'Corrección incompleta. Recarga la consulta.');
        return {reply:bot.data().text,duplicate:true,needsClarification:bot.data().kind==='clarification'};
      }
      if((await tx.get(botRef)).exists)fail(409,'La solicitud ya se utilizó para otra operación.');
      if(s.status !== 'open') fail(409,'La consulta está cerrada.');
      if(s.messageCount + 2 > 200) fail(409,'Límite de prueba alcanzado.');
      const alert=assessIncoming(s.clinicalState,answer,null,userRef.id,at);
      if(!alert && s.clinicalState.pendingQuestions?.[0]?.customFlow)fail(409,'Termina la pregunta pendiente antes de corregir otra respuesta.');
      if(!alert && (s.clinicalState.revision||0) !== expectedRevision) fail(409,'La consulta cambió. Recarga antes de corregir.');
      const {reply,clinicalState,needsClarification}=alert || correctInterview(s.clinicalState,factKey,answer,userRef.id,at);
      clinicalState.revision=(s.clinicalState.revision||0)+1;
      tx.create(userRef,{id:userRef.id,role:'user',operation:'correction',factKey,expectedRevision,text:answer,createdAt:at,sequence:s.messageCount});
      tx.create(botRef,{id:botRef.id,role:'assistant',kind:clinicalState.phase==='safety_alert' ? 'safety_alert' : needsClarification ? 'clarification' : 'correction',nextQuestionId:clinicalState.pendingQuestions?.[0]?.id || null,text:reply,createdAt:at,sequence:s.messageCount+1});
      tx.update(ref,{clinicalState,messageCount:s.messageCount+2,updatedAt:at});
      return {reply,duplicate:false,needsClarification};
    });
  }
  async beginAdditional(id,uid,{expectedRevision,requestId}={},mode) {
    if(!['review','adaptive'].includes(mode))fail(400,'Operación no válida.');
    if(!Number.isInteger(expectedRevision)||expectedRevision<0||typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))fail(400,'Recarga la consulta antes de continuar.');
    const ref=this.ref(id),messageRef=ref.collection('messages').doc(requestId+'-assistant'),userRef=ref.collection('messages').doc(requestId+'-user'),at=this.now();
    return this.db.runTransaction(async tx=>{
      const session=this.owned(await tx.get(ref),uid),previous=await tx.get(messageRef),userMessage=await tx.get(userRef),state=session.clinicalState;
      if(previous.exists){const p=previous.data();if(p.kind!=='additional_start'||p.mode!==mode||p.expectedRevision!==expectedRevision)fail(409,'La solicitud ya se utilizó. Recarga la consulta.');return {duplicate:true};}
      if(userMessage.exists)fail(409,'La solicitud ya se utilizó. Recarga la consulta.');
      if(session.status!=='open'||state?.phase!=='complete'||state.assessment?.type==='safety_alert')fail(409,'No se puede iniciar esta revisión en el estado actual.');
      if(!answersConfirmed(state))fail(409,'Revisa y corrige tus respuestas y confirma que son verdaderas antes de continuar.');
      if((state.revision||0)!==expectedRevision)fail(409,'La consulta cambió. Recarga antes de continuar.');
      if(session.messageCount>=200)fail(409,'Esta consulta alcanzó su límite de mensajes.');
      let pending,next={...state};
      if(mode==='review')pending=reviewQuestion(state);
      else {
        const completed=state.adaptive?.completed||[];
        if(completed.length>=2)fail(409,'Se completaron las dos rondas de aclaraciones. Puedes revisar y corregir el resumen.');
        if(session.orientation?.status!=='ready'||session.orientation.basedOnRevision!==expectedRevision)fail(409,'Primero genera una orientación con tus respuestas actuales.');
        const available=availableClarifications(state),requested=session.orientation.result.aclaraciones_sugeridas||[];
        const chosen=available.filter(q=>requested.includes(q.id)).slice(0,3);
        if(!chosen.length)fail(409,'No quedan aclaraciones disponibles para esta orientación.');
        const questions=chosen.map((q,i)=>({id:'adaptive_'+requestId+'_'+i,kind:'text',customFlow:true,target:q.id,parentKey:q.parentKey,parentSourceMessageId:state.facts.find(f=>f.key===q.parentKey)?.sourceMessageId||null,text:q.question,number:'A'+((state.additionalAnswers||[]).length+i+1)}));
        const active={id:requestId,status:'collecting',questions,index:0,startedAt:at,basedOnRevision:expectedRevision};
        next.adaptive={completed,active};pending=questions[0];
      }
      next={...next,phase:'collecting',pendingQuestions:[pending],revision:expectedRevision+1};
      tx.create(messageRef,{id:messageRef.id,role:'assistant',kind:'additional_start',mode,expectedRevision,nextQuestionId:pending.id,text:pending.text,createdAt:at,sequence:session.messageCount});
      tx.update(ref,{clinicalState:next,messageCount:session.messageCount+1,updatedAt:at});return {duplicate:false};
    });
  }
  async close(id, uid) {
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      this.owned(await tx.get(ref), uid);
      tx.update(ref, { status: 'closed', updatedAt: this.now() });
    });
  }
  async delete(id, uid) {
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      this.owned(await tx.get(ref), uid, { allowExpired: true });
      const messages = await tx.get(ref.collection('messages').limit(201));
      if (messages.docs.length > 200) fail(409, 'Sesión fuera del límite de borrado de esta etapa.');
      for (const m of messages.docs) tx.delete(m.ref);
      tx.delete(ref);
    });
  }
}
'@
},
@{Path='backend/src/interview-v8.js';Content=@'
import {parseMeasurement} from './demographics.js';
import {parseAge,parseDirectSex,parsePain,directMeasurement} from './direct-input-v4.js';
// Protocolo técnico de recopilación: sin clasificación ni interpretación clínica.
import { normalize, answerStatus, reasonIssue, detailIssue, hasReportedTime } from './response-quality.js';
import { CLEAN_SCREEN_QUESTION as SCREEN_QUESTION, initialSafety, recordScreen } from './safety.js';
export const PROTOCOL_ID = 'intake-demo-v8';
export const QUESTIONS = Object.freeze([
 {id:'name',kind:'name',text:"¿Cómo te llamas?"},
 {id:'age',kind:'age',text:"¿Qué edad tienes?"},
 {id:'sex',kind:'sex',text:"¿Masculino (M) o femenino (F)?"},
 {id:'weight',kind:'weight',text:"¿Cuál es tu peso en kg?"},
 {id:'height',kind:'height',text:"¿Cuál es tu altura en cm?"},
 {id:'reason',kind:'text',text:"¿Motivo de tu consulta?"},
 {id:'onset',kind:'text',text:"¿Cuándo comenzaron tu dolencia o tus síntomas?"},
 {id:'location',kind:'text',text:"¿En qué parte le afecta?"},
 {id:'severity',kind:'severity',text:"Si tienes dolor, ¿qué intensidad tiene del 1 al 10? Si no tienes dolor, escribe 0."},
 {id:'associated',kind:'text',text:"¿Qué otros síntomas presentas?"},
 {id:'history',kind:'text',text:"¿Has tenido alguna enfermedad en el pasado?"},
 {id:'medications',kind:'text',text:"¿Tomas algún medicamento?"},
 {id:'allergies',kind:'text',text:"¿Tienes algún tipo de alergia?"},
 {id:'allergy_reaction',kind:'text',text:"¿Qué medicamento o remedio consumes para la alergia?"},
 {id:'allergy_timing',kind:'text',text:"¿Desde cuándo la tienes y cuándo fue la última vez?"},
 {id:'family_history',kind:'text',text:'¿Tienes alguna enfermedad hereditaria y cuál es?'},
 {id:'answers_confirmation',kind:'confirmation',text:'¿Sus respuestas son verdaderas? (Sí/No)'}
]);
// Regla acotada: identifica solo saludos y fórmulas de cortesía conocidas.
// No busca palabras dentro de una descripción ni interpreta síntomas.
export function isGreetingOnly(answer) {
  let remaining = normalize(answer).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!remaining) return true;
  const greeting = /^(?:hola que tal|que tal|como estas|como esta|buenos dias|buenas tardes|buenas noches|buen dia|muy buenas|que onda|de acuerdo|por favor|hola|holi|buenas|saludos|hey|hello|hi|gracias|okay|ok|vale|checkia|asistente)(?:\s+|$)/;
  while (remaining) {
    const match = remaining.match(greeting);
    if (!match) return false;
    remaining = remaining.slice(match[0].length).trim();
  }
  return true;
}
export function initialInterview() {
  return { schemaVersion: 2, protocolId: PROTOCOL_ID, validationVersion: 16, revision: 0, phase: 'collecting', facts: [], pendingQuestions: [{ ...QUESTIONS[0] }], clarificationContext: null, safety: initialSafety(), assessment: null };
}
function error(status, message) { throw Object.assign(new Error(message), { status }); }
function validateAnswer(question,answer) {
 const status=answerStatus(answer);
 if(question.kind==='confirmation'&&!/^(?:si|no)[.!]?$/.test(normalize(answer)))error(400,'Responde Sí o No para confirmar tus respuestas.');
 if(status==='reported') {
  if(question.kind==='name'&&(answer.length>80||!/^[-\p{L}\p{M} '\u2019]+$/u.test(answer))) error(400,'Escribe solo tus nombres o un alias de hasta 80 caracteres. También puedes escribir Prefiero no responder.');

  if(question.kind==='sex') {
   if(/^(?:t|therian)$/.test(normalize(answer))) error(400,'Esta opción no corresponde al dato solicitado. Escribe M, F, No sé o Prefiero no responder para continuar.');
   parseDirectSex(answer);
  }
  if(question.kind==='severity'&&!/^(?:[0-9]|10)$/.test(normalize(answer))) error(400,'Escribe un número de 0 a 10; 0 significa sin dolor.');

 }
 if(['sex'].includes(question.kind)&&status==='not_applicable') error(400,'Puedes escribir No sé o Prefiero no responder para este dato.');
 return status;
}
const knownNone = text => /^(?:no|no tengo|no tengo ninguna|ninguno|ninguna|ninguno referido|ninguna referida|ninguna conocida|ninguno conocido|no tomo medicamentos|no tomo nada|no tomo remedios|no uso remedios|no consumo remedios|ningun remedio|sin remedios|no tengo alergias|no tengo ninguna alergia|no soy alergico|no soy alergica|no soy alergico a nada|no soy alergica a nada|sin alergias conocidas)$/.test(normalize(text).replace(/[.!]+$/g,''));
const bareYes=text=>/^(?:si|si tomo|si tengo|si consumo)[.!]?$/.test(normalize(text));
const yesNo=text=>/^(?:si|no)[.!]?$/.test(normalize(text));
const remedyQuestions = [
 {id:'remedies_detail',parentKey:'medications',kind:'text',text:'¿Cuál es el remedio y qué contiene? Si no sabes, escribe No sé.'},
 {id:'remedies_since',parentKey:'medications',kind:'text',text:'¿Desde cuándo lo consumes y por qué lo consumes? Si no sabes, escribe No sé.'}
];
export function followupsFor(key,answer,status) {
 // Una negación de medicamentos no equivale a negar el uso de remedios.
 if(key==='medications'&&status==='none_reported')return [{id:'remedies_use',parentKey:key,kind:'text',text:'¿Tomas algún remedio casero, naturista o botánico? Responde Sí, No o No sé.'}];
 if(status!=='reported')return [];
 const n=normalize(answer);
 if(key==='onset'&&!hasReportedTime(n))return [{id:'onset_when',parentKey:key,kind:'text',text:'¿Recuerdas cuándo comenzó? Puedes dar una fecha o un aproximado. Si no recuerdas, escribe No sé.'}];
 if(key==='location')return [
  {id:'location_description',parentKey:key,kind:'text',text:'Descríbeme su dolor o afectación.'}
 ];
 if(key==='history'&&/^(?:si|si he tenido(?: alguna)?|si tengo|he tenido)$/.test(n.replace(/[.!]+$/g,'')))return [{id:'history_detail',parentKey:key,kind:'text',text:'¿Cuál enfermedad o dolencia has tenido?'}];
 if(key==='medications')return [
  {id:'medications_details',parentKey:key,kind:'text',text:'¿Qué medicamento tomas, por qué, cuánto consumes (dosis) y desde cuándo?'},
  {id:'medications_knows_active',parentKey:key,kind:'text',text:'¿Sabes cuál es su principio activo? Responde Sí, No o No sé.'}
 ];
 if(key==='allergies'&&bareYes(answer))return [{id:'allergies_substance',parentKey:key,kind:'text',text:'¿Cuál alergia tienes?'}];
 if(key==='family_history'&&!knownNone(answer))return [...(bareYes(answer)?[{id:'family_history_condition',parentKey:key,kind:'text',text:'¿Cuál es la enfermedad hereditaria?'}]:[]),{id:'family_history_relative',parentKey:key,kind:'text',text:'¿Quién de tus familiares la tuvo o la tiene?'}];
 return [];
}
// Preserve every free-text response; normalize only an unambiguous supported value.
function freeNumericData(kind,answer){
 try{
  if(kind==='age')return {numericValue:parseAge(answer)};
  const normalizedAnswer=normalize(answer).replace(',','.');
  if(!/^\d+(?:\.\d+)?\s*(?:kg|kilos?|kilogramos?|cm|centimetros?|m|metros?)?$/.test(normalizedAnswer))return {};
  return {measurement:parseMeasurement(kind,answer)};
 }catch{return {};}
}
function factFrom(question, answer, sourceMessageId, at) {
  const status=validateAnswer(question,answer);
  const valueData=status!=='reported'?{}:['age','weight','height'].includes(question.kind)?freeNumericData(question.kind,answer):question.kind==='sex'?{codedValue:parseDirectSex(answer),dataType:'self_reported_sex'}:question.kind==='severity'?{pain:parsePain(answer)}:{};
  return {...valueData,key:question.id,question:question.text,text:answer,status:status === 'reported' && ['medications','allergies','family_history'].includes(question.id) && knownNone(answer) ? 'none_reported' : status,source:'user_report',sourceMessageId,recordedAt:at,clarifications:[]};
}
function resultFor(state, reply, needsClarification=false) {
  return {clinicalState:{...state,validationVersion:16,safety:state.safety||initialSafety(),assessment:null},reply,needsClarification};
}
function requestDetail(state, question, answer, sourceMessageId, at, reply) {
  const event = {questionId:question.id,text:answer,sourceMessageId,recordedAt:at,reason:reply,source:'user_report'};
  return resultFor({...state,qualityEvents:[...(state.qualityEvents || []),event]},reply,true);
}
function personalized(question,facts) {
 if(!question) return null;
 const name=facts.find(f=>f.key==='name');
 if(name?.status!=='reported'||!['age','weight','height'].includes(question.id)) return {...question};
 const display=name.text.trim().replace(/\s+/g,' ').slice(0,60);
 return {...question,text:question.text.replace('?',`, ${display}?`)};
}
function skipAllergyDetails(state,fact) {
 const facts=[...state.facts.filter(f=>!['allergies','allergy_reaction','allergy_timing','answers_confirmation'].includes(f.key)),fact];
 for(const key of ['allergy_reaction','allergy_timing']) {
  const q=QUESTIONS.find(q=>q.id===key),old=state.facts.find(f=>f.key===key);
  const revisions=old?[...(old.revisions||[]),{text:old.text,status:old.status,clarifications:old.clarifications||[],sourceMessageId:old.sourceMessageId,recordedAt:old.recordedAt}]:[];
  facts.push({key,question:q.text,text:'No se preguntó: no refieres una alergia identificada en la respuesta anterior.',status:'not_applicable',source:'conditional_skip',sourceMessageId:fact.sourceMessageId,recordedAt:fact.recordedAt,clarifications:[],autoSkipped:true,revisions});
 }
 const next=personalized(QUESTIONS.find(q=>!facts.some(f=>f.key===q.id)),facts);
 return resultFor({...state,facts,phase:next?'collecting':'complete',pendingQuestions:next?[next]:[],clarificationContext:null},next?next.text:'Respuestas guardadas.');
}
function finishMain(state, fact) {
  if(fact.key==='allergies'&&fact.status!=='reported') return skipAllergyDetails(state,fact);
  const facts=[...state.facts,fact], next=fact.key === 'height' ? SCREEN_QUESTION : personalized(QUESTIONS.find(q=>!facts.some(f=>f.key===q.id)),facts);
  return resultFor({...state,facts,clarificationContext:null,pendingQuestions:next ? [{...next}] : [],phase:next ? 'collecting' : 'complete'},next ? next.text : 'Respuestas guardadas. Puedes revisar y corregir el resumen.');
}
function finishClarification(state, context) {
  if (!context.correction) return finishMain(state,context.draft);
  const facts=state.facts.map((f,i)=>i===context.targetIndex ? context.draft : f);
  const restored={...state,facts,clarificationContext:null,pendingQuestions:context.resumePendingQuestions,phase:context.resumePhase};
  return resultFor(restored,context.resumePendingQuestions[0] ? 'Corrección y aclaraciones guardadas. '+context.resumePendingQuestions[0].text : 'Corrección y aclaraciones guardadas. La recopilación sigue terminada; no se ha realizado evaluación clínica.');
}
export function advanceDirect(state, questionId, answer, sourceMessageId, at) {
  if (state?.protocolId !== PROTOCOL_ID) error(409, 'Esta sesión pertenece a la prueba anterior. Crea una nueva para iniciar la entrevista.');
  if (state.phase !== 'collecting') error(409, 'La entrevista ya terminó. Puedes consultar el historial o corregir una respuesta.');
  const question=state.pendingQuestions?.[0];
  if (!question || question.id !== questionId) error(409, 'La pregunta pendiente cambió. Recarga la consulta antes de responder.');
  if (question.id === 'alarm_screen') {
    const safety=recordScreen(state,answer,sourceMessageId,at);
    return resultFor({...state,safety,pendingQuestions:[personalized(QUESTIONS[5],state.facts)]},QUESTIONS[5].text);
  }
  if ((question.id === 'reason' || question.parentKey) && isGreetingOnly(answer)) {
    return resultFor(state,question.id === 'reason' ? 'Hola. Cuéntame qué molestia tienes para registrar el motivo de tu consulta.' : 'Necesito una respuesta a esta aclaración. Describe el dato que conozcas o escribe No sé o Prefiero no responder.',true);
  }
  const issue = question.id === 'reason' ? reasonIssue(answer) : question.parentKey ? detailIssue(question.id, answer) : null;
  if (issue) return requestDetail(state,question,answer,sourceMessageId,at,issue);
  if(question.id==='onset_when'&&answerStatus(answer)==='reported'&&!hasReportedTime(answer)&&! /\b(?:infancia|desde nino|desde nina)\b/.test(normalize(answer)))
    return requestDetail(state,question,answer,sourceMessageId,at,'Dime cuándo empezó: por ejemplo ayer, hace 2 días o una fecha. Si no recuerdas, escribe No sé.');
  if(question.id==='history_detail'&&/^(?:si|si he tenido|si tengo)$/.test(normalize(answer).replace(/[.!]+$/g,''))) return requestDetail(state,question,answer,sourceMessageId,at,'Escribe cuál enfermedad o dolor has tenido. Si no lo recuerdas, escribe No sé.');
  if (['medications_identity','location_description','remedies_detail'].includes(question.id)&&/^(?:si|no|ok)$/.test(normalize(answer))) return requestDetail(state,question,answer,sourceMessageId,at,'Describe el dato que te pide la pregunta. Si no lo sabes, escribe No sé; también puedes escribir Prefiero no responder.');
  if(['remedies_use','medications_knows_active'].includes(question.id)&&answerStatus(answer)==='reported'&&!yesNo(answer)&&!knownNone(answer))return requestDetail(state,question,answer,sourceMessageId,at,'Responde Sí, No o No sé.');
  if (['medications_details','medications_identity','allergies_substance','family_history_condition','family_history_relative'].includes(question.id)&&/^(?:si|no|ok)$/.test(normalize(answer)))return requestDetail(state,question,answer,sourceMessageId,at,'Describe el dato que conoces o escribe No sé.');
  if (state.clarificationContext) {
    const context=structuredClone(state.clarificationContext);
    if (!question.parentKey || question.parentKey !== context.draft.key) error(409,'Aclaración incompatible. Recarga la consulta.');
    const status=['remedies_use','medications_knows_active'].includes(question.id)&&knownNone(answer)?'none_reported':answerStatus(answer);
    context.draft.clarifications.push({key:question.id,question:question.text,text:answer,status,source:'user_report',sourceMessageId,recordedAt:at});
    // No corresponde expresa que el texto original no era una declaración de alergia.
    const next=context.remainingQuestions.slice(1);
    if(question.id==='remedies_use'&&status==='reported'&&bareYes(answer))next.push(...remedyQuestions.map(q=>({...q})));
    if(question.id==='medications_knows_active'&&status==='reported'&&bareYes(answer))next.push({id:'medications_identity',parentKey:'medications',kind:'text',text:'Menciona cuál es el principio activo que indica la caja. Si no sabes, escribe No sé.'});
    if (question.id === 'allergies_substance' && status === 'not_applicable') {
      context.draft.status='not_applicable';return finishClarification(state,context);
    }
    if (!next.length) return finishClarification(state,context);
    context.remainingQuestions=next;
    return resultFor({...state,clarificationContext:context,pendingQuestions:[next[0]]},next[0].text,true);
  }
  if (question.id !== QUESTIONS.find(q=>!state.facts.some(f=>f.key===q.id))?.id) error(409,'Estado incompatible. Crea una nueva entrevista.');
  const fact=factFrom(question,answer,sourceMessageId,at), followups=followupsFor(fact.key,answer,fact.status);
  if (!followups.length) return finishMain(state,fact);
  const context={draft:fact,remainingQuestions:followups,correction:false};
  return resultFor({...state,clarificationContext:context,pendingQuestions:[followups[0]]},followups[0].text,true);
}
function correctCore(state, key, answer, sourceMessageId, at) {
  if (state?.protocolId !== PROTOCOL_ID) error(409,'Esta consulta no admite correcciones de esta entrevista.');
  if (state.clarificationContext) error(409,'Termina la aclaración pendiente antes de corregir otra respuesta.');
  const targetIndex=state.facts.findIndex(f=>f.key===key),question=QUESTIONS.find(q=>q.id===key);
  if(targetIndex<0 || !question) error(400,'Selecciona una respuesta ya registrada.');
  if(state.facts[targetIndex].autoSkipped) error(400,'Primero corrige la pregunta 15 sobre tus alergias para responder las preguntas que se omitieron.');
  if(key==='reason' && isGreetingOnly(answer)) error(400,'Un saludo no puede sustituir el motivo de consulta. Describe el problema o escribe No sé.');
  if(key==='reason' && reasonIssue(answer)) error(400,reasonIssue(answer));
  const old=state.facts[targetIndex], fact=factFrom(question,answer,sourceMessageId,at);
  fact.revisions=[...(old.revisions||[]),{text:old.text,status:old.status,clarifications:old.clarifications||[],sourceMessageId:old.sourceMessageId,recordedAt:old.recordedAt,supersededAt:at}];
  const facts=state.facts.map((f,i)=>i===targetIndex ? fact : f),followups=followupsFor(key,answer,fact.status);
  if(key==='allergies'&&fact.status!=='reported') return skipAllergyDetails(state,fact);
  if(key==='allergies'&&fact.status==='reported') {
   const reset=state.facts.filter(f=>!['allergies','allergy_reaction','allergy_timing','answers_confirmation'].includes(f.key));
   fact.revisions=[...(fact.revisions||[]),...state.facts.filter(f=>['allergy_reaction','allergy_timing'].includes(f.key)).map(f=>({text:f.text,status:f.status,clarifications:f.clarifications||[],sourceMessageId:f.sourceMessageId,recordedAt:f.recordedAt,dependentKey:f.key}))];
   const transition=advanceDirect({...state,facts:reset,pendingQuestions:[{...question}],phase:'collecting'},'allergies',answer,sourceMessageId,at);
   const revised=transition.clinicalState.clarificationContext?.draft || transition.clinicalState.facts.find(f=>f.key==='allergies');
   revised.revisions=fact.revisions;return transition;
  }
  if (!followups.length) return resultFor({...state,facts},state.pendingQuestions[0] ? 'Corrección guardada. '+state.pendingQuestions[0].text : 'Corrección guardada. La recopilación sigue terminada; no se ha realizado evaluación clínica.');
  const context={draft:fact,remainingQuestions:followups,correction:true,targetIndex,resumePendingQuestions:state.pendingQuestions,resumePhase:state.phase};
  return resultFor({...state,facts,phase:'collecting',clarificationContext:context,pendingQuestions:[followups[0]]},'Corrección guardada. '+followups[0].text,true);
}


// Una corrección cambia la base de la confirmación: debe confirmarse de nuevo.
export function correctDirect(state,key,...args){
 if(key==='answers_confirmation')return correctCore(state,key,...args);
 const hadConfirmation=state.facts?.some(f=>f.key==='answers_confirmation');
 const base=hadConfirmation?{...state,facts:state.facts.filter(f=>f.key!=='answers_confirmation'),phase:'collecting',pendingQuestions:[{...QUESTIONS.find(q=>q.id==='answers_confirmation')}]}:state;
 return correctCore(base,key,...args);
}
export function answersConfirmed(state){
 if(!['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state?.protocolId))return true;
 const answer=state.facts?.find(f=>f.key==='answers_confirmation');
 return !!answer&&normalize(answer.text).replace(/[.!]$/,'')==='si';
}
'@
},
@{Path='backend/src/interview.js';Content=@'
import {advanceDirect as v8Advance,correctDirect as v8Correct} from './interview-v8.js';
import {advanceDirect as v7Advance,correctDirect as v7Correct} from './interview-v7.js';
import {advanceDirect as v6Advance,correctDirect as v6Correct} from './interview-v6.js';
export {initialInterview,QUESTIONS,PROTOCOL_ID,isGreetingOnly,followupsFor} from './interview-v8.js';
import {advanceDirect as v5Advance,correctDirect as v5Correct} from './interview-v5.js';
import {advanceDirect,correctDirect} from './direct-interview.js';
import {advanceDirect as v3Advance,correctDirect as v3Correct} from './interview-v3.js';
import {advanceInterview as previousAdvance,correctInterview as previousCorrect} from './interview-v2.js';
export const advanceInterview=(state,...args)=>state?.protocolId==='intake-demo-v8'?v8Advance(state,...args):state?.protocolId==='intake-demo-v7'?v7Advance(state,...args):state?.protocolId==='intake-demo-v6'?v6Advance(state,...args):state?.protocolId==='intake-demo-v5'?v5Advance(state,...args):state?.protocolId==='intake-demo-v4'?advanceDirect(state,...args):state?.protocolId==='intake-demo-v3'?v3Advance(state,...args):previousAdvance(state,...args);
export const correctInterview=(state,...args)=>state?.protocolId==='intake-demo-v8'?v8Correct(state,...args):state?.protocolId==='intake-demo-v7'?v7Correct(state,...args):state?.protocolId==='intake-demo-v6'?v6Correct(state,...args):state?.protocolId==='intake-demo-v5'?v5Correct(state,...args):state?.protocolId==='intake-demo-v4'?correctDirect(state,...args):state?.protocolId==='intake-demo-v3'?v3Correct(state,...args):previousCorrect(state,...args);
'@
},
@{Path='backend/src/orientation.js';Content=@'
import {answersConfirmed} from './interview-v8.js';
import {RAG_VERSION,bindEvidence} from './rag.js';
import {availableClarifications,safetyReviewCurrent} from './adaptive.js';
import {randomUUID} from 'node:crypto';
import {buildSummary} from './summary.js';
import {validateOrientation} from './openai-client.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function orientationContext(session) {
 const summary=buildSummary(session);
 const context={availableClarifications:availableClarifications(session.clinicalState),purpose:'Preparar una evaluación profesional con información referida; no diagnóstico ni triaje.',safety:{status:summary.safety.status,screenAnswer:summary.safety.screenText},reviewNotes:summary.warnings.map(w=>w.text),fields:summary.groups.flatMap(g=>g.fields).filter(f=>f.key!=='name').map(f=>({key:f.key,label:f.label,answer:f.text,status:f.status,omitted:f.autoSkipped,measurement:f.measurement,pain:f.pain,clarifications:f.details.map(d=>({label:d.label,answer:d.text,status:d.status}))}))};
 if(JSON.stringify(context).length>32000)fail(400,'La consulta contiene demasiado texto para esta orientación. Revisa y resume tus respuestas.');
 return context;
}
export class OrientationService {
 constructor(store,client,{now=()=>Date.now(),leaseMs=90000,retriever=null}={}){this.store=store;this.client=client;this.now=now;this.leaseMs=leaseMs;this.retriever=retriever;}
 async generate(id,uid,{consent,expectedRevision}={}){
  if(consent!==true)fail(400,'Confirma el envío de tus respuestas para generar la orientación.');
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)fail(400,'Recarga la consulta antes de generar la orientación.');
  const ref=this.store.ref(id),token=randomUUID(),at=this.now();
  const claim=await this.store.db.runTransaction(async tx=>{
   const session=this.store.owned(await tx.get(ref),uid),state=session.clinicalState;
   if(state?.phase==='safety_alert'||state?.assessment?.type==='safety_alert')fail(409,'Esta consulta tiene una alerta. Busca ayuda y sigue las indicaciones de emergencia.');
   if(state?.phase!=='complete')fail(409,'Termina la entrevista antes de generar la orientación.');
   if((state.revision||0)!==expectedRevision)fail(409,'Tus respuestas cambiaron. Recarga la consulta y revísalas.');
   if(!answersConfirmed(state))fail(409,'Revisa y corrige tus respuestas y confirma que son verdaderas antes de generar orientación.');
   if(this.retriever)this.retriever.ensureReady();
   if(session.orientation?.status==='ready'&&session.orientation.basedOnRevision===expectedRevision&&session.orientation.promptVersion===(this.client?.promptVersion||'orientation-rag-v1')&&session.orientation.retrievalVersion===(this.retriever?.version||'disabled'))return {cached:session.orientation};
   if(!safetyReviewCurrent(state))fail(409,'Antes de generar la orientación, comprueba nuevamente las señales actuales.');
   if(session.status!=='open')fail(409,'La consulta está cerrada. Puedes revisar la orientación guardada.');
   if(!this.client?.configured)fail(503,'La orientación no está disponible en este momento. Puedes seguir consultando tu resumen.');
   if(session.orientationRun?.status==='pending'&&session.orientationRun.expiresAt>at)fail(409,'Tu orientación se está preparando. Espera y recarga la consulta.');
   if((session.orientationAttempts||0)>=5)fail(429,'Esta consulta alcanzó el límite de solicitudes de orientación.');
   if(session.orientationRun?.status==='failed'&&at-session.orientationRun.updatedAt<15000)fail(429,'Espera unos segundos antes de intentarlo nuevamente.');
   const context=orientationContext(session);
   tx.update(ref,{orientationAttempts:(session.orientationAttempts||0)+1,orientationRun:{status:'pending',token,basedOnRevision:expectedRevision,expiresAt:at+this.leaseMs,updatedAt:at},orientationConsent:{provider:'OpenAI',version:'22.2',acceptedAt:at,basedOnRevision:expectedRevision}});
   return {context};
  });
  if(claim.cached)return {orientation:claim.cached,cached:true};
  try {
   const evidence=this.retriever?await this.retriever.retrieve(claim.context):{version:RAG_VERSION,status:'insufficient_evidence',retrieved:[],sources:[],usage:{inputTokens:0}};
   // La consulta puede cambiar mientras responde el servicio de embeddings.
   const fresh=await this.store.get(id,uid);
   if(fresh.status!=='open'||fresh.clinicalState?.phase!=='complete'||fresh.clinicalState.revision!==expectedRevision||fresh.clinicalState.assessment?.type==='safety_alert')fail(409,'Tus respuestas cambiaron durante la búsqueda. Revisa el resumen antes de generar la orientación.');
   const context={...claim.context,evidence:{status:evidence.status,retrieved:evidence.retrieved.map(c=>({id:c.id,title:c.title,section:c.section,text:c.text,checkedAt:c.checkedAt}))}};
   const generated=await this.client.generate(context);
   const validated=validateOrientation(generated.result);
   const allowed=new Set(claim.context.availableClarifications.map(q=>q.id));
   const {result,rag}=bindEvidence({...validated,aclaraciones_sugeridas:validated.aclaraciones_sugeridas.filter(id=>allowed.has(id))},evidence);
   const orientation={status:'ready',retrievalVersion:this.retriever?.version||'disabled',rag,basedOnRevision:expectedRevision,createdAt:this.now(),provider:'OpenAI',model:generated.model,promptVersion:generated.promptVersion,result,usage:generated.usage,clinicallyValidated:false};
   await this.store.db.runTransaction(async tx=>{
    const session=this.store.owned(await tx.get(ref),uid),state=session.clinicalState;
    if(session.orientationRun?.token!==token)fail(409,'La solicitud cambió. Recarga la consulta.');
    if(session.status!=='open'||state?.phase!=='complete'||(state.revision||0)!==expectedRevision||state.assessment?.type==='safety_alert')fail(409,'Tus respuestas cambiaron durante la generación. Revisa el resumen antes de intentarlo nuevamente.');
    tx.update(ref,{orientation,orientationRun:{status:'ready',token,basedOnRevision:expectedRevision,updatedAt:this.now()},updatedAt:this.now()});
   });
   return {orientation,cached:false};
  } catch(error) {
   try{await this.store.db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().orientationRun?.token===token)tx.update(ref,{orientationRun:{status:'failed',token,basedOnRevision:expectedRevision,updatedAt:this.now()}});});}catch{}
   throw error;
  }
 }
}
'@
},
@{Path='backend/src/safety.js';Content=@'
// Prototipo de alarmas de alcance limitado. No clasifica pacientes ni descarta emergencias.
export const SAFETY_VERSION = 'alarm-demo-v2';
export const SOURCES = Object.freeze({
  general: {title:'MedlinePlus: reconocimiento de emergencias médicas',url:'https://medlineplus.gov/spanish/ency/article/001927.htm'},
  abdominal: {title:'NHS: stomach ache',url:'https://www.nhs.uk/symptoms/stomach-ache/'},
  headache: {title:'NHS: headaches',url:'https://www.nhs.uk/symptoms/headaches/'},
  chest: {title:'East of England Ambulance Service: when to call 999',url:'https://www.eastamb.nhs.uk/your-service/using-999'},
  mexico: {title:'Gobierno de México: 911',url:'https://www.gob.mx/911'}
});
export const SCREEN_QUESTION = Object.freeze({id:'alarm_screen',kind:'safety',text:'Antes de continuar: ¿la persona presenta AHORA alguna de estas señales?\n• Dificultad importante para respirar o atragantamiento.\n• Dolor o presión en el pecho fuerte o que no cede.\n• Sangrado que no se detiene o vómito con sangre.\n• Pérdida de conocimiento o no responde.\n• Dificultad repentina para hablar o debilidad de un lado.\n• Dolor abdominal muy intenso o de aparición muy repentina.\n• Dolor de cabeza que empezó de repente y es extremadamente intenso.\nResponde Sí, No o No sé. Esta lista no cubre todas las emergencias.'});
export const V3_SCREEN_QUESTION=Object.freeze({id:'alarm_screen',kind:'safety',text:"Antes de continuar, responde sinceramente: ¿tienes alguna de estas señales ahora?\na) ¿Tienes dificultad importante para respirar o atragantamiento (te estás asfixiando)?\nb) ¿Tienes dolor o presión fuerte o intensa en el pecho?\nc) ¿Tienes sangrado que no se detiene o vómito con sangre?\nd) ¿Usted tiene pérdida de conocimiento o no responde bien estas preguntas?\ne) ¿Tienes dificultad para hablar o debilidad de un lado de la boca ahora?\nf) ¿Tienes dolor abdominal muy intenso (estómago, vientre, intestinos o riñón)?\ng) ¿Tienes dolor de cabeza intenso (migraña) o te has desmayado antes de responder esto?\nResponde Sí, una letra de la a a la g, No o No sé. Esta lista no cubre todas las emergencias. Si alguien no responde, busca ayuda sin esperar el formulario."});
export const DIRECT_SCREEN_QUESTION=Object.freeze({id:"alarm_screen",kind:"safety",text:"ANTES DE CONTINUAR: ¿TIENES ALGUNA DE ESTAS SEÑALES?\na) ¿Tienes dificultad importante para respirar o atragantamiento?\nb) ¿Tienes dolor o presión fuerte o intensa en el pecho?\nc) ¿Tienes sangrado que no se detiene o vómito con sangre?\nd) ¿Usted tiene pérdida de conocimiento o te sientes realmente mareado?\ne) ¿Tienes dificultad para hablar o debilidad de un lado de la boca ahora?\nf) ¿Tienes dolor abdominal muy intenso (estómago, vientre)?\ng) ¿Tienes dolor de cabeza intenso (migraña) o has sufrido un desmayo hoy?\nResponde Sí, una letra de la a a la g, No o No sé."});
export const MOBILE_SCREEN_QUESTION=Object.freeze({id:'alarm_screen',kind:'safety',screenVersion:'mobile-screen-v1',text:'ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA?\na) ¿Tienes dificultad para respirar?\nb) ¿Tienes dolor intenso o presión en el pecho?\nc) ¿Tienes sangrado o vómito con sangre?\nd) ¿Tuviste pérdida de conocimiento o estás mareado ahora?\ne) ¿Tienes mareo, náuseas o desmayo?\nf) ¿Tienes dolor abdominal intenso (estómago, vientre)?\ng) ¿Tienes dolor de cabeza intenso?\nh) ¿Tienes sudoración fría, repentina o pegajosa?\nResponde Sí, una letra de la a a la h, No o No sé.'});
export const COMPACT_SCREEN_QUESTION=Object.freeze({...MOBILE_SCREEN_QUESTION,screenVersion:'mobile-screen-v2',text:MOBILE_SCREEN_QUESTION.text.replace('ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA?','ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA? SÍ/NO').replace('\nResponde Sí, una letra de la a a la h, No o No sé.','')});
export function selectedScreenLetters(answer,maxLetter='g') {
 const n=normalized(answer).replace(/^(?:la\s+)?(?:opcion|letra)\s+/,'').replace(/[.!?¿¡]+$/g,'').trim();
 return new RegExp('^[a-'+maxLetter+'][).:]?(?:(?:\\s*[,;/]\\s*|\\s+y\\s+|\\s+)[a-'+maxLetter+'][).:]?)*$').test(n);
}
export function initialSafety() {return {version:SAFETY_VERSION,status:'not_screened',screenAnswer:null};}
const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const RULES = [
  {id:'breathing',label:'Dificultad respiratoria referida',source:'general',match:t=>/\b(?:me cuesta mucho respirar|se me dificulta mucho respirar|no puedo respirar|no puede respirar|no logro respirar|me estoy ahogando|se esta ahogando|me falta el aire|me falta aire|dificultad (?:grave|intensa|severa) para respirar)\b/.test(t)},
  {id:'chest',label:'Dolor o presión torácica referidos',source:'chest',match:t=>/\b(?:dolor (?:en el |de )pecho|presion (?:en el |de )pecho|presion fuerte en el pecho|dolor fuerte en el pecho|me duele el pecho|me aprieta el pecho)\b/.test(t)},
  {id:'bleeding',label:'Sangrado preocupante referido',source:'general',match:t=>/\b(?:vomito sangre|vomitando sangre|vomita sangre|sangrado que no (?:para|se detiene)|sangro y no para|sangro sin parar)\b/.test(t)},
  {id:'consciousness',label:'Falta de respuesta o pérdida de conocimiento referidas',source:'general',match:t=>/\b(?:me acabo de desmayar|me estoy desmayando|esta inconsciente|(?:la persona|mi madre|mi mama|mi padre|mi papa|el paciente|mi hijo|mi hija) no responde|no despierta|no se despierta|perdio el conocimiento|ha perdido el conocimiento)\b/.test(t)},
  {id:'neurological',label:'Cambio neurológico repentino referido',source:'general',match:t=>/\b(?:de repente|repentinamente)\b.{0,90}\b(?:me cuesta hablar|se me dificulta hablar|no puedo hablar|no puede hablar|no puedo mover un lado|no puede mover un lado|debilidad de un lado)\b|\b(?:me cuesta hablar|se me dificulta hablar|no puedo hablar|no puede hablar|debilidad de un lado)\b.{0,90}\b(?:de repente|repentinamente)\b/.test(t)},
  {id:'abdominal',label:'Dolor abdominal intenso o repentino referido',source:'abdominal',match:t=>/\b(?:abdomen|abdominal|estomago|vientre|panza)\b/.test(t) && /\b(?:dolor|duele)\b/.test(t) && /\b(?:insoportable|muy fuerte|muy intenso|intenso|severo|repentino|de repente|no soporto|me estoy muriendo)\b/.test(t)},
  {id:'headache',label:'Dolor de cabeza repentino y muy intenso referido',source:'headache',match:t=>/\b(?:dolor de cabeza|duele la cabeza)\b/.test(t) && /\b(?:de repente|repentinamente|repentino|subito)\b/.test(t) && /\b(?:extremadamente|insoportable|muy fuerte|muy intenso|peor dolor)\b/.test(t)}
];
export function detectSignals(text) {
  // Negaciones e historia solo se manejan en formas sencillas, por cláusula.
  // Esta regla no ofrece comprensión semántica ni cobertura exhaustiva.
  const clauses=normalized(text).split(/[.;!?\n]+|\b(?:pero|aunque|y)\b/).map(t=>t.trim()).filter(Boolean);
  const found=new Map();
  for(const clause of clauses) {
    if (/\b(?:no tengo|no presento|no siento|no me duele|no le duele|no vomito|sin dolor|niego|no hay|nunca he tenido)\b/.test(clause)) continue;
    if (/\b(?:hace anos|hace meses|el ano pasado|tuve|tenia|ya se me quito|ya no tengo)\b/.test(clause)) continue;
    for(const rule of RULES) if(rule.match(clause)) found.set(rule.id,{id:rule.id,label:rule.label,source:SOURCES[rule.source]});
  }
  return [...found.values()];
}
export const ALERT_REPLY = 'Posible señal de alarma reportada. Si corresponde a una situación real actual, busca atención de emergencia ahora. En México llama al 911; fuera de México utiliza el número local de emergencias. No esperes a terminar esta entrevista y no conduzcas tú: pide ayuda. Esta consulta queda interrumpida. Para un caso ficticio, no realices una llamada de emergencia.';
export function assessIncoming(state, text, questionId, sourceMessageId, at) {
  if(state.phase === 'safety_alert') throw Object.assign(new Error('Esta consulta tiene una alerta persistente. Puedes revisar el historial, cerrar la consulta o crear otra prueba.'),{status:409});
  let signals=detectSignals(text);
  const n=normalized(text).replace(/[.!?¿¡]+$/g,'').trim();
  if(['alarm_screen','alarm_recheck'].includes(questionId) && state.pendingQuestions?.[0]?.id === questionId && (/^(?:si|si alguna|si una)$/.test(n)||selectedScreenLetters(text,['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId)?'h':'g'))) {
    signals=[{id:'screen_positive',label:'Alguna señal de la lista fue referida por el usuario',source:SOURCES.general}];
  }
  if(!signals.length) return null;
  const safety={...(state.safety||initialSafety()),status:'possible_alarm',version:SAFETY_VERSION};
  const assessment={type:'safety_alert',engineVersion:SAFETY_VERSION,classification:'possible_emergency',clinicallyValidated:false,signals,sourceMessageId,reportedText:text,createdAt:at,reply:ALERT_REPLY,emergencyNumberMexico:'911',emergencyNumberSource:SOURCES.mexico};
  return {clinicalState:{...state,safety,phase:'safety_alert',pendingQuestions:[],assessment},reply:ALERT_REPLY,needsClarification:false};
}
export function recordScreen(state,answer,sourceMessageId,at) {
  const n=normalized(answer).replace(/[.!?¿¡]+$/g,'').trim();
  const denied=/^(?:no|ninguna|ninguno|no ninguna)$/.test(n);
  const unknown=/^(?:no\s+se|nose|no\s+lo\s+se|prefiero\s+no\s+responder|no\s+recuerdo|no\s+lo\s+recuerdo|no\s+estoy\s+segur[oa])$/.test(n);
  if(!denied && !unknown) throw Object.assign(new Error('Para esta comprobación responde Sí, No o No sé. También puedes describir directamente una señal actual.'),{status:400});
  return {version:SAFETY_VERSION,status:denied ? 'user_denied_listed_signs' : 'unknown',screenAnswer:{text:answer,status:denied ? 'reported_negative' : 'unknown',source:'user_report',sourceMessageId,recordedAt:at}};
}

export const CLEAN_SCREEN_QUESTION=Object.freeze({...COMPACT_SCREEN_QUESTION,screenVersion:'mobile-screen-v3',text:COMPACT_SCREEN_QUESTION.text.replace('ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA? SÍ/NO','¿Tienes algo de esto ahora? (Sí/No)')});
'@
},
@{Path='backend/src/summary.js';Content=@'
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
'@
},
@{Path='backend/test/mobile-v7.test.js';Content=@'
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {FirestoreStore} from '../src/firestore-store.js';import {FakeDB} from '../test-support/fake-db.js';import {orientationContext} from '../src/orientation.js';
import {initialInterview as initialV7} from '../src/interview-v7.js';
const answers={name:'Luis',age:'unos treinta y tantos',sex:'M',weight:'No me he pesado recientemente',height:'soy alto, no recuerdo mi altura',alarm_screen:'No',reason:'molestia leve en la cabeza',onset:'ayer',location:'cabeza',location_detail:'frente',location_description:'presión leve',severity:'3',associated:'ninguno',history:'No',medications:'No',remedies_use:'No',allergies:'No',answers_confirmation:'Sí',family_history:'No',family_history_condition:'diabetes',family_history_relative:'mi madre'};
async function setup(){const store=new FirestoreStore(new FakeDB()),s=await store.create('A');store.db.data.get('checkia_sessions/'+s.id).clinicalState=initialV7();return {store,id:s.id};}
async function send(c,text){const s=await c.store.get(c.id,'A');await c.store.append(c.id,'A',text,randomUUID(),s.clinicalState.pendingQuestions[0].id);return c.store.get(c.id,'A');}
async function until(c,target=null,overrides={}){let s=await c.store.get(c.id,'A'),count=0;while(s.clinicalState.pendingQuestions[0]&&s.clinicalState.pendingQuestions[0].id!==target){assert.ok(count++<40);const id=s.clinicalState.pendingQuestions[0].id;assert.ok(id in {...answers,...overrides},id);s=await send(c,({...answers,...overrides})[id]);}return s;}
test('v7 conserva texto libre en edad, peso y altura sin inventar medidas',async()=>{const c=await setup(),s=await until(c);assert.equal(s.clinicalState.protocolId,'intake-demo-v7');assert.equal(s.clinicalState.validationVersion,15);assert.equal(s.summary.progress.expected,17);for(const key of ['age','weight','height']){const f=s.clinicalState.facts.find(f=>f.key===key);assert.equal(f.text,answers[key]);assert.equal(f.numericValue,undefined);assert.equal(f.measurement,undefined);}assert.equal(s.clinicalState.phase,'complete');});
test('v7 normaliza solo datos reconocibles y mantiene la respuesta original',async()=>{const c=await setup(),s=await until(c,null,{age:'tengo 33 años',weight:'70,5 kg',height:'1,75 m'});const facts=s.clinicalState.facts;assert.equal(facts.find(f=>f.key==='age').numericValue,33);assert.equal(facts.find(f=>f.key==='age').text,'tengo 33 años');assert.equal(facts.find(f=>f.key==='weight').measurement.value,70.5);assert.equal(facts.find(f=>f.key==='height').measurement.value,175);});
test('v7 familia: No y desconocido no provocan seguimiento; Sí pregunta enfermedad y familiar',async()=>{for(const response of ['No','No sé','Sí','Sí, diabetes']){const c=await setup(),s=await until(c,null,{family_history:response});const f=s.clinicalState.facts.find(f=>f.key==='family_history');assert.equal(f.clarifications.length,response==='Sí'?2:response==='Sí, diabetes'?1:0);if(response.startsWith('Sí'))assert.equal(f.clarifications.at(-1).text,'mi madre');assert.equal(s.clinicalState.phase,'complete');assert.ok(orientationContext(s).fields.some(f=>f.key==='family_history'));}});
test('v7 corrige familiares y vuelve a confirmar sin duplicar datos',async()=>{const c=await setup();let s=await until(c);await c.store.correct(c.id,'A','Sí, diabetes',randomUUID(),'family_history',s.clinicalState.revision);s=await c.store.get(c.id,'A');assert.equal(s.clinicalState.pendingQuestions[0].id,'family_history_relative');s=await send(c,'mi padre');assert.equal(s.clinicalState.pendingQuestions[0].id,'answers_confirmation');s=await send(c,'Sí');assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.facts.filter(f=>f.key==='family_history').length,1);assert.equal(s.clinicalState.facts.find(f=>f.key==='family_history').revisions[0].text,'No');});
test('v7 corrección de alergias conserva pregunta 17 y pide nueva confirmación',async()=>{const c=await setup();let s=await until(c,null,{family_history:'Sí, diabetes'});await c.store.correct(c.id,'A','papaya',randomUUID(),'allergies',s.clinicalState.revision);s=await until(c,null,{allergy_reaction:'ninguno',allergy_timing:'desde niño y ayer'});assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.facts.find(f=>f.key==='family_history').clarifications[0].text,'mi madre');});
test('v7 encabezado Sí/No sin pie de letras, con guardas de alarma preservadas',async()=>{const c=await setup();let s=await until(c,'alarm_screen');assert.match(s.clinicalState.pendingQuestions[0].text,/SÍ\/NO/);assert.doesNotMatch(s.clinicalState.pendingQuestions[0].text,/Responde Sí, una letra/);s=await send(c,'h');assert.equal(s.clinicalState.phase,'safety_alert');assert.match(s.clinicalState.assessment.reply,/911/);});
'@
},
@{Path='backend/test/mobile-v8.test.js';Content=@'
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {FirestoreStore} from '../src/firestore-store.js';
import {FakeDB} from '../test-support/fake-db.js';
import {answersConfirmed} from '../src/interview-v8.js';
import {reviewQuestion} from '../src/adaptive.js';
const values={name:'Luis',age:'33',sex:'M',weight:'70',height:'175',alarm_screen:'No',reason:'molestia leve en la cabeza',onset:'ayer',location:'cabeza',location_description:'presión leve',severity:'3',associated:'ninguno',history:'No',medications:'No',remedies_use:'No',allergies:'No',allergy_reaction:'ninguno',allergy_timing:'desde niño y ayer',answers_confirmation:'Sí',family_history:'No',family_history_condition:'diabetes',family_history_relative:'mi madre'};
async function setup(){const store=new FirestoreStore(new FakeDB()),s=await store.create('A');return {store,id:s.id};}
async function send(c,text){const s=await c.store.get(c.id,'A');await c.store.append(c.id,'A',text,randomUUID(),s.clinicalState.pendingQuestions[0].id);return c.store.get(c.id,'A');}
async function until(c,target=null,overrides={}){let s=await c.store.get(c.id,'A'),count=0;while(s.clinicalState.pendingQuestions[0]&&s.clinicalState.pendingQuestions[0].id!==target){assert.ok(count++<45);const id=s.clinicalState.pendingQuestions[0].id;assert.ok(id in {...values,...overrides},id);assert.notEqual(id,'location_detail');s=await send(c,({...values,...overrides})[id]);}return s;}
test('v8: alergias No conserva familiares antes de la confirmación final',async()=>{const c=await setup();let s=await until(c,'family_history');assert.equal(s.clinicalState.protocolId,'intake-demo-v8');assert.ok(!s.clinicalState.facts.some(f=>f.key==='answers_confirmation'));s=await send(c,'No');assert.equal(s.clinicalState.pendingQuestions[0].id,'answers_confirmation');assert.equal(s.clinicalState.pendingQuestions[0].text,'¿Sus respuestas son verdaderas? (Sí/No)');s=await send(c,'Sí');assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.facts.at(-1).key,'answers_confirmation');assert.equal(s.summary.groups.at(-1).fields.at(-1).key,'answers_confirmation');assert.equal(answersConfirmed(s.clinicalState),true);});
test('v8: alergias referidas, familiares y su aclaración terminan antes de confirmar',async()=>{const c=await setup(),s=await until(c,null,{allergies:'papaya',family_history:'Sí'});assert.equal(s.clinicalState.validationVersion,16);assert.equal(s.clinicalState.facts.find(f=>f.key==='family_history').clarifications.length,2);assert.equal(s.clinicalState.facts.at(-1).key,'answers_confirmation');assert.ok(s.clinicalState.facts.find(f=>f.key==='location').clarifications.every(d=>d.key!=='location_detail'));assert.equal(s.clinicalState.facts.find(f=>f.key==='location').clarifications[0].key,'location_description');});
test('v8: corregir alergias a No conserva familiares y exige confirmar de nuevo',async()=>{const c=await setup();let s=await until(c,null,{allergies:'papaya',family_history:'Sí'});await c.store.correct(c.id,'A','No',randomUUID(),'allergies',s.clinicalState.revision);s=await c.store.get(c.id,'A');assert.equal(s.clinicalState.pendingQuestions[0].id,'answers_confirmation');assert.equal(answersConfirmed(s.clinicalState),false);assert.equal(s.clinicalState.facts.find(f=>f.key==='family_history').clarifications.length,2);s=await send(c,'Sí');assert.equal(s.clinicalState.phase,'complete');});
test('v8: corrección familiar conserva datos originales y vuelve a confirmar al final',async()=>{const c=await setup();let s=await until(c);await c.store.correct(c.id,'A','Sí, diabetes',randomUUID(),'family_history',s.clinicalState.revision);s=await send(c,'mi padre');assert.equal(s.clinicalState.pendingQuestions[0].id,'answers_confirmation');assert.equal(s.clinicalState.facts.find(f=>f.key==='family_history').revisions[0].text,'No');s=await send(c,'No');assert.equal(answersConfirmed(s.clinicalState),false);});
test('v8: pregunta 6 compacta y letra h mantienen bloqueo de emergencia',async()=>{const c=await setup();let s=await until(c,'alarm_screen');assert.match(s.clinicalState.pendingQuestions[0].text,/^¿Tienes algo de esto ahora\? \(Sí\/No\)/);assert.doesNotMatch(s.clinicalState.pendingQuestions[0].text,/ANTES DE CONTINUAR/);assert.match(reviewQuestion(s.clinicalState).text,/¿Tienes algo de esto ahora\?/);s=await send(c,'h');assert.equal(s.clinicalState.phase,'safety_alert');assert.equal(s.clinicalState.pendingQuestions.length,0);assert.match(s.clinicalState.assessment.reply,/911/);});
test('v8: confirmación No bloquea la revisión previa a generar y Sí la habilita',async()=>{const c=await setup();let s=await until(c,null,{answers_confirmation:'No'});await assert.rejects(()=>c.store.beginAdditional(c.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'review'));await c.store.correct(c.id,'A','Sí',randomUUID(),'answers_confirmation',s.clinicalState.revision);s=await c.store.get(c.id,'A');await c.store.beginAdditional(c.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'review');s=await c.store.get(c.id,'A');assert.equal(s.clinicalState.pendingQuestions[0].id,'alarm_recheck');});
'@
},
@{Path='frontend/src/EmergencyHelp.jsx';Content=@'
import React,{useState} from 'react';
import {hospitalLinks} from './emergency-config.js';
export function EmergencyHelp() {
  const [city,setCity]=useState(''),[insurance,setInsurance]=useState('');
  return <section className="emergency-help" aria-label="Ayuda de emergencia">
    <h3>Necesitas atención médica inmediata si esta situación es real</h3>
    <a className="emergency-call" href="tel:911">Llamar al 911 en México</a>
    <label htmlFor="emergency-city">Hospitales de emergencia</label>
    <select id="emergency-city" value={city} onChange={e=>{setCity(e.target.value);setInsurance('');}}>
      <option value="">Selecciona una opción</option><option value="yes">Cancún</option><option value="no">Otra localidad</option>
    </select>
    {city==='no' && <p>Estas ubicaciones corresponden al directorio de prueba de Cancún. Solicita ayuda al servicio de emergencias de tu localidad.</p>}
    {city==='yes' && <>
      <label htmlFor="emergency-insurance">¿Tiene seguridad social?</label>
      <select id="emergency-insurance" value={insurance} onChange={e=>setInsurance(e.target.value)}>
        <option value="">Selecciona una opción</option><option value="imss">Sí, IMSS</option><option value="public">No</option><option value="other">Otro seguro o No sé</option>
      </select>
      {insurance==='imss' && <a className="hospital-link" href={hospitalLinks.imss} target="_blank" rel="noopener noreferrer">Abrir ubicación IMSS · Urgencias en Google Maps</a>}
      {['public','other'].includes(insurance) && <a className="hospital-link" href={hospitalLinks.public} target="_blank" rel="noopener noreferrer">Abrir ubicación del hospital general público en Google Maps</a>}
      {insurance && <p>Enlace aportado para el prototipo; comprueba el destino en Maps. No se ha confirmado disponibilidad, cobertura ni tiempo de atención. Si el traslado no es seguro, pide ayuda al 911; no conduzcas tú.</p>}
    </>}
  </section>;
}
'@
},
@{Path='frontend/src/OrientationPanel.jsx';Content=@'
import React,{useState} from 'react';
export {safeSourceUrl} from './source-policy.js';
import {safeSourceUrl} from './source-policy.js';
export function OrientationPanel({session,busy,onGenerate,onBegin}){
 const [consent,setConsent]=useState(false),state=session.clinicalState;
 if(state?.phase==='safety_alert'||state?.assessment?.type==='safety_alert'||state?.phase!=='complete')return null;
 if(['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId)&&!/^si[.!]?$/i.test((state.facts.find(f=>f.key==='answers_confirmation')?.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()))return <section className="orientation-panel"><p>Revisa tus respuestas y corrige la confirmación final antes de generar orientación.</p></section>;
 const saved=session.orientation,current=saved?.status==='ready'&&saved.basedOnRevision===(state.revision||0)&&saved.promptVersion==='orientation-rag-v1',canGenerate=session.status==='open';
 const reviewed=state.safety?.reviewedRevision===(state.revision||0),rounds=(state.adaptive?.completed||[]).length,suggestions=saved?.result?.aclaraciones_sugeridas||[];
 return <section className="orientation-panel" aria-label="Orientación de la consulta">
  {current?<>{saved.rag?.version!=='rag-library-v2'&&<div className="notice"><p>Esta orientación se generó con una versión anterior de la biblioteca. Se conserva su historial.</p>{canGenerate&&<button type="button" disabled={busy} onClick={()=>onBegin('review')}>Actualizar con las nuevas fuentes</button>}</div>}<h4>Resumen</h4><p>{saved.result.resumen}</p>
   {saved.result.datos_por_aclarar.length>0&&<><h4>Datos por aclarar</h4><ul>{saved.result.datos_por_aclarar.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
   {canGenerate&&suggestions.length>0&&rounds<2&&<div className="notice"><p>Puedes responder algunas aclaraciones y actualizar la orientación con esos datos.</p><button type="button" disabled={busy} onClick={()=>onBegin('adaptive')}>Responder aclaraciones</button></div>}
   {rounds>=2&&<p className="small muted">Se completaron las dos rondas de aclaraciones. Puedes revisar y corregir tu resumen.</p>}
   <h4>Orientación general</h4><p>{saved.result.orientacion_general}</p>
   {saved.rag?.status==='insufficient_evidence'&&<p className="notice">No se encontraron fuentes suficientes en la base disponible para este motivo.</p>}
   <h4>Siguiente paso</h4><p>{saved.result.siguiente_paso}</p>
   {saved.result.preguntas_para_profesional.length>0&&<><h4>Preguntas para tu consulta</h4><ul>{saved.result.preguntas_para_profesional.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
   {saved.rag?.status==='matched'&&saved.rag.sources?.length>0&&<section aria-label="Fuentes utilizadas"><h4>Fuentes utilizadas en esta orientación</h4><p className="small muted">Resúmenes informativos de CHECKIA. La incorporación de estas fuentes no valida un diagnóstico. {saved.rag.sources.some(s=>s.clinicalReview==='pending')?'El contenido beta está pendiente de revisión clínica.':''}</p><ul>{[...new Map(saved.rag.sources.map(s=>[s.documentId||s.url,s])).values()].map(source=><li key={source.documentId||source.url}>{safeSourceUrl(source.url)?<a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title} — {source.publisher}</a>:<span>{source.title} — enlace no disponible</span>}<span className="small muted"> · Consultado: {source.checkedAt} · Versión: {source.version||'piloto'}</span></li>)}</ul><details><summary>Ver fragmentos que respaldan la orientación</summary>{saved.rag.sources.map(source=><article className="notice" key={source.id}><strong>{source.section}</strong><p>{source.text}</p><p className="small muted">{source.locator||source.section}. Revisión clínica: {source.clinicalReview==='approved'?'Registrada':'Pendiente'}.</p></article>)}</details></section>}
  </>:<>
   {canGenerate?(!reviewed?<><button type="button" disabled={busy} className="check-current-signals" onClick={()=>onBegin('review')}>Comprobar señales actuales</button></>:<><label className="orientation-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>Acepto enviar mi información a OpenAI para una evaluación beta de checkIA. El resultado no confirma un diagnóstico médico.</span></label><button type="button" disabled={busy||!consent} onClick={()=>onGenerate({consent:true,expectedRevision:state.revision||0})}>{busy?'Preparando…':'Generar orientación'}</button></>):<p>La consulta está cerrada y no tiene una orientación vigente.</p>}
  </>}
  {current&&<footer className="orientation-attribution"><span>Orientación médica</span><p>Orientación generada con IA. Revísala con un profesional de salud.</p></footer>}
 </section>;
}
'@
},
@{Path='frontend/src/main.jsx';Content=@'
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
  function beginOperation() { if (inFlight.current) return false; inFlight.current = true; setBusy(true); setError(''); return true; }
  function endOperation() { inFlight.current = false; setBusy(false); }
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
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(friendlyApiError(response.status,data.error));}
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
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(friendlyApiError(response.status,data.error)); }
    if (auth.currentUser?.uid !== current.uid) throw new Error('La cuenta cambió durante la solicitud.');
    return response.status === 204 ? null : response.json();
  }
  async function action(fn) {
    if (!beginOperation()) return;
    try { await fn(); } catch(e) { setError(e instanceof TypeError ? 'No se pudo conectar. Revisa tu conexión e inténtalo nuevamente.' : (e.message || 'No se pudo completar la operación.')); }
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
    setSelected(session); setChosenId(session.id); setMessage(''); setCorrectionKey(''); setCorrectionText('');
    await listSessions();
  });
  const generateOrientation=body=>action(async()=>{const id=selected.id;await api('/sessions/'+id+'/orientation','POST',body);setSelected(await api('/sessions/'+id));});
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
    {user&&<><nav className="admin-nav" aria-label="Secciones de CHECKIA"><button type="button" className="secondary" disabled={busy} aria-pressed={view==='consultations'} onClick={()=>setView('consultations')}>Mis consultas</button>{adminAllowed&&<button type="button" className="secondary" disabled={busy} aria-pressed={view==='admin'} onClick={()=>setView('admin')}>Panel de administrador</button>}</nav></>}
    {!ready ? <p role="status">Comprobando acceso…</p> : user ? (view==='admin'&&adminAllowed?<div id="main-content" tabIndex={-1}><AdminPanel key={user.uid} api={api} download={downloadAdmin}/></div>:<div className="layout">
      <aside className={"panel controls"+(selected?" has-session":"")}>
        <h2>Consultas</h2><p className="muted">Inicia una entrevista nueva o recupera una consulta guardada.</p>
        <button disabled={busy} onClick={createSession}>Nueva consulta</button>
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
      <section id="main-content" tabIndex={-1} className={"panel consultation"+(!selected?" no-selected-consultation":"")} aria-label="Entrevista">
        
        {!selected ? null : <>
          <div className="consultation-heading compact-heading"><div className="consultation-title"><h2>{selected.status === 'closed' ? 'Diagnóstico cerrado' : 'Diagnóstico'}</h2><span className="session-id">Consulta {selected.id.slice(0,8)}</span></div></div>
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
          </div> : alarm ? <p className="muted">Entrevista detenida. Puedes revisar el historial o cerrar esta consulta de prueba.</p> : selected.status === 'closed' ? <div className="notice">Esta consulta está cerrada. Puedes revisar su historial.</div> : !interview ? <div className="notice">Esta consulta no contiene una entrevista. Pulsa “Nueva consulta” para comenzar.</div> : selected.clinicalState.phase === 'complete' ? <p className="completion-state">Respuestas guardadas.</p> : <div className="notice error">No se pudo cargar la siguiente pregunta. Pulsa “Recargar mensajes” e inténtalo nuevamente.</div>}

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
          <OrientationPanel key={selected.id+":"+(selected.clinicalState?.revision||0)} session={selected} busy={busy} onGenerate={generateOrientation} onBegin={beginAdditional}/>
          <div className="consultation-footer"><button type="button" className="secondary reload-messages" disabled={busy} onClick={()=>loadSession(selected.id)}>Recargar mensajes</button></div>
        </>}
      </section>
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
    {busy && <p className="busy-status" role="status">Procesando…</p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
'@
},
@{Path='frontend/src/mobile.css';Content=@'
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
'@
}
)
$backup=Join-Path $ProjectRoot ("respaldos\paso22_3_"+(Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$newFiles=@()
foreach($file in $files){$target=Join-Path $ProjectRoot $file.Path;if(Test-Path -LiteralPath $target){$saved=Join-Path $backup $file.Path;New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null;Copy-Item -LiteralPath $target -Destination $saved}else{$newFiles+=$file.Path}}
$encoding=New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path $backup 'ARCHIVOS_NUEVOS.txt'),[string[]]$newFiles,$encoding)
foreach($file in $files){$target=Join-Path $ProjectRoot $file.Path;New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null;[System.IO.File]::WriteAllText($target,$file.Content+[Environment]::NewLine,$encoding);Write-Host ("Actualizado: "+$file.Path)}
Write-Host "Paso 22.3 aplicado. Respaldo: $backup"
Write-Host 'Prueba local con npm test en backend y npm run build en frontend.'
Write-Host 'Crea una consulta NUEVA. Las anteriores conservan sus preguntas y validaciones.'
Write-Host 'Para publicar: Cloud Run primero y Hosting despues. Sigue PUBLICAR_PASO_22.txt.'
Write-Host 'No se cambiaron claves, dependencias, datos de Firestore o indice RAG. No se publico nada.'
