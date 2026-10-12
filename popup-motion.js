'use strict';
(()=>{
 const selector='dialog,.friends-popover,.photo-edit-menu,.reaction-picker',bound=new WeakSet(),closing=new WeakMap();
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
 function cancel(node){const state=closing.get(node);if(!state)return;closing.delete(node);clearTimeout(state.timeout);node.inert=state.inert;state.animation?.cancel()}
 function exit(node,done){if(closing.has(node))return;if(reduced()||typeof node.animate!=='function'||!node.isConnected){done();return}
  const state={inert:node.inert};closing.set(node,state);node.inert=true;
  const finish=()=>{if(closing.get(node)!==state)return;closing.delete(node);clearTimeout(state.timeout);node.inert=state.inert;done()};
  try{const look=getComputedStyle(node);state.animation=node.animate([{opacity:look.opacity,transform:look.transform},{opacity:0,transform:'translateY(5px) scale(.985)'}],{duration:140,easing:'cubic-bezier(.4,0,1,1)'});state.animation.onfinish=finish;state.timeout=setTimeout(finish,190)}catch{finish()}
 }
 function bind(node){if(bound.has(node))return;bound.add(node);
  if(node.tagName==='DIALOG'){
   const close=node.close.bind(node),showModal=node.showModal.bind(node),show=node.show.bind(node);
   node.close=value=>{if(!node.open)return close(value);exit(node,()=>close(value))};
   node.showModal=(...args)=>{cancel(node);return showModal(...args)};node.show=(...args)=>{cancel(node);return show(...args)};
   node.addEventListener('cancel',e=>{if(e.defaultPrevented)return;e.preventDefault();node.close()});
   node.addEventListener('submit',e=>{if(e.defaultPrevented||e.target.method!=='dialog')return;e.preventDefault();node.close(e.submitter?.value||'')});
  }else{
   const hidden=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');let requested=hidden.get.call(node);
   Object.defineProperty(node,'hidden',{configurable:true,get:()=>requested,set:value=>{requested=!!value;if(!requested){cancel(node);hidden.set.call(node,false)}else if(!hidden.get.call(node))exit(node,()=>hidden.set.call(node,true));else hidden.set.call(node,true)}});
   if(node.matches('.reaction-picker')){const remove=node.remove.bind(node);node.remove=()=>exit(node,remove)}
  }
 }
 function scan(root){if(root.matches?.(selector))bind(root);root.querySelectorAll?.(selector).forEach(bind)}
 function init(){scan(document);new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node)}).observe(document.body,{childList:true,subtree:true})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
