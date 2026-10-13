const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../vendor/gif-codec.js'),W=require('../gif-crop-worker.js'),M=require('../gif-media.js'),G=require('../profile-crop.js');
function fixture(count=3,w=4,h=4){const gif=C.GIFEncoder();for(let n=0;n<count;n++){const index=new Uint8Array(w*h);index.fill(n%2?2:1);if(n===2)index.fill(0);gif.writeFrame(index,w,h,{palette:[[0,0,0],[255,0,0],[0,0,255]],transparent:true,transparentIndex:0,delay:[100,200,300][n%3],repeat:2,dispose:2})}gif.finish();return gif.bytes()}
test('animated crop retains frames, timing, repeat count, transparent pixels and cloud limits',()=>{
 const input=fixture(),result=W.convert(input,{x:1,y:1,width:2,height:2},'avatar'),meta=M.inspect(result,'avatar'),parsed=C.parseGIF(result),frames=C.decompressFrames(parsed,true);
 assert.equal(meta.frames,3);assert.equal(meta.width,2);assert.equal(meta.height,2);assert.equal(W.sourceInfo(result).repeat,2);
 assert.deepEqual(frames.map(f=>f.delay),[100,200,300]);assert.deepEqual([...frames[0].patch.slice(0,4)],[255,0,0,255]);assert.deepEqual([...frames[1].patch.slice(0,4)],[0,0,255,255]);assert.equal(frames[2].patch[3],0);
 assert.ok(result.length<=134970);assert.ok(M.valid('data:image/gif;base64,'+Buffer.from(result).toString('base64'),'avatar'));
 const again=C.decompressFrames(C.parseGIF(W.convert(result,{x:0,y:0,width:2,height:2})),true);assert.equal(again[2].patch[3],0,'opaque-to-transparent transitions must not leave a black background');
});
test('long GIF is sampled within decode budget while keeping total animation duration',()=>{
 const input=fixture(150,16,16),result=W.convert(input,{x:0,y:0,width:16,height:16}),frames=C.decompressFrames(C.parseGIF(result),true);
 assert.ok(frames.length>1&&frames.length<=80);assert.equal(frames.reduce((a,f)=>a+f.delay,0),30000);assert.equal(W.sourceInfo(result).repeat,2);
});
test('crop rectangles stay inside image in portrait and landscape banner layouts',()=>{
 for(const [w,h]of [[1200,800],[800,1200]])for(const zoom of [1,2,4])for(const [x,y]of [[-100,1e5],[w/2,h/2]]){const r=G.rectangle(w,h,8/3,zoom,x,y);assert.ok(r.x>=0&&r.y>=0);assert.ok(r.x+r.width<=w+.001&&r.y+r.height<=h+.001);assert.equal(r.width/r.height,8/3)}
 for(const r of [{x:-1,y:0,size:2},{x:0,y:0,size:8},{x:NaN,y:0,size:2}])assert.throws(()=>W.convert(fixture(),r));
});
test('invalid or excessive GIF data is rejected before frame decompression',()=>{
 const input=fixture();assert.throws(()=>W.sourceInfo(input.slice(0,-1)));const big=input.slice();big[6]=255;big[7]=255;assert.throws(()=>W.sourceInfo(big),/gif-dimensions/);assert.throws(()=>W.sourceInfo(fixture(301,1,1)),/gif-memory/);
});
test('restore previous disposal preserves pixels outside the next small patch',()=>{
 const gif=C.GIFEncoder(),palette=[[0,0,0],[255,0,0],[0,255,0],[0,0,255],[255,255,255]];
 gif.writeFrame(Uint8Array.from([1,2,1,2]),2,2,{palette,delay:100,repeat:0,dispose:1});
 gif.writeFrame(Uint8Array.from([3]),1,1,{palette,delay:100,dispose:3});
 gif.writeFrame(Uint8Array.from([4]),1,1,{palette,delay:100,dispose:1});gif.finish();
 const bytes=gif.bytes();let images=0;
 // Move the third patch to the right without altering its compressed pixels.
 for(let i=0;i<bytes.length;i++)if(bytes[i]===44&&bytes[i+5]===1&&bytes[i+6]===0&&bytes[i+7]===1&&bytes[i+8]===0){if(++images===2){bytes[i+1]=1;break}}
 const result=W.convert(bytes,{x:0,y:0,width:2,height:2},'avatar'),frames=C.decompressFrames(C.parseGIF(result),true);
 assert.deepEqual([...frames[1].patch.slice(0,4)],[0,0,255,255]);assert.deepEqual([...frames[2].patch.slice(0,8)],[255,0,0,255,255,255,255,255]);
 assert.throws(()=>W.convert(bytes,{x:0,y:0,width:1,height:2},'avatar'),/gif-invalid/);
});
test('complex banner is automatically reduced to the existing cloud size limit',()=>{
 const gif=C.GIFEncoder(),palette=Array.from({length:64},(_,n)=>[n*4,(n*17)%256,(n*41)%256]);let seed=7;
 for(let n=0;n<40;n++){const pixels=new Uint8Array(240*90);for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=seed>>>26}gif.writeFrame(pixels,240,90,{palette,delay:100,repeat:0})}gif.finish();
 const output=W.convert(gif.bytes(),{x:0,y:0,width:240,height:90},'banner');assert.ok(output.length<=134970);const info=M.inspect(output,'banner');assert.ok(info.width<240);assert.ok(info.frames>1);assert.equal(C.decompressFrames(C.parseGIF(output)).reduce((a,f)=>a+f.delay,0),4000);
});
