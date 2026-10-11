const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(label='',uid='alice'){
 const nodes=new Map(),storage=new Map(label?[['focus_profile_label',label],['focus_profile_uid',uid]]:[]);
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'Giriş yap',hidden:false,open:false,events:{},append(){},addEventListener(k,fn){this.events[k]=fn},showModal(){this.open=true},close(){this.open=false;this.events.close?.()},getBoundingClientRect:()=>({left:0,right:100,top:0,bottom:100})});return nodes.get(id)};
 const ctx={document:{getElementById:node,querySelector:()=>node('account-card')},localStorage:{getItem:k=>storage.get(k)||null}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('account-ui.js','utf8'),ctx);return {ctx,node,storage};
}
test('a cached display label prevents signed-out flash without creating authenticated state',()=>{
 const f=fixture('Efe');assert.equal(f.node('openAccount').textContent,'Profilim');assert.equal(f.node('accountGuest').hidden,true);assert.equal(f.node('accountMember').hidden,true);assert.match(f.node('accountStatus').textContent,/yükleniyor/);assert.equal(f.ctx.auth,undefined);assert.equal(f.ctx.FocusAccount,undefined);assert.equal([...f.storage.keys()].some(k=>/token|cookie/i.test(k)),false);
});
test('manual Profilim intent survives login completion and onboarding has explicit dialog state',()=>{
 const f=fixture('Efe');f.node('openAccount').onclick();assert.equal(f.ctx.FocusAccountUI.mode,'profile');f.ctx.FocusAccountUI.closeLogin();assert.equal(f.node('accountSheet').open,true);
 f.ctx.FocusAccountUI.onboarding();assert.equal(f.ctx.FocusAccountUI.mode,'onboarding');assert.match(f.node('profileSetupTitle').textContent,/tamamla/);f.ctx.FocusAccountUI.closeLogin();assert.equal(f.node('accountSheet').open,false);
});
test('a fresh guest opens login and invalid oversized presentation data is ignored',()=>{
 const f=fixture('x'.repeat(31));assert.equal(f.node('openAccount').textContent,'Giriş yap');f.node('openAccount').onclick();assert.equal(f.ctx.FocusAccountUI.mode,'login');assert.equal(f.node('accountSheet').open,true);
});

test('cached label without a valid identity key does not show a stale profile',()=>{for(const uid of ['', 'bad uid', 'x'.repeat(129)])assert.equal(fixture('Efe',uid).node('openAccount').textContent,'Giriş yap')});
