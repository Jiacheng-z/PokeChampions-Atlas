/* Pokémon Champions damage subset derived from NCP Damage Calculator (MIT), commit 1369b359b85f0a6343df006acde92cc4a7d07805. See THIRD_PARTY_NOTICES.md. */
(()=>{
  'use strict';

  const MOD=0x1000;
  const normalize=value=>String(value||'').trim().toLowerCase();
  const pokeRound=value=>value%1>.5?Math.ceil(value):Math.floor(value);
  const chainMods=mods=>mods.reduce(
    (value,modifier)=>modifier===MOD?value:Math.round(value*modifier/MOD),
    MOD
  );
  const percent=value=>Math.round(value*10)/10;

  function stat(base,points,nature,key,hp=false){
    if(hp)return base===1?1:Math.floor((base*2+31)*.5)+60+points;
    const multiplier=
      nature?.statUp===key?1.1:
      nature?.statDown===key?0.9:
      1;
    return Math.floor((Math.floor((base*2+31)*.5)+5+points)*multiplier);
  }

  function build(profile,form,itemRules={}){
    const stats=form.baseStats;
    const points=profile.statPoints[0];
    const nature=profile.natures[0];
    const profileAbility=profile.abilities[0]?.ncpName||'';
    const formHasFixedAbility=form.kind==='mega'&&form.ncpAbility;
    const ability=formHasFixedAbility?form.ncpAbility:profileAbility||form.ncpAbility||'';
    const topItem=profile.heldItems?.[0]||null;
    const itemKey=topItem?.itemKey||'';
    const itemEffect=itemRules.effects?.[itemKey]||null;

    return {
      name:form.name,
      id:form.id,
      types:(form.types||[]).map(normalize),
      weight:form.weight,
      ability,
      abilitySource:formHasFixedAbility?'form':'profile',
      itemKey,
      itemName:topItem?.itemName||itemEffect?.name||'',
      itemStatus:topItem?.damageStatus||'none',
      itemReason:topItem?.damageReason||'',
      itemEffect:topItem?.damageStatus==='applied'?itemEffect:null,
      level:50,
      maxHP:stat(stats.hp,points.hp,nature,'hp',true),
      attack:stat(stats.attack,points.attack,nature,'攻击'),
      defense:stat(stats.defense,points.defense,nature,'防御'),
      spAttack:stat(stats.spAttack,points.spAttack,nature,'特攻'),
      spDefense:stat(stats.spDefense,points.spDefense,nature,'特防'),
      nature:nature.name,
      points
    };
  }

  function effectiveness(type,types,chart){
    return types.reduce((value,targetType)=>value*(chart[type]?.[targetType]??1),1);
  }

  function transform(move,attacker){
    let type=normalize(move.type);
    const category=normalize(move.category);
    let boosted=false;
    const conversions={
      Aerilate:'flying',
      Pixilate:'fairy',
      Refrigerate:'ice',
      Galvanize:'electric',
      Dragonize:'dragon'
    };

    if(attacker.ability==='Liquid Voice'&&move.mechanics?.isSound)type='water';
    else if(attacker.ability==='Normalize'){
      type='normal';
      boosted=true;
    }else if(type==='normal'&&conversions[attacker.ability]){
      type=conversions[attacker.ability];
      boosted=true;
    }

    return {...move,type,category,boosted};
  }

  function isImmune(defender,move){
    const ability=defender.ability;
    const type=move.type;
    if((ability==='Levitate'||ability==='Eelevate')&&type==='ground')return true;
    if(ability==='Flash Fire'&&type==='fire')return true;
    if(['Water Absorb','Dry Skin','Storm Drain'].includes(ability)&&type==='water')return true;
    if(['Volt Absorb','Lightning Rod','Motor Drive'].includes(ability)&&type==='electric')return true;
    if(ability==='Sap Sipper'&&type==='grass')return true;
    if(ability==='Earth Eater'&&type==='ground')return true;
    if(ability==='Soundproof'&&move.mechanics?.isSound)return true;
    if(ability==='Bulletproof'&&move.mechanics?.isBullet)return true;
    return false;
  }

  function movePower(move,attacker,defender){
    if(move.ncpName==='Eruption'||move.ncpName==='Water Spout')return 150;
    if(move.ncpName==='Low Kick'||move.ncpName==='Grass Knot'){
      const weight=defender.weight;
      return weight>=200?120:weight>=100?100:weight>=50?80:weight>=25?60:weight>=10?40:20;
    }
    if(move.ncpName==='Last Respects')return 50;
    if(move.ncpName==='Weather Ball')return 50;
    if(move.ncpName==='Expanding Force')return 80;
    if(move.ncpName==='Knock Off')return move.power;
    if(move.ncpName==='Final Gambit')return 0;
    return move.power;
  }

  function basePowerMods(attacker,move,basePower){
    const mods=[];
    if(move.boosted)mods.push(0x1333);
    if(attacker.ability==='Iron Fist'&&move.mechanics?.isPunch)mods.push(0x1333);
    if(attacker.ability==='Reckless'&&(move.mechanics?.hasRecoil||move.mechanics?.recoilHP))mods.push(0x1333);
    if(attacker.ability==='Sheer Force'&&move.mechanics?.hasSecondaryEffect)mods.push(0x14cd);
    if(attacker.ability==='Tough Claws'&&move.mechanics?.makesContact)mods.push(0x14cd);
    if(attacker.ability==='Punk Rock'&&move.mechanics?.isSound)mods.push(0x14cd);
    if(attacker.itemEffect?.stage==='basePower'&&(
      !attacker.itemEffect.category||attacker.itemEffect.category===move.category
    )&&(
      !attacker.itemEffect.type||attacker.itemEffect.type===move.type
    ))mods.push(attacker.itemEffect.modifier);

    const interim=pokeRound(basePower*chainMods(mods)/MOD);
    if(attacker.ability==='Technician'&&interim<=60)mods.push(0x1800);
    if(attacker.ability==='Mega Launcher'&&move.mechanics?.isPulse)mods.push(0x1800);
    if(attacker.ability==='Strong Jaw'&&move.mechanics?.isBite)mods.push(0x1800);
    return Math.max(1,pokeRound(basePower*chainMods(mods)/MOD));
  }

  function attackMods(attacker,move){
    const mods=[];
    if(attacker.ability==='Hustle'&&move.category==='physical')mods.push(0x1800);
    if(['Huge Power','Pure Power'].includes(attacker.ability)&&move.category==='physical')mods.push(0x2000);
    if(attacker.ability==="Dragon's Maw"&&move.type==='dragon')mods.push(0x1800);
    if(attacker.ability==='Fire Mane'&&move.type==='fire')mods.push(0x1800);
    if(attacker.ability==='Sharpness'&&move.mechanics?.isSlice)mods.push(0x1800);
    if(attacker.ability==='Steelworker'&&move.type==='steel')mods.push(0x1800);
    if(attacker.itemEffect?.stage==='attack'&&attacker.itemEffect.category===move.category){
      mods.push(attacker.itemEffect.modifier);
    }
    return chainMods(mods);
  }

  function defenseMods(defender,move){
    const mods=[];
    if(defender.ability==='Fur Coat'&&move.category==='physical')mods.push(0x2000);
    if(defender.itemEffect?.stage==='defense'&&defender.itemEffect.category===move.category){
      mods.push(defender.itemEffect.modifier);
    }
    return chainMods(mods);
  }

  function finalMods(attacker,defender,move,typeEffectiveness){
    const mods=[];
    if(['Multiscale','Shadow Shield'].includes(defender.ability))mods.push(0x800);
    if(['Fluffy','Aura Guard'].includes(defender.ability)&&move.mechanics?.makesContact)mods.push(0x800);
    if(defender.ability==='Fluffy'&&move.type==='fire')mods.push(0x2000);
    if(defender.ability==='Punk Rock'&&move.mechanics?.isSound)mods.push(0x800);
    if(defender.ability==='Ice Scales'&&move.category==='special')mods.push(0x800);
    if(['Solid Rock','Filter','Prism Armor'].includes(defender.ability)&&typeEffectiveness>1)mods.push(0xc00);
    if(attacker.ability==='Tinted Lens'&&typeEffectiveness<1)mods.push(0x2000);
    if(attacker.itemEffect?.stage==='final'&&(
      !attacker.itemEffect.superEffective||typeEffectiveness>1
    ))mods.push(attacker.itemEffect.modifier);
    return chainMods(mods);
  }

  function calculate(attacker,defender,rawMove,typeChart){
    const move=transform(rawMove,attacker);
    if(!move.power&&move.ncpName!=='Final Gambit')return{error:'缺少威力'};

    const typeEffectiveness=effectiveness(move.type,defender.types,typeChart);
    if(typeEffectiveness===0||isImmune(defender,move)){
      return{
        damage:[0],min:0,max:0,minPercent:0,maxPercent:0,
        effectiveness:0,resolvedType:move.type
      };
    }

    if(move.ncpName==='Final Gambit'){
      const value=attacker.maxHP;
      const valuePercent=percent(value/defender.maxHP*100);
      return{
        damage:[value],min:value,max:value,minPercent:valuePercent,maxPercent:valuePercent,
        effectiveness:typeEffectiveness,resolvedType:move.type,fixed:true
      };
    }

    const basePower=basePowerMods(attacker,move,movePower(move,attacker,defender));
    const rawAttack=move.category==='physical'?attacker.attack:attacker.spAttack;
    const rawDefense=move.category==='physical'?defender.defense:defender.spDefense;
    const attack=Math.max(1,pokeRound(rawAttack*attackMods(attacker,move)/MOD));
    const defense=Math.max(1,pokeRound(rawDefense*defenseMods(defender,move)/MOD));
    let baseDamage=Math.floor(
      Math.floor((Math.floor(2*attacker.level/5+2)*basePower*attack)/defense)/50+2
    );

    if(move.isSpread)baseDamage=pokeRound(baseDamage*0xc00/MOD);
    const stab=attacker.types.includes(move.type)
      ?attacker.ability==='Adaptability'?0x2000:0x1800
      :MOD;
    const final=finalMods(attacker,defender,move,typeEffectiveness);
    const damage=[];

    for(let random=85;random<=100;random++){
      let value=Math.floor(baseDamage*random/100);
      value=pokeRound(value*stab/MOD);
      value=Math.floor(value*typeEffectiveness);
      value=pokeRound(value*final/MOD);
      damage.push(Math.max(1,value));
    }

    return{
      damage,
      min:damage[0],
      max:damage[15],
      minPercent:percent(damage[0]/defender.maxHP*100),
      maxPercent:percent(damage[15]/defender.maxHP*100),
      effectiveness:typeEffectiveness,
      resolvedType:move.type,
      spread:!!move.isSpread
    };
  }

  function across(data,attackerProfile,defenderProfile,move){
    const slug=(move.href||'').split('/').pop();
    const rawMove=data.damageCalc.moves[slug];
    if(!rawMove)return{error:'招式资料缺失'};

    const details=[];
    for(const attackerFormId of attackerProfile.formIds){
      for(const defenderFormId of defenderProfile.formIds){
        const attackerForm=data.forms[attackerFormId];
        const defenderForm=data.forms[defenderFormId];
        try{
          const attacker=build(attackerProfile,attackerForm,data.damageCalc.items);
          const defender=build(defenderProfile,defenderForm,data.damageCalc.items);
          const result=calculate(attacker,defender,rawMove,data.damageCalc.typeChart);
          details.push({
            attacker:attackerForm.name,
            defender:defenderForm.name,
            attackerForm:attackerFormId,
            defenderForm:defenderFormId,
            attackerAbility:attacker.ability,
            attackerAbilitySource:attacker.abilitySource,
            defenderAbility:defender.ability,
            defenderAbilitySource:defender.abilitySource,
            attackerItem:attacker.itemName,
            attackerItemStatus:attacker.itemStatus,
            attackerItemReason:attacker.itemReason,
            defenderItem:defender.itemName,
            defenderItemStatus:defender.itemStatus,
            defenderItemReason:defender.itemReason,
            defenderHP:defender.maxHP,
            ...result
          });
        }catch(error){
          details.push({
            attacker:attackerForm?.name||attackerFormId,
            defender:defenderForm?.name||defenderFormId,
            attackerForm:attackerFormId,
            defenderForm:defenderFormId,
            error:error.message
          });
        }
      }
    }

    const valid=details.filter(detail=>!detail.error);
    const base=valid.find(detail=>
      detail.attackerForm===attackerProfile.id&&detail.defenderForm===defenderProfile.id
    )||valid[0];
    if(!base)return{error:'无法构造计算配置',details,attackerRows:[]};

    const attackerRows=attackerProfile.formIds.map(formId=>{
      const formDetails=details.filter(detail=>detail.attackerForm===formId);
      const formValid=formDetails.filter(detail=>!detail.error);
      if(!formValid.length){
        return{
          attackerForm:formId,
          attacker:data.forms[formId]?.name||formId,
          details:formDetails,
          error:formDetails[0]?.error||'无法计算'
        };
      }
      return{
        attackerForm:formId,
        attacker:formValid[0].attacker,
        minPercent:Math.min(...formValid.map(detail=>detail.minPercent)),
        maxPercent:Math.max(...formValid.map(detail=>detail.maxPercent)),
        details:formDetails,
        varies:formValid.some(detail=>
          detail.minPercent!==formValid[0].minPercent||detail.maxPercent!==formValid[0].maxPercent
        )
      };
    });

    return{
      base,
      details,
      attackerRows,
      minPercent:Math.min(...valid.map(detail=>detail.minPercent)),
      maxPercent:Math.max(...valid.map(detail=>detail.maxPercent)),
      varies:valid.some(detail=>
        detail.minPercent!==base.minPercent||detail.maxPercent!==base.maxPercent
      )
    };
  }

  globalThis.ChampionsDamage={
    build,
    calculate,
    across,
    normalize,
    pokeRound,
    chainMods,
    version:'ncp-1369b359-items-v1'
  };
})();
