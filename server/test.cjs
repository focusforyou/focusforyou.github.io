const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLobbyServer}=require('./server.cjs');
test('room creation, participant auth, shared timer, reset and host departure',async t=>{
let now=1000000;
const server=createLobbyServer({clock:()=>now});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
const base='http://127.0.0.1:'+server.address().port;
async function request(path,body,token,origin){
const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();return {status:r.status,data:text?JSON.parse(text):{}};
}
const host=await request('/rooms',{name:'Host',focus:1,break:1});assert.equal(host.status,201);assert.equal(host.data.host,true);
const code=host.data.code,guest=await request('/rooms/'+code+'/join',{name:'Guest'});
assert.equal(guest.data.members.length,2);
assert.equal((await request('/rooms/'+code)).status,401);
assert.equal((await request('/rooms/'+code,undefined,host.data.token,'https://evil.example')).status,403);
assert.equal((await request('/rooms/'+code+'/action',{action:'toggle'},guest.data.token)).status,403);
let state=await request('/rooms/'+code+'/action',{action:'toggle'},host.data.token);assert.equal(state.data.timer.running,true);
now+=30000;state=await request('/rooms/'+code,undefined,guest.data.token);assert.equal(state.data.timer.remaining,30);
now+=30000;state=await request('/rooms/'+code,undefined,host.data.token);assert.equal(state.data.timer.phase,'break');assert.equal(state.data.timer.rounds,1);
await request('/rooms/'+code+'/action',{action:'toggle'},host.data.token);
now+=10000;state=await request('/rooms/'+code,undefined,host.data.token);assert.equal(state.data.timer.remaining,60);
await request('/rooms/'+code+'/leave',{},guest.data.token);assert.equal((await request('/rooms/'+code,undefined,host.data.token)).data.members.length,1);
await request('/rooms/'+code+'/leave',{},host.data.token);assert.equal((await request('/rooms/'+code,undefined,host.data.token)).status,404);
});
test('input validation and expiry',async t=>{
let now=1000000;const server=createLobbyServer({clock:()=>now});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
let r=await fetch(base+'/rooms',{method:'POST',body:JSON.stringify({name:''})});assert.equal(r.status,400);
r=await fetch(base+'/rooms',{method:'POST',body:JSON.stringify({name:'A'})});const room=await r.json();
now+=300001;r=await fetch(base+'/rooms/'+room.code,{headers:{Authorization:'Bearer '+room.token}});assert.equal(r.status,404);
});

