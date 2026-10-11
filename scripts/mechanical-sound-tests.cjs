const assert=require('node:assert/strict'),esbuild=require('esbuild');
(async()=>{
 const r=await esbuild.build({entryPoints:['src/engine/mechanicalClick.ts'],bundle:true,platform:'node',format:'cjs',write:false});
 const m={exports:{}};new Function('module','exports',r.outputFiles[0].text)(m,m.exports);
 const {mechanicalClickSamples:samples,mechanicalBuffer:buffer}=m.exports;
 for(const rate of [32000,44100,48000,96000])for(const accent of [false,true]){
  const x=samples(rate,accent),y=samples(rate,accent);
  assert.deepEqual(x,y);assert.equal(x.length,Math.ceil(rate*.06));
  assert.ok(x.every(v=>Number.isFinite(v)&&Math.abs(v)<=.861));
  const energy=(a,b)=>x.slice(Math.floor(a*rate),Math.floor(b*rate)).reduce((s,v)=>s+v*v,0);
  assert.ok(energy(.03,.06)<energy(0,.03)*.01,'short dry tail');
  assert.equal(x[0],0);assert.ok(Math.abs(x.at(-1))<.00001);
 }
 assert.notDeepEqual(samples(48000),samples(48000,true));
 let created=0;const ctx={sampleRate:48000,createBuffer:(_,n)=>{created++;const x=new Float32Array(n);return {getChannelData:()=>x}}};
 assert.equal(buffer(ctx,'beat'),buffer(ctx,'sub'));assert.equal(buffer(ctx,'accent'),buffer(ctx,'accent'));assert.equal(created,2);
 console.log('PASS: 4 sample rates, dry decay, finite unclipped output, repeatable ticks, accent and buffer reuse.');
})().catch(e=>{console.error(e);process.exit(1)});
