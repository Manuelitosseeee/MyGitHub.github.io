// Optional local-only QA fixture. Enabled only by an ignored .env.local value.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from '../friends-backend/worker.js';
export function socialPreview(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../friends-backend/schema.sql',import.meta.url),'utf8'));
 class Statement{constructor(sql){this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return sqlite.prepare(this.sql).get(...this.args)??null;}async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}async run(){return sqlite.prepare(this.sql).run(...this.args);}}
 const env={DB:{prepare:s=>new Statement(s),async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
 let seeded=false;
 return {name:'social-local-qa',configureServer(server){server.middlewares.use('/qa-social/v1',async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
  const request=new Request('http://localhost/v1'+req.url,{method:req.method,headers:{...req.headers,origin:'http://localhost:4173'},body:body.length?body:undefined});
  const response=await worker.fetch(request,env);const text=await response.text();
  if(!seeded&&req.url==='/profile'&&response.status===201){seeded=true;const me=JSON.parse(text);const id='local-bob';sqlite.prepare('INSERT INTO social_users VALUES(?,?,?,?,?)').run(id,'Test_Chitarrista','test_chitarrista','local-fixture-no-auth',Date.now());const [a,b]=[me.id,id].sort();sqlite.prepare('INSERT INTO social_links VALUES(?,?,?,?,?)').run(a,b,id,'pending',Date.now());sqlite.prepare('INSERT INTO social_presence VALUES(?,?,?,?,?,?,?,?)').run(id,JSON.stringify({mapId:'home',owned:['rug','desk','cat','art'],lampOn:true,deskLightOn:true,fireOn:false,rainOn:true,elapsed:0}),0,'2026-11-02',5420,Date.now(),null,null);}
  // Toggle fixture presence to exercise live rendering, without external effects.
  if(req.url.startsWith('/me'))sqlite.prepare('UPDATE social_presence SET studying=?,updated=? WHERE owner=?').run(Math.floor(Date.now()/20000)%2,Date.now(),'local-bob');
  res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(text);
 });}};
}
