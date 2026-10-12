const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('nested dialogs pause once and resume only after the last modal closes',()=>{
 let open=0,observe,changes=0;const ctx={document:{readyState:'complete',body:{classList:{toggle(){}}},querySelector:()=>open?{}:null},MutationObserver:class{constructor(f){observe=f}observe(){}},CustomEvent:class{constructor(name,{detail}){this.detail=detail}},dispatchEvent(){changes++}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('overlay-performance.js','utf8'),ctx);
 open=1;observe();assert.equal(ctx.FocusOverlayOpen,true);assert.equal(changes,1);open=2;observe();open=1;observe();assert.equal(changes,1);open=0;observe();assert.equal(ctx.FocusOverlayOpen,false);assert.equal(changes,2);
});
