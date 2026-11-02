// MyGuitarHub widget snapshots: no public room access without a revocable friendship token.
// Social auth and friendship authorization are delegated to the existing social service.
const SOCIAL='https://myguitarhub-social-v1.manuelitosmurf.workers.dev';
const ORIGINS=new Set(['https://myguitarhub.pages.dev','http://localhost:5173','http://127.0.0.1:5173']);
const json=(data,status=200,h={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer',...h}});
export default {async fetch(request,env){
 const origin=request.headers.get('origin');
 const headers={'cache-control':'no-store, max-age=0','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...(ORIGINS.has(origin)?{'access-control-allow-origin':origin,'access-control-allow-headers':'Authorization,Content-Type','access-control-allow-methods':'GET,POST,OPTIONS'}:{})};
 if(origin&&!ORIGINS.has(origin))return json({error:'Origine non autorizzata'},403,headers);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 const url=new URL(request.url),path=url.pathname;
 if(path==='/health')return json({ok:true,service:'myguitarhub-widget',version:1},200,headers);
 try{
  const rawToken=path==='/snapshot'?(request.headers.get('authorization')||'').replace(/^Bearer /,''):url.searchParams.get('token')||'';
  if(!/^[a-f0-9]{64}$/.test(rawToken))return json({error:'Codice widget non valido'},401,headers);
  const external=path==='/snapshot'?'/me':'/widget';
  const social=await fetch(SOCIAL+external,{headers:{Authorization:'Bearer '+rawToken},signal:AbortSignal.timeout(9000),cache:'no-store'});
  if(!social.ok)return json({error:'Accesso revocato o non autorizzato'},social.status===403?403:401,headers);
  const user=await social.json();
  if(!user?.id)return json({error:'Profilo non disponibile'},403,headers);
  if(path==='/snapshot'&&request.method==='POST'){
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato non valido'},415,headers);
   const length=Number(request.headers.get('content-length')||'0');
   if(length>290000)return json({error:'Immagine troppo grande'},413,headers);
   const raw=await request.text();if(raw.length>290000)return json({error:'Immagine troppo grande'},413,headers);
   let body;try{body=JSON.parse(raw);}catch{return json({error:'JSON non valido'},400,headers)}
   const valid=v=>typeof v==='string'&&v.length>300&&v.length<136000&&/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(v);
   if(!valid(body.light)||!valid(body.dark))return json({error:'Foto stanza non valide'},400,headers);
   await env.DB.prepare('INSERT INTO widget_snapshots(owner_id,light_image,dark_image,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET light_image=excluded.light_image,dark_image=excluded.dark_image,updated_at=excluded.updated_at').bind(user.id,body.light,body.dark,Date.now()).run();
   return json({ok:true},200,headers);
  }
  if(path==='/status'&&request.method==='GET'){
   return json({nickname:user.nickname,studying:!!user.fresh&&!!user.presence?.studying,fresh:!!user.fresh,updatedAt:user.seenAt||0,mapId:user.presence?.mapId||'home'},200,headers);
  }
  if(path==='/image'&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT light_image,dark_image FROM widget_snapshots WHERE owner_id=?').bind(user.id).first();
   if(!row)return json({error:'Apri MyGuitarHub per sincronizzare la tua stanza'},404,headers);
   const awake=!!user.fresh&&!!user.presence?.studying;
   const image=awake?row.light_image:row.dark_image;
   const base64=image.slice('data:image/webp;base64,'.length),data=atob(base64);
   const bytes=new Uint8Array(data.length);for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);
   return new Response(bytes,{status:200,headers:{...headers,'content-type':'image/webp','x-widget-state':awake?'studying':'resting'}});
  }
  return json({error:'Endpoint inesistente'},404,headers);
 }catch(error){console.error('widget_error',error?.message);return json({error:'Servizio widget temporaneamente non disponibile'},500,headers)}
}};
