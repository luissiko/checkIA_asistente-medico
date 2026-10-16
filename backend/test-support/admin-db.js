import {FakeDB} from './fake-db.js';
const value=(d,key,id)=>key==='__name__'?id:key.split('.').reduce((o,k)=>o?.[k],d);
export class AdminDB extends FakeDB{
 async runTransaction(fn){return super.runTransaction(tx=>fn({...tx,create:(ref,d)=>{if(this.failAudit&&ref.path.startsWith('checkia_admin_audit/'))throw new Error('audit');tx.create(ref,d);}}));}
 query(path,filters=[],orders=[],cap=Infinity,after=null,selected=null){
  return {path,
   doc:id=>({path:path+'/'+id,id,collection:name=>this.query(path+'/'+id+'/'+name),create:async d=>{if(this.failAudit&&path==='checkia_admin_audit')throw new Error('audit');this.data.set(path+'/'+id,structuredClone(d));}}),
   where:(key,op,v)=>this.query(path,[...filters,[key,op,v]],orders,cap,after,selected),
   orderBy:(key,direction='asc')=>this.query(path,filters,[...orders,[key,direction]],cap,after,selected),
   limit:n=>this.query(path,filters,orders,n,after,selected),
   startAfter:(...values)=>this.query(path,filters,orders,cap,values,selected),
   select:(...keys)=>this.query(path,filters,orders,cap,after,keys),
   get:async()=>{
    let rows=[...this.data].filter(([p,d])=>p.startsWith(path+'/')&&p.split('/').length===path.split('/').length+1&&filters.every(([k,op,v])=>{const a=value(d,k,p.split('/').at(-1));return op==='=='?a===v:op==='>='?a>=v:op==='<'?a<v:false;}));
    const compare=(a,b)=>{for(const [key,dir]of orders){const av=value(a[1],key,a[0].split('/').at(-1)),bv=value(b[1],key,b[0].split('/').at(-1));const n=av<bv?-1:av>bv?1:0;if(n)return dir==='desc'?-n:n;}return 0;};
    rows.sort(compare);if(after)rows=rows.filter(([p,d])=>{for(let i=0;i<orders.length;i++){const [key,dir]=orders[i],a=value(d,key,p.split('/').at(-1)),b=after[i];if(a!==b)return dir==='desc'?a<b:a>b;}return false;});
    this.lastQuery={path,cap,selected,filters,orders};
    return {docs:rows.slice(0,cap).map(([p,d])=>({id:p.split('/').at(-1),ref:{path:p,id:p.split('/').at(-1)},data:()=>{if(!selected)return structuredClone(d);const out={};for(const key of selected){const v=value(d,key);if(v===undefined)continue;const parts=key.split('.');let node=out;for(const k of parts.slice(0,-1))node=node[k]??={};node[parts.at(-1)]=structuredClone(v);}return out;}}))};
   }
  };
 }
}
