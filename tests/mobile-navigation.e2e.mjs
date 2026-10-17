import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: false } });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const customBrowser = process.env.RECORDINGS_TEST_BROWSER;
const options = { headless: true };
if (customBrowser) { options.executablePath = customBrowser; options.args = (await import('@sparticuz/chromium')).default.args; options.env = { ...process.env, LD_LIBRARY_PATH: path.dirname(customBrowser) }; }
let browser;
try {
  browser = await chromium.launch(options);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem('mygithub.welcome-complete', 'true'));
  const page = await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const nav=page.getByRole('navigation',{name:'Navigazione principale mobile',exact:true});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button')).toHaveCount(5);
  expect(await nav.getByRole('button').evaluateAll(items=>items.map(i=>i.getAttribute('aria-label')))).toEqual(['Diario','Studio','Metronomo','Registrazioni','Altro']);
  await expect(page.locator('.desktop-tabbar')).toBeHidden();
  await nav.getByRole('button',{name:'Metronomo',exact:true}).click();
  await expect(page.locator('.pane.metronomo')).toHaveClass(/active/);
  await expect(nav.getByRole('button',{name:'Metronomo',exact:true})).toHaveAttribute('aria-current','page');
  for(const label of ['Allenamento','Accordatore','Corde','Impostazioni']){
    await nav.getByRole('button',{name:'Altro',exact:true}).click();
    await expect(page.getByRole('menu',{name:'Altre funzioni'})).toBeVisible();
    await page.getByRole('menuitem',{name:label,exact:true}).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    const id={Allenamento:'allenamento',Accordatore:'accordatore',Corde:'corde',Impostazioni:'impostazioni'}[label];
    await expect(page.locator('.pane.'+id)).toHaveClass(/active/);
  }
  await nav.getByRole('button',{name:'Diario',exact:true}).click();
  await fs.mkdir('../navigation-qa',{recursive:true});
  await page.waitForTimeout(300);
  await page.screenshot({path:'../navigation-qa/mobile-main.png'});
  await nav.getByRole('button',{name:'Altro',exact:true}).click();
  await page.waitForTimeout(300);
  await page.screenshot({path:'../navigation-qa/mobile-more.png'});
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem',{name:'Accordatore',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('button',{name:'Altro',exact:true})).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await nav.getByRole('button',{name:'Altro',exact:true}).click();
  await page.getByRole('button',{name:'Chiudi menu Altro',exact:true}).click({position:{x:15,y:150}});
  await expect(page.getByRole('menu')).toHaveCount(0);
  const layouts=[];
  for(const width of [320,375,390,430,700]){
    await page.setViewportSize({width,height:844});
    const result=await nav.evaluate(el=>{const b=el.getBoundingClientRect();return {height:b.height,bottomGap:innerHeight-b.bottom,centers:Array.from(el.querySelectorAll('.mobile-nav-button svg')).map(i=>{const r=i.getBoundingClientRect();return r.y+r.height/2}),overflow:document.documentElement.scrollWidth>innerWidth};});
    expect(result.height).toBe(64);expect(result.bottomGap).toBe(6);expect(result.overflow).toBe(false);
    expect(Math.max(...result.centers)-Math.min(...result.centers)).toBeLessThan(.1);
    layouts.push({width,...result});
  }
  // Simulate a 34px device safe area: it is added exactly once, outside the pill.
  await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:'.mobile-navigation { bottom: calc(34px + 6px) !important; }'});
  const safeGap=await nav.evaluate(el=>innerHeight-el.getBoundingClientRect().bottom);
  expect(safeGap).toBe(40);
  // Floating navigation must stay absent during full-screen Pixel Story.
  await page.evaluate(()=>document.body.classList.add('pixel-session'));
  await expect(nav).toBeHidden();
  await page.evaluate(()=>document.body.classList.remove('pixel-session'));
  await expect(nav).toBeVisible();
  await page.setViewportSize({width:1440,height:1000});
  await expect(nav).toBeHidden();
  await expect(page.locator('.desktop-tabbar')).toBeVisible();
  await expect(page.locator('.desktop-tabbar').getByRole('button')).toHaveCount(8);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({success:true,checks:['five icon-only destinations with metronome in center','all secondary destinations reachable','outside click and Escape close the menu','keyboard navigation and focus restoration','mobile alignment and compact bottom spacing','safe area counted once','Pixel Story full screen unaffected','desktop navigation retained'],layouts,browserErrors:errors},null,2));
}finally{await browser?.close();await server.close();}
