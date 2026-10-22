"""One-time, pinned upstream import. Requires gh; runtime/builds use checked-in files.
Itch discovery: https://pflat.itch.io/lpc-character-generator (LPC ecosystem).
Art is sourced from ElizaWy/LPC, NOT pflat's executable or music/UI.
"""
import base64, concurrent.futures, json, subprocess, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/vendor/lpc-revised';OUT.mkdir(parents=True,exist_ok=True)
def api(path):return json.loads(subprocess.check_output(['gh','api',path]))
if (OUT/'sources.json').exists():
 data=json.loads((OUT/'sources.json').read_text());commit=data['commit'];profiles=data['profiles'];entries=data['files']
else:
 commit=api('repos/ElizaWy/LPC/commits/main')['sha']
 # Query subtrees independently; the repository-wide recursive tree is truncated.
 base=api('repos/ElizaWy/LPC/contents/Characters?ref='+commit)
 paths={}
 for folder in ['Body','Head','Clothing','Hair']:
  sha=next(x['sha'] for x in base if x['name']==folder)
  tree=api('repos/ElizaWy/LPC/git/trees/'+sha+'?recursive=1');assert not tree['truncated']
  paths.update({'Characters/'+folder+'/'+x['path']:x['sha'] for x in tree['tree'] if x['type']=='blob'})
 animations=['Idle','Walk','Sitting'];profiles=[];needed=set()
 hairs=['Short 02 - Parted','Medium 04 - Bangs & Bun','Short 05 - Natural','Medium 02 - Curly','Short 06 - Balding','Medium 06 - Dreadlocks','Short 07 - Flat Top','Medium 07 - Bob, Side Part']
 skins=['Honey','Bronze','Peach','Coffee','Ivory','Brown'];shirts=['Shirt 07 - Buttoned Longsleeve Shirt','Shirt 04 - T-shirt','Shirt 09 - Polo','Shirt 02 - V-neck Longsleeve Shirt'];colors=['Denim','Fern','Wine','Linen','Charcoal','Ochre']
 for i in range(24):
  form='Feminine, Thin' if i%2 else 'Masculine, Thin';skin=skins[(i//2)%6]
  body='Body 01 - '+form if i%2 else 'Body 02 - '+form
  head='Head 03 - Elderly' if i in [4,12,20] else 'Head 01 - Feminine' if i%2 else 'Head 02 - Masculine'
  layers=['Characters/Body/'+body+'/'+skin,'Characters/Clothing/'+form+'/Legs/Pants 03 - Pants/'+['Charcoal','Denim','Umber'][i%3], 'Characters/Clothing/'+form+'/Feet/Shoes 01 - Shoes/Black','Characters/Clothing/'+form+'/Torso/'+shirts[(i//2)%4]+'/'+colors[(i//4+i%2)%6], 'Characters/Head/'+head+'/'+skin,'Characters/Hair/'+hairs[i%8]+'/'+['Black','Ash Brown','Blonde','Gray'][(i//6)%4]]
  profile={'id':i,'form':form,'skin':skin,'hair':hairs[i%8],'layers':{}}
  for animation in animations:
   files=[p+'/'+animation+'.png' for p in layers]
   for p in files:assert p in paths,p
   needed.update(files);profile['layers'][animation]=files
  profiles.append(profile)
 entries={p:{'sha':paths[p],'local':'source/'+str(i).zfill(3)+'.png'} for i,p in enumerate(sorted(needed))}
 for p in ['Characters/Credits.txt','Characters/Clothing/Credits.txt','Characters/Hair/Credits.txt','README.md']:
  x=api('repos/ElizaWy/LPC/contents/'+p+'?ref='+commit);entries[p]={'sha':x['sha'],'local':p.replace('/','-')}
 data={'repository':'https://github.com/ElizaWy/LPC','commit':commit,'discoveredVia':'https://pflat.itch.io/lpc-character-generator','license':'OGA-BY 3.0','profiles':profiles,'files':entries}
 (OUT/'sources.json').write_text(json.dumps(data,indent=2)+'\n')
def download(item):
 p,entry=item;dest=OUT/entry['local']
 if dest.exists():return
 dest.parent.mkdir(parents=True,exist_ok=True)
 blob=api('repos/ElizaWy/LPC/git/blobs/'+entry['sha']);dest.write_bytes(base64.b64decode(blob['content']))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(download,entries.items()))
print('Imported',len(entries),'pinned LPC layers/credits for',len(profiles),'character looks at',commit)
