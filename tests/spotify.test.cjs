const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{webcrypto,randomUUID}=require('node:crypto');
const key='focus_spotify_session',pending='focus_spotify_pending',tick=()=>new Promise(r=>setImmediate(r));
function response(status=204,data=null){return {status,ok:status>=200&&status<300,headers:{get:()=>null},json:async()=>data}}
function fixture(saved=null,options={}){
 class El{constructor(){this.children=[];this.nodes=new Map();this.hidden=false;this.open=false;this.textContent=''}append(n){this.children.push(n)}querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new El());return this.nodes.get(s)}}
 const host=new El(),events={},docEvents={},storage=new Map(),calls=[],timers=new Map(),profileCalls=[];let uid='admin',seq=0;
 if(saved)storage.set(key,JSON.stringify({...saved,owner:'admin'}));
 const local=options.local||new Map();
 const popup={closed:false,close(){this.closed=true},location:''};
 const ctx={URL,URLSearchParams,TextEncoder,Uint8Array,btoa,Date,crypto:{getRandomValues:a=>webcrypto.getRandomValues(a),randomUUID,subtle:webcrypto.subtle},location:{origin:'https://focusforyou.github.io'},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},FocusAccount:{profile:()=>({uid})},FocusSocial:{getProfile:id=>{profileCalls.push(id);return {username:id==='admin'?'efe':'other'}}},document:{hidden:false,getElementById:()=>host,createElement:()=>new El(),addEventListener:(k,fn)=>docEvents[k]=fn},addEventListener:(k,fn)=>events[k]=fn,open:()=>popup,setTimeout:(fn,delay)=>{timers.set(++seq,{fn,delay});return seq},clearTimeout:id=>timers.delete(id),fetch:async(url,opts)=>{calls.push({url,opts});return ctx.handler?ctx.handler(url,opts):response()}};
 ctx.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};if(options.android)ctx.FocusAndroid=options.android;
 ctx.window=ctx;vm.runInNewContext(fs.readFileSync('spotify.js','utf8'),ctx);
 const panel=host.children[0],get=n=>panel.querySelector('[data-'+n+']');return {ctx,panel,get,popup,events,docEvents,storage,local,calls,timers,profileCalls,setUid:v=>uid=v};
}
test('PKCE exchange requires matching popup origin, source, state and signed-in owner',async()=>{
 const f=fixture();assert.equal(f.panel.hidden,false);assert.equal(f.profileCalls.at(-1),'admin');await f.get('connect').onclick();const req=JSON.parse(f.storage.get(pending)),url=new URL(f.popup.location);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(req.verifier.length,64);assert.equal(url.searchParams.get('state'),req.state);assert(!url.searchParams.has('client_secret'));
 const data={type:'focus-spotify-callback',code:'code',state:req.state};await f.events.message({origin:'https://evil.test',source:f.popup,data});await f.events.message({origin:f.ctx.location.origin,source:{},data});await f.events.message({origin:f.ctx.location.origin,source:f.popup,data:{...data,state:'wrong'}});assert.equal(f.calls.length,0);
 f.ctx.handler=async url=>url.includes('/api/token')?response(200,{access_token:'access',refresh_token:'refresh',expires_in:3600}):response();await f.events.message({origin:f.ctx.location.origin,source:f.popup,data});await tick();assert.equal(f.storage.has(pending),false);assert.equal(JSON.parse(f.storage.get(key)).owner,'admin');const body=f.calls[0].opts.body;assert.equal(body.get('code_verifier'),req.verifier);assert.equal(body.get('grant_type'),'authorization_code');assert.equal(body.has('client_secret'),false);
});
test('disconnect during code exchange cannot resurrect credentials or cross an account switch',async()=>{
 const f=fixture();await f.get('connect').onclick();const request=JSON.parse(f.storage.get(pending));let resolve;f.ctx.handler=()=>new Promise(r=>resolve=r);const finish=f.events.message({origin:f.ctx.location.origin,source:f.popup,data:{type:'focus-spotify-callback',code:'code',state:request.state}});f.ctx.FocusSpotify.disconnect();resolve(response(200,{access_token:'late',refresh_token:'late',expires_in:3600}));await finish;assert.equal(f.storage.has(key),false);assert.equal(f.get('controls').hidden,true);
});
test('refresh rotates access token, retains refresh token and stale logout results are ignored',async()=>{
 const f=fixture({access_token:'old',refresh_token:'refresh',expires:0});let resolve;f.ctx.handler=url=>url.includes('/api/token')?new Promise(r=>resolve=r):response();const update=f.get('refresh').onclick();await tick();f.ctx.FocusSpotify.disconnect();resolve(response(200,{access_token:'new',expires_in:3600}));await update;assert.equal(f.storage.has(key),false);assert.equal(f.calls.filter(c=>c.url.includes('/me/player')).length,0);
 const g=fixture({access_token:'old',refresh_token:'refresh',expires:0});g.ctx.handler=async url=>url.includes('/api/token')?response(200,{access_token:'new',expires_in:3600}):response();await g.get('refresh').onclick();assert.equal(JSON.parse(g.storage.get(key)).refresh_token,'refresh');assert.equal(g.calls[1].opts.headers.Authorization,'Bearer new');
});
test('playback controls use proper API methods and polling stops when hidden or signed out',async()=>{
 const f=fixture({access_token:'access',refresh_token:'refresh',expires:Date.now()+3600000});f.panel.open=true;await f.get('play').onclick();assert.equal(f.calls[0].url,'https://api.spotify.com/v1/me/player/play');assert.equal(f.calls[0].opts.method,'PUT');await f.get('next').onclick();assert.equal(f.calls[1].url,'https://api.spotify.com/v1/me/player/next');assert.equal(f.calls[1].opts.method,'POST');await f.get('prev').onclick();assert.equal(f.calls[2].opts.method,'POST');await f.get('refresh').onclick();assert([...f.timers.values()].some(x=>x.delay===15000));f.ctx.document.hidden=true;f.docEvents.visibilitychange();assert(![...f.timers.values()].some(x=>x.delay===15000));f.setUid('other');f.events['focus-profile']();assert.equal(f.panel.hidden,true);assert.equal(f.storage.has(key),false);
});
test('Spotify callback removes secrets from URL and only messages its same-origin opener',()=>{
 const sent=[],ctx={URLSearchParams,location:{search:'?state=s&code=secret',pathname:'/spotify-callback.html',origin:'https://focusforyou.github.io'},history:{replaceState:(...a)=>sent.push(['history',...a])},document:{getElementById:()=>({})},opener:{postMessage:(data,origin)=>sent.push([data,origin])},close(){}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('spotify-callback.js','utf8'),ctx);assert.equal(sent[0].at(-1),'/spotify-callback.html');assert.equal(sent[1][1],'https://focusforyou.github.io');assert.equal(sent[1][0].code,'secret');
});

