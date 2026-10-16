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
