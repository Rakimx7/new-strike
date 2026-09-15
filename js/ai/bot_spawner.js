import { S } from '../state.js';

export const BOT_SPECS = {
  grunt:   { hp:100,  speed:2.2, reward:250,  weaponPool:['glock','uzi','mp5','ak47'] },
  heavy:   { hp:180,  speed:1.7, reward:500,  weaponPool:['pkm','m249','ak47'] },
  sniper:  { hp:80,   speed:1.8, reward:450,  weaponPool:['scout','awp','barrett'] },
  // ⭐ BOSS TANKER — infection mode boss
  tanker:  { hp:1500, speed:1.15, reward:5000, weaponPool:['zombie_hand'] },
  // ⭐ RUNNER — fast, tanky, may knockback
  runner:  { hp:1000, speed:3.5,  reward:800,  weaponPool:['zombie_hand'] }
};

// ⭐ WEAPON PERSONALITY POOLS
const BOT_WEAPON_POOLS = {
  standard: ['glock','m1911','uzi','mp5','p90','galil','ak47','m4','scar'],
  heavy:    ['m249','pkm','rpg','flamer','pump','autoS'],
  sniper:   ['scout','awp','barrett','deagle'],
  assault:  ['ak47','m4','scar','mp5','p90','pump','autoS'],
  rusher:   ['deagle','m1911','uzi','pump','autoS'],
  wild:     ['rpg','flamer','barrett','deagle','ak47','m249','pkm','autoS','scar']
};

export function pickBotWeapon(kind, round){
  // ⭐ INFECTION / zombie types — always zombie_hand
  if(kind === 'tanker' || kind === 'runner') return 'zombie_hand';

  // ⭐ FFA: all weapons available (they have $16000)
  if(S.gameMode === 'ffa'){
    const allPool = [
      'glock','m1911','deagle',
      'uzi','mp5','p90',
      'galil','ak47','m4','scar',
      'm249','pkm',
      'pump','autoS',
      'scout','awp','barrett',
      'rpg','flamer'
    ];
    return allPool[Math.floor(Math.random() * allPool.length)];
  }

  // ⭐ WEAPON PERSONALITY — random per bot
  const roll = Math.random();
  let pool;
  if(roll < 0.60){
    pool = BOT_WEAPON_POOLS.standard;
  } else if(roll < 0.75){
    pool = BOT_WEAPON_POOLS.assault;
  } else if(roll < 0.87){
    pool = BOT_WEAPON_POOLS.heavy;
  } else if(roll < 0.95){
    pool = BOT_WEAPON_POOLS.rusher;
  } else {
    pool = BOT_WEAPON_POOLS.wild;
  }

  // Special pools override
  if(kind === 'sniper'){
    pool = BOT_WEAPON_POOLS.sniper;
  } else if(kind === 'heavy'){
    pool = BOT_WEAPON_POOLS.heavy;
  }

  // ⭐ RPG/flamer — 20% chance for grunt/heavy (round >= 4)
  if((kind === 'grunt' || kind === 'heavy') && round >= 4 && Math.random() < 0.20){
    return Math.random() < 0.7 ? 'rpg' : 'flamer';
  }

  return pool[Math.floor(Math.random() * pool.length)];
}