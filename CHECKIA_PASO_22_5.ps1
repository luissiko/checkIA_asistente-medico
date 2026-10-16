# CHECKIA paso 22.5: escritorio, sin animaciones y mensajes de error seguros.
# No despliega ni modifica backend, claves, modelo o datos de Firestore.
param([string]$ProjectRoot="C:\Users\cancu\Documents\GitHub\checkIA")
$ErrorActionPreference="Stop"
foreach($required in @('backend/src/interview-v8.js','frontend/src/mobile.css','frontend/src/main.jsx','frontend/src/OrientationPanel.jsx','frontend/src/interview-client.mjs')){if(!(Test-Path -LiteralPath (Join-Path $ProjectRoot $required))){throw "Falta $required. Revisa la ruta y el paso 22.3/22.4 antes de aplicar."}}
$files=@(
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

          <OrientationPanel key={selected.id+":"+(selected.clinicalState?.revision||0)} session={selected} busy={busy} generating={busyOperation==='orientation'} error={errorOperation==='orientation'?error:''} onGenerate={generateOrientation} onBegin={beginAdditional}/>
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
@{Path='frontend/src/OrientationPanel.jsx';Content=@'
import React,{useState} from 'react';
export {safeSourceUrl} from './source-policy.js';
import {safeSourceUrl} from './source-policy.js';
export function OrientationPanel({session,busy,generating=false,error='',onGenerate,onBegin}){
 const [consent,setConsent]=useState(false),state=session.clinicalState;
 if(state?.phase==='safety_alert'||state?.assessment?.type==='safety_alert'||state?.phase!=='complete')return null;
 if(['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId)&&!/^si[.!]?$/i.test((state.facts.find(f=>f.key==='answers_confirmation')?.text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()))return <section className="orientation-panel"><p>Revisa tus respuestas y corrige la confirmación final antes de generar orientación.</p></section>;
 const saved=session.orientation,current=saved?.status==='ready'&&saved.basedOnRevision===(state.revision||0)&&saved.promptVersion==='orientation-rag-v1',canGenerate=session.status==='open';
 const reviewed=state.safety?.reviewedRevision===(state.revision||0),rounds=(state.adaptive?.completed||[]).length,suggestions=saved?.result?.aclaraciones_sugeridas||[];
 return <section className="orientation-panel" aria-label="Orientación de la consulta">
  {canGenerate&&!current&&<label className="orientation-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>Acepto enviar mi información a OpenAI para una evaluación beta de checkIA. El resultado no confirma un diagnóstico médico.</span></label>}
  {current?<>{saved.rag?.version!=='rag-library-v2'&&<div className="notice"><p>Esta orientación se generó con una versión anterior de la biblioteca. Se conserva su historial.</p>{canGenerate&&<button type="button" disabled={busy} onClick={()=>onBegin('review')}>Actualizar con las nuevas fuentes</button>}</div>}<h4>Resumen</h4><p>{saved.result.resumen}</p>
   {saved.result.datos_por_aclarar.length>0&&<><h4>Datos por aclarar</h4><ul>{saved.result.datos_por_aclarar.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
   {canGenerate&&suggestions.length>0&&rounds<2&&<div className="notice"><p>Puedes responder algunas aclaraciones y actualizar la orientación con esos datos.</p><button type="button" disabled={busy} onClick={()=>onBegin('adaptive')}>Responder aclaraciones</button></div>}
   {rounds>=2&&<p className="small muted">Se completaron las dos rondas de aclaraciones. Puedes revisar y corregir tu resumen.</p>}
   <h4>Orientación general</h4><p>{saved.result.orientacion_general}</p>
   {saved.rag?.status==='insufficient_evidence'&&<p className="notice">No se encontraron fuentes suficientes en la base disponible para este motivo.</p>}
   <h4>Siguiente paso</h4><p>{saved.result.siguiente_paso}</p>
   {saved.result.preguntas_para_profesional.length>0&&<><h4>Preguntas para tu consulta</h4><ul>{saved.result.preguntas_para_profesional.map((t,i)=><li key={i}>{t}</li>)}</ul></>}
   {saved.rag?.status==='matched'&&saved.rag.sources?.length>0&&<section aria-label="Fuentes utilizadas"><p className="small muted">La incorporación de estas fuentes no valida un diagnóstico real y está pendiente de una revisión clínica.</p><ul>{[...new Map(saved.rag.sources.map(s=>[s.documentId||s.url,s])).values()].map(source=><li key={source.documentId||source.url}>{safeSourceUrl(source.url)?<a href={safeSourceUrl(source.url)} target="_blank" rel="noopener noreferrer">{source.title} — {source.publisher}</a>:<span>{source.title} — enlace no disponible</span>}<span className="small muted"> · Consultado: {source.checkedAt} · Versión: {source.version||'piloto'}</span></li>)}</ul><details><summary>Ver fragmentos que respaldan la orientación</summary>{saved.rag.sources.map(source=><article className="notice" key={source.id}><strong>{source.section}</strong><p>{source.text}</p><p className="small muted">{source.locator||source.section}. Revisión clínica: {source.clinicalReview==='approved'?'Registrada':'Pendiente'}.</p></article>)}</details></section>}
  </>:<>
   {canGenerate?(!reviewed?<><button type="button" disabled={busy} className="check-current-signals" title="Revisar señales actuales antes de generar la orientación; no confirma un diagnóstico." onClick={()=>onBegin('review')}>Comprobar primer diagnóstico</button></>:<><button type="button" className="generate-orientation" aria-busy={generating} disabled={busy||!consent} onClick={()=>onGenerate({consent:true,expectedRevision:state.revision||0})}>Generar orientación</button></>):<p>La consulta está cerrada y no tiene una orientación vigente.</p>}
  </>}
  {generating&&<p className="request-status" role="status">Preparando tu orientación…</p>}
  {error&&<p className="operation-error" role="alert">{error}</p>}
 </section>;
}
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
'@
},
@{Path='frontend/src/interview-client.mjs';Content=@'
export const WELCOME='0. ¡Hola, qué tal! Seré tu asistente virtual de diagnóstico médico. Por favor, responde las siguientes preguntas que se te realizarán.';
export function createdInterview(data,expectedProtocol) {
 const session=data?.session,state=session?.clinicalState;
 if(!session?.id||state?.protocolId!==expectedProtocol||state?.phase!=='collecting'||state?.pendingQuestions?.[0]?.id!=='name') {
  throw new Error('No se pudo iniciar la entrevista. Actualiza la página e inténtalo nuevamente.');
 }
 return session;
}
export function friendlyApiError(status,message,operation='') {
 if(status===401||status===403)return 'Tu acceso no está disponible. Inicia sesión nuevamente.';
 if(status===410)return 'Esta consulta venció. Puedes crear una nueva.';
 if(status>=500){
  // Only explicitly approved public messages can cross this boundary.
  // Never display arbitrary provider errors, stack traces, paths or credentials.
  const publicMessages=new Set([
   'La orientación no está disponible en este momento. Puedes seguir consultando tu resumen.',
   'La orientación tardó demasiado o no se pudo conectar. Intenta nuevamente en unos momentos.',
   'No se pudo generar la orientación. Intenta más tarde.',
   'No se pudo completar la orientación con estos datos. Tu resumen sigue disponible.',
   'No se recibió una orientación válida.',
   'No se recibió una orientación válida. Puedes intentarlo nuevamente.',
   'No se recibieron fuentes válidas.',
   'No se recibieron aclaraciones válidas.',
   'La orientación contiene un enlace que no pudo comprobarse.',
   'No se pudo comprobar la fuente de la orientación. Tu resumen sigue disponible.',
   'La base de información necesita preparación o revisión. Tu entrevista y resumen siguen disponibles.',
   'La búsqueda de información no está disponible en este momento.',
   'La búsqueda de información tardó demasiado. Intenta nuevamente.',
   'No se pudo consultar la información de apoyo. Intenta más tarde.',
   'No se recibió una búsqueda válida.'
  ]);
  if(publicMessages.has(message))return message;
  if(operation==='orientation')return status===504?'La orientación tardó demasiado. Tus respuestas siguen guardadas. Intenta nuevamente en unos momentos.':status===503?'El servicio de orientación no está disponible en este momento. Tu resumen sigue guardado.':status===502?'No se recibió una orientación válida del servicio. Tu resumen sigue guardado.':'No se pudo generar la orientación. Tu resumen sigue guardado. Intenta nuevamente en unos momentos.';
  return 'No se pudo completar la operación. Intenta nuevamente en unos momentos.';
 }
 if(typeof message==='string'&&message.trim()&&!/backend|frontend|firestore|\bAPI\b|\bUID\b|\.jsx?\b|protocolo|\bsrc\b/i.test(message))return message;
 return 'No se pudo completar la operación. Actualiza la consulta e inténtalo nuevamente.';
}
'@
},
@{Path='LEEME_PASO_22_5.txt';Content=@'
CHECKIA PASO 22.5 - ESCRITORIO, SIN ANIMACIONES Y ERRORES DE ORIENTACIÓN
Aplicar sobre el paso 22.4. Crea respaldo antes de modificar.
ALCANCE
Solo frontend. No cambia backend, modelo OpenAI, claves, preguntas, datos, biblioteca RAG ni dependencias. Health continúa en 22.3, intake-demo-v8, validationVersion 16.
Se retiran puntos y aro; se elimina LoadingIndicator.jsx con respaldo. Durante una solicitud se muestra texto estático y se conserva el bloqueo de duplicados.
ESCRITORIO
Sin consulta abierta, el módulo Consultas queda centrado. Con una consulta o panel administrativo, hay una columna lateral delimitada de 220-260 px y una columna principal flexible. Contenedores limitados al ancho disponible. El comportamiento de escritura móvil y la alerta roja se conservan.
ERRORES
Antes, friendlyApiError sustituía todos los errores 500 o superiores por el mismo mensaje genérico. Ahora conserva únicamente mensajes públicos seguros de una lista explícita: orientación, búsqueda, tiempo de espera o base no disponible. Nunca muestra mensajes arbitrarios del proveedor, claves, trazas ni rutas internas.
No se ha confirmado la causa de la llamada real que falló. El cambio 22.4 no modificó el endpoint, el consentimiento ni la revisión enviados al backend. Esta corrección no puede reparar una clave sin acceso, cuota agotada, indisponibilidad externa o fallo del servidor desde CSS. El nuevo mensaje ayudará a ubicar el problema sin perder las respuestas.
ARCHIVOS
frontend/src/main.jsx: distribución de escritorio y retirada de la animación de creación; contexto del error de orientación.
frontend/src/OrientationPanel.jsx: retira el aro y conserva texto estático de espera, consentimiento y reintento.
frontend/src/mobile.css: elimina las animaciones y delimita el diseño de escritorio.
frontend/src/interview-client.mjs: mensajes seguros específicos para errores del servicio.
frontend/src/LoadingIndicator.jsx: eliminado con respaldo; ya no se importa.
PRUEBA LOCAL
1. Detén frontend con Ctrl+C y aplica el instalador desde la raíz del proyecto.
2. En frontend ejecuta npm run build; si pasa, npm run dev. Mantén el backend activo en otra terminal con npm start.
3. Abre http://127.0.0.1:5173/ y recarga. Comprueba escritorio y celular.
4. Genera orientación en una consulta de prueba. No aparecerán figuras animadas. El texto de espera se retira al terminar o fallar.
5. Si falla, conserva el nuevo mensaje exacto e indica si ocurrió en local o en la web publicada. No compartas claves ni .env.
6. Para comprobar configuración pública: Invoke-RestMethod "https://checkia-project.web.app/api/health" | ConvertTo-Json -Depth 6
El health no comprueba el acceso real a OpenAI ni confirma que una generación vaya a funcionar.
VALIDACIÓN
JSX validado; siete comprobaciones de errores públicos y ocultamiento de detalles. Prueba de navegador con creación y generación demoradas, error, reintento y prevención de duplicados; consentimiento, cierre, fuentes, navegación administrativa, señales de alarma, centrado y ancho de columnas. Anchos 320, 390, 768, 900, 901, 1024, 1280, 1440 y 1920. Backend real 22.3 con FakeDB; autenticación, OpenAI y CSS base simulados. No se hicieron llamadas reales con credenciales del usuario. La compilación final debe ejecutarse en su proyecto.
PUBLICACIÓN
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { throw "Falló la compilación" }
Set-Location ..
firebase deploy --only hosting --config firebase.checkia.json --project checkia-project
if ($LASTEXITCODE -ne 0) { throw "Falló el despliegue" }
Abre https://checkia-project.web.app y recarga con Ctrl+F5. Cloud Run debe conservar el backend 22.3; no se modifica en esta entrega.
RESPALDO
respaldos/paso22_5_FECHA contiene archivos reemplazados y el componente retirado. ARCHIVOS_NUEVOS.txt enumera los archivos que antes no existían. Para revertir, detén frontend y restaura esos archivos en sus rutas originales.
'@
}
)

$removeFiles=@('frontend/src/LoadingIndicator.jsx')
$backup=Join-Path $ProjectRoot ("respaldos\paso22_5_"+(Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$newFiles=@()
foreach($file in $files){$target=Join-Path $ProjectRoot $file.Path;if(Test-Path -LiteralPath $target){$saved=Join-Path $backup $file.Path;New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null;Copy-Item -LiteralPath $target -Destination $saved}else{$newFiles+=$file.Path}}
foreach($relative in $removeFiles){$target=Join-Path $ProjectRoot $relative;if(Test-Path -LiteralPath $target){$saved=Join-Path $backup $relative;New-Item -ItemType Directory -Path (Split-Path $saved -Parent) -Force | Out-Null;Copy-Item -LiteralPath $target -Destination $saved}}
$encoding=New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines((Join-Path $backup 'ARCHIVOS_NUEVOS.txt'),[string[]]$newFiles,$encoding)
foreach($file in $files){$target=Join-Path $ProjectRoot $file.Path;New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null;[System.IO.File]::WriteAllText($target,$file.Content+[Environment]::NewLine,$encoding);Write-Host ("Actualizado: "+$file.Path)}
foreach($relative in $removeFiles){$target=Join-Path $ProjectRoot $relative;if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target;Write-Host ("Retirado con respaldo: "+$relative)}}
Write-Host "Paso 22.5 aplicado. Respaldo: $backup"
Write-Host 'Ejecuta npm run build y npm run dev desde frontend. Conserva backend 22.3 activo.'
Write-Host 'Si falla la orientacion, conserva el nuevo mensaje exacto e indica si es local o publicada.'
Write-Host 'No se cambiaron claves, modelo, datos o backend. No se publico nada. Sigue LEEME_PASO_22_5.txt.'
