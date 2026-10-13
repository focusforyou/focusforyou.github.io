const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app(){const workers=[];class Worker{constructor(url){this.url=url;workers.push(this)}postMessage(data){this.data=data}terminate(){this.stopped=true}}
 const timers=[];const root={Worker,location:{href:'https://focusforyou.github.io/'},URL,Uint8Array,Map,Buffer,atob,btoa,AbortController,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{}};
 vm.createContext(root);vm.runInContext(fs.readFileSync('gif-media.js','utf8'),root);return {api:root.FocusGifMedia,workers,timers};
}
const file={size:1,arrayBuffer:async()=>new ArrayBuffer(1)};
test('cancelling GIF conversion terminates the worker and ignores late output',async()=>{
 const a=app(),controller=new AbortController(),pending=a.api.crop(file,{x:0,y:0,size:1},'avatar',controller.signal);await new Promise(resolve=>setImmediate(resolve));controller.abort();assert.equal(await pending,null);assert.equal(a.workers[0].stopped,true);a.workers[0].onmessage({data:{error:'gif-invalid'}});
});
test('timeout and worker failures terminate conversion with actionable errors',async()=>{
 const a=app(),pending=a.api.crop(file,{x:0,y:0,size:1});await new Promise(resolve=>setImmediate(resolve));a.timers[0]();await assert.rejects(pending,/gif-timeout/);assert.equal(a.workers[0].stopped,true);
 const b=app(),failed=b.api.crop(file,{x:0,y:0,size:1});await new Promise(resolve=>setImmediate(resolve));b.workers[0].onerror();await assert.rejects(failed,/gif-worker/);assert.equal(b.workers[0].stopped,true);
});
test('already cancelled requests do not read files or create workers',async()=>{const a=app(),c=new AbortController();c.abort();assert.equal(await a.api.crop({size:1,arrayBuffer:()=>{throw Error('read')}},{},'avatar',c.signal),null);assert.equal(a.workers.length,0)});
