import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),esbuild=require('esbuild'),{createCanvas,loadImage}=require('@napi-rs/canvas');
async function mod(path){const r=await esbuild.build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const {composeRoom}=await mod('src/pixel/composition.ts'),model=await mod('src/pixel/model.ts'),art=await mod('src/pixel/art.ts'),{NEW_CORE}=await mod('src/pixel/mapArt.ts');
const points={studio:{console:[240,665],monitors:[210,549],rack:[810,665],mic:[350,810],guitar:[890,1040]},shop:{counter:[247,650],wall:[442,411],cabinet:[800,490],shelves:[40,840],guitars:[158,1300]},rehearsal:{drums:[260,664],keys:[550,657],amps:[790,610],bass:[909,805],pedals:[956,1250]},stage:{mic:[200,815],piano:[240,671],amp:[799,851],guitar:[900,1020],wedges:[50,1210]}};
const sheet=createCanvas(1004,4*480),sc=sheet.getContext('2d');let combinations=0,row=0;
for(const id of ['studio','shop','rehearsal','stage']){
 const full=await loadImage(`public/pixel/${id}-full.webp`),base=await loadImage(`public/pixel/${id}-base.webp`),cv=createCanvas(art.ART_W,art.ART_H),c=cv.getContext('2d'),reference=createCanvas(art.ART_W,art.ART_H),ref=reference.getContext('2d');ref.drawImage(full,0,0,art.ART_W,art.ART_H);const paid=model.itemsForMap(id).filter(i=>!i.included),included=model.itemsForMap(id).filter(i=>i.included).map(i=>i.id);
 for(let bits=0;bits<2**paid.length;bits++){
  const owned=[...included,...paid.filter((_,i)=>bits&(1<<i)).map(i=>i.id)];composeRoom(c,full,base,id,owned);
  for(const [item,[x,y]]of Object.entries(points[id]))if(owned.includes(`${id}:${item}`))assert.ok([...c.getImageData(x,y,1,1).data].every((v,k)=>Math.abs(v-ref.getImageData(x,y,1,1).data[k])<=2),`${id}/${item} is cut out at purchase mask ${bits}`);
  combinations++;
 }
 for(const [col,owned] of [included,[...included,...paid.slice(0,2).map(i=>i.id)],[...included,...paid.filter(i=>!i.id.endsWith(':plants')).map(i=>i.id)],[...included,...paid.map(i=>i.id)]].entries()){
  composeRoom(c,full,base,id,owned);c.save();c.beginPath();NEW_CORE.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();c.drawImage(full,0,0,art.ART_W,art.ART_H);c.restore();sc.drawImage(cv,col*251,row*480+25,251,392);sc.fillStyle='#fff';sc.font='13px sans-serif';sc.fillText(`${id}: ${['included','two purchases','no plants','complete'][col]}`,col*251+4,row*480+17);
 }
 for(const [w,h]of [[390,844],[393,852],[430,932],[844,390],[1363,936]]){
  const view=createCanvas(w,h),v=view.getContext('2d'),cam=art.camera(w,h);v.translate(cam.x,cam.y);v.scale(cam.scale,cam.scale);v.drawImage(cv,0,0);for(const [x,y]of [[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),h-1]])assert.equal(v.getImageData(x,y,1,1).data[3],255,`${id} has uncovered viewport at ${w}x${h}`);
 }
 row++;
}
await mkdir('/workspace/scratch/21f787905e4e/composition-qa',{recursive:true});await writeFile('/workspace/scratch/21f787905e4e/composition-qa/partial-maps.png',sheet.toBuffer('image/png'));
console.log(`PASS: ${combinations} purchase combinations preserve neighbouring objects; every tested viewport is covered by original map pixels.`);