test('successful playback commands never parse an empty response body, including HTTP 200 and 202',async()=>{
 for(const status of [200,202,204]){
 const f=fixture({access_token:'access',refresh_token:'refresh',expires:Date.now()+3600000});
 f.ctx.handler=async()=>({...response(status),json:async()=>{throw new SyntaxError('Unexpected end of JSON input')}});
 await f.get('play').onclick();assert.equal(f.get('status').textContent,'Spotify’a gönderildi.');assert.equal(f.get('play').disabled,false);
 await f.get('next').onclick();assert.equal(f.get('status').textContent,'Spotify’a gönderildi.');
 await f.get('prev').onclick();assert.equal(f.get('status').textContent,'Spotify’a gönderildi.');
 }
});
test('playback errors remain visible instead of being treated as successful commands',async()=>{
 const f=fixture({access_token:'access',refresh_token:'refresh',expires:Date.now()+3600000});f.ctx.handler=async()=>response(404);await f.get('play').onclick();assert.match(f.get('status').textContent,/bir şarkı aç/);
});

test('Android authorizes in browser, keeps pending PKCE across restart and exchanges only its matching callback',async()=>{
 const links=[],acks=[];let ready=0;const android={spotifyConnect:url=>links.push(url),spotifyReady:()=>ready++,spotifyCancel(){},spotifyAck:state=>acks.push(state)};
 const f=fixture(null,{android});assert.equal(f.panel.hidden,false);await f.get('connect').onclick();assert.equal(f.popup.location,'');
 const req=JSON.parse(f.local.get('focus_spotify_native_pending')),url=new URL(links[0]);assert.match(req.state,/^android_/);assert.equal(url.searchParams.get('redirect_uri'),'https://focusforyou.github.io/spotify-callback.html');assert.equal(ready,1);
 const g=fixture(null,{android,local:f.local});g.ctx.handler=async url=>url.includes('/api/token')?response(200,{access_token:'native',refresh_token:'refresh',expires_in:3600}):response();
 await g.ctx.FocusSpotifyNativeResult({type:'focus-spotify-callback',state:'wrong',code:'code'});assert.equal(g.calls.length,0);
 await g.ctx.FocusSpotifyNativeResult({type:'focus-spotify-callback',state:req.state,code:'code'});await tick();assert.equal(g.local.has('focus_spotify_native_pending'),false);assert.equal(JSON.parse(g.storage.get(key)).access_token,'native');assert.equal(acks[0],req.state);
 await g.ctx.FocusSpotifyNativeResult({type:'focus-spotify-callback',state:req.state,code:'code'});assert.equal(g.calls.filter(x=>x.url.includes('/api/token')).length,1);
});
test('Android logout cancels pending connection and old APK explains the required update',async()=>{
 let canceled=0;const f=fixture(null,{android:{spotifyConnect(){},spotifyReady(){},spotifyCancel(){canceled++}}});await f.get('connect').onclick();assert(f.local.has('focus_spotify_native_pending'));f.setUid('');f.events['focus-profile']();assert.equal(f.local.has('focus_spotify_native_pending'),false);assert.equal(f.panel.hidden,true);assert(canceled>0);
 const g=fixture(null,{android:{}});await g.get('connect').onclick();assert.match(g.get('status').textContent,/güncelle/);assert.equal(g.popup.location,'');
});
test('Android callback page supplies package-scoped app return without tokens or PKCE verifier',()=>{
 const link={},status={},ctx={URLSearchParams,location:{search:'?state=android_12345678901234567890&code=shortcode',pathname:'/spotify-callback.html',origin:'https://focusforyou.github.io'},history:{replaceState(){}},document:{getElementById:id=>id==='returnApp'?link:status},close(){throw Error('Do not close before user returns')}};ctx.window=ctx;vm.runInNewContext(fs.readFileSync('spotify-callback.js','utf8'),ctx);assert.equal(link.hidden,false);assert.match(link.href,/package=io.github.focusforyou.app/);assert.match(link.href,/code=shortcode/);assert(!link.href.includes('token'));assert(!link.href.includes('verifier'));
});
