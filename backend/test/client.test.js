import test from 'node:test';
import assert from 'node:assert/strict';
import {WELCOME,createdInterview,friendlyApiError} from '../../frontend/src/interview-client.mjs';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {FakeDB} from '../test-support/fake-db.js';
test('pantalla acepta la consulta real v5 y presenta nombre como primera pregunta',async()=>{
 const session=await new FirestoreStore(new FakeDB()).create('A');
 assert.equal(createdInterview({session},'intake-demo-v5'),session);
 assert.equal(session.clinicalState.pendingQuestions[0].text,'¿Cómo te llamas?');
 assert.match(WELCOME,/¡Hola, qué tal!/);assert.match(WELCOME,/diagnóstico médico/);
 assert.equal(session.messageCount,0);
});
test('consulta incompatible no se selecciona; errores no exponen rutas técnicas',()=>{
 for(const data of [undefined,{}, {session:{id:'id',clinicalState:{protocolId:'intake-demo-v3'}}}])assert.throws(()=>createdInterview(data,'intake-demo-v5'),/No se pudo iniciar/);
 for(const [status,text] of [[500,'Firestore falló'],[400,'backend/src/interview.js'],[409,'protocolo inválido'],[404,'Ruta de la API']])assert.doesNotMatch(friendlyApiError(status,text),/backend|firestore|API|\.js|protocolo/i);
 assert.match(friendlyApiError(400,'Escribe tu edad de 1 a 99 años.'),/1 a 99/);
});
