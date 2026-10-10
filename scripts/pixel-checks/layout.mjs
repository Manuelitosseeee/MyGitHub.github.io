import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),esbuild=require('esbuild'),{createCanvas,loadImage}=require('@napi-rs/canvas');
async function mod(path){const r=await esbuild.build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const {ITEM_ART,assetNames,itemId,drawPart,drawForeground,character,sourceFrame}=await mod('src/pixel/itemArt.ts'),{composeRoom}=await mod('src/pixel/composition.ts');
const floors={home:1004,studio:958,shop:1025,rehearsal:930,stage:1090};
const fixedPlantSupports={home:[494,307,307],studio:[310],shop:[248,244],rehearsal:[308],stage:[]};
const bounds=JSON.parse(await readFile('src/pixel/itemBounds.json','utf8'));
let count=0,pots=0;await mkdir('/workspace/scratch/21f787905e4e/layout-qa',{recursive:true});
for(const id of Object.keys(ITEM_ART)){
 const assets=Object.fromEntries(await Promise.all(assetNames(id).map(async name=>[name,await loadImage(`public/pixel/items/${name}.png`)])));
 const base=await loadImage(`public/pixel/${id==='home'?'empty-v2':id+'-base'}.webp`);if(id==='home')assets.toolsBase=await loadImage('public/pixel/neutral-v2.webp');
 const entries=Object.entries(ITEM_ART[id]).flatMap(([key,parts])=>parts.map((p,index)=>({key,index,p}))),sheet=createCanvas(5*201,Math.ceil(entries.length/5)*338),sc=sheet.getContext('2d');
 for(const [i,{key,index,p}]of entries.entries()){
  const [sx,sy,sw,sh]=sourceFrame(p.asset),im=assets[p.asset];assert.ok(sx>=0&&sy>=0&&sw>0&&sh>0&&sx+sw<=im.width&&sy+sh<=im.height,p.asset);
  assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=1005&&p.y+p.h<=1568,`${id}/${key}/${index}: clipped object`);
  if(!p.project)assert.ok(Math.abs(p.w/p.h-sw/sh)<.001,`${p.asset}: stretched sprite`);
  const cv=createCanvas(1004,1567),c=cv.getContext('2d');c.imageSmoothingEnabled=false;drawPart(c,assets,p);
  const pixels=c.getImageData(0,0,1004,1567).data;assert.ok(pixels.some((v,k)=>k%4===3&&v>200),`${p.asset}: invisible`);
  if(p.asset==='plant'){
   const foot=Math.round(p.y+p.h*bounds.plant.bottom/333); // Alpha bounds: the painted pot base.
   assert.ok(p.mount||(p.ground&&foot>=floors[id])||fixedPlantSupports[id].some(y=>Math.abs(y-foot)<=2),`${id}: unsupported pot at ${foot}`);pots++;
  }
  // Foreground decorations must not cover the face or the fixed metronome.
  if(p.z>=100)for(const [x,y,w,h]of [[493,757,95,94],[680,890,56,94]]){const d=c.getImageData(x,y,w,h).data;assert.ok(!d.some((v,k)=>k%4===3&&v>20),`${id}/${key}: covers essential feature`);}
  c.drawImage(base,0,0);drawPart(c,assets,p);drawPart(c,assets,character);
  const x=i%5*201,y=Math.floor(i/5)*338;sc.drawImage(cv,x,y+20,201,313);sc.fillStyle='#fff';sc.font='11px sans-serif';sc.fillText(`${key} / ${index+1}: ${p.asset}`,x+2,y+13);count++;
 }
 // Animated rendering's back/actor/front passes must match static composition.
 const owned=Object.keys(ITEM_ART[id]).map(k=>itemId(id,k)),a=createCanvas(1004,1567),b=createCanvas(1004,1567),ac=a.getContext('2d'),bc=b.getContext('2d');
 composeRoom(ac,base,id,owned,assets);composeRoom(bc,base,id,owned,assets,false,false);drawPart(bc,assets,character);drawForeground(bc,assets,id,owned);
 assert.deepEqual(ac.getImageData(0,0,1004,1567).data,bc.getImageData(0,0,1004,1567).data,`${id}: animated depth differs from preview`);
 await writeFile(`/workspace/scratch/21f787905e4e/layout-qa/${id}-objects.png`,sheet.toBuffer('image/png'));
}
console.log(`PASS: ${count} placed objects checked individually; ${pots} pots supported with no furniture dependency; original aspect ratios, viewport bounds, protected tools/face, identical animated/static depth.`);
