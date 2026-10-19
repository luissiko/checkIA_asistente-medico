import {isPaso23Protocol,Paso23Options,Paso23Bmi,Paso23Emergency} from './Paso23.jsx';
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
import './interactions.css';
import {AnswerOptions,InterviewProgress,LoadingDots} from './Interactions.jsx';
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
  const [bmiAcknowledged,setBmiAcknowledged]=useState('');
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
    if (!healthResponse.ok || (health.interview !== 'intake-demo-v8' && !isPaso23Protocol(health.interview)) || !(health.validationVersion >= 16) || health.safetyVersion !== 'alarm-demo-v2') {
      throw new Error('El servicio de entrevistas no está disponible en este momento. Actualiza la página e inténtalo nuevamente.');
    }
    const data = await api('/sessions', 'POST');
    const session=createdInterview(data,health.interview);
    setSelected(session); setView('consultations'); setChosenId(session.id); setMessage(''); setCorrectionKey(''); setCorrectionText('');
    await listSessions();
  },'create');
  async function refreshAfterAnswer(id){
    const session=await api('/sessions/'+id);setSelected(session);
    if(isPaso23Protocol(session.clinicalState?.protocolId)&&session.clinicalState.canGenerate&&session.status==='open'){
      setBusyOperation('orientation');
      try{await api('/sessions/'+id+'/orientation','POST',{consent:true,expectedRevision:session.clinicalState.revision});setSelected(await api('/sessions/'+id));}
      catch(e){setErrorOperation('orientation');setError(e.message||'No se pudo generar la respuesta. Tus respuestas están guardadas.');}
    }
  }
  const addPaso23Extra=async text=>{
    let saved=false;
    await action(async()=>{const id=selected.id;await api('/sessions/'+id+'/extra','POST',{text,requestId:crypto.randomUUID(),expectedRevision:selected.clinicalState.revision});saved=true;await refreshAfterAnswer(id);},'orientation');
    return saved;
  };
  const sendAnswer=text=>{
    if(!text.trim()||!selected||inFlight.current)return;
    action(async()=>{const id=selected.id;await api('/sessions/'+id+'/messages','POST',{message:text.trim(),requestId:crypto.randomUUID(),questionId:selected.clinicalState?.pendingQuestions?.[0]?.id});setMessage('');await refreshAfterAnswer(id);});
  };
  const generateOrientation=body=>action(async()=>{const id=selected.id;await api('/sessions/'+id+'/orientation','POST',body);setSelected(await api('/sessions/'+id));},'orientation');
  const beginAdditional=mode=>action(async()=>{const id=selected.id;await api('/sessions/'+id+(mode==='review'?'/safety-review':'/clarifications'),'POST',{expectedRevision:selected.clinicalState.revision||0,requestId:crypto.randomUUID()});setSelected(await api('/sessions/'+id));setMessage('');setCorrectionKey('');setCorrectionText('');});
  const loadSession = id => action(async () => { setSelected(await api('/sessions/' + id)); setChosenId(id); setMessage(''); setCorrectionKey(''); setCorrectionText(''); });
  const sendMessage=e=>{e.preventDefault();sendAnswer(message);};
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
      await refreshAfterAnswer(id); setCorrectionKey(''); setCorrectionText(''); setMessage('');
    });
  };
  const paso23Protocol=isPaso23Protocol(selected?.clinicalState?.protocolId);
  const cleanProtocol=paso23Protocol||selected?.clinicalState?.protocolId==='intake-demo-v8';
  const freeTextProtocol=paso23Protocol||['intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const mobileProtocol=selected?.clinicalState?.protocolId==='intake-demo-v6';
  const betaProtocol = selected?.clinicalState?.protocolId === 'intake-demo-v5';
  const revisedProtocol = ['intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const directProtocol = ['intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const currentProtocol = paso23Protocol||['intake-demo-v2','intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const interview = paso23Protocol||['intake-demo-v1','intake-demo-v2','intake-demo-v3','intake-demo-v4','intake-demo-v5','intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(selected?.clinicalState?.protocolId);
  const questionNumbers = {...(cleanProtocol ? {...mobileQuestionNumbers,allergy_timing:'16',family_history:'17',family_history_condition:'17.a',family_history_relative:'17.1',answers_confirmation:'18',location_description:'9.2'} : freeTextProtocol ? {...mobileQuestionNumbers,family_history:'17',family_history_condition:'17.a',family_history_relative:'17.1'} : mobileProtocol ? mobileQuestionNumbers : betaProtocol ? betaQuestionNumbers : revisedProtocol ? revisedQuestionNumbers : directProtocol ? directQuestionNumbers : currentProtocol ? currentQuestionNumbers : legacyQuestionNumbers),alarm_recheck:'R',...(paso23Protocol?Object.fromEntries((selected?.clinicalState?.facts||[]).map(f=>[f.key,f.number])):{}),...Object.fromEntries((selected?.clinicalState?.additionalAnswers||[]).map(a=>[a.key,a.number])),...Object.fromEntries((selected?.clinicalState?.pendingQuestions||[]).filter(q=>q.number).map(q=>[q.id,q.number]))};
  const numbered = (key,text) => questionNumbers[key] ? `${questionNumbers[key]}. ${text}` : text;
  const totalAnswers = freeTextProtocol ? 17 : mobileProtocol ? 16 : directProtocol ? 15 : currentProtocol ? 13 : 9;
  const alarm = selected?.clinicalState?.assessment?.type === 'safety_alert';
  const safety = selected?.clinicalState?.safety;
  const pending = interview ? selected.clinicalState.pendingQuestions?.[0] : null;
  const bmiAnswer=paso23Protocol?selected?.clinicalState?.paso23?.answers?.at(-1):null;
  const bmiKey=bmiAnswer?.key==='bmi_consent'&&selected?.clinicalState?.bmi?selected.id+':'+bmiAnswer.recordedAt:null;
  const pauseForBmi=Boolean(bmiKey&&bmiKey!==bmiAcknowledged);
  const canAnswer = !pauseForBmi&&selected?.status === 'open' && interview && selected.clinicalState.phase === 'collecting' && pending;
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
      {view==='consultations'&&selected&&<div className="primary-orientation">
          <OrientationPanel key={selected.id+":"+(selected.clinicalState?.revision||0)} session={selected} busy={busy} generating={busyOperation==='orientation'} error={errorOperation==='orientation'?error:''} onGenerate={generateOrientation} onBegin={beginAdditional} onExtra={addPaso23Extra}/>
      </div>}
      <div className="controls-column">
      <aside className={"panel controls"+(selected?" has-session":"")}>
        <h2>Consultas</h2><p className="muted">Empieza el diagnóstico de checkIA</p>
        <button disabled={busy} aria-busy={busyOperation==='create'} onClick={createSession}>Nueva consulta</button>
        {busyOperation==='create'&&<p className="request-status" role="status">Preparando tu consulta…<LoadingDots/></p>}
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
          {paso23Protocol&&<Paso23Emergency state={selected.clinicalState}/>}
          {paso23Protocol&&<Paso23Bmi state={selected.clinicalState} pause={pauseForBmi} busy={busy} onContinue={()=>setBmiAcknowledged(bmiKey)}/>}
          {alarm && <div className="notice error" role="alert"><h3>Posible señal de alarma</h3><EmergencyHelp key={selected.id}/><p>{selected.clinicalState.assessment.reply}</p><ul>{selected.clinicalState.assessment.signals.map(signal=><li key={signal.id}>{signal.label}</li>)}</ul><p className="small">Prototipo sin validación clínica. La alerta se conserva al recargar y la entrevista no continúa.</p><details><summary>Fuentes de estas señales</summary>{selected.clinicalState.assessment.signals.map(signal=><p key={signal.id}><a href={signal.source.url} target="_blank" rel="noopener noreferrer">{signal.source.title}</a></p>)}</details></div>}
          {!alarm && interview && safety?.status === 'unknown' && <div className="notice">La comprobación inicial quedó como desconocida. No se han descartado señales de alarma y la urgencia sigue sin determinar.</div>}
          {!alarm && interview && !safety && <div className="notice">Esta consulta anterior no incluye la comprobación inicial de señales de alarma.</div>}
          {interview&&!alarm&&selected.status==='open'&&<InterviewProgress state={selected.clinicalState} numbers={questionNumbers}/>}
          {pauseForBmi?null:canAnswer ? <div key={selected.id+':'+pending.id} className={"question-card"+(['alarm_screen','alarm_recheck'].includes(pending.id)?' alarm-question-compact checkia-safety-question':'')}>
            <button type="button" className="finish-writing secondary" onClick={()=>{answerInput.current?.blur();document.body.classList.remove('answer-focus');}}>Listo</button><p className="eyebrow">{'PREGUNTA ' + questionNumber + (pending.id==='alarm_recheck' ? ' · SEÑALES ACTUALES' : pending.id==='alarm_screen' ? ' · COMPROBACIÓN INICIAL' : pending.parentKey ? ' · ACLARACIÓN' : '')}</p><h3 style={{whiteSpace:'pre-line'}}>{pending.text}</h3>
            {clarification && <div className="notice" role="status">{clarification}</div>}
            <form onSubmit={sendMessage}>
              {error && <p id="answer-feedback" className="inline-answer-error" role="alert">{error}</p>}
              <label htmlFor="answer">Tu respuesta</label>
              {paso23Protocol?<Paso23Options question={pending} onSelect={sendAnswer} disabled={busy}/>:<AnswerOptions questionId={pending.id} value={message} onChange={setMessage} disabled={busy}/>}<textarea aria-invalid={!!error} aria-describedby={error?"answer-feedback":undefined} enterKeyHint="send" ref={answerInput} onKeyDown={enterToSubmit} id="answer" value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} required disabled={busy} rows={3} inputMode={!freeTextProtocol && revisedProtocol && ['age','weight','height'].includes(pending.id) ? 'decimal' : 'text'} placeholder={freeTextProtocol && ['age','weight','height'].includes(pending.id) ? 'Escribe tu respuesta con texto o números.' : revisedProtocol && pending.id === 'height' ? 'Solo número en cm, por ejemplo 175.' : revisedProtocol && pending.id === 'weight' ? 'Solo número en kg, por ejemplo 70.' : pending.id === 'name' ? 'Solo tus nombres o un alias, por ejemplo Luis Alejandro.' : pending.id === 'reason' ? 'Por ejemplo: molestia en el abdomen.' : 'Escribe tu respuesta a la pregunta actual.'}/>
              <div className="answer-footer"><button type="submit" onPointerDown={e=>e.preventDefault()} onMouseDown={e=>e.preventDefault()} disabled={busy || !message.trim()}>Guardar respuesta</button></div>
            </form>
          </div> : alarm ? <p className="muted">Entrevista detenida. Puedes revisar el historial o cerrar esta consulta de prueba.</p> : selected.status === 'closed' ? null : !interview ? <div className="notice">Esta consulta no contiene una entrevista. Pulsa “Nueva consulta” para comenzar.</div> : selected.clinicalState.phase === 'complete' ? (paso23Protocol?null:<p className="completion-state">Respuestas guardadas.</p>) : <div className="notice error">No se pudo cargar la siguiente pregunta. Pulsa “Recargar mensajes” e inténtalo nuevamente.</div>}

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
    {busy && !['create','orientation'].includes(busyOperation) && <p className="busy-status" role="status">Procesando…<LoadingDots/></p>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
