const fs=await import('node:fs/promises'),path=await import('node:path'),crypto=await import('node:crypto');
const root=path.resolve(process.argv[2]||path.join(import.meta.dirname,'..'));
const file=process.argv[3]?path.resolve(process.argv[3]):path.join(root,'data.json');
const text=await fs.readFile(file,'utf8'),d=JSON.parse(text),fail=m=>{throw Error(m)};
const cdn=u=>{try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='s-stats-platform-cdn.op.gg'&&/\.(png|webp|avif|svg)$/i.test(x.pathname)}catch{return false}};
const speed=(base,points,alignment)=>Math.floor((base+points+20)*({raised:110,neutral:100,lowered:90}[alignment]||0)/100);
if(d.schemaVersion!==5||d.sourceMode!=='double'||d.damageCalc?.generation!==10||d.damageCalc?.sourceCommit!=='1369b359b85f0a6343df006acde92cc4a7d07805'||!d.damageCalc?.items?.effects||!d.damageCalc?.items?.itemCatalog||d.modes?.double?.profileField!=='profiles'||d.modes?.single?.profileField!=='singleProfiles'||d.modes?.single?.implemented!==false||typeof d.source!=='string'||typeof d.updated!=='string')fail('expected schema v5 dual-mode damage metadata');
if(!Array.isArray(d.profiles)||d.profiles.length!==50||new Set(d.profiles.map(x=>x.id)).size!==50)fail('expected 50 unique doubles profiles');
if(!Array.isArray(d.singleProfiles)||d.singleProfiles.length!==50||new Set(d.singleProfiles.map(x=>x.id)).size!==50||d.singleProfiles.some(x=>x.sourceMode!=='single'))fail('expected 50 unique singles profiles');
if(d.profiles.map(x=>x.rank).sort((a,b)=>a-b).some((x,i)=>x!==i+1))fail('ranks must be 1..50');
if(!d.forms||!d.typeIcons||!d.typeColors)fail('forms/type metadata missing');
const typeKeys=Object.keys(d.typeIcons).sort();
if(typeKeys.length!==18||JSON.stringify(typeKeys)!==JSON.stringify(Object.keys(d.typeColors).sort()))fail('expected matching 18 type icons/colors');
for(const type of typeKeys)if(!cdn(d.typeIcons[type])||!/^#[0-9a-f]{6}$/i.test(d.typeColors[type]))fail(`invalid type metadata: ${type}`);
const byId=new Map(d.profiles.map(x=>[x.id,x]));
for(const p of d.profiles){
 if(p.id!==p.slug||p.sourceMode!=='double'||!cdn(p.image)||p.battleStatsGroup!==p.id||!Number.isInteger(p.baseSpeed))fail(`invalid profile: ${p.name}`);
 for(const [key,count] of Object.entries({moves:10,heldItems:10,natures:10,statPoints:30,teammates:10,beats:30,loses:30,winMoves:10,lossMoves:10}))if(p[key]?.length!==count)fail(`${p.name} ${key}: expected ${count}`);
 for(const item of p.heldItems){if(!item.itemKey||!item.itemName||!item.itemCategory||!['applied','excluded','unsupported'].includes(item.damageStatus)||!item.damageReason)fail(`${p.name}: invalid held item mapping ${item.itemId}`);const catalog=Object.values(d.damageCalc.items.itemCatalog).find(x=>x.id===String(item.itemId)&&x.key===item.itemKey);if(!catalog)fail(`${p.name}: orphan held item ${item.itemKey}`);if(item.damageStatus==='applied'&&!d.damageCalc.items.effects[item.itemKey])fail(`${p.name}: applied item lacks effect ${item.itemKey}`)}
 if(!Array.isArray(p.abilities)||!p.abilities.length||!Array.isArray(p.formIds)||!p.formIds.length)fail(`${p.name}: abilities/forms missing`);
 for(const list of ['beats','loses','teammates'])for(const x of p[list])if(!x.targetId||!x.href?.endsWith('/'+x.targetId))fail(`${p.name}: invalid ${list} target`);
 for(const m of [...p.moves,...p.winMoves,...p.lossMoves])if(!m.move||m.move==='NEW'||!m.href||!m.type||!cdn(m.typeIcon)||!['物理','特殊','状态'].includes(m.category))fail(`${p.name}: invalid move`);
 const points=p.statPoints[0],nature=p.natures[0],alignment=nature.statUp==='速度'?'raised':nature.statDown==='速度'?'lowered':'neutral';
 if(p.speedEstimate?.speedStatPoints!==points.speed||p.speedEstimate?.alignment!==alignment||p.speedEstimate?.value!==speed(p.baseSpeed,points.speed,alignment)||p.speedEstimate?.independentTopRows!==true)fail(`${p.name}: invalid speed estimate`);
 for(const id of p.formIds){const f=d.forms[id];if(!f||f.speciesId!==p.id||f.battleStatsGroup!==p.id||!Number.isInteger(f.baseSpeed)||!cdn(f.image)||!f.ncpName||!Number.isFinite(f.weight)||!f.ncpAbility||!f.baseStats||['hp','attack','defense','spAttack','spDefense','speed'].some(k=>!Number.isInteger(f.baseStats[k])))fail(`${p.name}: invalid combat form ${id}`)}
 if(!p.abilities[0]?.ncpName)fail(`${p.name}: TOP1 ability unmapped`);
 for(const m of [...p.winMoves,...p.lossMoves]){const slug=m.href.split('/').pop(),dm=d.damageCalc.moves?.[slug];if(!dm||!dm.ncpName||!dm.category||!dm.type)fail(`${p.name}: damage move unmapped ${slug}`)}
}
for(const [id,f] of Object.entries(d.forms))if(id!==f.id||!byId.get(f.speciesId)?.formIds.includes(id))fail(`orphan form: ${id}`);
const mega=Object.values(d.forms).filter(x=>x.kind==='mega'),parents=new Set(mega.map(x=>x.speciesId));
if(mega.length!==29||parents.size!==24||d.profiles.filter(x=>x.formIds.length>2).length!==5)fail(`Mega coverage regression: ${mega.length}/${parents.size}`);
for(const id of ['mega-salamence','mega-lucario','mega-lucario-z','mega-charizard-x','mega-charizard-y','mega-absol-z','mega-raichu-y','mega-garchomp-z'])if(!d.forms[id])fail(`Mega missing: ${id}`);
const g=byId.get('gholdengo'),s=byId.get('sneasler');
if(g.beats[0]?.targetId!=='sneasler'||g.loses.find(x=>x.targetId==='sneasler')?.rank!==24||s.loses.find(x=>x.targetId==='gholdengo')?.rank!==5)fail('doubles matchup regression: Gholdengo/Sneasler');
if(speed(123,32,'raised')!==192)fail('speed formula benchmark failed');
console.log(JSON.stringify({status:'VALID',schemaVersion:d.schemaVersion,sourceMode:d.sourceMode,file,updated:d.updated,doubleProfiles:d.profiles.length,singleProfiles:d.singleProfiles.length,forms:Object.keys(d.forms).length,megaForms:mega.length,megaParents:parents.size,datasetSha256:crypto.createHash('sha256').update(text).digest('hex')},null,2));
