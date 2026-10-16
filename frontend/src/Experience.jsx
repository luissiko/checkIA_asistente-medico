import React,{useEffect,useRef} from 'react';

export function HealthMark(){return <span className="health-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="32" height="32" focusable="false"><path d="M16 3v4M5 14H2v8h3m22-8h3v8h-3" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="16" cy="3" r="2" fill="currentColor"/><rect x="5" y="8" width="22" height="20" rx="6" fill="#d4eaff" stroke="currentColor" strokeWidth="2"/><circle cx="11" cy="17" r="2" fill="currentColor"/><circle cx="21" cy="17" r="2" fill="currentColor"/><path d="M11 23h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span className="health-plus">+</span></span>;}
export function WelcomeIntro({onDone}){
  const finish=useRef(onDone);finish.current=onDone;
  useEffect(()=>{const timer=setTimeout(()=>finish.current(),2500);return()=>clearTimeout(timer);},[]);
  return <main className="checkia-intro" aria-labelledby="intro-title"><div className="intro-card"><div className="intro-emblem"><HealthMark/></div><p className="intro-brand">CHECK<span>IA</span></p><h1 id="intro-title">Bienvenido a CHECKIA</h1><div className="intro-progress" aria-hidden="true"/></div></main>;
}
