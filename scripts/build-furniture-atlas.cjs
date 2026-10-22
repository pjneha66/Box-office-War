/* Kenney Furniture Kit 2.0, CC0. Sources and unchanged license live alongside atlas. */
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
(async()=>{const root=path.resolve(__dirname,'../assets/vendor/kenney-furniture'),files=fs.readdirSync(root).filter(n=>n.endsWith('.png')&&!n.startsWith('atlas')).sort(),tiles=[],frames={};
for(let i=0;i<files.length;i++){const x=i%5*128,y=Math.floor(i/5)*128;tiles.push({input:await sharp(path.join(root,files[i])).trim().resize(124,124,{fit:'inside'}).extend({top:2,bottom:2,left:2,right:2,background:'#00000000'}).resize(128,128,{fit:'contain',position:'south',background:'#00000000'}).png().toBuffer(),left:x,top:y});frames[files[i].replace('.png','')]={x,y,w:128,h:128};}
await sharp({create:{width:640,height:Math.ceil(files.length/5)*128,channels:4,background:'#00000000'}}).composite(tiles).png().toFile(path.join(root,'atlas.png'));fs.writeFileSync(path.join(root,'atlas.json'),JSON.stringify(frames,null,2)+'\n');
// Keep runtime rectangles in sync when adding/removing licensed source sprites.
const renderer=path.resolve(__dirname,'../studio-departments.js');
fs.writeFileSync(renderer,fs.readFileSync(renderer,'utf8').replace(/const furnitureFrames=\{[^\n]+\};/,'const furnitureFrames='+JSON.stringify(frames)+';'));
const cars=path.resolve(__dirname,'../assets/vendor/kenney-cars');
for(const name of ['delivery_SE','sedanSports_SE'])await sharp(path.join(cars,name+'.png')).trim().resize({width:144}).png().toFile(path.join(cars,name+'-trim.png'));
console.log('Built '+files.length+' furniture sprites and two vehicle derivatives.');})();
