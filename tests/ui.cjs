'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {_electron:electron}=require('playwright');

(async()=>{
 let app;
 try{
  const root=path.resolve(__dirname,'..');
  const temp=await fs.mkdtemp(path.join(require('node:os').tmpdir(),'plasmatio-test-'));
  const headless=process.platform==='linux'&&!process.env.DISPLAY;
  app=await electron.launch({executablePath:require('electron'),args:[root,`--user-data-dir=${temp}`,...(headless?['--no-sandbox','--ozone-platform=headless','--disable-gpu']:[])],timeout:20000});
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>window.Plasmatio&&!Plasmatio.transitioning);
  await page.evaluate(()=>{
   window.behaviorEvents=[];
   document.addEventListener('heptagon:behavior',e=>behaviorEvents.push({id:e.target.dataset.element||e.target.getAttribute('aria-label'),state:e.detail.state,sound:e.detail.sound}));
  });
  await page.evaluate(()=>Plasmatio.navigate('forge'));
  await page.mouse.move(750,310);await page.waitForTimeout(80);
  await page.mouse.move(675,320);await page.waitForTimeout(80);
  await page.mouse.click(675,320);await page.waitForTimeout(200);
  await page.mouse.click(260,35);await page.waitForTimeout(200);
  await page.evaluate(()=>Plasmatio.navigate('office'));
  const states=await page.evaluate(()=>[...new Set(behaviorEvents.filter(e=>e.id==='shape-top').map(e=>e.state))]);
  for(const state of ['presence','proximity','hover','click','other-click','page-leave','page-enter'])assert(states.includes(state),`Missing Heptagon state: ${state}`);
  assert(await page.evaluate(()=>behaviorEvents.every(e=>e.state===e.sound)),'Each state must have its sound');
  assert.equal(await page.evaluate(()=>Plasmatio.behavior.audio.state),'running');
  for(const name of ['forge','office','arena','settings']){
   await page.evaluate(name=>Plasmatio.navigate(name),name);
   const nav=page.locator('.page-nav');await nav.locator('button').first().hover();
   await page.waitForTimeout(160);
   assert.equal(await nav.locator('button:visible').count(),4);
   const geometry=await nav.locator('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
   for(let i=1;i<4;i++){assert.equal(geometry[i].x,geometry[0].x);assert.equal(geometry[i].w,geometry[0].w);assert.equal(geometry[i].h,geometry[0].h);assert(geometry[i].y>geometry[i-1].y);}
   assert.equal(await page.locator('.toolbar').evaluate(n=>getComputedStyle(n).translate),'0px 168px');
   const next=name==='forge'?'office':'forge';
   await nav.locator(`[data-destination="${next}"]`).click();
   await page.waitForFunction(next=>Plasmatio.current===next&&!Plasmatio.transitioning,next);
  }
  if(process.env.PLASMATIO_TEST_OUTPUT){
   await fs.mkdir(process.env.PLASMATIO_TEST_OUTPUT,{recursive:true});
   for(const name of ['welcome','home','forge','office','arena','settings']){
    await page.evaluate(name=>Plasmatio.navigate(name),name);await page.mouse.move(1000,700);
    await page.evaluate(()=>document.getAnimations().forEach(a=>a.cancel()));
    await page.screenshot({path:path.join(process.env.PLASMATIO_TEST_OUTPUT,`${name}.png`)});
   }
   await page.evaluate(()=>Plasmatio.navigate('forge'));await page.locator('.page-nav button').first().hover();await page.waitForTimeout(160);
   await page.screenshot({path:path.join(process.env.PLASMATIO_TEST_OUTPUT,'menu.png')});
  }
  await page.getByRole('button',{name:'Minimize window'}).click();
  assert(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized()));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());
  await page.getByRole('button',{name:'Maximize window'}).click();
  assert(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized()));
  // Ozone headless's synthetic display is 1×1; restore via native API there.
  if(headless)await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].unmaximize());
  else await page.getByRole('button',{name:'Restore window'}).click();
  await page.waitForFunction(()=>innerWidth>600);
  assert.equal(errors.length,0,errors.join('\n'));
  const closing=app.waitForEvent('close');await page.getByRole('button',{name:'Close window'}).click();await closing;app=null;
  await fs.rm(temp,{recursive:true,force:true});
  console.log('PASS: all seven Heptagon states and sound bindings, four-page navigation, menu geometry, native minimize/maximize/close, no JS errors.');
 }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
