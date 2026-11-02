import {useSyncExternalStore} from 'react';
import type {SocialData} from './model';
export const API=import.meta.env.VITE_SOCIAL_API || 'https://myguitarhub-friends.manuelitosmurf.workers.dev/v1';
const KEY=import.meta.env.VITE_SOCIAL_API?'mygithub.social.qa.identity':'mygithub.social.identity.v1';
let credential='';try{credential=localStorage.getItem(KEY)??'';}catch{}
let current:{data:SocialData|null;error:string;credential:boolean}={data:null,error:'',credential:!!credential};
const listeners=new Set<()=>void>();
function emit(){listeners.forEach(f=>f());}
export const social={
 get:()=>current,
 subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
 secret:()=>credential,
 async call<T=Record<string,unknown>>(path:string,body?:unknown,keepalive=false):Promise<T>{
  const response=await fetch(API+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+credential,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',keepalive,signal:keepalive?undefined:AbortSignal.timeout(15000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error??'Connessione non disponibile.');return result;
 },
 async refresh(){try{const data=await social.call<SocialData>('/me');current={data,error:'',credential:true};emit();return data;}catch(e){current={...current,error:(e as Error).message};emit();throw e;}},
 async register(nickname:string){const result=await social.call<{token:string}>('/profile',{nickname});localStorage.setItem(KEY,result.token);credential=result.token;current={...current,credential:true};emit();await social.refresh();},
 async restore(secret:string){const previous=credential;credential=secret.trim();try{const data=await social.call<SocialData>('/me');localStorage.setItem(KEY,credential);current={data,error:'',credential:true};emit();}catch(e){credential=previous;throw e;}},
 clear(){localStorage.removeItem(KEY);credential='';current={data:null,error:'',credential:false};emit();}
};
export function useSocial(){return useSyncExternalStore(social.subscribe,social.get);}
