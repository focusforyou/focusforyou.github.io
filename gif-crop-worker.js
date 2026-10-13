'use strict';
if(typeof importScripts==='function')importScripts('vendor/gif-codec.js','gif-media.js');
(function(root){
 const codec=root.FocusGifCodec||(typeof require==='function'?require('./vendor/gif-codec.js'):null);
 function sourceInfo(bytes){
  if(bytes.length>20*1024*1024||bytes.length<14)throw Error('gif-size');
  const u=i=>bytes[i]|bytes[i+1]<<8,w=u(6),h=u(8);
  if(!w||!h||w>2048||h>2048||w*h>1500000)throw Error('gif-dimensions');
  if(!['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6))))throw Error('gif-invalid');
  let i=13+((bytes[10]&128)?3*(1<<((bytes[10]&7)+1)):0),frames=0,repeat=-1;
  const skip=()=>{while(i<bytes.length){const n=bytes[i++];if(!n)return;if(i+n>bytes.length)throw Error('gif-invalid');i+=n}throw Error('gif-invalid')};
  while(i<bytes.length){const mark=bytes[i++];if(mark===59){if(!frames||i!==bytes.length)throw Error('gif-invalid');return {width:w,height:h,frames,repeat}}
   if(mark===33){const label=bytes[i++];if(![249,255,254].includes(label))throw Error('gif-invalid');if(label===249&&bytes[i]!==4)throw Error('gif-invalid');if(label===255&&bytes[i]===11){const name=String.fromCharCode(...bytes.slice(i+1,i+12));if(['NETSCAPE2.0','ANIMEXTS1.0'].includes(name)&&bytes[i+12]===3&&bytes[i+13]===1)repeat=u(i+14)}skip();continue}
   if(mark!==44||i+9>bytes.length)throw Error('gif-invalid');const fw=u(i+4),fh=u(i+6),packed=bytes[i+8];if(!fw||!fh||u(i)+fw>w||u(i+2)+fh>h)throw Error('gif-invalid');i+=9;if(packed&128)i+=3*(1<<((packed&7)+1));if(bytes[i]<2||bytes[i]>8||i>=bytes.length)throw Error('gif-invalid');i++;skip();if(++frames>300||frames*w*h>60000000)throw Error('gif-memory');
  }throw Error('gif-invalid');
 }
 function cropRect(rect,w,h){
  const x=Number(rect?.x),y=Number(rect?.y),width=Number(rect?.width??rect?.size),height=Number(rect?.height??rect?.size);
  if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||x+width>w+.001||y+height>h+.001)throw Error('gif-invalid');
  return {x,y,width,height};
 }
 function sample(canvas,sw,rect,w,h){
  const out=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=4*(Math.floor(rect.y+(y+.5)*rect.height/h)*sw+Math.floor(rect.x+(x+.5)*rect.width/w)),b=4*(y*w+x);out.set(canvas.subarray(a,a+4),b)}return out;
 }
 function convert(buffer,rect,kind='avatar'){
  const bytes=new Uint8Array(buffer),info=sourceInfo(bytes);rect=cropRect(rect,info.width,info.height);
  if(!['avatar','banner'].includes(kind)||Math.abs(rect.width/rect.height-(kind==='banner'?8/3:1))>.01)throw Error('gif-invalid');
  const gif=codec.parseGIF(bytes),frames=gif.frames.filter(f=>f.image);
  const bg=frames[0].gce?.extras.transparentColorGiven?[0,0,0,0]:[...(gif.gct?.[gif.lsd.backgroundColorIndex]||[0,0,0]),255];
  const sizes=kind==='banner'?[320,256,192,160,128]:[160,128,96,80,64];
  for(let attempt=0;attempt<sizes.length;attempt++){
   const w=Math.min(sizes[attempt],Math.max(1,Math.round(rect.width))),h=Math.max(1,Math.round(w*rect.height/rect.width));
   const maxFrames=Math.min([80,60,40,30,24][attempt],Math.floor(24*1024*1024/(w*h*4))),step=Math.max(1,Math.ceil(frames.length/maxFrames));
   const canvas=new Uint8Array(info.width*info.height*4),encoder=codec.GIFEncoder();for(let i=0;i<canvas.length;i+=4)canvas.set(bg,i);let previous=null,restore=null,pending=null,delay=0,overflow=false;
   // Full composited frames permit correct disposal even when frames are sampled.
   const write=()=>{if(!pending)return;const palette=codec.quantize(pending,[96,64,48,32,24][attempt]-1),index=codec.applyPalette(pending,palette),transparentIndex=0;palette.unshift([0,0,0]);let transparent=false;for(let i=0;i<index.length;i++){index[i]++;if(pending[i*4+3]<128){index[i]=transparentIndex;transparent=true}}
    // Reserve transparent index zero on every frame so disposal also clears to
    // transparency after an opaque frame; no black trail on the next frame.
    encoder.writeFrame(index,w,h,{palette,delay,repeat:info.repeat,transparent:true,transparentIndex,dispose:2});overflow=encoder.bytesView().length>134970;
   };
   for(let n=0;n<frames.length;n++){
    if(previous?.disposalType===2){const d=previous.dims;for(let y=d.top;y<d.top+d.height;y++)for(let x=d.left;x<d.left+d.width;x++)canvas.set(bg,4*(y*info.width+x))}
    else if(previous?.disposalType===3&&restore)canvas.set(restore);
    const frame=codec.decompressFrame(frames[n],gif.gct,true);restore=frame.disposalType===3?canvas.slice():null;const d=frame.dims;
    for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){const src=(y*d.width+x)*4;if(frame.patch[src+3])canvas.set(frame.patch.subarray(src,src+4),((y+d.top)*info.width+x+d.left)*4)}
    if(n%step===0){write();if(overflow)break;pending=sample(canvas,info.width,rect,w,h);delay=0}
    delay+=Math.max(20,(frames[n].gce?.delay||10)*10);previous=frame;
   }
   if(overflow)continue;write();if(overflow)continue;encoder.finish();const output=encoder.bytes();if(output.length<=134970)return output;
  }throw Error('gif-size');
 }
 if(typeof module!=='undefined')module.exports={convert,sourceInfo,cropRect,sample};
 else root.onmessage=e=>{try{const output=convert(e.data.buffer,e.data.rect,e.data.kind);root.postMessage({bytes:output.buffer},[output.buffer])}catch(error){root.postMessage({error:/^gif-/.test(error.message)?error.message:'gif-invalid'})}};
})(globalThis);
