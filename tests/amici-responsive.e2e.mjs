import assert from 'node:assert/strict';
import { chromium, webkit } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';

const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const origin='http://127.0.0.1:'+server.httpServer.address().port;
const pictures='amici-layout-screenshots';
await fs.mkdir(pictures,{recursive:true});
const friendData={
  friends:[{id:'friend-01',linkId:'link-01',nickname:'chitarrista1234567',presence:null,seenAt:0,fresh:false}],
  requests:[]
};
const profiles={id:'tester',nickname:'Manuelitosse'};
const widths=[320,360,375,390,414,430,768,1280];
const failures=[];
const overlaps=(left,right)=>Math.min(left.right,right.right)-Math.max(left.left,right.left)>1
&&Math.min(left.bottom,right.bottom)-Math.max(left.top,right.top)>1;

for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true});
 try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
   const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
   await page.addInitScript(()=>{
    localStorage.setItem('mygithub.welcome-complete','true');
    localStorage.setItem('mygithub.social-credential.v1','1'.repeat(64));
   });
   await page.route('**/myguitarhub-social-v1.manuelitosmurf.workers.dev/**',route=>{
    const pathname=new URL(route.request().url()).pathname;
    const body=pathname.endsWith('/me')?profiles:
               pathname.endsWith('/friends')?friendData:
               {ok:true};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
   });
   await page.goto(origin+'/?tab=amici',{waitUntil:'domcontentloaded'});
   await page.locator('.pane.amici.active .friends-screen .friend-row').waitFor({timeout:20000});
   for(const textSize of ['m','xl']){
    await page.evaluate(size=>document.documentElement.dataset.fs=size,textSize);
    await page.waitForTimeout(80);
    const layout=await page.evaluate(()=>{
     const $=s=>document.querySelector('.pane.amici.active '+s);
     const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
     const pane=$('.friends-screen').closest('.pane');
     const els={
      heading:$('.friends-screen > .friends-header'),
      subtitle:$('.friends-screen > .friends-header .screen-sub'),
      mail:$('.friends-screen > .friends-header > .btn'),
      card:$('.friends-screen .friend-profile'),
      name:$('.friends-screen .friend-profile .friends-header h2'),
      edit:$('.friends-screen .friend-profile .friends-header > .btn'),
      add:$('.friends-screen .friend-profile > .btn-primary'),
      row:$('.friends-screen .friend-row'),
      avatar:$('.friends-screen .friend-avatar'),
      friend:$('.friends-screen .friend-open'),
      remove:$('.friends-screen .friend-row > .btn'),
      note:$('.friends-screen .friend-footnote'),
     };
     return {viewport:innerWidth,paneWidth:pane.clientWidth,paneScroll:pane.scrollWidth,
       docScroll:document.documentElement.scrollWidth,rectangles:Object.fromEntries(Object.entries(els).map(([k,v])=>[k,rect(v)])),
       text:{subtitle:els.subtitle.innerText,name:els.name.innerText}};
    });
    const {rectangles:r}=layout;const prefix=engine+' '+width+'px '+textSize;
    const bad=(c,msg)=>{if(c)failures.push(prefix+': '+msg);};
    bad(layout.paneScroll>layout.paneWidth+2,'horizontal scroll '+JSON.stringify({scroll:layout.paneScroll,client:layout.paneWidth}));
    bad(layout.docScroll>layout.viewport+2,'document horizontal scroll');
    for(const [name,b] of Object.entries(r)){
      bad(b.left < -2||b.right > width+2||b.width<0,name+' outside viewport '+JSON.stringify(b));
    }
    bad(overlaps(r.name,r.edit),'nickname overlaps edit button');
    bad(overlaps(r.friend,r.remove),'friend overlaps Remove button');
    bad(overlaps(r.subtitle,r.mail),'subtitle overlaps mailbox');
    bad(r.subtitle.width<Math.min(155,width*.5),'subtitle is too narrow');
    bad(jsErrors.length>0,'javascript errors '+jsErrors.join(', '));
    if(textSize==='m'){
      await page.screenshot({path:pictures+'/'+engine+'-'+width+'.png'});
    }
    console.log(prefix,JSON.stringify({scroll:layout.paneScroll,client:layout.paneWidth,nickname:r.name.width,subtitle:r.subtitle.width,removeLeft:r.remove.left,friendRight:r.friend.right}));
   }
   if(engine==='chromium'&&width===390){
      await page.evaluate(()=>document.documentElement.dataset.fs='m');
      await page.locator('.friends-screen .friend-profile > .btn-primary').click();
      const input=page.getByPlaceholder('Nickname dell’amico');
      await input.fill('chitarrista01');
      assert.equal(await input.inputValue(),'chitarrista01');
      assert.equal(await input.evaluate(el=>document.activeElement===el),true,'nickname typing loses focus');
   }
   await page.close();
  }
 }finally{await browser.close();}
}
await server.close();
if(failures.length)throw new Error('Friends responsive QA failed:\n'+failures.join('\n'));
console.log('PASS: all widths, light/dark-agnostic styles, XL type, no overlapping and no sideways scrolling');
