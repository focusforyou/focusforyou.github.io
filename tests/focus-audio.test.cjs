const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 class El{constructor(){this.children=[];this.map=new Map();this.value='25';this.checked=true;this.hidden=false;this.attributes={}}append(e){this.children.push(e)}setAttribute(k,v){this.attributes[k]=v}querySelector(s){if(!this.map.has(s))this.map.set(s,new El());return this.map.get(s)}}
 const target=new El(),body=new El(),events={},levels=[],nodes=[];body.dataset={timerPhase:'focus',timerRunning:'true'};
 function node(){const n={connect(){},disconnect(){n.disconnected=true},start(){n.started=true},stop(){n.stopped=true},frequency:{value:0},gain:{value:0,setTargetAtTime:v=>levels.push(v)}};nodes.push(n);return n}
 class Audio{constructor(){this.sampleRate=8;this.currentTime=0;this.destination={}}async resume(){}async suspend(){}close(){this.closed=true}createBuffer(_,size){return {getChannelData:()=>new Float32Array(size)}}createBufferSource(){return node()}createBiquadFilter(){return node()}createGain(){return node()}createOscillator(){return node()}}
 const ctx={AudioContext:Audio,document:{body,getElementById:()=>target,createElement:()=>new El()},addEventListener:(n,f)=>(events[n]??=[]).push(f),setTimeout:()=>1,clearTimeout(){}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('focus-audio.js','utf8'),ctx);return {ctx,body,target,panel:target.children[0],events,levels,nodes,emit:n=>events[n]?.forEach(f=>f({}))};
}
test('opt-in generated focus audio mutes during break and resumes on the actual window phase event',async()=>{
 const f=fixture(),button=f.panel.querySelector('button');assert.equal(f.nodes.length,0);await button.onclick();assert.equal(f.levels.at(-1),.0625);f.body.dataset.timerPhase='break';f.emit('focus-timer-phase');assert.equal(f.levels.at(-1),0);assert.match(f.body.children[0].textContent,/Mola zamanı/);f.body.dataset.timerPhase='focus';f.emit('focus-timer-phase');assert.equal(f.levels.at(-1),.0625);assert.match(f.body.children[0].textContent,/Odak zamanı/);
 f.panel.querySelector('[type=checkbox]').checked=false;f.body.dataset.timerPhase='break';f.emit('focus-timer-phase');assert.equal(f.levels.at(-1),.0625);await button.onclick();assert(f.nodes.every(n=>n.disconnected));assert.equal(button.attributes['aria-pressed'],'false');
});
test('changing generated sound releases old nodes and pagehide clears audio and button state',async()=>{
 const f=fixture(),button=f.panel.querySelector('button'),select=f.panel.querySelector('select');select.value='waves';await button.onclick();const old=[...f.nodes];select.value='brown';select.onchange();assert(old.every(n=>n.disconnected));f.emit('pagehide');assert(f.nodes.every(n=>n.disconnected));assert.equal(button.textContent,'Sesi aç');assert.equal(button.attributes['aria-pressed'],'false');
});
