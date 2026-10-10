import {store} from '../data/store';
import {ALL_DAYS,dayKey} from './planner';
const API='https://myguitarhub-study.guitarmurfs.workers.dev';
const KEY='mygithub.push-device.v1';
export const defaults={enabled:false,time:'18:00',daily:true,deadlines:true,incomplete:true};
function device(){let t=localStorage.getItem(KEY);if(!t){t=crypto.randomUUID()+crypto.randomUUID();localStorage.setItem(KEY,t)}return t;}
async function request(path:string,body?:unknown,authToken?:string){const r=await fetch(API+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','Authorization':'Bearer '+(authToken??device())}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Promemoria non sincronizzati: riprova con una connessione attiva.');return r.json();}
export function needsInstall(){return /iPhone|iPad|iPod/.test(navigator.userAgent)&&!matchMedia('(display-mode: standalone)').matches&&!(navigator as Navigator&{standalone?:boolean}).standalone;}
export async function authorizeNotifications(){
 if(needsInstall())throw new Error('Su iPhone: Safari → Condividi → Aggiungi alla schermata Home. Apri MyGitHub dall’icona, poi richiedi l’autorizzazione.');
 if(!('Notification' in window)||!('PushManager' in window))throw new Error('Questo browser non supporta Web Push. Usa un browser compatibile o la PWA installata.');
 const permission=await Notification.requestPermission();
 if(permission==='denied')throw new Error('Notifiche bloccate. Riabilitale nelle impostazioni del sito del browser o, su iPhone, in Impostazioni → Notifiche → MyGitHub. Poi premi di nuovo Richiedi autorizzazione.');
 if(permission!=='granted')return false;
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub){const config=await request('/config');const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})}
 store.updateSettings({notifications:{...defaults,...store.state.settings.notifications,enabled:true}});
 await syncNotifications();return true;
}
export async function syncNotifications(){
 const pending=localStorage.getItem('mygithub.push-unsubscribe-pending');if(pending){const p=JSON.parse(pending);await request('/unsubscribe',{endpoint:p.endpoint},p.token);localStorage.removeItem('mygithub.push-unsubscribe-pending')}
 const prefs={...defaults,...store.state.settings.notifications};
 if(!('serviceWorker' in navigator))return;
 const reg=await navigator.serviceWorker.getRegistration();const sub=await reg?.pushManager?.getSubscription();
 if(!prefs.enabled){if(sub){try{await request('/unsubscribe',{endpoint:sub.endpoint})}catch(e){localStorage.setItem('mygithub.push-unsubscribe-pending',JSON.stringify({endpoint:sub.endpoint,token:device()}));throw e}finally{await sub.unsubscribe()}}return;}
 if(!sub||!('Notification' in window)||Notification.permission!=='granted')return;
 const st=store.state;
 await request('/subscribe',{subscription:sub.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,preferences:prefs,days:st.settings.studyDays??ALL_DAYS,songs:st.songs.map(s=>({id:s.id,title:s.title,goalBpm:s.goalBpm})),milestones:st.milestones,results:st.studyResults.map(r=>({songId:r.songId,date:r.date,bpm:r.bpm})),goals:st.dailyGoals.filter(g=>g.date===dayKey())});
}
export function watchNotificationSync(onError:(msg:string)=>void){let timer:ReturnType<typeof setTimeout>;const sync=()=>{clearTimeout(timer);timer=setTimeout(()=>{void syncNotifications().catch(e=>onError(e.message))},1500)};const off=store.subscribe(sync);window.addEventListener('online',sync);sync();return()=>{off();clearTimeout(timer);window.removeEventListener('online',sync)}}
export async function removePush(){store.updateSettings({notifications:{...defaults,...store.state.settings.notifications,enabled:false}});try{await syncNotifications()}finally{localStorage.removeItem(KEY)}}
