import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const site='https://myguitarhub-amici-preview.manuelitosmurf.workers.dev';
const suffix=Date.now().toString(36).slice(-8);
const tok=()=> 'gh1.'+randomBytes(32).toString('base64url');
const a={nickname:'qa_a_'+suffix,token:tok()},b={nickname:'qa_b_'+suffix,token:tok()};
async function api(path,method='GET',auth=null,body=undefined,expected=200){
 const r=await fetch(site+'/api/friends/'+path,{method,headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const json=await r.json(); console.log(method,path,r.status,json.error??'ok');
 assert.equal(r.status,expected,JSON.stringify(json));return json;
}
const ai=await api('identity','POST',null,a,201),bi=await api('identity','POST',null,b,201);
await api('identity','POST',null,a,409);
await api('requests','POST',a.token,{nickname:b.nickname});
const requests=await api('requests','GET',b.token);
assert.equal(requests.requests.length,1);
await api('requests/'+requests.requests[0].id+'/accept','POST',b.token);
let fa=await api('list','GET',a.token),fb=await api('list','GET',b.token);
assert.equal(fa.friends[0].id,bi.id);assert.equal(fb.friends[0].id,ai.id);
const room={mapId:'home',owned:['home-desk'],lampOn:true,deskLightOn:true,fireOn:true,rainOn:false,activeMs:4400};
await api('presence','POST',a.token,{room,studying:true,weekKey:'2026-11-02',weekSeconds:3660});
fb=await api('list','GET',b.token);
assert.equal(fb.friends[0].studying,true);
assert.equal(fb.friends[0].weekSeconds,3660);
assert.equal(fb.friends[0].room.mapId,'home');
await api('friend/'+ai.id,'DELETE',b.token);
fa=await api('list','GET',a.token);assert.equal(fa.friends.length,0);
await api('friend/'+ai.id,'GET',b.token,undefined,403);
console.log('PASS: new Cloudflare D1 identity, requests, acceptance, friend presence, weekly stats and access revocation');
