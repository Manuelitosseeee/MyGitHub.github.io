// Device credentials are random bearer secrets; nicknames never authenticate.
const allowed = new Set(['https://myguitarhub.pages.dev','https://myguitarhub-amici.pages.dev','http://localhost:5173','http://127.0.0.1:5173']);
export const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const secret = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(code,msg)=>{throw new ApiError(code,msg);};
const nick=v=>{if(typeof v!=='string'||! /^[a-zA-Z0-9_]{3,24}$/.test(v))fail(400,'Usa da 3 a 24 lettere, numeri o underscore.');return v;};
export function cleanPresence(p) {
 if(!p||!['home','studio','shop','rehearsal','stage'].includes(p.mapId)||!Array.isArray(p.owned)||p.owned.length>100||p.owned.some(x=>typeof x!=='string'||x.length>64))fail(400,'Stanza non valida.');
 if(!Number.isFinite(p.weekSeconds)||p.weekSeconds<0||p.weekSeconds>604800||!/^\d{4}-\d{2}-\d{2}$/.test(p.weekStart))fail(400,'Statistiche non valide.');
 return {mapId:p.mapId,owned:[...new Set(p.owned)],lampOn:p.lampOn===true,deskLightOn:p.deskLightOn===true,fireOn:p.fireOn===true,rainOn:p.rainOn===true,studying:p.studying===true,activeMs:Math.max(0,Math.min(604800000,Number(p.activeMs)||0)),weekSeconds:Math.floor(p.weekSeconds),weekStart:p.weekStart};
}
function publicUser(u,now) {
 let presence=null;try{presence=u.presence?JSON.parse(u.presence):null;}catch{}
 return {id:u.id,nickname:u.nickname,presence,seenAt:u.seen_at,fresh:now-u.seen_at<90000};
}
export default {async fetch(request,env) {
 const origin=request.headers.get('Origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(origin&&allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'});
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
 try {
 if(origin&&!allowed.has(origin))fail(403,'Origine non autorizzata.');
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),path=url.pathname,now=Date.now(),db=env.DB;
 if(path==='/health')return json({ok:true,version:1});
 const auth=request.headers.get('Authorization')??'',token=auth.startsWith('Bearer ')?auth.slice(7):(path==='/widget/image'&&request.method==='GET'?(url.searchParams.get('token')??''):'');
 if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Configura il tuo nickname su questo dispositivo.');
 const tokenHash=await hash(token);
 // Rate limits are shared across isolates. Buckets are bounded by periodic cleanup.
 const bucket=Math.floor(now/60000),ip=request.headers.get('CF-Connecting-IP')??'local';
 const key=await hash(`${ip}:${bucket}:${request.method==='GET'?'read':'write'}`);
 const rate=await db.prepare('INSERT INTO social_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+120000).first();
 if(rate.count>(request.method==='GET'?240:120))fail(429,'Troppe richieste. Attendi un minuto.');
 if(request.method!=='GET')await db.prepare('DELETE FROM social_limits WHERE expires<?').bind(now).run();
 let body={};
 if(request.method==='POST'){
  const reader=request.body?.getReader();let size=0,chunks=[];
  if(reader){while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>(path==='/widget/snapshot'?300000:16384)){await reader.cancel();fail(413,'Richiesta troppo grande.');}chunks.push(value);}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Richiesta non valida.');}
  if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Richiesta non valida.');
 }
 let me=await db.prepare('SELECT * FROM social_users WHERE token_hash=?').bind(tokenHash).first();
 if(path==='/profile'&&request.method==='POST'){
  const nickname=nick(body.nickname);
  const existing=await db.prepare('SELECT id FROM social_users WHERE nickname=? COLLATE NOCASE').bind(nickname).first();
  if(existing&&existing.id!==me?.id)fail(409,'Questo nickname è già occupato.');
  if(me)await db.prepare('UPDATE social_users SET nickname=? WHERE id=?').bind(nickname,me.id).run();
  else {const id=crypto.randomUUID();try{await db.prepare('INSERT INTO social_users(id,nickname,token_hash,created_at) VALUES (?,?,?,?)').bind(id,nickname,tokenHash,now).run();}catch{fail(409,'Nickname già occupato. Riprova.');}me={id};}
  return json({id:me.id,nickname});
 }
 if(path==='/widget/image'&&request.method==='GET'){
  const row=await db.prepare("SELECT u.id,u.presence,u.seen_at FROM social_widget_tokens w JOIN social_links l ON l.id=w.link_id AND l.status='accepted' JOIN social_users u ON u.id=w.target WHERE w.hash=? AND ((l.lo=w.viewer AND l.hi=w.target) OR (l.hi=w.viewer AND l.lo=w.target))").bind(tokenHash).first();
  if(!row)fail(403,'Accesso widget revocato.');
  const snap=await db.prepare('SELECT lit,dark FROM social_widget_snapshots WHERE user_id=?').bind(row.id).first();
  if(!snap)fail(404,'La stanza non è ancora stata sincronizzata per i widget.');
  let p=null;try{p=row.presence?JSON.parse(row.presence):null;}catch{}
  const active=now-row.seen_at<90000&&p?.studying===true;
  const encoded=active?snap.lit:snap.dark;
  if(typeof encoded!=='string'||!/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(encoded))fail(500,'Immagine non valida.');
  const raw=atob(encoded.slice('data:image/webp;base64,'.length));
  const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Response(bytes,{status:200,headers:{...headers,'Content-Type':'image/webp','X-Widget-State':active?'studying':'resting','Cache-Control':'no-store, max-age=0'}});
 }
 if(path==='/widget'&&request.method==='GET'){
  const row=await db.prepare("SELECT u.* FROM social_widget_tokens w JOIN social_links l ON l.id=w.link_id AND l.status='accepted' JOIN social_users u ON u.id=w.target WHERE w.hash=? AND ((l.lo=w.viewer AND l.hi=w.target) OR (l.hi=w.viewer AND l.lo=w.target))").bind(tokenHash).first();
  if(!row)fail(403,'Amicizia rimossa o accesso revocato.');return json(publicUser(row,now));
 }
 if(!me)fail(401,'Profilo non trovato. Ripristina il codice del tuo profilo.');
 if(path==='/widget/snapshot'&&request.method==='POST'){
  const valid=v=>typeof v==='string'&&v.length<=135000&&/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(v)&&v.length>300;
  if(!valid(body.lit)||!valid(body.dark))fail(400,'Immagini stanza non valide.');
  await db.prepare('INSERT INTO social_widget_snapshots(user_id,lit,dark,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET lit=excluded.lit,dark=excluded.dark,updated_at=excluded.updated_at').bind(me.id,body.lit,body.dark,now).run();
  return json({ok:true,updatedAt:now});
 }
 if(path==='/profile/delete'&&request.method==='POST'){
  await db.batch([db.prepare('DELETE FROM social_widget_tokens WHERE viewer=? OR target=?').bind(me.id,me.id),db.prepare('DELETE FROM social_links WHERE lo=? OR hi=?').bind(me.id,me.id),db.prepare('DELETE FROM social_widget_snapshots WHERE user_id=?').bind(me.id),db.prepare('DELETE FROM social_users WHERE id=?').bind(me.id)]);return json({ok:true});
 }
 if(path==='/me'&&request.method==='GET')return json({id:me.id,nickname:me.nickname});
 if(path==='/friends'&&request.method==='GET'){
  const rows=await db.prepare('SELECT u.*,l.id AS linkId,l.status,l.sender FROM social_links l JOIN social_users u ON u.id=CASE WHEN l.lo=? THEN l.hi ELSE l.lo END WHERE l.lo=? OR l.hi=? ORDER BY u.nickname COLLATE NOCASE').bind(me.id,me.id,me.id).all();
  return json({friends:rows.results.filter(r=>r.status==='accepted').map(r=>({...publicUser(r,now),linkId:r.linkId})),requests:rows.results.filter(r=>r.status==='pending').map(r=>({id:r.id,nickname:r.nickname,linkId:r.linkId,incoming:r.sender!==me.id}))});
 }
 const requestFriend=async target=>{
  if(target===me.id)fail(400,'Non puoi aggiungere te stesso.');
  const [lo,hi]=[me.id,target].sort();
  const exists=await db.prepare('SELECT id FROM social_links WHERE lo=? AND hi=?').bind(lo,hi).first();
  if(exists)return json({ok:true,message:'Amicizia o richiesta già presente.'});
  await db.prepare("INSERT OR IGNORE INTO social_links(id,lo,hi,sender,status,created_at) VALUES (?,?,?,?,'pending',?)").bind(crypto.randomUUID(),lo,hi,me.id,now).run();return json({ok:true});
 };
 if(path==='/request'&&request.method==='POST'){
  const target=await db.prepare('SELECT id FROM social_users WHERE nickname=? COLLATE NOCASE').bind(nick(body.nickname)).first();
  if(!target)fail(404,'Nickname non trovato.');return await requestFriend(target.id);
 }
 if(path==='/invite'&&request.method==='POST'){
  const invitation=secret();await db.prepare('UPDATE social_users SET invite_hash=?,invite_expires=? WHERE id=?').bind(await hash(invitation),now+604800000,me.id).run();return json({invitation});
 }
 if(path==='/invite/preview'&&request.method==='POST'){
  if(typeof body.invitation!=='string')fail(400,'Invito non valido.');
  const target=await db.prepare('SELECT id,nickname FROM social_users WHERE invite_hash=? AND invite_expires>?').bind(await hash(body.invitation),now).first();
  if(!target)fail(404,'Invito scaduto o revocato.');return json(target);
 }
 if(path==='/invite/accept'&&request.method==='POST'){
  if(typeof body.invitation!=='string')fail(400,'Invito non valido.');
  const target=await db.prepare('SELECT id FROM social_users WHERE invite_hash=? AND invite_expires>?').bind(await hash(body.invitation),now).first();
  if(!target)fail(404,'Invito scaduto o revocato.');if(target.id===me.id)fail(400,'Questo è il tuo invito.');
  const [lo,hi]=[me.id,target.id].sort();
  await db.prepare("INSERT INTO social_links(id,lo,hi,sender,status,created_at) VALUES (?,?,?,?,'accepted',?) ON CONFLICT(lo,hi) DO UPDATE SET status='accepted'").bind(crypto.randomUUID(),lo,hi,target.id,now).run();return json({ok:true});
 }
 if(path==='/respond'&&request.method==='POST'){
  const result=body.accept===true?await db.prepare("UPDATE social_links SET status='accepted' WHERE id=? AND status='pending' AND sender<>? AND (lo=? OR hi=?)").bind(String(body.linkId),me.id,me.id,me.id).run():await db.prepare("DELETE FROM social_links WHERE id=? AND status='pending' AND sender<>? AND (lo=? OR hi=?)").bind(String(body.linkId),me.id,me.id,me.id).run();
  if(!result.meta.changes)fail(404,'Richiesta non più disponibile.');return json({ok:true});
 }
 if(path==='/remove'&&request.method==='POST'){
  await db.batch([db.prepare('DELETE FROM social_widget_tokens WHERE link_id IN (SELECT id FROM social_links WHERE id=? AND (lo=? OR hi=?))').bind(String(body.linkId),me.id,me.id),db.prepare('DELETE FROM social_links WHERE id=? AND (lo=? OR hi=?)').bind(String(body.linkId),me.id,me.id)]);return json({ok:true});
 }
 if(path==='/presence'&&request.method==='POST'){
  const p=cleanPresence(body);await db.prepare('UPDATE social_users SET presence=?,seen_at=? WHERE id=?').bind(JSON.stringify(p),now,me.id).run();return json({ok:true});
 }
 if(path==='/widget-token'&&request.method==='POST'){
  const link=await db.prepare("SELECT * FROM social_links WHERE id=? AND status='accepted' AND (lo=? OR hi=?)").bind(String(body.linkId),me.id,me.id).first();
  if(!link)fail(403,'Amicizia non disponibile.');
  const widgetToken=secret(),target=link.lo===me.id?link.hi:link.lo;
  await db.batch([db.prepare('DELETE FROM social_widget_tokens WHERE viewer=? AND target=?').bind(me.id,target),db.prepare('INSERT INTO social_widget_tokens(hash,viewer,target,link_id,created_at) VALUES (?,?,?,?,?)').bind(await hash(widgetToken),me.id,target,link.id,now)]);return json({token:widgetToken});
 }
 fail(404,'Funzione non trovata.');
 }catch(error){if(!(error instanceof ApiError))console.error('social_api_failure',error.message);return json({error:error instanceof ApiError?error.message:'Servizio temporaneamente non disponibile.'},error.status??500);}
}};
