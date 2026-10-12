const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),model=require('../social-model.js');
test('public names combine owned font with existing color and remove the prior font on changes',()=>{
 const classes=new Set(),node={classList:{add:v=>classes.add(v),toggle:(v,on)=>on?classes.add(v):classes.delete(v)}};
 model.decorate(node,{cosmetics:{font:'fredoka',nameStyle:'gold',plate:'ruby'}});assert(classes.has('font-fredoka'));assert(classes.has('name-gold'));assert(classes.has('plate-ruby'));
 model.decorate(node,{cosmetics:{font:'space-mono',nameStyle:'ice'}});assert(!classes.has('font-fredoka'));assert(classes.has('font-space-mono'));assert(!classes.has('name-gold'));assert(classes.has('name-ice'));
 model.decorate(node,{cosmetics:{font:'malicious'}});assert(!classes.has('font-space-mono'));assert.equal(model.cosmetics({}).font,'default');
});
test('font assets are bundled with licenses and offline cache coverage',()=>{
 const shell=fs.readFileSync('sw.js','utf8'),css=fs.readFileSync('name-fonts.css','utf8');for(const name of ['fredoka','cinzel','space-mono','bungee','pacifico','chelaone']){const b=fs.readFileSync('fonts/'+name+'.ttf');assert(b.length>1000);assert.equal(b.readUInt32BE(0),0x10000);assert(fs.readFileSync('fonts/'+name+'-OFL.txt','utf8').includes('SIL OPEN FONT LICENSE'));assert(shell.includes('/fonts/'+name+'.ttf'));assert(css.includes('fonts/'+name+'.ttf'))}
});

test('playful fonts are accepted and unknown fonts are rejected',()=>{for(const font of ['bungee','pacifico','chelaone'])assert.equal(model.cosmetics({font}).font,font);assert.equal(model.cosmetics({font:'unknown'}).font,'default')});
