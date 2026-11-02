import assert from 'node:assert/strict';
import {chromium,webkit} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const site='https://myguitarhub-amici-preview.manuelitosmurf.workers.dev';
await mkdir('screenshots',{recursive:true});
const browserSet=[['chromium',chromium],['webkit',webkit]];
const presets=[['iphone',390,844],['android',360,800],['tablet',768,1024],['desktop',1280,820]];
const unique=(prefix)=>prefix+Date.now().toString(36).slice(-8);

for(const [engineName,engine] of browserSet){
 const browser=await engine.launch({headless:true});
 for(const [device,w,h] of presets){
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,isMobile:w<800,hasTouch:w<800});
  await context.addInitScript(()=>localStorage.setItem('mygithub.welcome-complete','true'));
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForSelector(w<=700?'.mobile-nav-pill':'.desktop-tabbar',{state:'visible',timeout:15000});
  if(w<=700){await page.getByRole('button',{name:'Altro'}).click();await page.getByRole('menuitem',{name:'Amici'}).click();}
  else await page.locator('.desktop-tabbar button').filter({hasText:'Amici'}).click();
  await page.getByText('Crea il tuo nickname').waitFor({timeout:20000});
  await page.screenshot({path:`screenshots/${engineName}-${device}.png`,fullPage:true});
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
  console.log(engineName,device,'width',width);
  assert.ok(width.scroll<=width.inner+4,`${engineName} ${device} overflow ${JSON.stringify(width)}`);
  assert.deepEqual(errors,[],`${engineName} ${device} JS console errors`);
  if(engineName==='chromium'&&device==='iphone'){
   const nick=unique('ct');
   await page.getByRole('textbox',{name:'Il tuo nickname'}).fill(nick);
   await page.getByRole('button',{name:'Crea nickname'}).click();
   await page.getByRole('button',{name:/Aggiungi amico/}).waitFor({timeout:20000});
   await page.getByRole('button',{name:/Aggiungi amico/}).click();
   await page.getByRole('button',{name:/Tramite nickname/}).click();
   const friendInput=page.getByLabel("Nickname dell'amico");
   await friendInput.focus();
   for(const letter of 'sample_account_01'){
    if(letter==='_') await page.keyboard.insertText('_');
    else await friendInput.press(letter);
    assert.equal(await friendInput.evaluate(el=>document.activeElement===el),true,'Nickname input lost focus while typing');
   }
   assert.equal(await friendInput.inputValue(),'sample_account_01');
   await page.screenshot({path:'screenshots/chromium-invite-modal.png',fullPage:true});
   const modal=await page.locator('[role="dialog"]').count();
   assert.equal(modal,1);
  }
  await context.close();
 }
 await browser.close();
}
console.log('PASS: iPhone/Android/tablet/desktop at Chromium and WebKit, friends UI and popup.');
