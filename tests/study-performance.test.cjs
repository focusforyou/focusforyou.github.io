const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Study history redraws only when a visible minute or goal changes, while exact seconds remain recorded',()=>{
 let rebuilds=0;const elements={};const node=()=>({append(){},style:{},replaceChildren(){rebuilds++}});
 const context={document:{getElementById:id=>elements[id]??=node(),createElement:node,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},setInterval(){},Date};context.window=context;
 vm.runInNewContext(fs.readFileSync('study.js','utf8')+';window.api=Study;',context);
 const study=context.api;study.render();assert.equal(rebuilds,1);
 for(let i=0;i<20;i++){study.record(1,Date.now());study.render()}
 assert.equal(rebuilds,1);assert.equal(study.totalSeconds(),20);
 study.record(40,Date.now());study.render();assert.equal(rebuilds,2);
 study.applyPreferences({focus:25,break:5,goal:180});assert.equal(rebuilds,3);
});
