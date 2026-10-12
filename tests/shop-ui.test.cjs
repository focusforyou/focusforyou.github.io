const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(admin=true,catalog=null){
 class El{constructor(){this.children=[];this.hidden=false;this.textContent='';this.value='';this.attributes={}}append(...n){this.children.push(...n)}replaceChildren(...n){this.children=[...n]}setAttribute(k,v){this.attributes[k]=v}addEventListener(k,fn){this.events??={};this.events[k]=fn}focus(){}showModal(){this.open=true}close(){this.open=false}}
 const nodes=new Map(),events={},gifts=[],intervals=[];let state={uid:'admin',admin,balance:0};const by=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)};
 const store={snapshot:()=>state,owned:()=>true,grant:async(name,id)=>gifts.push([name,id]),grantTag:async()=>{},purchase:async()=>{}};
 const ctx={Study:{totalSeconds:()=>21600},setInterval:fn=>intervals.push(fn),document:{getElementById:by,createElement:()=>new El()},FocusCosmetics:{catalog:()=>catalog||[{id:'frame:gold',kind:'frame',value:'gold',label:'Altın çerçeve',cost:3600000}]},FocusAccount:{profile:()=>({uid:'admin',name:'Efe',photo:'',cosmetics:{frame:'none',font:'default',nameStyle:'ice',plate:'none'}})},FocusCosmeticStore:store,addEventListener:(n,f)=>events[n]=f};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('shop-ui.js','utf8'),ctx);
 return {by,events,gifts,store,intervals,ctx,setState:s=>state=s};
}
test('admin gifts the selected card item and wallet refresh preserves its username form',async()=>{
 const f=fixture(),card=f.by('shopItems').children[0],gift=card.children[3],form=card.children[4],input=form.children[0];gift.onclick();input.value='@zeynep';f.by('cosmeticShop').open=true;f.events['focus-cosmetics']();assert.equal(f.by('shopItems').children[0],card);assert.equal(input.value,'@zeynep');await form.onsubmit({preventDefault(){}});assert.deepEqual(f.gifts,[['@zeynep','frame:gold']]);assert.match(form.children[2].textContent,/envanterine verildi/);
 f.setState({uid:'member',admin:false,balance:0});f.events['focus-cosmetics']();assert.equal(f.by('shopItems').children[0].children.length,4);assert.equal(f.by('cosmeticAdmin').hidden,true);
});
test('ordinary users never receive gift controls and cannot purchase owned items',()=>{const f=fixture(false),card=f.by('shopItems').children[0];assert.equal(card.children.length,4);assert.equal(card.children[2].disabled,true)});

test('wallet shows sub-minute progress, loading and sync failures without presenting a false zero',()=>{
 const f=fixture();f.by('cosmeticShop').open=true;f.setState({uid:'admin',admin:true,balance:29,earnedSeconds:29,spentSeconds:0});f.events['focus-cosmetics']();assert.equal(f.by('shopBalance').textContent,'29 sn');
 f.setState({uid:'admin',admin:true,balance:3661,earnedSeconds:3661,spentSeconds:0});f.events['focus-cosmetics']();assert.equal(f.by('shopBalance').textContent,'1 sa 1 dk 1 sn');
 f.setState({uid:'admin',admin:true,loading:true});f.events['focus-cosmetics']();assert.equal(f.by('shopBalance').textContent,'Yükleniyor…');
 f.setState({uid:'admin',admin:true,error:'wallet-sync-failed'});f.events['focus-cosmetics']();assert.equal(f.by('shopBalance').textContent,'Senkronizasyon bekleniyor');assert.match(f.by('shopEarned').textContent,/kaydedilemedi/);
});

test('historical total is distinct from spendable wallet and refreshes while the shop is open',()=>{
 const f=fixture();assert.match(f.by('shopTotalStudy').textContent,/6 sa/);assert.equal(f.by('shopBalance').textContent,'0 sn');f.by('cosmeticShop').open=true;f.ctx.Study.totalSeconds=()=>21661;f.intervals[0]();assert.match(f.by('shopTotalStudy').textContent,/6 sa 1 dk 1 sn/);assert.equal(f.by('shopBalance').textContent,'0 sn');
});

test('try-on uses the current identity without persisting ownership and clears on close or account switch',()=>{
 const f=fixture(),before=JSON.stringify(f.ctx.FocusAccount.profile()),card=f.by('shopItems').children[0];card.children.at(-1).onclick();const panel=f.by('cosmeticTryOn');assert.equal(panel.hidden,false);assert.match(panel.children[1].children[0].className,/frame-gold/);assert.equal(panel.children[1].children[1].textContent,'Efe');assert.equal(card.children.at(-1).textContent,'Deneniyor');assert.equal(JSON.stringify(f.ctx.FocusAccount.profile()),before);assert.equal(f.gifts.length,0);
 f.by('cosmeticShop').events.close();assert.equal(panel.hidden,true);assert.equal(card.children.at(-1).textContent,'Dene');card.children.at(-1).onclick();f.by('cosmeticShop').open=true;f.setState({uid:'other',admin:false,balance:0});f.events['focus-cosmetics']();assert.equal(panel.hidden,true);
});
