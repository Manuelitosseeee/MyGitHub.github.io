import {timingSafeEqual} from 'node:crypto';
import webpush from 'web-push';
import {plan,ALL_DAYS,dayDiff,bestFor,resultToday,type Milestone,type StudyResult,type DailyGoal} from '../src/study/planner';
type Env = Cloudflare.Env;
interface Payload {subscription:{endpoint:string;keys:{p256dh:string;auth:string}};timezone:string;preferences:{enabled:boolean;time:string;daily:boolean;deadlines:boolean;incomplete:boolean};days:number[];songs:{id:string;title:string;goalBpm:number|null}[];milestones:Milestone[];results:StudyResult[];goals:DailyGoal[]}
const ORIGIN='https://myguitarhub.pages.dev';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Content-Type':'application/json'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
async function hash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(v=>v.toString(16).padStart(2,'0')).join('')}
export function localClock(at:number,tz:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);const get=(t:string)=>parts.find(p=>p.type===t)!.value;return {date:`${get('year')}-${get('month')}-${get('day')}`,minute:Number(get('hour'))*60+Number(get('minute'))}}
export function reminder(p:Payload,at:number){
 const {date,minute}=localClock(at,p.timezone),weekday=new Date(date+'T12:00:00Z').getUTCDay();if(!p.preferences.enabled||!p.days.includes(weekday))return null;
 const [h,m]=p.preferences.time.split(':').map(Number),start=h*60+m,follow=start+180;
 // Short catch-up window handles a delayed cron without replaying stale reminders.
 const kind=minute>=start&&minute<start+15?'daily':follow<1440&&minute>=follow&&minute<follow+15?'incomplete':null;if(!kind)return null;
 const planned=p.milestones.filter(m=>m.songId).flatMap(m=>{const song=p.songs.find(s=>s.id===m.songId);if(!song||song.goalBpm===null)return [];const calc=plan(m,song.goalBpm,bestFor(song.id,p.results),p.days,date),goal=p.goals.find(g=>g.date===date&&g.songId===song.id);if(calc.complete&&!goal)return [];const target=goal?.target??calc.target;return [{title:song.title,target,done:resultToday(song.id,p.results,date)>=target,due:m.date}]});
 const remaining=planned.filter(s=>!s.done),near=planned.filter(s=>dayDiff(date,s.due)>=0&&dayDiff(date,s.due)<=7),custom=p.milestones.filter(m=>!m.songId&&dayDiff(date,m.date)>=0&&dayDiff(date,m.date)<=7);
 if(kind==='incomplete'){if(!p.preferences.incomplete||!remaining.length)return null;return{date,kind,title:'Gli obiettivi di oggi',body:`Restano ${remaining.length} brani: ${remaining.map(s=>`${s.title} · ${s.target} BPM`).join(', ').slice(0,220)}`}}
 const body:string[]=[];if(p.preferences.daily&&remaining.length)body.push(remaining.map(s=>`${s.title} · ${s.target} BPM`).join(', '));if(p.preferences.daily&&!planned.length)body.push('Un po’ di studio libero? Apri la tua libreria.');if(p.preferences.deadlines&&(near.length||custom.length))body.push(`Scadenze vicine: ${[...near.map(s=>s.title),...custom.map(m=>m.title)].join(', ')}`);if(!body.length)return null;return{date,kind,title:'La tua sessione di oggi',body:body.join('. ').slice(0,300)};
}
function valid(p:Payload){
 try{const u=new URL(p.subscription.endpoint);const host=u.hostname;if(u.protocol!=='https:'||u.port||u.username||u.password||!(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.apple.com')||host==='web.push.apple.com'||host.endsWith('.notify.windows.com')))return false;new Intl.DateTimeFormat('it',{timeZone:p.timezone});return !!p.subscription.keys?.auth&&!!p.subscription.keys?.p256dh&&/^([01]\d|2[0-3]):[0-5]\d$/.test(p.preferences.time)&&p.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&p.songs.length<=500&&p.milestones.length<=1000&&p.results.length<=20000&&p.goals.length<=500;}catch{return false}
}
export default {
 async fetch(req:Request,env:Env){
  const path=new URL(req.url).pathname;if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method==='GET'&&path==='/config')return json({publicKey:env.VAPID_PUBLIC});if(req.method==='GET'&&path==='/health')return json({ok:true});
  if(req.method!=='POST'||req.headers.get('Origin')!==ORIGIN)return json({error:'Forbidden'},403);
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')??'';if(!/^[\da-f-]{72}$/.test(token))return json({error:'Unauthorized'},401);const owner=await hash(token);
  if(Number(req.headers.get('Content-Length')??0)>500000)return json({error:'Too large'},413);
  try{const reader=req.body?.getReader();if(!reader)return json({error:'Missing body'},400);let length=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>500000){await reader.cancel();return json({error:'Too large'},413)}chunks.push(part.value)}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}const text=new TextDecoder().decode(bytes);const p=JSON.parse(text);
   if(path==='/unsubscribe'){await env.DB.prepare('DELETE FROM subscriptions WHERE owner=? AND endpoint=?').bind(owner,p.endpoint).run();return json({ok:true})}
   if(path!=='/subscribe'||!valid(p))return json({error:'Invalid subscription'},400);
   const existing=await env.DB.prepare('SELECT owner FROM subscriptions WHERE endpoint=?').bind(p.subscription.endpoint).first<{owner:string}>();if(existing&&!timingSafeEqual(Buffer.from(existing.owner),Buffer.from(owner)))return json({error:'Owner mismatch'},403);
   await env.DB.prepare('INSERT INTO subscriptions(endpoint,owner,payload,updated) VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET payload=excluded.payload,updated=excluded.updated').bind(p.subscription.endpoint,owner,JSON.stringify(p),Date.now()).run();return json({ok:true});
  }catch{return json({error:'Unable to save subscription'},400)}
 },
 async scheduled(event:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(deliver(env,event.scheduledTime));}
};
export async function deliver(env:Env,at:number){
 let cursor='';for(let page=0;page<100;page++){
 const rows=await env.DB.prepare('SELECT endpoint,payload FROM subscriptions WHERE endpoint>? ORDER BY endpoint LIMIT 50').bind(cursor).all<{endpoint:string;payload:string}>();if(!rows.results.length)break;
 for(const row of rows.results){cursor=row.endpoint;try{const p:Payload=JSON.parse(row.payload),message=reminder(p,at);if(!message)continue;const key=await hash(row.endpoint+'::'+message.date+'::'+message.kind);const claim=await env.DB.prepare('INSERT OR IGNORE INTO deliveries(id,at) VALUES(?,?)').bind(key,at).run();if(!claim.meta.changes)continue;
 const details=webpush.generateRequestDetails(p.subscription,JSON.stringify({title:message.title,body:message.body,tag:message.date+'-'+message.kind}),{TTL:3600,vapidDetails:{subject:ORIGIN,publicKey:env.VAPID_PUBLIC,privateKey:env.VAPID_PRIVATE}});
 const r=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body});if(r.status===404||r.status===410)await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(row.endpoint).run();else if(!r.ok){if(r.status>=500||r.status===429)await env.DB.prepare('DELETE FROM deliveries WHERE id=?').bind(key).run();console.warn(JSON.stringify({event:'push_failed',status:r.status}));}
 }catch(e){console.warn(JSON.stringify({event:'push_error',message:e instanceof Error?e.message:'Error'}));}}
 }
 await env.DB.prepare('DELETE FROM deliveries WHERE at<?').bind(at-30*86400000).run();
}
