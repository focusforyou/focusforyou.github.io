'use strict';
const Study=(()=>{
const defaults={focus:25,break:5,goal:120};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Math.round(Number(n)||min)));
const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
function cleanDays(input){
const out={};if(!input||typeof input!=='object'||Array.isArray(input))return out;
for(const [date,seconds] of Object.entries(input)){
if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(seconds)&&seconds>=0&&seconds<=86400)out[date]=seconds;
}return out;
}
let stored={};try{stored=JSON.parse(localStorage.getItem('focus_study')||'{}')||{}}catch(e){}
const preferences={focus:clamp(stored.preferences?.focus||25,1,180),break:clamp(stored.preferences?.break||5,1,60),goal:clamp(stored.preferences?.goal||120,5,1440)};
let days=cleanDays(stored.days),lastRender=0,localWorked=0;
function save(){try{localStorage.setItem('focus_study',JSON.stringify({version:1,preferences,days}))}catch(e){}}
function record(seconds,from){
while(seconds>0){
const date=new Date(from),midnight=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime();
const part=Math.min(seconds,(midnight-from)/1000);
if(part<=0)break;
const key=dateKey(date);days[key]=Math.min(86400,(days[key]||0)+part);localWorked+=part;window.FocusAccount?.record(key,part);seconds-=part;from+=part*1000;
}if(Date.now()-lastRender>1000){render();lastRender=Date.now()}
}
function render(){
const by=id=>document.getElementById(id);if(!by('dailyMinutes'))return;
const today=dateKey(new Date()),minutes=Math.floor((days[today]||0)/60);
by('dailyMinutes').textContent=minutes;by('dailyProgress').max=preferences.goal;by('dailyProgress').value=Math.min(minutes,preferences.goal);
by('dailySummary').textContent=minutes>=preferences.goal?'Bugünün hedefine ulaştın!':(preferences.goal-minutes)+' dakika sonra günlük hedef tamam.';
const list=[];for(let ago=6;ago>=0;ago--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-ago);list.push({label:d.toLocaleDateString('tr-TR',{weekday:'short'}),date:dateKey(d),minutes:Math.floor((days[dateKey(d)]||0)/60)})}
const max=Math.max(preferences.goal,...list.map(d=>d.minutes));
by('studyHistory').replaceChildren(...list.map(d=>{
const box=document.createElement('div');box.className='history-day';box.title=d.date+': '+d.minutes+' dakika';
const value=document.createElement('strong');value.textContent=d.minutes+' dk';
const bar=document.createElement('div');bar.className='history-bar';const fill=document.createElement('div');fill.className='history-fill';fill.style.height=Math.max(3,d.minutes/max*90)+'px';bar.append(fill);
const label=document.createElement('span');label.textContent=d.label;box.append(value,bar,label);return box;
}));
by('weeklySummary').textContent='Bu hafta toplam '+list.reduce((n,d)=>n+d.minutes,0)+' dakika.';
}
function init(){
const by=id=>document.getElementById(id);
by('dailyGoal').value=preferences.goal;by('focusMinutes').value=preferences.focus;by('breakMinutes').value=preferences.break;
by('saveGoal').onclick=()=>{preferences.goal=clamp(by('dailyGoal').value,5,1440);by('dailyGoal').value=preferences.goal;save();render()};
by('saveDurations').onclick=()=>{
const focus=clamp(by('focusMinutes').value,1,180),rest=clamp(by('breakMinutes').value,1,60);
const ok=Study.changeDurations?.(focus,rest);
by('settingsMessage').textContent=ok?'Süreler kaydedildi.':'Önce devam eden turu sıfırla; sonra süreleri değiştirebilirsin.';
by('focusMinutes').value=preferences.focus;by('breakMinutes').value=preferences.break;
};
render();setInterval(render,30000);
}
document.addEventListener('DOMContentLoaded',init);
return {preferences,record,save,render,dateKey,totalSeconds:()=>Object.values(days).reduce((sum,n)=>sum+n,0),localSeconds:()=>localWorked,
snapshot:()=>({days:{...days},preferences:{...preferences}}),applyDays:value=>{days=cleanDays(value);save();render()},applyPreferences:value=>{preferences.focus=clamp(value?.focus,1,180);preferences.break=clamp(value?.break,1,60);preferences.goal=clamp(value?.goal,5,1440);save();render()}};
})();

