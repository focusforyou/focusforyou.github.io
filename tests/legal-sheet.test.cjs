const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('legal links open inside the page without navigating away from a joined room',()=>{
 const events={},sheet={opened:false,showModal(){this.opened=true},addEventListener:(key,fn)=>events[key]=fn},frame={src:'',removeAttribute(){this.src=''}};
 const handlers=[],links=['/privacy.html','/terms.html','/delete-account.html'].map(href=>({getAttribute:()=>href,addEventListener:(_,fn)=>handlers.push(fn)}));
 vm.runInNewContext(fs.readFileSync('legal-sheet.js','utf8'),{document:{getElementById:id=>id==='legalSheet'?sheet:frame,querySelectorAll:()=>links}});
 for(let i=0;i<links.length;i++){let prevented=false;handlers[i]({preventDefault(){prevented=true}});assert(prevented);assert(sheet.opened);assert.equal(frame.src,links[i].getAttribute());events.close();assert.equal(frame.src,'')}
 let prevented=false;handlers[0]({ctrlKey:true,preventDefault(){prevented=true}});assert.equal(prevented,false);
});

