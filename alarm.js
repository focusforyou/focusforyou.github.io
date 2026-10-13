'use strict';
window.FocusSound=(()=>{
 let context=null,unlocking=null,lastKind='',lastPlayed=-Infinity;
 function unlock(){
  if(window.FocusAndroid?.sound)return Promise.resolve(true);
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Audio)return Promise.resolve(false);
   if(!context||context.state==='closed')context=new Audio();
   if(context.state==='running')return Promise.resolve(true);
   if(!unlocking)unlocking=Promise.resolve(context.resume()).then(()=>context.state==='running').catch(()=>false).finally(()=>{unlocking=null});
   return unlocking;
  }catch(e){return Promise.resolve(false)}
 }
 function play(kind='alarm'){
  if(!['alarm','nudge','focus','break'].includes(kind)||kind==='nudge'&&window.FocusExtras?.quiet?.())return false;
  const now=Date.now();if(lastKind===kind&&now-lastPlayed<1000)return false;
  if(window.FocusAndroid?.sound){try{window.FocusAndroid.sound(kind);lastKind=kind;lastPlayed=now;return true}catch(e){}}
  // A user gesture unlocks audio; never create an autoplay context from a timer.
  if(!context||context.state!=='running')return false;
  try{
   const start=context.currentTime,notes=kind==='alarm'?[660,880,1047,880]:kind==='focus'?[523,659,784]:kind==='break'?[784,659,523,392]:[880,660];
   for(let i=0;i<notes.length;i++){
    const tone=context.createOscillator(),gain=context.createGain(),at=start+i*.24;
    tone.type='sine';tone.frequency.value=notes[i];
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.16,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.20);
    tone.connect(gain);gain.connect(context.destination);tone.start(at);tone.stop(at+.22);
    tone.onended=()=>{tone.disconnect();gain.disconnect()};
   }
   lastKind=kind;lastPlayed=now;return true;
  }catch(e){return false}
 }
 document.addEventListener('pointerdown',unlock,{passive:true});
 document.addEventListener('keydown',unlock);
 return {unlock,play};
})();

