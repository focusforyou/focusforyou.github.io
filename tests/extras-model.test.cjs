const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../extras-model.js');
test('study state prioritizes offline membership over a stale running timer',()=>{
 assert.equal(M.state({running:true,phase:'focus'},false),'Çevrimdışı');
 assert.equal(M.state({running:true,phase:'focus'}),'Odaklanıyor');
 for(const timer of [undefined,{running:false,phase:'focus'},{running:true,phase:'break'},{running:false,phase:'break'}])assert.equal(M.state(timer),'Molada');
});
test('milestones unlock at the precise threshold and invalid work totals never earn achievements',()=>{
 for(const invalid of [NaN,Infinity,-Infinity,-1,'3600',undefined])assert.deepEqual(M.earned(invalid),[]);
 assert.equal(M.earned(3599).length,0);assert.deepEqual(M.earned(3600).map(m=>m.id),['first']);
 for(let index=0;index<M.milestones.length;index++){
  const milestone=M.milestones[index],seconds=milestone.hours*3600;
  assert.equal(M.earned(seconds-1).length,index);assert.equal(M.earned(seconds).length,index+1);assert.equal(M.earned(seconds).at(-1),milestone);
 }
});
test('showcase normalizes untrusted profile fields and retains at most three known unique badges',()=>{
 for(const invalid of [undefined,null,42,'bio'])assert.deepEqual(M.showcase(invalid),{bio:'',showHours:false,seconds:0,badges:[]});
 const input={bio:'x'.repeat(200),showHours:'true',seconds:Infinity,badges:['first','unknown','first','ten','fifty','hundred',null,{}]};
 const result=M.showcase(input);assert.equal(result.bio.length,160);assert.equal(result.showHours,false);assert.equal(result.seconds,0);assert.deepEqual(result.badges,['first','ten','fifty']);assert.equal(input.bio.length,200);assert.equal(input.badges.length,8);
 assert.equal(M.showcase({seconds:-20}).seconds,0);assert.equal(M.showcase({seconds:1e12}).seconds,315360000);
 assert.equal(M.showcase({seconds:1234,showHours:true}).seconds,1234);assert.equal(M.showcase({showHours:true}).showHours,true);
});
test('calendar emits chronological local dates across leap day without modifying the supplied date',()=>{
 const end=new Date(2024,2,3,23,59,30),original=end.getTime(),days={'2024-02-28':90,'2024-02-29':3600,'2024-03-03':7200};
 const result=M.calendar(days,end,1);assert.deepEqual(result.map(d=>d.key),['2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01','2024-03-02','2024-03-03']);
 assert.deepEqual(result[2],{key:'2024-02-28',minutes:1,level:1});assert.deepEqual(result[3],{key:'2024-02-29',minutes:60,level:3});assert.equal(result.at(-1).level,4);assert.equal(end.getTime(),original);
});
test('calendar caps work at a full day and gives exact intensity boundaries, ignoring invalid records',()=>{
 const end=new Date(2026,9,12),days={'2026-10-06':-1,'2026-10-07':'3600','2026-10-08':1799,'2026-10-09':1800,'2026-10-10':3599,'2026-10-11':3600,'2026-10-12':999999};
 const result=M.calendar(days,end,1);assert.deepEqual(result.map(d=>d.level),[0,0,1,2,2,3,4]);assert.equal(result.at(-1).minutes,1440);
 assert.equal(M.calendar({},end).length,84);assert.equal(M.calendar({},end,0).length,7);assert.equal(M.calendar({},end,100).length,182);
 assert.equal(M.calendar({'2026-10-12':NaN},end,1).at(-1).minutes,0);
});
test('room role resolution gives admin priority and never borrows another member moderator role',()=>{
 const room={ownerUid:'owner'},members=[{uid:'mod',role:'moderator'},{uid:'member',role:'member'}];
 assert.equal(M.role(room,'owner',members,true),'Yönetici');assert.equal(M.role(room,'owner',members),'Lider');assert.equal(M.role(room,'mod',members),'Moderatör');
 for(const uid of ['member','outsider'])assert.equal(M.role(room,uid,members),'Üye');
});
