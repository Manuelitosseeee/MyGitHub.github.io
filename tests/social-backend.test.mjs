import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker,{publicPresence} from '../friends-backend/worker.js';
function harness(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(fs.readFileSync(new URL('../friends-backend/schema.sql',import.meta.url),'utf8'));
 class Statement{constructor(sql){this.sql=sql;this.args=[];}bind(...args){this.args=args;return this;}async first(){return sqlite.prepare(this.sql).get(...this.args)??null;}async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}async run(){return sqlite.prepare(this.sql).run(...this.args);}}
 const env={DB:{prepare:s=>new Statement(s),async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
 const api=async(path,body,token='',headers={})=>{const r=await worker.fetch(new Request('https://api.test/v1'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);return {status:r.status,body:await r.json(),headers:r.headers};};return {api,sqlite};
}
test('authentication, consent, identical room, widget access, revocation and re-add',async()=>{
 const {api,sqlite}=harness();const a=(await api('/profile',{nickname:'Alice'})).body,b=(await api('/profile',{nickname:'Bob'})).body,c=(await api('/profile',{nickname:'Carol'})).body;
 assert.equal((await api('/profile',{nickname:'alice'})).status,409);assert.equal((await api('/me')).status,401);
 await api('/request',{nickname:'Bob'},a.token);assert.equal((await api('/me',undefined,b.token)).body.incoming[0].nickname,'Alice');
 await api('/respond',{id:b.id,accept:true},a.token);assert.equal((await api('/me',undefined,a.token)).body.friends.length,0);
 await api('/respond',{id:a.id,accept:true},b.token);assert.equal((await api('/me',undefined,a.token)).body.friends.length,1);assert.equal((await api('/me',undefined,b.token)).body.friends.length,1);
 const room={mapId:'home',owned:['rug','desk'],lampOn:true,rainOn:false,fireOn:true,deskLightOn:false,elapsed:12000};
 assert.equal((await api('/presence',{room,studying:true,weekKey:'2026-11-02',weekSeconds:123},a.token)).status,200);
 const f=(await api('/me',undefined,b.token)).body.friends[0];assert.deepEqual(f.room,room);assert.equal(f.studying,true);assert.equal(f.weekSeconds,123);
 assert.equal((await api('/widget',{id:a.id},c.token)).status,403);
 const w=(await api('/widget',{id:a.id},b.token)).body.token;assert.equal((await api('/widget',undefined,w)).body.studying,true);assert.equal((await api('/me',undefined,w)).status,401);
 await api('/remove',{id:a.id},b.token);assert.equal((await api('/widget',undefined,w)).status,401);assert.equal((await api('/me',undefined,a.token)).body.friends.length,0);
 const invite=(await api('/invite',{},a.token)).body.invite;assert.equal((await api('/invite?code='+invite,undefined,b.token)).body.nickname,'Alice');
 await api('/request',{invite},b.token);assert.equal((await api('/me',undefined,b.token)).body.friends.length,1);assert.equal((await api('/widget',undefined,w)).status,401);
 sqlite.exec('UPDATE social_presence SET updated=0');assert.equal((await api('/me',undefined,b.token)).body.friends[0].studying,false);
});
test('self requests, reject, invalid data, expiry, CORS, nickname changes',async()=>{
 const {api,sqlite}=harness();const a=(await api('/profile',{nickname:'Alice'})).body,b=(await api('/profile',{nickname:'Bob'})).body;
 assert.equal((await api('/request',{nickname:'Alice'},a.token)).status,400);assert.equal((await api('/presence',{room:{mapId:'bad'}},a.token)).status,400);
 await api('/request',{nickname:'Bob'},a.token);await api('/respond',{id:a.id,accept:false},b.token);assert.equal((await api('/me',undefined,b.token)).body.incoming.length,0);
 const inv=(await api('/invite',{},a.token)).body.invite;sqlite.exec('UPDATE social_invites SET expires=0');assert.equal((await api('/request',{invite:inv},b.token)).status,404);
 assert.equal((await api('/me',undefined,a.token,{Origin:'https://evil.example'})).status,403);assert.equal((await api('/me',undefined,a.token,{Origin:'https://myguitarhub.pages.dev'})).headers.get('access-control-allow-origin'),'https://myguitarhub.pages.dev');
 await api('/nickname',{nickname:'Alice_2'},a.token);assert.equal((await api('/me',undefined,a.token)).body.me.nickname,'Alice_2');
});
test('stale or absent presence is never studying',()=>{assert.equal(publicPresence(null).studying,false);assert.equal(publicPresence({updated:0,studying:1,room:'{}'}).studying,false);});
