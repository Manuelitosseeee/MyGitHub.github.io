import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium, webkit } from '@playwright/test';

const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:false},logLevel:'error'});
await server.listen();
const port=server.httpServer.address().port;
const url='http://127.0.0.1:'+port+'/';
await fs.mkdir('pixel-hands-qa',{recursive:true});

for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1400,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  const metrics=await page.evaluate(async ()=>{
   const {prepareHands,drawHands,handPose}=await import('/src/pixel/motion.ts');
   const img=new Image();img.src='/pixel/items/character.png';await img.decode();
   const original=document.createElement('canvas');original.width=1004;original.height=1567;
   const o=original.getContext('2d',{willReadFrequently:true});
   o.imageSmoothingEnabled=false;
   o.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,332,699,510*img.naturalWidth/img.naturalHeight,510);
   const motion=prepareHands(original);
   const source=o.getImageData(0,0,1004,1567).data;
   const mctx=motion.clean.getContext('2d',{willReadFrequently:true});
   const unmodified=mctx.getImageData(0,0,1004,1567).data;
   let sourceChanged=0;for(let i=0;i<source.length;i++)if(source[i]!==unmodified[i])sourceChanged++;
   const within=(x,y,b)=>x>=b[0]&&y>=b[1]&&x<b[2]&&y<b[3];
   const pick=[493,907,566,961],fret=[610,831,674,888],face=[504,786,608,858];
   let changedPick=0,changedFret=0,changedFace=0,changedOther=0;
   const frames=[10,10.1,10.2,10.3];
   const containers=[];
   for(let i=0;i<frames.length;i++){
    const cv=document.createElement('canvas');cv.width=1004;cv.height=1567;
    const c=cv.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;
    c.drawImage(motion.clean,0,0);
    drawHands(c,motion,frames[i],true,false);
    const data=c.getImageData(0,0,1004,1567).data;
    for(let y=0;y<1567;y++){
     for(let x=0;x<1004;x++){
      const p=(y*1004+x)*4;
      if(data[p]===source[p]&&data[p+1]===source[p+1]&&data[p+2]===source[p+2]&&data[p+3]===source[p+3])continue;
      if(within(x,y,face))changedFace++;
      if(within(x,y,pick))changedPick++;
      else if(within(x,y,fret))changedFret++;
      else changedOther++;
     }
    }
    // A close-up is saved, not a replacement image of the character.
    const crop=document.createElement('canvas');crop.width=280;crop.height=193;
    const cropCtx=crop.getContext('2d');cropCtx.imageSmoothingEnabled=false;
    cropCtx.drawImage(cv,420,793,280,193,0,0,280,193);
    crop.style.width='560px';crop.style.height='386px';
    crop.style.imageRendering='pixelated';crop.style.background='#272431';
    crop.style.margin='8px';crop.style.border='1px solid #888';
    containers.push(crop);
   }
   const idle=document.createElement('canvas');idle.width=1004;idle.height=1567;
   const idleCtx=idle.getContext('2d',{willReadFrequently:true});idleCtx.drawImage(motion.clean,0,0);
   drawHands(idleCtx,motion,10,false,false);
   const idleCopy=idleCtx.getImageData(0,0,1004,1567).data;
   let idleDiff=0;for(let i=0;i<source.length;i++)if(source[i]!==idleCopy[i])idleDiff++;
   drawHands(idleCtx,motion,10,true,true);
   const reduced=idleCtx.getImageData(0,0,1004,1567).data;
   let reducedDiff=0;for(let i=0;i<source.length;i++)if(source[i]!==reduced[i])reducedDiff++;
   document.body.replaceChildren(...containers);
   document.body.style.cssText='margin:0;background:#15151a;display:flex;flex-wrap:wrap';
   return {sourceChanged,changedPick,changedFret,changedFace,changedOther,idleDiff,reducedDiff,pose:handPose(10,true,false),digitCount:motion.digits.length};
  });
  await page.screenshot({path:'pixel-hands-qa/'+name+'-playing-hands.png',fullPage:true});
  console.log(name,JSON.stringify(metrics));
  assert.equal(metrics.sourceChanged,0,'approved original sprite must remain byte-identical');
  assert.equal(metrics.changedFace,0,'the original face must never change while playing');
  assert.equal(metrics.changedOther,0,'no hand pixels may escape approved regions');
  assert.ok(metrics.changedPick>15,'right plucking hand and strings should move');
  assert.ok(metrics.changedFret>15,'left fretting fingertips should move');
  assert.equal(metrics.idleDiff,0,'idle hands must not animate');
  assert.equal(metrics.reducedDiff,0,'prefers-reduced-motion should retain still actor');
  assert.equal(metrics.pose.lean,0,'whole actor must not translate while playing');
  assert.equal(metrics.digitCount,5);
  assert.deepEqual(errors,[],name+' JavaScript errors');
  await page.close();
 }finally{await browser.close();}
}
await server.close();
console.log('PASS original face, fingertips, strings, motion, pause and reduced-motion across Chromium/WebKit');
