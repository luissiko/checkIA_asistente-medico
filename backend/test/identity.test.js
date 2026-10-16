import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
test('todas las rutas de sesiones requieren identidad; UID viene del token',async t=>{
  let owner, correctionArgs; const store={correct:async(...args)=>{correctionArgs=args;return {reply:'Corregido'};},create:async uid=>{owner=uid;return {id:'fixture'};}};
  const server=createApp({store,verifyToken:async token=>{if(token!=='valid')throw new Error('invalid');return {uid:'verified-user'};}}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const url=`http://127.0.0.1:${server.address().port}/api`;
  for(const [path,method] of [['/sessions','GET'],['/sessions','POST'],['/sessions/id','GET'],['/sessions/id','DELETE'],['/sessions/id/messages','POST'],['/sessions/id/close','POST'],['/sessions/id/corrections','POST']])
    assert.equal((await fetch(url+path,{method})).status,401);
  assert.equal((await fetch(url+'/me',{headers:{Authorization:'Bearer invalid'}})).status,401);
  const me=await(await fetch(url+'/me',{headers:{Authorization:'Bearer valid'}})).json();assert.equal(me.uid,'verified-user');
  const created=await fetch(url+'/sessions',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({ownerUid:'forged'})});
  assert.equal(created.status,201);assert.equal(owner,'verified-user');
  const correction=await fetch(url+'/sessions/id/corrections',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({answer:'35',factKey:'age',expectedRevision:3,requestId:'test',ownerUid:'forged'})});
  assert.equal(correction.status,201);assert.deepEqual(correctionArgs,['id','verified-user','35','test','age',3]);
  assert.equal((await fetch(url+'/sessions/id/corrections',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({answer:42,factKey:'age'})})).status,400);
  assert.equal((await fetch(url+'/sessions/id/messages',{method:'POST',headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({message:42})})).status,400);
});
