'use strict';
const CACHE='focus-v75';
const SHELL=['/robot-plates.css','/chat-readability.css','/profile-crop.js','/profile-crop.css','/profile-edit.js','/profile-edit.css','/popup-motion.js','/fonts/bungee.ttf','/fonts/pacifico.ttf','/fonts/chelaone.ttf','/name-fonts.css','/fonts/fredoka.ttf','/fonts/cinzel.ttf','/fonts/space-mono.ttf','/overlay-performance.js','/workspace-performance.css','/theme-controls.css','/profile-model.js','/profile-studio.js','/profile.css','/room-tools.js','/extras.js','/extras-model.js','/extras.css','/cosmetics.js','/cosmetic-store.js','/cosmetics.css','/shop-ui.js','/alarm.js','/desktop-timer.css','/','/index.html','/study.js','/settings.js','/chat.js','/lobby-peer.js','/lobby-model.js','/cloud-model.js','/account.js','/push-client.js','/account-delete.js','/social.js','/social-delete.js','/social-model.js','/social.css','/legal-sheet.js','/community-ui.js','/account-ui.js','/firebase-config.js','/motion.js','/native-session.js','/vendor/peerjs-1.5.5.min.js','/install.js','/mobile-ui.js','/mobile-ui.css','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/gif-media.js','/planner-model.js','/planner-notes.js','/planner-notes.css','/focus-audio.js','/focus-audio.css','/spotify.js','/spotify-callback.js','/spotify-callback.html','/room-activities.js','/room-activities-model.js','/room-activities.css','/fonts/orbitron.ttf','/cosmetic-frames.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('focus-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
const url=new URL(event.request.url);
if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
if(!SHELL.includes(url.pathname))return;
const load=()=>fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}return response});
// Versioned assets are immutable for this release. Avoid a network round-trip
// on every reload; a new release gets new URLs and a fresh cache namespace.
if(event.request.mode!=='navigate'&&url.searchParams.has('v')){
 event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request);if(cached)return cached;return load().catch(async()=>await cache.match(url.pathname)||Response.error())}));return;
}
event.respondWith(load().catch(()=>caches.match(event.request).then(response=>response||(event.request.mode==='navigate'?caches.match('/index.html'):Response.error()))));
});
