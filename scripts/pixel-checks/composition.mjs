import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),esbuild=require('esbuild'),{createCanvas,loadImage}=require('@napi-rs/canvas');
async function mod(path){const r=await esbuild.build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const {composeRoom}=await mod('src/pixel/composition.ts'),model=await mod('src/pixel/model.ts'),art=await mod('src/pixel/art.ts'),{ITEM_ART,assetNames,drawPart}=await mod('src/pixel/itemArt.ts');
const sheet=createCanvas(5*251,5*422),sc=sheet.getContext('2d');let row=0,singles=0,combinations=0;
for(const id of ['home','studio','shop','rehearsal','stage']){
 console.log('checking',id);const base=await loadImage(`public/pixel/${id==='home'?'empty-v2':id+'-base'}.webp`),assets=Object.fromEntries(await Promise.all(assetNames(id).map(async name=>[name,await loadImage(`public/pixel/items/${name}.png`)])));
 if(id==='home')assets.toolsBase=await loadImage('public/pixel/neutral-v2.webp');
 for(const [name,im]of Object.entries(assets).filter(([n])=>n!=='toolsBase')){const s=createCanvas(im.width,im.height),c=s.getContext('2d');c.drawImage(im,0,0);const data=c.getImageData(0,0,s.width,s.height).data;let transparent=0,opaque=0;for(let k=3;k<data.length;k+=4){if(data[k]===0)transparent++;if(data[k]>200)opaque++;}assert.ok(transparent>data.length/4*.02,`${name}: rectangular backdrop`);assert.ok(opaque>20,`${name}: empty sprite`);}
 const cv=createCanvas(art.ART_W,art.ART_H),c=cv.getContext('2d'),included=model.itemsForMap(id).filter(i=>i.included).map(i=>i.id),paid=model.itemsForMap(id).filter(i=>!i.included);
 // A single purchase may change only pixels in its true alpha silhouette.
 const baseline=createCanvas(art.ART_W,art.ART_H),bc=baseline.getContext('2d');composeRoom(bc,base,id,included,assets);const before=bc.getImageData(0,0,art.ART_W,art.ART_H).data;
 for(const item of paid){if(!ITEM_ART[id][id==='home'?item.id:item.id.split(':')[1]])continue;
  composeRoom(c,base,id,[...included,item.id],assets);const after=c.getImageData(0,0,art.ART_W,art.ART_H).data;
  const support=createCanvas(art.ART_W,art.ART_H),mc=support.getContext('2d');mc.imageSmoothingEnabled=false;for(const p of ITEM_ART[id][id==='home'?item.id:item.id.split(':')[1]])drawPart(mc,assets,p);const mask=mc.getImageData(0,0,art.ART_W,art.ART_H).data;
  for(let k=0;k<before.length;k+=4)if(mask[k+3]===0)for(let j=0;j<4;j++)assert.ok(Math.abs(after[k+j]-before[k+j])<=2,`${item.id} erased or pasted background outside its silhouette`);
  singles++;
 }
 for(let bits=0;bits<2**paid.length;bits++){
  const owned=[...included,...paid.filter((_,i)=>bits&(1<<i)).map(i=>i.id)];const calls=[];const proxy=new Proxy(c,{get(target,key){if(key==='drawImage')return (im,...args)=>{calls.push(im);return target.drawImage(im,...args);};const v=target[key];return typeof v==='function'?v.bind(target):v;},set(target,key,v){target[key]=v;return true;}});try{composeRoom(proxy,base,id,owned,assets);}catch(e){console.log('failed mask',id,bits);throw e;}
  const allowed=new Set([base,assets.toolsBase,assets.character,...Object.entries(ITEM_ART[id]).filter(([key])=>owned.includes(id==='home'?key:`${id}:${key}`)).flatMap(([,parts])=>parts.map(p=>assets[p.asset]))]);assert.ok(calls.every(im=>allowed.has(im)),`${id}: an unowned object appeared`);combinations++;
 }
 const first=id==='stage'?'stage:amp':id==='rehearsal'?'rehearsal:amps':id==='studio'?'studio:rack':id==='shop'?'shop:wall':'shelf';const guitar=id==='shop'?'shop:guitars':id==='rehearsal'?'rehearsal:bass':id==='home'?'guitar':`${id}:guitar`;
 for(const [col,owned]of [included,[...included,first],[...included,guitar],[...included,first,guitar],[...included,...paid.map(i=>i.id)]].entries()){composeRoom(c,base,id,owned,assets);sc.drawImage(cv,col*251,row*422+25,251,392);sc.fillStyle='#fff';sc.font='12px sans-serif';sc.fillText(`${id}: ${['included','amp/furniture','guitar only','both','all'][col]}`,col*251+3,row*422+17);}
 for(const [w,h]of [[390,844],[393,852],[430,932],[844,390],[1363,936]]){const view=createCanvas(w,h),v=view.getContext('2d'),cam=art.camera(w,h);art.drawRoomEdges(v,base,w,h,cam);v.translate(cam.x,cam.y);v.scale(cam.scale,cam.scale);v.drawImage(cv,0,0);for(const [x,y]of [[0,0],[w-1,0],[0,h-1],[w-1,h-1]])assert.equal(v.getImageData(x,y,1,1).data[3],255);}
 row++;
}
await mkdir('/workspace/scratch/21f787905e4e/composition-qa',{recursive:true});await writeFile('/workspace/scratch/21f787905e4e/composition-qa/isolated-purchases.png',sheet.toBuffer('image/png'));
console.log(`PASS: ${singles} single purchases affect only their alpha silhouette; ${combinations} ownership combinations; transparent assets and complete-map framing and fullscreen edge coverage.`);
