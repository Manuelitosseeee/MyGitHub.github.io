const assert=require('node:assert/strict'),esbuild=require('esbuild');
async function mod(path){const r=await esbuild.build({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false,nodePaths:['backend/node_modules']});const m={exports:{}};new Function('module','exports','require',r.outputFiles[0].text)(m,m.exports,require);return m.exports;}
(async()=>{const p=await mod('src/study/planner.ts'),w=await mod('backend/worker.ts'),base={id:'x',date:'2026-11-10',title:'',songId:'song',startBpm:60,path:'relax',createdAt:0},today='2026-10-10';
let x=p.plan(base,91,0,p.ALL_DAYS,today);assert.equal(x.completion,base.date);assert.equal(x.target,60);
assert.equal(p.plan(base,65,0,p.ALL_DAYS,today).target,60);
x=p.plan({...base,path:'medio'},110,0,p.ALL_DAYS,today);assert.equal(x.target,65);assert.equal(x.completion,'2026-10-19');
x=p.plan({...base,path:'impegnativo'},105,0,p.ALL_DAYS,today);assert.ok(x.target<=105);assert.ok(x.warning.includes('indicativi'));
x=p.plan(base,91,80,p.ALL_DAYS,'2026-10-20');assert.equal(x.from,80);assert.ok(x.target<=91);
x=p.plan(base,91,0,[1,2,3,4,5],today);assert.equal(x.target,60);assert.equal(x.scheduled,false);
x=p.plan(base,91,0,[],today);assert.equal(x.completion,null);
x=p.plan({...base,date:'2026-10-01'},100,0,p.ALL_DAYS,today);assert.equal(x.completion,null);
x=p.plan(base,91,125,p.ALL_DAYS,today);assert.equal(x.complete,true);assert.equal(p.bestFor('song',[{songId:'song',bpm:125},{songId:'song',bpm:80}]),125);
assert.equal(p.dayDiff('2026-03-28','2026-03-30'),2);assert.equal(p.shiftDay('2026-03-28',2),'2026-03-30');
let cases=0;for(const path of Object.keys(p.PATHS))for(let diff=1;diff<=200;diff+=7)for(const duration of [1,3,7,30,100])for(const days of [p.ALL_DAYS,[1,3,5]]){const m={...base,path,date:p.shiftDay(today,duration)};const z=p.plan(m,60+diff,0,days,today);assert.ok(z.target<=60+diff);if(z.completion){assert.ok(z.completion<=m.date);assert.ok(days.includes(p.weekday(z.completion)));}cases++;}
const payload={subscription:{endpoint:'https://fcm.googleapis.com/x',keys:{auth:'a',p256dh:'b'}},timezone:'Europe/Rome',preferences:{enabled:true,time:'18:00',daily:true,deadlines:true,incomplete:true},days:p.ALL_DAYS,songs:[{id:'song',title:'Test',goalBpm:91}],milestones:[base],results:[],goals:[]};
let msg=w.reminder(payload,Date.parse('2026-10-10T16:00:00Z'));assert.equal(msg.kind,'daily');assert.ok(msg.body.includes('Test'));
assert.equal(w.reminder({...payload,days:[1,2,3,4,5]},Date.parse('2026-10-10T16:00:00Z')),null);
assert.equal(w.reminder(payload,Date.parse('2026-10-10T15:59:00Z')),null);
assert.equal(w.reminder({...payload,preferences:{...payload.preferences,enabled:false}},Date.parse('2026-10-10T16:00:00Z')),null);
msg=w.reminder(payload,Date.parse('2026-10-10T19:00:00Z'));assert.equal(msg.kind,'incomplete');
assert.equal(w.reminder({...payload,results:[{songId:'song',date:today,bpm:91}],goals:[{songId:'song',date:today,from:60,target:61}]},Date.parse('2026-10-10T19:00:00Z')),null);
assert.equal(w.localClock(Date.parse('2026-10-26T17:00:00Z'),'Europe/Rome').minute,1080);
console.log(`PASS: ${cases} planner cases, rest days, DST, best results, daily and incomplete reminder selection.`);
})().catch(e=>{console.error(e);process.exit(1)});
