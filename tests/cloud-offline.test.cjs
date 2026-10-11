const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('blocked local storage cannot interrupt offline study recording or its periodic sync',()=>{
 const intervals=[];
 const context={window:{},localStorage:{getItem(){throw Error('Storage blocked')}},setInterval:fn=>intervals.push(fn),addEventListener(){},URL};
 vm.runInNewContext(fs.readFileSync('cloud-model.js','utf8'),context);
 assert.doesNotThrow(()=>context.window.FocusAccount.record('2026-10-11',1));
 for(const tick of intervals)assert.doesNotThrow(tick);
});
