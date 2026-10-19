import express from 'express';
import {createApp} from '../src/app.js';
import {requireIdentity} from '../src/identity.js';
import {CONTENT} from './engine.mjs';
export function createIntegratedApp({store,orientationService,adminService,verifyToken}={}){
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
 app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});next();});
 app.get('/api/health',(req,res)=>res.json({service:'CHECKIA',stage:23,storage:'firestore',localOnly:true,medicalInference:false,interview:CONTENT.version,validationVersion:23,summaryVersion:23,safetyVersion:'alarm-demo-v2',rag:orientationService?.retriever?.status??{ready:false,state:'not_configured'},llm:{configured:Boolean(orientationService?.client?.configured)}}));
 app.post('/api/sessions/:id/extra',requireIdentity(verifyToken),async(req,res,next)=>{try{res.json(await store.addExtra(req.params.id,req.identity.uid,req.body));}catch(e){next(e);}});
 app.use(createApp({store,orientationService,adminService,verifyToken}));
 app.use((e,req,res,next)=>{const status=Number.isInteger(e.status)&&[400,404,409,410,413,429,502,503,504].includes(e.status)?e.status:e.type==='entity.parse.failed'?400:e.type==='entity.too.large'?413:500;res.status(status).json({error:status===500?'No se pudo completar la operación local.':status===413?'Solicitud demasiado grande.':e.type==='entity.parse.failed'?'JSON inválido.':e.message});});
 return app;
}
