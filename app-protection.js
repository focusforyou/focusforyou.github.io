'use strict';
(function(root){
 function create(report=()=>{}){
  let instance=null,sdk=null,configured=false;
  const state=(status,error)=>{const code=/^app-check\/[a-z-]+$/.test(error?.code||'')?error.code:'app-check/unavailable';try{report(status,status==='unavailable'?code:'')}catch(e){}};
  function start(app,key,provider){
   if(!key||instance)return instance;configured=true;sdk=provider;
   try{instance=sdk.initializeAppCheck(app,{provider:new sdk.ReCaptchaEnterpriseProvider(key),isTokenAutoRefreshEnabled:true});
    sdk.onTokenChanged(instance,value=>state(value?.token?'verified':'pending'),error=>state('unavailable',error));return instance;
   }catch(error){state('unavailable',error);return null}
  }
  async function token(){
   if(!configured)return '';if(!instance)throw Error('app-check-unavailable');
   let timer;try{const result=await Promise.race([sdk.getToken(instance,false),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('app-check-timeout')),12000)})]);
    if(typeof result?.token!=='string'||result.token.length>8192||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(result.token))throw Error('app-check-unavailable');return result.token;
   }finally{clearTimeout(timer)}
  }
  return {start,token};
 }
 if(typeof module!=='undefined')module.exports={create};
 if(root?.document)root.FocusAppProtection=create((status,code)=>{if(status==='verified')console.info('[Focus] App Check doğrulandı.');else if(status==='unavailable')console.warn('[Focus] App Check kullanılamıyor:',code)});
})(typeof window!=='undefined'?window:null);
