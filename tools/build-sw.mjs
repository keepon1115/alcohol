import fs from "node:fs";
import crypto from "node:crypto";
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(d + "/" + e.name) : [d + "/" + e.name],
    );
const files = walk("app").filter((p) => !p.endsWith("/sw.js"));
const version = crypto
  .createHash("sha256")
  .update(files.map((f) => fs.readFileSync(f)).join(""))
  .digest("hex")
  .slice(0, 12);
fs.writeFileSync(
  "app/sw.js",
  `const CACHE='tankyu-alcohol-${version}';const ASSETS=${JSON.stringify(["./", ...files.map((f) => "./" + f.slice(4))])};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'}))))));self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('tankyu-alcohol-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(new URL('./',location.href).pathname))return;e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(e.request,{ignoreSearch:true})||await fetch(e.request).catch(async err=>{if(e.request.mode==='navigate')return await c.match('./index.html');throw err;});})());});`,
);
