const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const LobbyModel=require('../lobby-model.js'),ExtrasModel=require('../extras-model.js');
function fixture(){
 const nodes=new Map(),ticks=[];let timer={phase:'focus',running:true,worked:3600},roomTimer;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,open:false,textContent:'',classList:{toggle(){}},contains(){return false},addEventListener(){},setAttribute(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(id)};
 const ctx={console,LobbyModel,ExtrasModel,navigator:{onLine:true},document:{hidden:false,getElementById:node,addEventListener(){}},setInterval:f=>ticks.push(f),addEventListener(){},Study:{liveSession:()=>timer},FocusSocial:{uid:()=> 'alice',getProfile:()=>({name:'Alice',username:'alice'}),getMemberTimer:()=>roomTimer,memberState:()=> 'Çevrimdışı'}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('community-ui.js','utf8'),ctx);
 return {ctx,node,tick:()=>ticks.forEach(f=>f()),timer:v=>timer=v,room:v=>roomTimer=v};
}
test('own profile is online without an active room and follows the local timer while open',()=>{
 const f=fixture();f.ctx.openMemberProfile('alice');assert.equal(f.node('memberProfileStatusText').textContent,'Odaklanıyor');assert.notEqual(f.node('memberProfileTotalHours').textContent,'—');assert.equal(f.node('memberProfileRoomHours').textContent,'—');
 f.timer({phase:'focus',running:false,worked:3600});f.tick();assert.equal(f.node('memberProfileStatusText').textContent,'Molada');
 f.ctx.navigator.onLine=false;f.tick();assert.equal(f.node('memberProfileStatusText').textContent,'Çevrimdışı');
});
test('own local session wins over stale explicit room data, strangers do not inherit it',()=>{
 const f=fixture();f.ctx.openMemberProfile('alice','Alice',{phase:'focus',running:false,worked:0});assert.equal(f.node('memberProfileStatusText').textContent,'Odaklanıyor');
 f.ctx.openMemberProfile('bob','Bob');assert.equal(f.node('memberProfileStatusText').textContent,'Çevrimdışı');assert.equal(f.node('memberProfileTotalHours').textContent,'—');
 f.node('memberProfileModal').close();f.node('memberProfileStatusText').textContent='closed';f.tick();assert.equal(f.node('memberProfileStatusText').textContent,'closed');
});
