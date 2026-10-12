const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(reduced=false){
 const ids={},events={},profile={name:'Efe',username:'efe',exam:'OTHER',cosmetics:{nameStyle:'gold',frame:'gold',tag:'doctor'}};
 const element=id=>ids[id]??= {id,hidden:false,attrs:{},classList:{toggle:(key,value)=>ids[id][key]=value,add:(key)=>ids[id][key]=true},setAttribute(key,value){this.attrs[key]=value},focus(){document.activeElement=this},contains(node){return node===this||node===ids.friendUsername||node===ids.closeFriends},addEventListener(key,fn){this[key]=fn},animate(){this.animated=true},showModal(){this.open=true},close(){this.open=false},click(){this.onclick?.()},prepend(node){this.tag=node.textContent},append(){},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}}};
 const document={getElementById:element,activeElement:null,addEventListener:(key,fn)=>events[key]=fn,createElement:()=>({})};
 const context={setInterval(){},document,addEventListener:(key,fn)=>events[key]=fn,matchMedia:()=>({matches:reduced}),console,FocusSocial:{getProfile:()=>profile,uid:()=>''}};context.window=context;
 vm.runInNewContext(fs.readFileSync('social-model.js','utf8'),context);
 vm.runInNewContext(fs.readFileSync('community-ui.js','utf8'),context);
 return {ids,events,profile,document,context};
}
test('Member popup reflects cloud cosmetics and removes previous user styling',()=>{
 const app=setup();app.context.openMemberProfile('test-user');
 assert.equal(app.ids.memberProfileTitle['name-gold'],true);
 assert.equal(app.ids.memberProfileAvatar['frame-gold'],true);
 assert.equal(app.ids.memberProfileExam.textContent,'Diğer');
 app.profile.cosmetics={};app.profile.name='Yeni kişi';app.context.openMemberProfile('next-user');
 assert.equal(app.ids.memberProfileTitle['name-gold'],false);
 assert.equal(app.ids.memberProfileAvatar['frame-gold'],false);
 assert.equal(app.ids.memberProfileTitle.textContent,'Yeni kişi');
});
test('Friends popup respects reduced motion and returns keyboard focus when closed',()=>{
 const app=setup(true);app.ids.friendsPanel.hidden=true;
 app.ids.friendsToggle.onclick();
 assert.equal(app.ids.friendsPanel.hidden,false);assert.equal(app.document.activeElement,app.ids.friendUsername);
 assert.equal(app.ids.friendsPanel.animated,undefined);
 app.events.keydown({key:'Escape'});
 assert.equal(app.ids.friendsPanel.hidden,true);assert.equal(app.document.activeElement,app.ids.friendsToggle);
 app.ids.friendsMember.hidden=true;app.ids.friendsToggle.onclick();
 assert.equal(app.document.activeElement,app.ids.closeFriends);
});
test('member profile renders gifted custom tag with cloud-selected colors',()=>{
 const app=setup();app.profile.cosmetics={tag:'custom:UZMAN',nameStyle:'ruby',frame:'ice',plate:'emerald'};app.context.openMemberProfile('test-user');assert.equal(app.ids.memberProfileTitle.tag,'[UZMAN]');assert.equal(app.ids.memberProfileTitle['name-ruby'],true);assert.equal(app.ids.memberProfileTitle['plate-emerald'],true);assert.equal(app.ids.memberProfileAvatar['frame-ice'],true);
});

