const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),model=require('../lobby-model.js');
test('Untrusted participant data is bounded and roster identity is validated',()=>{
assert.equal(model.cleanName('   '),null);assert.equal(model.cleanName('x'.repeat(31)),null);
assert.equal(model.cleanName(' Efe '),'Efe');
assert.deepEqual(model.cleanTimer({left:Infinity,total:-1,rounds:-1,running:'true'}),{phase:'focus',left:1500,total:1500,rounds:0,running:false,worked:0,roomWorked:0,focus:1500,rest:300});
const p={type:'roster',version:1,code:'ABC',members:[{id:'host',name:'A'},{id:'guest',name:'B',host:true}]};
assert.equal(model.cleanRoster(p,'ABC','host','guest')[1].host,false);
assert.equal(model.cleanRoster(p,'BAD','host','guest'),null);
assert.equal(model.cleanRoster(p,'ABC','host','intruder'),null);
p.members[1].id='host';assert.equal(model.cleanRoster(p,'ABC','host','guest'),null);
});
test('Independent live timers, room totals, authenticated chat, photo delivery and departure',async()=>{
const peers=new Map();let serial=0;
class Conn extends EventEmitter{
constructor(owner,other){super();this.peer=other;this.owner=owner;this.open=false}
send(data){const target=this.pair;queueMicrotask(()=>{if(target.open)target.emit('data',structuredClone(data))})}
close(){if(!this.open)return;this.open=false;this.emit('close');if(this.pair.open){this.pair.open=false;this.pair.emit('close')}}
}
class Peer extends EventEmitter{
constructor(id){super();this.id=id||'guest-'+ ++serial;this.links=[];this.destroyed=false;if(peers.has(this.id)){queueMicrotask(()=>this.emit('error',{type:'unavailable-id'}));return}peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id))}
connect(id){const c=new Conn(this.id,id),target=peers.get(id);if(!target){queueMicrotask(()=>this.emit('error',{type:'peer-unavailable'}));return c}
const d=new Conn(id,this.id);c.pair=d;d.pair=c;this.links.push(c);target.links.push(d);queueMicrotask(()=>{target.emit('connection',d);c.open=d.open=true;d.emit('open');c.emit('open')});return c}
destroy(){this.destroyed=true;if(peers.get(this.id)===this)peers.delete(this.id);this.links.forEach(c=>c.close());this.emit('close')}
}
function setup(name,timer,firstCode){
const elements=new Map(),intervals=[];
const element=()=>({value:'',textContent:'',hidden:false,disabled:false,children:[],append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items}});
const doc={querySelector:()=>element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,addEventListener(){}};
const win={addEventListener(){}};
const chat={messages:[],configure(fn){this.send=fn},receive(m){this.messages.push(m)},reset(){this.messages=[]},state(){}};
const random={getRandomValues(array){if(firstCode){array[0]=Number(firstCode)-10000;firstCode=null;return array}return require('node:crypto').webcrypto.getRandomValues(array)}};
const context=vm.createContext({document:doc,window:win,Study:{liveSession:()=>timer},RoomChat:chat,LobbyModel:model,Peer,crypto:random,sessionStorage:{removeItem(){}},setInterval(fn,ms){intervals.push({fn,ms})},setTimeout,clearTimeout,URL,URLSearchParams,location:{origin:'https://focusforyou.github.io',pathname:'/',search:''},navigator:{}});
vm.runInContext(fs.readFileSync('lobby-peer.js','utf8'),context);doc.getElementById('lobbyName').value=name;
return {get:doc.getElementById.bind(doc),chat,tick:()=>intervals.filter(x=>x.ms===1000).forEach(x=>x.fn()),timer};
}
const turn=()=>new Promise(resolve=>setTimeout(resolve,10));
const a=setup('A',{phase:'focus',left:600,total:600,running:false,rounds:0});a.get('createRoom').onclick();await turn();
const code=a.get('roomCode').textContent.slice(4);assert.match(code,/^[1-9][0-9]{4}$/);
const invalid=setup('Invalid',{});invalid.get('roomCodeInput').value='ABCDE';invalid.get('joinRoom').onclick();assert.match(invalid.get('lobbyStatus').textContent,/5 haneli/);
const collision=setup('Collision',{},code);collision.get('createRoom').onclick();await turn();assert.match(collision.get('roomCode').textContent,/Oda [1-9][0-9]{4}/);assert.notEqual(collision.get('roomCode').textContent.slice(4),code);collision.get('leaveRoom').onclick();await new Promise(r=>setTimeout(r,130));assert.equal(peers.size,1);
const b=setup('B',{phase:'break',left:180,total:300,running:false,rounds:2});b.get('roomCodeInput').value=code;b.get('joinRoom').onclick();await turn();
assert.match(a.get('roomInfo').textContent,/2\/8/);assert.match(b.get('roomInfo').textContent,/2\/8/);
for(const duplicateName of [' a ',' b ']){const duplicate=setup(duplicateName,{});duplicate.get('roomCodeInput').value=code;duplicate.get('joinRoom').onclick();await turn();assert.match(duplicate.get('lobbyStatus').textContent,/takma ad odada kullanılıyor/);assert.equal(duplicate.get('joinRoom').disabled,false);assert.equal(duplicate.get('roomPanel').hidden,true);assert.match(a.get('roomInfo').textContent,/2\/8/)}
assert.equal(peers.size,2);
const firstName=setup('IŞIK',{}),sameName=setup('ışık',{});for(const participant of [firstName,sameName]){participant.get('roomCodeInput').value=code;participant.get('joinRoom').onclick()}await turn();assert.match(firstName.get('lobbyStatus').textContent,/Odaya bağlısın/);assert.match(sameName.get('lobbyStatus').textContent,/takma ad odada kullanılıyor/);assert.match(a.get('roomInfo').textContent,/3\/8/);
firstName.get('leaveRoom').onclick();await new Promise(r=>setTimeout(r,130));sameName.get('joinRoom').onclick();await turn();assert.match(sameName.get('lobbyStatus').textContent,/Odaya bağlısın/);sameName.get('leaveRoom').onclick();await new Promise(r=>setTimeout(r,130));assert.match(a.get('roomInfo').textContent,/2\/8/);
assert.match(a.get('roomMembers').children[0].children[1].textContent,/10:00/);assert.match(b.get('roomMembers').children[1].children[1].textContent,/03:00/);
b.timer.running=true;b.timer.left=120;b.tick();await turn();a.tick();await turn();
assert.match(a.get('roomMembers').children[0].children[1].textContent,/10:00/);assert.match(b.get('roomMembers').children[1].children[1].textContent,/02:00/);
b.timer.worked=60;b.tick();await turn();a.tick();await turn();assert.match(a.get('roomTotal').textContent,/0 sa 01 dk/);
const photo='data:image/jpeg;base64,'+'A'.repeat(350000);const message={id:'A'.repeat(20),text:'Bir soru',image:photo,sender:'Spoof'};assert.equal(b.chat.send(message),true);await turn();assert.equal(a.chat.messages[0].sender,'B');assert.equal(b.chat.messages[0].image,photo);
const host=peers.get('focusforyou-room-v3-'+code),guest=[...peers.values()].find(p=>p!==host);
guest.links[0].send({type:'action',version:1,action:'reset'});await turn();assert.equal(a.timer.left,600);
const c=setup('C',{phase:'focus',left:1500,total:1500,running:false,rounds:0});c.get('roomCodeInput').value=code;c.get('joinRoom').onclick();await turn();assert.match(c.get('roomInfo').textContent,/3\/8/);assert.equal(c.chat.messages[0].text,'Bir soru');
c.timer.worked=30;c.tick();await turn();a.tick();await turn();c.get('leaveRoom').onclick();await new Promise(r=>setTimeout(r,130));assert.match(a.get('roomInfo').textContent,/2\/8/);assert.match(a.get('roomTotal').textContent,/0 sa 01 dk 30 sn/);
a.get('leaveRoom').onclick();await new Promise(r=>setTimeout(r,130));assert.match(b.get('lobbyStatus').textContent,/oda kapandı/);assert.equal(b.timer.running,true);assert.equal(peers.size,0);
});
test('Live projection counts focus only and validates image messages',()=>{
const projected=model.project({phase:'focus',running:true,total:60,left:2,focus:60,rest:60,worked:10,roomWorked:3},5);
assert.equal(projected.phase,'break');assert.equal(projected.left,57);assert.equal(projected.worked,12);assert.equal(projected.roomWorked,5);
assert.equal(model.content({id:'A'.repeat(20),text:'x',image:'data:image/svg+xml;base64,AAAA'}),null);
assert.equal(model.content({id:'A'.repeat(20),text:'x'.repeat(2001)}),null);
assert.equal(model.content({id:'A'.repeat(20),text:'',image:'data:image/jpeg;base64,'+'A'.repeat(1500001)}),null);
});

