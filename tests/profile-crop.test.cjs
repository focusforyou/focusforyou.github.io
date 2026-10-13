const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../profile-crop.js');
test('portrait and landscape crop fit the image and stay square at every edge',()=>{
 for(const [w,h] of [[2400,800],[800,2400],[900,900]])for(const zoom of [0,1,2,4,99])for(const [x,y] of [[-100,-200],[1e6,1e6],[w/2,h/2]]){
  const crop=C.geometry(w,h,zoom,x,y);assert.ok(crop.x>=0&&crop.y>=0);assert.ok(crop.x+crop.size<=w&&crop.y+crop.size<=h);assert.ok(crop.zoom>=1&&crop.zoom<=4);
 }
 assert.deepEqual(C.geometry(1200,800),{x:200,y:0,size:800,cx:600,cy:400,zoom:1});
});
test('invalid image dimensions and oversized or executable files are rejected',()=>{
 for(const [w,h] of [[0,1],[-1,2],[Infinity,3],[NaN,1]])assert.throws(()=>C.geometry(w,h));
 for(const file of [{type:'image/svg+xml',size:10},{type:'image/jpeg',size:21*1024*1024},{type:'image/png',size:0},null])assert.throws(()=>C.validate(file));
 assert.equal(C.validate({type:'image/png',size:20*1024*1024}).size,20*1024*1024);
});
test('GIF identification preserves animations rather than silently encoding a still',()=>{
 assert.equal(C.isGif({type:'image/gif',name:'a'}),true);assert.equal(C.isGif({type:'image/png',name:'A.GIF'}),true);assert.equal(C.isGif({type:'image/png',name:'a.png'}),false);
});
test('JPEG encoding lowers quality to respect the cloud limit and rejects unusable output',()=>{
 const seen=[];const output=C.encode({toDataURL:(type,q)=>{seen.push(q);assert.equal(type,'image/jpeg');return 'data:image/jpeg;base64,'+'A'.repeat(q>.6?50000:1000)}});
 assert.ok(output.length<=40000);assert.deepEqual(seen,[.88,.76,.6]);
 assert.throws(()=>C.encode({toDataURL:()=> 'data:image/png;base64,AAAA'}));
 assert.throws(()=>C.encode({toDataURL:()=> 'data:image/jpeg;base64,'+'A'.repeat(50000)}));
});

