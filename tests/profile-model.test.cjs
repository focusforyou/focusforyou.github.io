const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../profile-model.js');
const jpg='data:image/jpeg;base64,YWJjZA==';
test('banner accepts bounded JPEG only; executable, remote and oversized images are rejected',()=>{
 assert.equal(M.banner(jpg),jpg);
 for(const x of ['https://example.com/a.jpg','data:image/svg+xml;base64,YWJjZA==','data:image/jpeg;base64,<>',null,{},'data:image/jpeg;base64,'+'a'.repeat(40000)])assert.equal(M.banner(x),'');
});
test('dirty banner survives cloud hydration; removal invalidates a pending image decode',()=>{
 const d=M.draft();d.load({uid:'a'});assert.equal(d.set(jpg,d.ticket()),true);d.load({uid:'a',banner:''});assert.equal(d.value(),jpg);
 const pending=d.ticket();assert.equal(d.set('',d.ticket()),true);assert.equal(d.set(jpg,pending),false);assert.equal(d.value(jpg),'');
});
test('account switch discards draft and rejects earlier asynchronous uploads',()=>{
 const d=M.draft();d.load({uid:'a',banner:jpg});const pending=d.ticket();d.load({uid:'b'});assert.equal(d.value(),'');assert.equal(d.set(jpg,pending),false);d.load({uid:''});assert.equal(d.set(jpg,d.ticket()),false);
});
