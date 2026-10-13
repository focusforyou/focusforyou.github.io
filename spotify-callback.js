'use strict';
(()=>{
 const params=new URLSearchParams(location.search),state=params.get('state'),code=params.get('code'),error=params.get('error');history.replaceState(null,'',location.pathname);
 const status=document.getElementById('status');
 if(!state||(!code&&!error)){status.textContent='Bağlantıyı Focus For You’daki Spotify düğmesinden başlat.';return}
 if(/^android_[A-Za-z0-9_-]{16,80}$/.test(state)&&!window.opener){
  if(code&&code.length>4096||error&&error.length>256)return;
  const query=new URLSearchParams({state});if(error)query.set('error',error);else query.set('code',code);
  const link=document.getElementById('returnApp');link.hidden=false;link.href='intent://spotify-callback?'+query+'#Intent;scheme=focusforyou;package=io.github.focusforyou.app;end';
  status.textContent=error?'Spotify bağlantısı iptal edildi. Uygulamaya dönebilirsin.':'Spotify onayı tamamlandı. Bağlantıyı bitirmek için uygulamaya dön.';
  return;
 }
 if(!window.opener){status.textContent='Bağlantıyı Focus For You’daki Spotify düğmesinden başlat.';return}
 window.opener.postMessage({type:'focus-spotify-callback',state,code,error},location.origin);status.textContent=error?'Spotify bağlantısı iptal edildi.':'Spotify’a bağlandın. Bu pencereyi kapatabilirsin.';window.close();
})();
