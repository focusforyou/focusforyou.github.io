const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=name=>fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8');
test('Cosmetic GIF styles never switch to PNG when Windows animation effects are off',()=>{
 for(const name of ['cosmetics.css','robot-leds.css','robot-plates.css']){
  assert.doesNotMatch(read(name),/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i,name+' should not disable cosmetic GIFs');
 }
 const css=read('cosmetics.css'),led=read('robot-leds.css'),plates=read('robot-plates.css');
 assert.match(css,/\.frame-pulse\{--frame-art:url\('assets\/cosmetics\/pulse-frame\.gif'\)/);
 assert.match(led,/robot-duo-leds-v2\.gif/);
 for(const id of ['gold','silver','duo'])assert.match(plates,new RegExp('robot-'+id+'-plate-animated\\.gif'));
});
test('HTML requests updated GIF CSS and the new PWA cache serves robot LED styles offline',()=>{
 const html=read('index.html'),sw=read('sw.js');
 for(const name of ['cosmetics','robot-leds','robot-plates'])assert.match(html,new RegExp(name+'\\.css\\?v=cosmetic-gif-fix1'));
 const version=Number(sw.match(/const CACHE='focus-v(\d+)'/)?.[1]);assert.ok(version>=80,'GIF crop release needs a fresh cache');
 for(const asset of ['gif-crop-worker.js','vendor/gif-codec.js','color-themes.css'])assert.ok(sw.includes("'/"+asset+"'"),asset+' must be available offline');
 assert.match(sw,/'\/robot-leds\.css'/);
});
