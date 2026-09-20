import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.argv[2]||path.join(import.meta.dirname,'..'));
const dataPath=path.join(root,'data.json');
const data=JSON.parse(await fs.readFile(dataPath,'utf8'));
const ITEM_EFFECTS={
  'choice-band':{name:'Choice Band',stage:'attack',category:'physical',modifier:0x1800},
  'choice-specs':{name:'Choice Specs',stage:'attack',category:'special',modifier:0x1800},
  'assault-vest':{name:'Assault Vest',stage:'defense',category:'special',modifier:0x1800},
  'muscle-band':{name:'Muscle Band',stage:'basePower',category:'physical',modifier:0x1199},
  'wise-glasses':{name:'Wise Glasses',stage:'basePower',category:'special',modifier:0x1199},
  'life-orb':{name:'Life Orb',stage:'final',modifier:0x14cc},
  'expert-belt':{name:'Expert Belt',stage:'final',modifier:0x1333,superEffective:true}
};
const TYPE_BOOSTS={
  normal:['silk-scarf','pink-bow','polkadot-bow'],fire:['charcoal','flame-plate'],
  water:['mystic-water','splash-plate','sea-incense','wave-incense'],electric:['magnet','zap-plate'],
  grass:['miracle-seed','meadow-plate','rose-incense'],ice:['never-melt-ice','icicle-plate'],
  fighting:['black-belt','fist-plate'],poison:['poison-barb','toxic-plate'],ground:['soft-sand','earth-plate'],
  flying:['sharp-beak','sky-plate'],psychic:['twisted-spoon','mind-plate','odd-incense'],bug:['silver-powder','insect-plate'],
  rock:['hard-stone','stone-plate','rock-incense'],ghost:['spell-tag','spooky-plate'],dragon:['dragon-fang','draco-plate'],
  dark:['black-glasses','dread-plate'],steel:['metal-coat','iron-plate'],fairy:['fairy-feather','pixie-plate']
};
for(const [type,keys] of Object.entries(TYPE_BOOSTS))for(const key of keys)
  ITEM_EFFECTS[key]={name:key,stage:'basePower',type,modifier:0x1333};
const EXCLUDED=new Set(['focus-sash','white-herb','mental-herb','eject-button','red-card','air-balloon']);
const classify=item=>{
  if(item.category==='berries')return['excluded','一次性果子不纳入静态伤害'];
  if(item.category==='mega-stones')return['excluded','超级石由形态数据处理'];
  if(item.key.endsWith('-seed')||item.key.includes('terrain-seed'))return['excluded','场地种子依赖场地且会消耗'];
  if(item.key.endsWith('-gem')||EXCLUDED.has(item.key))return['excluded','一次性或条件道具不纳入静态伤害'];
  if(ITEM_EFFECTS[item.key])return['applied','固定倍率已按 NCP 阶段计入'];
  return['unsupported','已识别但当前伤害内核未覆盖'];
};
const balanced=(text,start)=>{
  const open=text[start],close=open==='{'?'}':open==='['?']':null;
  let depth=0,string=false,escape=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false}
    else if(c==='"')string=true;
    else if(c===open)depth++;
    else if(c===close&&!--depth)return text.slice(start,i+1);
  }
  return null;
};
const decodeRsc=html=>{
  let text='';
  for(const match of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)){
    try{const value=JSON.parse(match[1]);if(typeof value[1]==='string')text+=value[1]+'\n'}catch{}
  }
  return text.replaceAll('\\"','"').replaceAll('\\u0026','&');
};
const extractItems=text=>{
  const result=new Map();
  for(const match of text.matchAll(/"category":"(?:berries|hold-items|mega-stones)"/g)){
    try{
      const start=text.lastIndexOf('{',match.index);
      const item=JSON.parse(balanced(text,start));
      if(item?.id!=null&&item.key)result.set(`${item.category}:${item.id}`,{
        id:String(item.id),key:item.key,name:item.name||item.key,category:item.category,
        effect:item.effect||'',affectedMoveKeys:item.affectedMoveKeys||[],
        affectedMoveTypeKeys:item.affectedMoveTypeKeys||[],affectedBuffEffectKeys:item.affectedBuffEffectKeys||[],
        regulation:item.regulation||null
      });
    }catch{}
  }
  return result;
};
const ids=[...new Set([...data.profiles.map(profile=>profile.id),...Object.values(data.forms).filter(form=>form.kind==='mega').map(form=>form.id)])];
const catalog=new Map();
let cursor=0;
async function worker(){
  while(cursor<ids.length){
    const id=ids[cursor++];
    const response=await fetch(`https://op.gg/zh-cn/pokemon-champions/pokedex/${id}`);
    if(!response.ok)throw Error(`profile ${id}: HTTP ${response.status}`);
    for(const [key,item] of extractItems(decodeRsc(await response.text())))catalog.set(key,item);
    process.stdout.write(`COLLECT ${cursor}/${ids.length} ${id} (${catalog.size} items)\n`);
  }
}
await Promise.all(Array.from({length:6},worker));
const byId=new Map();
for(const item of catalog.values())if(!byId.has(item.id)||item.category==='hold-items')byId.set(item.id,item);
for(const profile of data.profiles)for(const held of profile.heldItems){
  const item=byId.get(String(held.itemId));
  if(!item)throw Error(`item catalog missing: ${profile.id}/${held.itemId}`);
  const [damageStatus,damageReason]=classify(item);
  Object.assign(held,{itemKey:item.key,itemName:item.name,itemCategory:item.category,itemEffectText:item.effect,damageStatus,damageReason});
}
data.schemaVersion=5;
data.damageCalc={...data.damageCalc,items:{version:1,effects:ITEM_EFFECTS,excludedCategories:['berries','mega-stones','terrain-seed','consumable','conditional-one-use'],policy:'TOP1；固定倍率道具计入；一次性、场地依赖或未覆盖道具不计入',itemCatalog:Object.fromEntries(catalog)}};
const backupDir=path.join(root,'.update','backups');await fs.mkdir(backupDir,{recursive:true});
await fs.copyFile(dataPath,path.join(backupDir,`data.before-items-${Date.now()}.json`));
const temp=`${dataPath}.tmp-${process.pid}`;await fs.writeFile(temp,JSON.stringify(data));await fs.rename(temp,dataPath);
console.log(JSON.stringify({status:'PUBLISHED',schemaVersion:data.schemaVersion,catalog:catalog.size,profiles:data.profiles.length},null,2));
