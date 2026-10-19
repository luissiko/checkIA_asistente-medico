import React,{useEffect,useRef,useState} from 'react';
import './text-size.css';
const sizes=[85,100,115,130,150],labels=['Pequeño','Normal','Grande','Muy grande','Extra grande'];
export function TextSizeControl(){
 const [size,setSize]=useState(()=>{try{const n=Number(localStorage.getItem('checkia-text-size'));return sizes.includes(n)?n:100;}catch{return 100;}}),[open,setOpen]=useState(false),root=useRef(null),button=useRef(null);
 useEffect(()=>{document.documentElement.style.fontSize=size+'%';try{localStorage.setItem('checkia-text-size',String(size));}catch{}},[size]);
 useEffect(()=>{const close=e=>{if(!root.current?.contains(e.target))setOpen(false);};const escape=e=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[]);
 return <div ref={root} className="text-size-control"><button ref={button} type="button" className="text-size-trigger" aria-label="Tamaño de letra" aria-expanded={open} aria-controls="text-size-options" onClick={()=>setOpen(!open)}>Aa</button>{open&&<div id="text-size-options" className="text-size-menu" role="group" aria-label="Tamaños de letra">{sizes.map((n,i)=><button key={n} type="button" aria-pressed={size===n} onClick={()=>{setSize(n);setOpen(false);button.current?.focus();}}>{labels[i]} · {n}%</button>)}</div>}</div>;
}
