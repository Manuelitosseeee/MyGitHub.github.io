import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5173,strictPort:false}});await server.listen();let browser;
try{
 browser=await chromium.launch({executablePath:process.env.STUDIO_TEST_BROWSER,headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,LD_LIBRARY_PATH:process.env.STUDIO_TEST_LIB}});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(()=>localStorage.setItem('mygithub.welcome-complete','true'));
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
 const nav=page.getByRole('navigation',{name:'Navigazione principale mobile',exact:true});await nav.getByRole('button',{name:'Metronomo',exact:true}).click();
 const pane=page.locator('.pane.metronomo');const sec=pane.getByLabel('Intervallo incremento in secondi');const step=pane.getByLabel('Incremento automatico in BPM');
 for(const value of ['20','2','3600','1']){await sec.fill('');await expect(sec).toHaveValue('');await sec.pressSequentially(value);await expect(sec).toHaveValue(value);await sec.press('Enter');await expect(sec).toHaveValue(value);}
 await step.fill('2');await step.press('Enter');
 expect(await sec.evaluate(e=>e.clientWidth)).toBeGreaterThan(90);
 await pane.getByRole('switch').click();await pane.getByRole('button',{name:'Avvia il metronomo',exact:true}).click();
 await page.evaluate(()=>{window.originalAudio=document.querySelector('audio[data-metronome]');window.originalSrc=window.originalAudio.src;});
 const geometry=async locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect();return{height:r.height,top:r.top}});
 const display=pane.locator('.metro-tempo-display');const initial=await geometry(display);
 for(let i=0;i<16;i++){await page.waitForTimeout(230);const r=await geometry(display);expect(r.height).toBeCloseTo(initial.height,1);expect(r.top).toBeCloseTo(initial.top,1);}
 const current=await page.evaluate(async()=>{const {store}=await import('/src/data/store.ts');const e=document.querySelector('audio[data-metronome]');return{bpm:store.state.settings.metro.bpm,same:e===window.originalAudio,sameSrc:e.src===window.originalSrc,paused:e.paused,rate:e.playbackRate}});
 expect(current.bpm).toBeGreaterThanOrEqual(106);expect(current.bpm).toBeLessThanOrEqual(108);expect(current.same).toBe(true);expect(current.sameSrc).toBe(true);expect(current.paused).toBe(false);expect(current.rate).toBe(1);
 // A long callback delay causes one step, never a catch-up burst.
 await page.evaluate(()=>{const now=performance.now.bind(performance);Object.defineProperty(performance,'now',{value:()=>now()+600000,configurable:true});});await page.waitForTimeout(400);
 const after=await page.evaluate(async()=>(await import('/src/data/store.ts')).store.state.settings.metro.bpm);expect(after-current.bpm).toBeLessThanOrEqual(2);
 await pane.getByRole('button',{name:'Ferma il metronomo',exact:true}).click();await nav.getByRole('button',{name:'Studio',exact:true}).click();await page.getByRole('switch',{name:'Pixel Story in Studio'}).click();await page.getByRole('button',{name:'Entra e inizia a studiare'}).click();await page.locator('.px-stage').getByRole('button',{name:/metronomo/i}).click();
 const popup=page.getByRole('dialog',{name:'Metronomo originale'});await popup.getByRole('button',{name:'Avvia il metronomo',exact:true}).click();const box=await geometry(popup);
 for(let i=0;i<12;i++){await page.waitForTimeout(170);const r=await geometry(popup);expect(r.height).toBeCloseTo(box.height,1);expect(r.top).toBeCloseTo(box.top,1);}
 await expect(popup.getByRole('button',{name:'Ferma il metronomo',exact:true})).toBeVisible();
 expect(errors).toEqual([]);console.log(JSON.stringify({success:true,current,checks:['editable 20/2/3600/1 fields','wide input','16 beat layout samples stable','automatic steps retain audio element AND source','no catch-up burst','Pixel dialog stable during beats and acceleration'],errors}));
}finally{await browser?.close();await server.close();}
