const ORIGINS=new Set(['https://myguitarhub.pages.dev','https://myguitarhub-amici.pages.dev','http://terminal.local:4173']);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const pair=(a,b)=>[a,b].sort();
export function cleanRoom(r){
 if(!r||!['home','studio','shop','rehearsal','stage'].includes(r.mapId)||!Array.isArray(r.owned)||r.owned.length>100)fail('Stanza non valida.');
 return {mapId:r.mapId,owned:[...new Set(r.owned.filter(s=>typeof s==='string'&&/^[a-z:-]{1,50}$/.test(s)))],lampOn:!!r.lampOn,deskLightOn:!!r.deskLightOn,fireOn:!!r.fireOn,rainOn:!!r.rainOn,elapsed:Math.max(0,Math.min(604800000,Number(r.elapsed)||0))};
}
export function publicPresence(p,now=Date.now()){
 const fresh=!!p&&now-p.updated<90000,studying=fresh&&p.studying===1;
 return {room:p?JSON.parse(p.room):null,studying,online:fresh,updated:p?.updated??null,weekKey:p?.weekkey??'',weekSeconds:p?.seconds??0};
}
async function route(req,env){
 const db=env.DB, url=new URL(req.url),path=url.pathname.replace(/^\/v1/,'');
 if(req.method==='GET'&&path==='/health')return json({ok:true,version:'friends-v1'});
 const read=async()=>{if(Number(req.headers.get('content-length'))>600000)fail('Richiesta troppo grande.',413);const reader=req.body?.getReader();let size=0,parts=[];if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();fail('Richiesta troppo grande.',413);}parts.push(value);}try{const all=new Uint8Array(size);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder().decode(all));}catch{fail('Richiesta non valida.');}};
 const one=(sql,...args)=>db.prepare(sql).bind(...args).first();
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 const limit=async(key,max)=>{const minute=Math.floor(Date.now()/60000);const p=await one('INSERT INTO social_limits(key,minute,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN minute=excluded.minute THEN hits+1 ELSE 1 END,minute=excluded.minute RETURNING hits',key,minute);if(p.hits>max)fail('Troppe richieste. Riprova tra un minuto.',429);};
 const auth=req.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
 if(path==='/profile'&&req.method==='POST'){
  await limit('register:'+req.headers.get('CF-Connecting-IP'),8);
  const b=await read();const nickname=typeof b.nickname==='string'?b.nickname.trim():'';
  if(!/^[a-zA-Z0-9_]{3,24}$/.test(nickname))fail('Usa 3–24 lettere, numeri o trattini bassi.');
  const id=crypto.randomUUID(),secret=token();
  try{await run('INSERT INTO social_users VALUES(?,?,?,?,?)',id,nickname,nickname.toLowerCase(),await hash(secret),Date.now());}catch(e){if(String(e).includes('UNIQUE'))fail('Questo nickname è già occupato.',409);throw e;}
  return json({id,nickname,token:secret},201);
 }
 // Dedicated read-only widget credential. Friendship is checked on EVERY request.
 if(path==='/widget'&&req.method==='GET'){
  const w=await one('SELECT * FROM social_widgets WHERE hash=?',await hash(auth));if(!w)fail('Widget non autorizzato.',401);
  const [a,b]=pair(w.viewer,w.target);if(!await one("SELECT 1 FROM social_links WHERE a=? AND b=? AND status='accepted'",a,b))fail('Amicizia rimossa.',403);
  const user=await one('SELECT nickname FROM social_users WHERE id=?',w.target),p=await one('SELECT * FROM social_presence WHERE owner=?',w.target);
  return json({nickname:user.nickname,...publicPresence(p),snapshot:p?(p.studying===1&&publicPresence(p).studying?p.snapshot:p.asleep??(p.studying===0?p.snapshot:null)):null,openURL:'https://myguitarhub.pages.dev/?friend='+w.target});
 }
 const me=await one('SELECT id,nickname FROM social_users WHERE authhash=?',await hash(auth));if(!me)fail('Profilo non riconosciuto. Ripristina il tuo codice personale.',401);
 if(req.method!=='GET')await limit('user:'+me.id,100);
 const linked=async target=>{const [a,b]=pair(me.id,target);return one("SELECT 1 FROM social_links WHERE a=? AND b=? AND status='accepted'",a,b);};
 if(path==='/me'&&req.method==='GET'){
  const {results}=await db.prepare("SELECT u.id,u.nickname,l.status,l.sender,p.room,p.studying,p.weekkey,p.seconds,p.updated FROM social_links l JOIN social_users u ON u.id=CASE WHEN l.a=? THEN l.b ELSE l.a END LEFT JOIN social_presence p ON p.owner=u.id WHERE l.a=? OR l.b=? ORDER BY u.nickkey").bind(me.id,me.id,me.id).all();
  return json({me,friends:results.filter(x=>x.status==='accepted').map(x=>({id:x.id,nickname:x.nickname,...publicPresence(x.room?x:null)})),incoming:results.filter(x=>x.status==='pending'&&x.sender!==me.id).map(x=>({id:x.id,nickname:x.nickname})),outgoing:results.filter(x=>x.status==='pending'&&x.sender===me.id).map(x=>({id:x.id,nickname:x.nickname}))});
 }
 if(path==='/nickname'&&req.method==='POST'){
  const {nickname}=await read();if(typeof nickname!=='string'||!/^[a-zA-Z0-9_]{3,24}$/.test(nickname))fail('Usa 3–24 lettere, numeri o trattini bassi.');
  try{await run('UPDATE social_users SET nickname=?,nickkey=? WHERE id=?',nickname,nickname.toLowerCase(),me.id);}catch(e){if(String(e).includes('UNIQUE'))fail('Questo nickname è già occupato.',409);throw e;}return json({ok:true});
 }
 if(path==='/invite'&&req.method==='POST'){
  await limit('invite:'+me.id,10);const secret=token();await run('INSERT INTO social_invites VALUES(?,?,?)',await hash(secret),me.id,Date.now()+7*86400000);
  await run('DELETE FROM social_invites WHERE expires<?',Date.now());return json({invite:secret});
 }
 if(path==='/invite'&&req.method==='GET'){
  const i=await one('SELECT u.id,u.nickname FROM social_invites i JOIN social_users u ON u.id=i.owner WHERE i.hash=? AND i.expires>?',await hash(url.searchParams.get('code')??''),Date.now());if(!i)fail('Invito scaduto o non valido.',404);return json(i);
 }
 if(path==='/request'&&req.method==='POST'){
  await limit('request:'+me.id,12);const data=await read();let target;
  if(data.invite)target=await one('SELECT owner AS id FROM social_invites WHERE hash=? AND expires>?',await hash(String(data.invite)),Date.now());
  else target=await one('SELECT id FROM social_users WHERE nickkey=?',String(data.nickname??'').trim().toLowerCase());
  if(!target)fail('Nickname o invito non trovato.',404);if(target.id===me.id)fail('Non puoi aggiungere te stesso.');
  const [a,b]=pair(me.id,target.id),old=await one('SELECT * FROM social_links WHERE a=? AND b=?',a,b);
  if(old?.status==='accepted')return json({accepted:true});
  if(data.invite){await run("INSERT INTO social_links VALUES(?,?,?,'accepted',?) ON CONFLICT(a,b) DO UPDATE SET status='accepted'",a,b,me.id,Date.now());return json({accepted:true});}
  if(old)return json({pending:true});await run("INSERT OR IGNORE INTO social_links VALUES(?,?,?,'pending',?)",a,b,me.id,Date.now());return json({pending:true});
 }
 if(path==='/respond'&&req.method==='POST'){
  const {id,accept}=await read();const [a,b]=pair(me.id,String(id));
  if(accept)await run("UPDATE social_links SET status='accepted' WHERE a=? AND b=? AND sender<>? AND status='pending'",a,b,me.id);
  else await run("DELETE FROM social_links WHERE a=? AND b=? AND sender<>? AND status='pending'",a,b,me.id);
  return json({ok:true});
 }
 if(path==='/remove'&&req.method==='POST'){
  const {id}=await read(),[a,b]=pair(me.id,String(id));
  await db.batch([db.prepare('DELETE FROM social_links WHERE a=? AND b=?').bind(a,b),db.prepare('DELETE FROM social_widgets WHERE (viewer=? AND target=?) OR (viewer=? AND target=?)').bind(me.id,id,id,me.id)]);return json({ok:true});
 }
 if(path==='/presence'&&req.method==='POST'){
  const b=await read(),room=cleanRoom(b.room),seconds=Number(b.weekSeconds);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.weekKey)||!Number.isFinite(seconds)||seconds<0||seconds>604800)fail('Statistiche non valide.');
  const snap=b.snapshot;for(const snap of [b.snapshot,b.asleep])if(snap!==undefined&&snap!==null&&(typeof snap!=='string'||snap.length>260000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(snap)))fail('Immagine non valida.');
  await run('INSERT INTO social_presence VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET room=excluded.room,studying=excluded.studying,weekkey=excluded.weekkey,seconds=excluded.seconds,updated=excluded.updated,snapshot=COALESCE(excluded.snapshot,social_presence.snapshot),asleep=COALESCE(excluded.asleep,social_presence.asleep)',me.id,JSON.stringify(room),b.studying?1:0,b.weekKey,Math.floor(seconds),Date.now(),snap??null,b.asleep??null);return json({ok:true});
 }
 if(path==='/widget'&&req.method==='POST'){
  const {id}=await read();if(!await linked(id))fail('Amicizia non disponibile.',403);const secret=token();
  await db.batch([db.prepare('DELETE FROM social_widgets WHERE viewer=? AND target=?').bind(me.id,id),db.prepare('INSERT INTO social_widgets VALUES(?,?,?,?)').bind(await hash(secret),me.id,id,Date.now())]);
  return json({token:secret});
 }
 fail('Funzione non trovata.',404);
}
export default {async fetch(req,env){
 const origin=req.headers.get('Origin');const allowed=!origin||ORIGINS.has(origin)||/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
 if(!allowed)return json({error:'Origine non autorizzata.'},403);
 let res;if(req.method==='OPTIONS')res=new Response(null,{status:204});else try{res=await route(req,env);}catch(e){if(!e.status)console.error(JSON.stringify({event:'social-error',message:String(e)}));res=json({error:e.status?e.message:'Servizio temporaneamente non disponibile.'},e.status??500);}
 const h=new Headers(res.headers);if(origin)h.set('Access-Control-Allow-Origin',origin);h.set('Vary','Origin');h.set('Access-Control-Allow-Headers','Authorization,Content-Type');h.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');return new Response(res.body,{status:res.status,headers:h});
}};
