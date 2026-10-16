import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeConfig} from '../src/runtime-config.js';
test('servidor local conserva 127.0.0.1:3001; Cloud Run usa 0.0.0.0 y PORT',()=>{
 assert.deepEqual(runtimeConfig({}),{cloud:false,port:3001,host:'127.0.0.1',embeddingTimeoutMs:20000,llmTimeoutMs:45000});
 const c=runtimeConfig({K_SERVICE:'checkia-api',PORT:'8080'});assert.equal(c.host,'0.0.0.0');assert.equal(c.port,8080);assert.ok(c.embeddingTimeoutMs+c.llmTimeoutMs<50000);
 for(const PORT of ['-1','0','70000','abc','3.5'])assert.throws(()=>runtimeConfig({PORT}));
});
