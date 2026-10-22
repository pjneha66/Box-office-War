'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');process.chdir(root);
const env={self:{addEventListener(){}},globalThis:{}};
vm.runInNewContext(fs.readFileSync('sw.js','utf8')+'\nglobalThis.assets=ASSETS;',env);
const assets=env.globalThis.assets;
for(const name of assets)if(name!=='./')assert(fs.existsSync(name),'Missing offline asset '+name);
const html=fs.readFileSync('index.html','utf8'),native=fs.readFileSync('apk/www/index.html','utf8');
for(const m of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))/g)){
 if(m[1].startsWith('http'))continue;assert(assets.includes(m[1]),'Not precached '+m[1]);assert(fs.existsSync('apk/www/'+m[1]),'Missing APK '+m[1]);
 assert.equal(fs.readFileSync('apk/www/'+m[1],'utf8'),fs.readFileSync(m[1],'utf8'),'Stale APK '+m[1]);
 const staged='apk/android/app/src/main/assets/public/'+m[1];
 if(fs.existsSync('apk/android/app/src/main/assets/public'))assert.equal(fs.readFileSync(staged,'utf8'),fs.readFileSync(m[1],'utf8'),'Stale Capacitor native module '+m[1]);
}
for(const name of fs.readdirSync('assets/studio',{recursive:true}).filter(n=>fs.statSync('assets/studio/'+n).isFile())){
 const relative='assets/studio/'+name;assert(assets.includes(relative),'Offline manifest '+relative);
 assert(fs.readFileSync(relative).equals(fs.readFileSync('apk/www/'+relative)),'Stale APK art '+name);
 const staged='apk/android/app/src/main/assets/public/'+relative;
 if(fs.existsSync('apk/android/app/src/main/assets/public'))assert(fs.readFileSync(relative).equals(fs.readFileSync(staged)),'Stale Capacitor native art '+name);
}
if(fs.existsSync('apk/android/app/src/main/assets/public'))assert.equal(fs.readFileSync('apk/android/app/src/main/assets/public/index.html','utf8'),native,'Stale Capacitor native HTML');
for(const relative of ['assets/vendor/kenney-cars/delivery_SE-trim.png','assets/vendor/kenney-cars/sedanSports_SE-trim.png','assets/vendor/kenney-furniture/atlas.png','assets/vendor/kenney-furniture/atlas.json','assets/vendor/kenney-nature/tree_palmDetailedTall_SE-trim.png','assets/vendor/kenney-nature/plant_bushDetailed_SE-trim.png']){
 assert(assets.includes(relative),'Vendor asset not precached '+relative);
 for(const staging of ['apk/www/','apk/android/app/src/main/assets/public/'])if(fs.existsSync(staging))assert(fs.readFileSync(relative).equals(fs.readFileSync(staging+relative)),'Stale vendor art '+staging+relative);
}
const atlas=fs.readFileSync('assets/vendor/kenney-furniture/atlas.png'),frames=JSON.parse(fs.readFileSync('assets/vendor/kenney-furniture/atlas.json','utf8'));
assert.equal(atlas.readUInt32BE(16),640);const atlasHeight=Math.ceil(Object.keys(frames).length/5)*128;assert.equal(atlas.readUInt32BE(20),atlasHeight);
const runtimeFrames=JSON.parse(fs.readFileSync('studio-departments.js','utf8').match(/const furnitureFrames=(\{[^\n]+\});/)[1]);
assert.deepEqual(runtimeFrames,frames,'Runtime furniture atlas metadata drift');
for(const frame of Object.values(frames)){assert(frame.x>=0&&frame.y>=0&&frame.x+frame.w<=640&&frame.y+frame.h<=atlasHeight);}
for(const pack of ['kenney-furniture','kenney-nature','kenney-cars'])assert(fs.readFileSync('assets/vendor/'+pack+'/License.txt','utf8').includes('CC0'),'Missing CC0 license '+pack);
const storyPNG=fs.readFileSync('assets/studio/story-furniture.png'),storyFrames=JSON.parse(fs.readFileSync('assets/studio/story-furniture.json','utf8'));
assert.equal(storyPNG.readUInt32BE(16),640);assert.equal(storyPNG.readUInt32BE(20),384);
assert.equal(Object.keys(storyFrames).length,13);
assert.deepEqual(JSON.parse(fs.readFileSync('studio-departments.js','utf8').match(/const storyFrames=(\{[^\n]+\});/)[1]),storyFrames);
for(const f of Object.values(storyFrames))assert(f.x>=0&&f.y>=0&&f.x+f.w<=640&&f.y+f.h<=384&&f.ax===64&&f.ay===98);
assert(!native.includes('navigator.serviceWorker.register'));console.log('PASS offline manifest, web/APK file parity, original art packaging and native staging (when present)');
