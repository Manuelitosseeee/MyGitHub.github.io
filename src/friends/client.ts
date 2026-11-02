import {pixel} from '../pixel/state';
import {ownedOnMap} from '../pixel/model';
import {store} from '../data/store';
import type {MapId} from '../pixel/maps';
export const API=import.meta.env.VITE_SOCIAL_API || 'https://myguitarhub-social-v1.manuelitosmurf.workers.dev';
const KEY='mygithub.social-credential.v1';
export interface Profile {id:string;nickname:string}
export interface Presence {mapId:MapId;owned:string[];studying:boolean;lampOn:boolean;deskLightOn:boolean;fireOn:boolean;rainOn:boolean;activeMs:number;weekSeconds:number;weekStart:string}
export interface Friend extends Profile {linkId:string;presence:Presence|null;seenAt:number;fresh:boolean}
export interface FriendRequest extends Profile {linkId:string;incoming:boolean}
export interface FriendsData {friends:Friend[];requests:FriendRequest[]}
export function credential(){return localStorage.getItem(KEY)||'';}
export function restoreCredential(value:string){if(!/^[a-f0-9]{64}$/.test(value))throw Error('Codice profilo non valido.');localStorage.setItem(KEY,value);window.dispatchEvent(new Event('social:profile'));}
export function ensureCredential(){let token=credential();if(!token){token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,token);}return token;}
export async function api<T>(path:string,body?:unknown,token=credential()):Promise<T>{
 const response=await fetch(API+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(12000)});
 let data;try{data=await response.json();}catch{throw Error('Il servizio Amici non risponde. Riprova.');}
 if(!response.ok)throw Error(data.error||'Impossibile completare la richiesta.');return data;
}
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function presence():Presence {
 const p=pixel.get(),now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate());start.setDate(start.getDate()-(start.getDay()+6)%7);
 const weekStart=dateKey(start),today=dateKey(now);
 const seconds=store.state.practices.filter(x=>x.date>=weekStart&&x.date<=today).reduce((sum,x)=>sum+x.seconds,0);
 // Completed Pixel sessions are already included in practices: only add the live session.
 const active=p.session?.activeMs??0;
 const liveSeconds=p.session&&p.session.startedAt>=start.getTime()?active/1000:0;
 return {mapId:p.mapId,owned:ownedOnMap(p,p.mapId),studying:p.session?.status==='running',lampOn:p.lampOn,deskLightOn:p.deskLightOn,fireOn:p.fireOn,rainOn:p.rainOn,activeMs:active,weekSeconds:Math.min(604800,Math.floor(seconds+liveSeconds)),weekStart};
}
export function watchPresence(onError:(message:string)=>void){
 let busy=false,queued=false,timer:number|undefined,disposed=false,last=0;
 const send=async()=>{
  if(disposed||!credential())return;
  if(busy){queued=true;return;}
  busy=true;last=Date.now();
  try{await api('/presence',presence());onError('');}catch(e){onError(e instanceof Error?e.message:'Sincronizzazione non disponibile.');}finally{busy=false;if(queued){queued=false;schedule();}}
 };
 const schedule=()=>{if(timer!==undefined)return;timer=window.setTimeout(()=>{timer=undefined;void send();},Math.max(0,1500-(Date.now()-last)));};
 const unsub=pixel.subscribe(schedule),unsubStore=store.subscribe(schedule);
 const interval=window.setInterval(()=>{if(!document.hidden)void send();},25000);
 const resume=()=>{if(!document.hidden)void send();};
 const hidden=()=>{
  if(!document.hidden){void send();return;}
  if(credential())void fetch(API+'/presence',{method:'POST',headers:{Authorization:`Bearer ${credential()}`,'Content-Type':'application/json'},body:JSON.stringify(presence()),keepalive:true}).catch(()=>{});
 };
 window.addEventListener('online',resume);window.addEventListener('social:profile',resume);document.addEventListener('visibilitychange',hidden);
 void send();
 return()=>{disposed=true;unsub();unsubStore();clearInterval(interval);clearTimeout(timer);window.removeEventListener('online',resume);window.removeEventListener('social:profile',resume);document.removeEventListener('visibilitychange',hidden);};
}
export const hours=(seconds:number)=>`${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`;
