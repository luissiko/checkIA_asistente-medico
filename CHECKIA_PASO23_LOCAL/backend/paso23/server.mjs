import {createServer} from 'node:http';
import {randomUUID, randomBytes} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {CONTENT, initialState, advance, pending, canGenerate, contextFor} from './engine.mjs';
import {createOpenAIClient, validateOrientation} from '../src/openai-client.js';
import {createEmbeddingClient} from '../src/embeddings.js';
import {loadRag, bindEvidence} from '../src/rag.js';

const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
export function createLocalServer({client, retriever, now = () => Date.now()} = {}) {
  const sessions = new Map();
  const token = randomBytes(32).toString('hex');
  let requestsInFlight = 0;
  function publicSession(s) {
    return {...s, pending: pending(s), contentVersion: CONTENT.version};
  }
  function owned(id) {
    const s = sessions.get(id);
    if (!s || now() - s.updatedAt > 2 * 60 * 60 * 1000) { sessions.delete(id); fail(404, 'La prueba expiró. Inicia otra.'); }
    return s;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (code, body) => { res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
    try {
      const host = req.headers.host;
      const actualHost = `127.0.0.1:${server.address().port}`;
      if (host !== actualHost && host !== `localhost:${server.address().port}`) fail(403, 'Este servidor solo admite acceso local.');
      const origin = req.headers.origin;
      if (origin && origin !== `http://${host}`) fail(403, 'Origen no permitido.');
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(path)) {
        if (path === '/') res.setHeader('Set-Cookie', `paso23=${token}; HttpOnly; SameSite=Strict; Path=/`);
        const name = path === '/' ? 'index.html' : path.slice(1);
        res.writeHead(200, {'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'});
        return res.end(readFileSync(new URL('./public/' + name, import.meta.url)));
      }
      if (!req.headers.cookie?.split(';').some(c => c.trim() === `paso23=${token}`)) fail(403, 'Abre primero la página local de CHECKIA.');
      if (req.method === 'GET' && path === '/api/config') return json(200, {content: CONTENT, llm: {configured: Boolean(client?.configured)}, rag: retriever?.status ?? {ready: false, state: 'not_configured'}});
      if (req.method === 'GET' && path === '/original') {
        res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
        return res.end(readFileSync(new URL('../../docs/paso23/ORIGINAL_USUARIO.md', import.meta.url)));
      }
      let body = {};
      if (req.method === 'POST') {
        if (!String(req.headers['content-type']).startsWith('application/json')) fail(415, 'Se requiere JSON.');
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 20000) fail(413, 'Solicitud demasiado grande.'); }
        try { body = JSON.parse(raw || '{}'); } catch { fail(400, 'JSON inválido.'); }
      }
      if (req.method === 'POST' && path === '/api/sessions') {
        for (const [id, s] of sessions) if (now() - s.updatedAt > 7200000) sessions.delete(id);
        if (sessions.size >= 1000) fail(429, 'Límite de pruebas locales alcanzado. Reinicia el servidor o elimina pruebas.');
        const s = {...initialState(), id: randomUUID(), startedAt: now(), updatedAt: now(), consent: body.consent === true, generationAttempts: 0};
        sessions.set(s.id, s); return json(201, publicSession(s));
      }
      if (req.method === 'GET' && path === '/api/metrics') {
        const all = [...sessions.values()], complete = all.filter(s => s.phase === 'complete');
        const average = values => values.length ? values.reduce((a,b) => a + b, 0) / values.length : null;
        return json(200, {testOnly: true, sampleSize: all.length, completed: complete.length, emergencyRoutes: all.filter(s => s.phase === 'emergency').length, meanAnsweredQuestions: average(all.map(s => s.answers.length)), meanCompletedDurationSeconds: average(complete.map(s => (s.completedAt - s.startedAt) / 1000)), clinicalAccuracy: 'not_measured'});
      }
      const m = path.match(/^\/api\/sessions\/([a-f0-9-]{36})(?:\/(answer|edit|orientation|export))?$/);
      if (!m) fail(404, 'Ruta no encontrada.');
      const s = owned(m[1]);
      if (req.method === 'DELETE' && !m[2]) { sessions.delete(s.id); return json(200, {deleted: true}); }
      if (req.method === 'GET' && !m[2]) return json(200, publicSession(s));
      if (req.method === 'GET' && m[2] === 'export') return json(200, {exportVersion: 1, sourceSha256: CONTENT.sourceSha256, decisions: CONTENT.decisions, session: publicSession(s)});
      if (req.method !== 'POST') fail(405, 'Método no permitido.');
      if (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== s.revision) fail(409, 'La consulta cambió. Recárgala antes de continuar.');
      if (m[2] === 'answer') {
        const next = advance(s, body.questionId, body.answer);
        next.updatedAt = now();
        if (next.phase === 'complete' || next.phase === 'emergency') next.completedAt = now();
        sessions.set(s.id, next); return json(200, publicSession(next));
      }
      if (m[2] === 'edit') {
        const index = s.answers.findIndex(a => a.key === body.questionId);
        if (index < 0) fail(400, 'Respuesta no encontrada.');
        let fresh = initialState();
        for (const a of s.answers.slice(0, index)) fresh = advance(fresh, a.key, a.text);
        const next = {...s, ...fresh, journal: s.journal, generationPending: false, revision: s.revision + 1, updatedAt: now(), completedAt: null, correctionHistory: [...(s.correctionHistory ?? []), {questionId: body.questionId, previousAnswers: s.answers.slice(index), at: now()}]};
        sessions.set(s.id, next); return json(200, publicSession(next));
      }
      if (m[2] !== 'orientation') fail(404, 'Ruta no encontrada.');
      if (!canGenerate(s)) fail(409, 'Termina y confirma la entrevista o completa la rama especial de emergencia.');
      if (!s.consent) fail(400, 'Esta prueba se inició sin autorizar el envío a OpenAI. Inicia otra con esa opción activada.');
      if (!client?.configured) fail(503, 'OpenAI no está configurado. Las preguntas, respuestas y ayudas locales siguen disponibles.');
      if (!retriever?.status.ready) fail(503, 'El corpus necesita preparación o revisión. No se ha generado una respuesta con evidencia.');
      if (s.orientation?.revision === s.revision) return json(200, publicSession(s));
      if (s.generationPending || requestsInFlight >= 2) fail(409, 'Ya hay una generación pendiente.');
      if (s.generationAttempts >= 5) fail(429, 'Límite de cinco generaciones por prueba.');
      const revision = s.revision;
      s.generationAttempts++; s.generationPending = true; requestsInFlight++;
      try {
        const context = contextFor(s);
        if (JSON.stringify(context).length > 32000) fail(400, 'La entrevista excede el límite de contexto. Exporta las respuestas para revisarlas.');
        const evidence = await retriever.retrieve(context);
        const generated = await client.generate({...context, evidence: {status: evidence.status, retrieved: evidence.retrieved.map(c => ({id:c.id, title:c.title, section:c.section, text:c.text, checkedAt:c.checkedAt}))}});
        const checked = validateOrientation(generated.result);
        const bound = bindEvidence({...checked, aclaraciones_sugeridas: []}, evidence);
        const current = sessions.get(s.id);
        if (!current || current.revision !== revision) fail(409, 'Las respuestas cambiaron durante la generación; se descartó el resultado.');
        current.orientation = {revision, model: generated.model, promptVersion: generated.promptVersion, usage: generated.usage, ...bound, createdAt: now()};
        return json(200, publicSession(current));
      } finally { s.generationPending = false; requestsInFlight--; }
    } catch (e) {
      json(Number.isInteger(e.status) ? e.status : 500, {error: Number.isInteger(e.status) ? e.message : 'No se pudo completar esta operación local.'});
    }
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.env.K_SERVICE) throw new Error('PASO 23 solo permite ejecución local, no Cloud Run.');
  const env = new URL('../.env', import.meta.url);
  if (existsSync(env)) process.loadEnvFile(env);
  const client = createOpenAIClient();
  let retriever;
  try { retriever = loadRag(createEmbeddingClient({enabled: client.configured})); } catch { retriever = null; }
  const port = Number(process.env.CHECKIA_PASO23_PORT || 3023);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto local inválido.');
  const server = createLocalServer({client, retriever});
  server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'El puerto está ocupado. Cierra la otra prueba o configura CHECKIA_PASO23_PORT.' : 'No se pudo iniciar el servidor local.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`CHECKIA Paso 23 · PRUEBA LOCAL · http://127.0.0.1:${port}`);
    console.log(`OpenAI: ${client.configured ? 'configurado' : 'no configurado'} · RAG: ${retriever?.status.state || 'no disponible'}`);
    console.log('Datos solo en memoria. Usa casos ficticios. Ctrl+C para terminar.');
  });
}
