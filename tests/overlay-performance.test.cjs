const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('nested dialogs pause once and resume only after the last modal closes',()=>{
 let open=0,observe,changes=0;const ctx={document:{readyState:'complete',body:{classList:{toggle(){}}},querySelector:()=>open?{}:null},MutationObserver:class{constructor(f){observe=f}observe(){}},CustomEvent:class{constructor(name,{detail}){this.detail=detail}},dispatchEvent(){changes++}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('overlay-performance.js','utf8'),ctx);
 open=1;observe();assert.equal(ctx.FocusOverlayOpen,true);assert.equal(changes,1);open=2;observe();open=1;observe();assert.equal(changes,1);open=0;observe();assert.equal(ctx.FocusOverlayOpen,false);assert.equal(changes,2);
});

test('desktop friend popover pauses the sky while the mobile popover keeps its existing behaviour',()=>{
 for(const width of [1920,390]){let friendOpen=false,hiddenWatch;const friend={};const ctx={innerWidth:width,document:{readyState:'complete',body:{classList:{toggle(){}}},querySelector:selector=>selector==='.friends-popover'?friend:selector.includes('.friends-popover')&&friendOpen?friend:null},MutationObserver:class{constructor(fn){this.fn=fn}observe(target){if(target===friend)hiddenWatch=this.fn}},CustomEvent:class{constructor(_,options){this.detail=options.detail}},dispatchEvent(){}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('overlay-performance.js','utf8'),ctx);friendOpen=true;hiddenWatch();assert.equal(!!ctx.FocusOverlayOpen,width>=900);friendOpen=false;hiddenWatch();assert.equal(!!ctx.FocusOverlayOpen,false);}
});
