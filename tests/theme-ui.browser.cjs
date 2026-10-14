'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{chromium}=require('playwright');
const root=process.cwd(),themes=['minecraft','inventory','inventory-dark','inventory-amoled','terraria','stardew','ais','hoi4'];
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':body)})});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;fs.mkdirSync('theme-ui-proof',{recursive:true});
 const browser=await chromium.launch({headless:true});let checks=0;
 try{
  for(const viewport of [{width:1440,height:1000},{width:375,height:900}]){
   const mobile=viewport.width<900,context=await browser.newContext({viewport,hasTouch:mobile,serviceWorkers:'block'});
   await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
   const page=await context.newPage();await page.goto(origin+'/#calisma',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.FocusSettings);
   await page.evaluate(async()=>{await document.fonts.ready;const probe=document.createElement('div');probe.id='cursorProbes';probe.style='position:fixed;left:-10000px;top:0';probe.innerHTML='<button id="probeButton"><span id="probeButtonSpan">Action</span><svg id="probeButtonSvg"></svg></button><button id="probeDisabled" disabled><span id="probeDisabledSpan">Disabled</span></button><input type="email" id="probeEmail"><div role="button" id="probeRole"><span id="probeRoleSpan">Role</span></div><div contenteditable="true" id="probeEdit"><b id="probeEditChild">Text</b></div>';document.body.append(probe)});
   for(const theme of themes){
    await page.evaluate(theme=>{window.FocusSettings.applyTheme(theme);location.hash='#calisma'},theme);await page.waitForTimeout(80);
    await page.evaluate(()=>document.fonts.ready);
    const skin=await page.evaluate(()=>({theme:window.FocusSettings.theme,font:getComputedStyle(document.querySelector('.logo')).fontFamily,panel:getComputedStyle(document.querySelector('.card.timer')).backgroundColor}));
    assert.equal(skin.theme,theme);if(!['ais','hoi4'].includes(theme))assert.match(skin.font,/FocusPixel/);
    if(theme==='inventory-amoled')assert.equal(skin.panel,'rgb(0, 0, 0)');
    if(!mobile&&theme!=='ais'){
     const cursors=await page.evaluate(()=>Object.fromEntries(['body','#probeButton','#probeButtonSpan','#probeButtonSvg','#probeDisabled','#probeDisabledSpan','#probeEmail','#probeRole','#probeRoleSpan','#probeEdit','#probeEditChild'].map(sel=>[sel,getComputedStyle(document.querySelector(sel)).cursor])));
     assert.match(cursors.body,/data:image\/png;base64/);assert.match(cursors['#probeButton'],/pointer$/);
     assert.notEqual(cursors.body,cursors['#probeButton'],'clickable cursor must be a different bitmap from arrow');
     assert.equal(cursors['#probeButton'],cursors['#probeButtonSpan']);assert.equal(cursors['#probeButton'],cursors['#probeButtonSvg']);
     assert.match(cursors['#probeEmail'],/text$/);assert.notEqual(cursors['#probeEmail'],cursors.body);
     assert.match(cursors['#probeDisabled'],/not-allowed$/);assert.equal(cursors['#probeDisabled'],cursors['#probeDisabledSpan']);
     assert.equal(cursors['#probeRole'],cursors['#probeRoleSpan']);assert.equal(cursors['#probeEdit'],cursors['#probeEditChild']);
     await page.evaluate(()=>window.FocusSettings.applyCursor(false,false));
     assert.doesNotMatch(await page.locator('#probeButton').evaluate(e=>getComputedStyle(e).cursor),/data:image/);
     await page.evaluate(()=>window.FocusSettings.applyCursor(true,false));checks+=11;
    }
    for(const route of ['calisma','lobi','ilerleme','ayarlar']){
     await page.evaluate(route=>location.hash='#'+route,route);await page.waitForTimeout(60);
     const overflow=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
     assert.ok(overflow.scroll<=overflow.width+1,theme+' '+route+' overflows at '+viewport.width+': '+JSON.stringify(overflow));checks++;
    }
    await page.evaluate(()=>location.hash='#calisma');await page.waitForTimeout(80);
    await page.screenshot({path:'theme-ui-proof/'+theme+'-'+viewport.width+'.png'});
   }
   await page.evaluate(()=>{window.FocusSettings.applyTheme('inventory');location.hash='#ayarlar'});await page.waitForTimeout(80);
   await page.screenshot({path:'theme-ui-proof/gallery-'+viewport.width+'.png',fullPage:true});
   if(!mobile){
    await page.locator('#themeTerrariaBtn .sample-dial').hover();const real=await page.locator('#themeTerrariaBtn .sample-dial').evaluate(e=>getComputedStyle(e).cursor);assert.match(real,/pointer$/);
    const button=await page.locator('#themeTerrariaBtn').evaluate(e=>getComputedStyle(e).cursor);assert.equal(real,button);checks+=2;
   }
   await context.close();
  }
  console.log('Browser theme verification passed: '+checks+' assertions, 18 screenshots.');
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
