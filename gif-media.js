'use strict';
(function(root){
 const MAX=180000,cache=new Map();
 function inspect(bytes,kind='banner'){
 if(!(bytes instanceof Uint8Array)||bytes.length<14)throw Error('gif-invalid');const text=(a,b)=>String.fromCharCode(...bytes.slice(a,b));if(!['GIF87a','GIF89a'].includes(text(0,6)))throw Error('gif-invalid');const read=i=>bytes[i]|bytes[i+1]<<8,w=read(6),h=read(8);if(!w||!h||w>(kind==='avatar'?256:640)||h>(kind==='avatar'?256:360))throw Error('gif-dimensions');let i=13+((bytes[10]&128)?3*(1<<((bytes[10]&7)+1)):0),frames=0,decoded=0;const skip=()=>{while(i<bytes.length){const size=bytes[i++];if(size===0)return;if(i+size>bytes.length)throw Error('gif-invalid');i+=size}throw Error('gif-invalid')};
 while(i<bytes.length){const marker=bytes[i++];if(marker===0x3b){if(!frames||i!==bytes.length)throw Error('gif-invalid');return {width:w,height:h,frames,decodedBytes:decoded}}
 if(marker===0x21){if(i>=bytes.length)throw Error('gif-invalid');i++;skip();continue}
 if(marker!==0x2c||i+9>bytes.length)throw Error('gif-invalid');const x=read(i),y=read(i+2),fw=read(i+4),fh=read(i+6),packed=bytes[i+8];if(!fw||!fh||x+fw>w||y+fh>h)throw Error('gif-invalid');i+=9;if(packed&128)i+=3*(1<<((packed&7)+1));if(i>=bytes.length||bytes[i]<2||bytes[i]>8)throw Error('gif-invalid');i++;skip();frames++;decoded=w*h*frames*4;if(frames>120||decoded>24*1024*1024)throw Error('gif-memory');
 }throw Error('gif-invalid');
 }
 function decode(value){if(typeof value!=='string'||value.length>MAX||!/^data:image\/gif;base64,R0lGOD(?:dh|lh)[A-Za-z0-9+/]*={0,2}$/.test(value))throw Error('gif-invalid');const data=value.slice(value.indexOf(',')+1),binary=typeof atob==='function'?atob(data):Buffer.from(data,'base64').toString('binary');return Uint8Array.from(binary,c=>c.charCodeAt(0))}
 function valid(value,kind='banner'){if(typeof value!=='string'||value.length>MAX||!value.startsWith('data:image/gif;base64,'))return '';const cached=cache.get(value);if(cached&&Object.hasOwn(cached,kind))return cached[kind]?value:'';let ok=false;try{inspect(decode(value),kind);ok=true}catch(e){}const record=cached||{};record[kind]=ok;cache.set(value,record);if(cache.size>16)cache.delete(cache.keys().next().value);return ok?value:''}
 async function load(file,kind='banner'){if(!file||file.size>134970)throw Error('gif-size');const bytes=new Uint8Array(await file.arrayBuffer());inspect(bytes,kind);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const encoded=typeof btoa==='function'?btoa(binary):Buffer.from(bytes).toString('base64');const value='data:image/gif;base64,'+encoded;if(value.length>MAX)throw Error('gif-size');return value}
 function message(error){return error?.message==='gif-dimensions'?'GIF çok büyük. En fazla 2048 piksel ve 1,5 milyon piksel içeren bir GIF seç.':error?.message==='gif-memory'?'GIF çok uzun veya karmaşık. Daha kısa bir GIF seç.':error?.message==='gif-size'?'GIF kaydetme sınırına sığmadı. Daha sade veya kısa bir GIF seç.':error?.message==='gif-timeout'?'GIF hazırlanması uzun sürdü. Daha küçük bir GIF seç.':error?.message==='gif-worker'?'Bu tarayıcı GIF kırpmayı açamadı. Uygulamayı güncelleyip tekrar dene.':'GIF açılamadı. Başka bir GIF seç.'}
 async function crop(file,rect,kind='avatar',signal){
  if(!file||file.size>20*1024*1024)throw Error('gif-size');
  if(signal?.aborted)return null;
  const buffer=await file.arrayBuffer();if(signal?.aborted)return null;
  return new Promise((resolve,reject)=>{
   let worker,timer,done=false;
   const finish=(value,error)=>{if(done)return;done=true;clearTimeout(timer);worker?.terminate();signal?.removeEventListener('abort',abort);error?reject(error):resolve(value)};
   const abort=()=>finish(null);
   try{worker=new Worker(new URL('gif-crop-worker.js?v=1',root.location.href));
    worker.onmessage=e=>{if(e.data.error)return finish(null,Error(e.data.error));try{const bytes=new Uint8Array(e.data.bytes);inspect(bytes,kind);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const value='data:image/gif;base64,'+btoa(binary);if(!valid(value,kind))throw Error('gif-size');finish(value)}catch(error){finish(null,error)}};
    worker.onerror=()=>finish(null,Error('gif-worker'));signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>finish(null,Error('gif-timeout')),45000);worker.postMessage({buffer,rect,kind},[buffer]);
   }catch(error){finish(null,Error('gif-worker'))}
  });
 }
 const api={inspect,valid,load,crop,message,MAX};root.FocusGifMedia=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
