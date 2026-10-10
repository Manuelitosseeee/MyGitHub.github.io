import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const esbuild=require(require.resolve('esbuild',{paths:[process.cwd()]}));
const result=await esbuild.build({entryPoints:['src/pixel/model.ts'],bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
let p=m.initialPixel();p=m.begin(p,'song','Test',1000,'s1');p=m.tick(p,61000);
assert.equal(p.balanceCents,100);assert.equal(p.session.activeMs,60000);
p=m.pause(p,91000);assert.equal(p.balanceCents,150);const paused=p;p=m.tick(p,999999);assert.deepEqual(p,paused);
p=m.resume(p,1000000);p=m.tick(p,1030000);assert.equal(p.balanceCents,200);assert.equal(p.session.activeMs,120000);
p=m.finish(p,1030000);assert.equal(p.receipts[0].earnedCents,200);assert.equal(p.session,null);
assert.deepEqual(m.finish(p,1040000),p,'No duplicate payout');
assert.equal(m.buy(p,'desk'),p,'Cannot buy without funds');
p={...p,balanceCents:100000};p=m.buy(p,'desk');assert.equal(p.balanceCents,92000);assert.equal(m.bonusFor(p.owned),5);assert.equal(m.buy(p,'desk'),p,'No duplicate purchase');
p=m.begin(p,'song','Bonus',1,'s2');p=m.tick(p,60001);assert.equal(p.session.earnedCents,105);
p=m.buy(p,'guitar');assert.equal(p.session.bonus,5,'Purchases apply to later sessions');p=m.tick(p,120001);assert.equal(p.session.earnedCents,210);
const recovered=m.recover(JSON.parse(JSON.stringify(p)));assert.equal(recovered.session.status,'paused');assert.equal(recovered.session.checkpoint,null);assert.equal(recovered.balanceCents,p.balanceCents);
assert.equal(m.completed(p),false);for(const i of m.ITEMS.filter(i=>i.required))p=m.buy(p,i.id);assert.equal(m.completed(p),true);
let tiny=m.begin(m.initialPixel(),'song','Tiny',0,'s');for(let i=1;i<=120;i++)tiny=m.tick(tiny,i*500);assert.equal(tiny.balanceCents,100,'Fractional ticks preserve 1 euro/min');
assert.equal(m.clock(3661000),'01:01:01');assert.deepEqual(m.recover({version:1,balanceCents:-50}),m.initialPixel());
console.log('PASS: accrual, pauses, resume, purchases, bonus snapshot, recovery, completion, fractional cents, no duplicate rewards');

const artwork=await esbuild.build({entryPoints:['src/pixel/art.ts'],bundle:true,platform:'node',format:'esm',write:false});
const a=await import('data:text/javascript;base64,'+Buffer.from(artwork.outputFiles[0].text).toString('base64'));
for(const [w,h] of [[390,844],[430,932],[1440,900],[844,390]]){const c=a.camera(w,h);assert.ok(c.scale>0);assert.ok(c.x>=0&&c.y>=0);assert.ok(c.x+a.ART_W*c.scale<=w+.001);assert.ok(c.y+a.ART_H*c.scale<=h+.001);for(const q of Object.values(a.HOTSPOTS)){assert.ok(c.x+(q[0]+q[2])*c.scale<=w+.001);assert.ok(c.y+(q[1]+q[3])*c.scale<=h+.001);}}
const old=m.initialPixel();delete old.deskLightOn;old.owned=['desk','lamp','plant'];old.balanceCents=12345;const migrated=m.recover(old);assert.deepEqual(migrated.owned,old.owned);assert.equal(migrated.balanceCents,12345);assert.equal(migrated.deskLightOn,true);
assert.equal(a.hasAllArt(m.ITEMS.map(i=>i.id)),true);assert.equal(a.hasAllArt(['desk']),false);
console.log('PASS: portrait/landscape geometry, hotspot bounds, previous purchases and light migration');
// Every unlock is economic; no elapsed-time/session requirement.
let world={...m.initialPixel(),balanceCents:2000000};
for(const map of m.MAPS){assert.equal(m.mapUnlocked(world,map.id),true);world=m.selectMap(world,map.id);assert.equal(world.mapId,map.id);if(map.id!=='home'){assert.ok(m.ownedOnMap(world,map.id).length>world.owned.length);assert.equal(m.completed(world,map.id),false);}for(const item of m.itemsForMap(map.id)){if(!item.included){const balance=world.balanceCents;world=m.buy(world,item.id);assert.equal(world.balanceCents,balance-item.price*100);}}assert.equal(m.completed(world,map.id),true);}
assert.equal(world.totalMs,0);assert.equal(world.receipts.length,0);assert.ok(m.bonusFor(world.owned)<=150);
let locked={...m.initialPixel(),balanceCents:999999};assert.equal(m.selectMap(locked,'stage'),locked);assert.equal(m.buy(locked,'stage:piano'),locked);assert.equal(m.mapUnlocked(locked,'studio'),false);
let run=m.begin(world,'song','Stage',1000,'all-map-session');assert.equal(run.session.mapId,'stage');assert.equal(m.selectMap(run,'home'),run);run=m.pause(run,61000);const save=m.recover(JSON.parse(JSON.stringify(run)));assert.equal(save.mapId,'stage');assert.equal(save.session.mapId,'stage');assert.deepEqual(save.owned,run.owned);assert.equal(save.balanceCents,run.balanceCents);
console.log('PASS: all five shops, included furniture, sequential economic unlocks, locked purchases, active-map recovery');
