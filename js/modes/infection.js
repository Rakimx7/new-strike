// =========================================================
// INFECTION MODE MODULE
// Humans vs Zombies. Zombies convert on contact.
// =========================================================
import * as THREE from 'three';
import { S } from '../state.js';
import { beep } from '../utils.js';

// ─────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────
export const INFECTION_CONFIG = {
  roundTime: 300,
  buyPhaseTime: 20,
  // ⭐ 12 zombies total: 3 grunts + 8 runners + 1 tanker
  initialZombies: 12,
  tankerCount: 1,
  runnerCount: 8,              // 6 → 8 runners (mas maraming mabilis)
  totalBots: 30,               // 30 survivors + player = 31 total
  zombieSpeedMult: 1.45,
  humanSpeedMult: 1.00,
  zombieHp: 250,
  tankerHp: 1500,
  runnerHp: 750,               // 1000 → 750 (para hindi masyadong tanky sa 8 runners)
  humanHp: 100,
  conversionRange: 2.5,
  safeSpawnDistance: 25
};

// ─────────────────────────────────────────────────────
// SPAWN POINTS — 16 distributed slots around map
// ─────────────────────────────────────────────────────
export const INFECTION_SPAWN_POINTS = [
  [-82, 82], [82, 82], [-82, -82], [82, -82],
  [-82, 0], [82, 0], [0, 82], [0, -82],
  [-55, 55], [55, 55], [-55, -55], [55, -55],
  [-50, 0], [50, 0], [0, 50], [0, -50]
];

let _usedSpawns = new Set();

export function resetInfectionSpawns() {
  _usedSpawns = new Set();
}

export function getInfectionSpawn() {
  const avail = [];
  for(let i = 0; i < INFECTION_SPAWN_POINTS.length; i++){
    if(!_usedSpawns.has(i)) avail.push(i);
  }
  if(!avail.length){
    _usedSpawns.clear();
    for(let i = 0; i < INFECTION_SPAWN_POINTS.length; i++) avail.push(i);
  }
  const idx = avail[Math.floor(Math.random() * avail.length)];
  _usedSpawns.add(idx);
  const [x, z] = INFECTION_SPAWN_POINTS[idx];
  return new THREE.Vector3(x + (Math.random()-0.5)*3, 0, z + (Math.random()-0.5)*3);
}

export function getFarthestSpawnFrom(pos) {
  let best = INFECTION_SPAWN_POINTS[0], bestD = -1;
  for(const [x, z] of INFECTION_SPAWN_POINTS){
    const d = Math.hypot(x - pos.x, z - pos.z);
    if(d > bestD){ bestD = d; best = [x, z]; }
  }
  return new THREE.Vector3(best[0] + (Math.random()-0.5)*3, 0, best[1] + (Math.random()-0.5)*3);
}

// ─────────────────────────────────────────────────────
// COUNTERS
// ─────────────────────────────────────────────────────
export function countSurvivors() {
  let n = (S.player && S.player.alive && S.player.team === 'survivor') ? 1 : 0;
  const bots = window._getAllBots ? window._getAllBots() : [];
  for(const b of bots){
    if(b.alive && b.team === 'survivor') n++;
  }
  return n;
}

export function countZombies() {
  let n = (S.player && S.player.alive && S.player.team === 'zombie') ? 1 : 0;
  const bots = window._getAllBots ? window._getAllBots() : [];
  for(const b of bots){
    if(b.alive && b.team === 'zombie') n++;
  }
  return n;
}

// ─────────────────────────────────────────────────────
// PLAYER CONVERSION — when a zombie hits the player
// ─────────────────────────────────────────────────────
export function convertPlayerToZombie(attacker) {
  const p = S.player;
  if(!p || !p.alive) return;
  if(p.team === 'zombie') return;

  p.team = 'zombie';
  S.playerTeam = 'zombie';

  S.ownedWeapons = ['zombie_hand'];
  S.currentWeaponKey = 'zombie_hand';
  S.ammoState = { zombie_hand: { ammo: Infinity, reserve: Infinity } };

  p.hp = p.maxHp;
  p.kevlar = 0;
  p.helmet = 0;
  p.kevlarReduction = 0;
  p.helmetReduction = 0;
  p.armorOwnedKevlar = false;
  p.armorOwnedHelmet = false;

  if(window._refreshViewModels) window._refreshViewModels();
  if(window._renderWeaponBar) window._renderWeaponBar();

  beep(180, 0.4, 'sawtooth', 0.3);
  setTimeout(() => beep(120, 0.4, 'sawtooth', 0.25), 150);
  if(window._showMsg) window._showMsg('YOU ARE INFECTED!', 3000);
  if(window._addKillfeed) window._addKillfeed(attacker?.name || 'ZOMBIE', 'YOU', 'ZOMBIE BITE', null, 'zombie', 'survivor');
  if(window._updateHUD) window._updateHUD();
}

// ─────────────────────────────────────────────────────
// HUD TEXT
// ─────────────────────────────────────────────────────
export function getInfectionHUDText() {
  const s = countSurvivors();
  const z = countZombies();
  return 'SURVIVORS ' + s + '  —  ZOMBIES ' + z;
}

// ─────────────────────────────────────────────────────
// ZOMBIE MELEE ATTACK
// ─────────────────────────────────────────────────────
export function tryZombieConvert(target, attacker) {
  if(!target || !attacker) return false;

  if(target === S.player){
    if(S.player.team === 'zombie') return false;
    convertPlayerToZombie(attacker);
    return true;
  }

  if(target.isBot){
    if(target.team === 'zombie') return false;
    if(window._convertToZombie){
      window._convertToZombie(target, attacker);
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────
// ⭐ BOT BUY LOADOUT — random weapons/armor/items
// ─────────────────────────────────────────────────────
function botBuyLoadout(bot){
  if(!bot) return;

  const weaponPool = [
    'glock','m1911','deagle',
    'uzi','mp5','p90',
    'galil','ak47','m4','scar',
    'm249','pkm',
    'pump','autoS',
    'scout','awp','barrett'
  ];

  // 10% chance ng special weapon
  let wId;
  if(Math.random() < 0.10){
    wId = Math.random() < 0.6 ? 'rpg' : 'flamer';
  } else {
    wId = weaponPool[Math.floor(Math.random() * weaponPool.length)];
  }
  bot.weaponId = wId;

  // Rebuild mesh with new weapon
  if(window._rebuildBotMesh){
    window._rebuildBotMesh(bot, bot.kind, bot.team, wId);
  }

  // Random armor (30% chance)
  if(Math.random() < 0.3){
    bot.hasArmor = true;
    bot.armor = 100;
    bot.armorMax = 100;
    bot.armorReduction = 0.5;
  }

  // Random inventory
  bot.inventory = {
    grenade: Math.random() < 0.5 ? (1 + Math.floor(Math.random()*2)) : 0,
    smoke: Math.random() < 0.3 ? 1 : 0,
    flash: Math.random() < 0.25 ? 1 : 0,
    medkit: Math.random() < 0.3 ? 1 : 0,
    mine: Math.random() < 0.25 ? 1 : 0,
    turret: Math.random() < 0.2 ? 1 : 0
  };
  bot._itemCooldown = 0;
  bot._lastTurretRound = 0;
  bot._grenadeCooldown = 0;
}

// ─────────────────────────────────────────────────────
// START ROUND — Buy Phase (20s) then Zombies spawn
// ⭐ KEEP player's loadout kung buhay siya sa round end
// ─────────────────────────────────────────────────────
export function startInfectionRound(spawnBotFn){
  // ⭐ CAPTURE previous round state BEFORE any reset
  const playerWasZombie = (S.player && S.player.team === 'zombie');
  const playerDied = (S.playerDiedThisRound === true);
  const shouldWipeLoadout = playerWasZombie || playerDied;

  S.playerTeam = 'survivor';
  if(S.player){
    S.player.team = 'survivor';
    S.player.hp = S.player.maxHp;
    S.player.alive = true;
    S.player.kevlar = 0;
    S.player.helmet = 0;
    S.player.armorOwnedKevlar = false;
    S.player.armorOwnedHelmet = false;
  }

  S.roundTimeRemaining = INFECTION_CONFIG.roundTime;
  S.roundActive = false;

  // ⭐ Starting money — buy phase budget
  if(S.player) S.player.money = 10000;

  // ═══════════════════════════════════════════════════════════
  // ⭐ LOADOUT: Wipe lang kung namatay o naging zombie
  // Kung nakaligtas sa round → KEEP lahat ng binili
  // ═══════════════════════════════════════════════════════════
  if(shouldWipeLoadout){
    // Namatay o naging zombie → reset sa default
    S.ownedWeapons = ['glock', 'knife'];
    S.currentWeaponKey = 'glock';
    S.ammoState = {
      glock: { ammo: 17, reserve: 102 },
      knife: { ammo: Infinity, reserve: Infinity }
    };
    console.log('[INFECTION] Player loadout WIPED (died or was zombie)');
  } else {
    // ⭐ Nakaligtas → KEEP weapons, refill lang ang ammo
    if(!S.ownedWeapons.includes('glock')) S.ownedWeapons.unshift('glock');
    if(!S.ownedWeapons.includes('knife')) S.ownedWeapons.push('knife');
    for(const id in S.ammoState){
      const w = window._getWeapon ? window._getWeapon(id) : null;
      if(!w || w.melee) continue;
      S.ammoState[id].ammo = w.mag;
      S.ammoState[id].reserve = w.reserveMax;
    }
    // Make sure may valid weapon
    if(!S.ownedWeapons.includes(S.currentWeaponKey)){
      S.currentWeaponKey = 'glock';
    }
    console.log('[INFECTION] Player SURVIVED — keeping loadout (' + S.ownedWeapons.length + ' weapons)');
  }

  if(window._refreshViewModels) window._refreshViewModels();
  if(window._renderWeaponBar) window._renderWeaponBar();

  // ⭐ Reset flag AFTER we used it
  S.playerDiedThisRound = false;

  // Teleport player
  resetInfectionSpawns();
  const playerSpawn = getInfectionSpawn();
  if(S.player){
    S.player.pos.set(playerSpawn.x, S.player.eye, playerSpawn.z);
    S.player.yaw = Math.atan2(-playerSpawn.x, -playerSpawn.z);
  }

  if(!spawnBotFn) return;

  // ⭐ Clear old bots
  const botsRef = window._getAllBots ? window._getAllBots() : [];
  botsRef.forEach(b => {
    if(b && b.mesh && window._scene) window._scene.remove(b.mesh);
  });
  botsRef.length = 0;

  // ⭐ BUY PHASE: Spawn all as SURVIVORS with random loadouts
  S.buyPhaseActive = true;
  S.buyPhaseTimeRemaining = INFECTION_CONFIG.buyPhaseTime;

  const total = INFECTION_CONFIG.totalBots;
  for(let i = 0; i < total; i++){
    const spawnPos = getInfectionSpawn();
    const bot = spawnBotFn('survivor', 'grunt', spawnPos);
    if(bot){
      bot.hp = INFECTION_CONFIG.humanHp;
      bot.maxHp = INFECTION_CONFIG.humanHp;
      bot.reward = 300;
      botBuyLoadout(bot);
    }
  }

  if(window._showMsg){
    window._showMsg('BUY PHASE\n20 seconds to gear up!\nPress [B] to open shop anywhere', 3500);
  }
  if(window._addKillfeed){
    window._addKillfeed('SYSTEM', 'BUY PHASE', '20 SECONDS', 'special', 'survivor', 'survivor');
  }

  console.log('[INFECTION] Buy phase started. ' + total + ' survivors spawned.');
}

// ─────────────────────────────────────────────────────
// ⭐ SPAWN ZOMBIES — tawagin pagkatapos ng buy phase
// ─────────────────────────────────────────────────────
export function spawnInfectionZombies(){
  const bots = window._getAllBots ? window._getAllBots() : [];
  const survivors = bots.filter(b => b.alive && b.team === 'survivor');

  const numTankers = INFECTION_CONFIG.tankerCount;
  const numRunners = INFECTION_CONFIG.runnerCount;
  const numGrunts = INFECTION_CONFIG.initialZombies - numTankers - numRunners;

  const shuffled = [...survivors].sort(() => Math.random() - 0.5);

  let idx = 0;
  for(let i = 0; i < numTankers; i++){
    if(shuffled[idx] && window._promoteBotToZombieKind){
      window._promoteBotToZombieKind(shuffled[idx], 'tanker');
      idx++;
    }
  }
  for(let i = 0; i < numRunners; i++){
    if(shuffled[idx] && window._promoteBotToZombieKind){
      window._promoteBotToZombieKind(shuffled[idx], 'runner');
      idx++;
    }
  }
  for(let i = 0; i < numGrunts; i++){
    if(shuffled[idx] && window._promoteBotToZombieKind){
      window._promoteBotToZombieKind(shuffled[idx], 'grunt');
      idx++;
    }
  }

  S.buyPhaseActive = false;
  S.roundActive = true;

  if(window._showMsg){
    window._showMsg('★ INFECTION STARTED ★\nZombies are coming!', 3000);
  }
  if(window._addKillfeed){
    window._addKillfeed('SYSTEM', '', 'ZOMBIES INCOMING', 'special', 'zombie', 'survivor');
  }

  console.log('[INFECTION] Buy phase over. ' + numTankers + ' tanker, ' + numRunners + ' runners, ' + numGrunts + ' grunts spawned.');
}

// ─────────────────────────────────────────────────────
// CHECK WIN CONDITION
// ─────────────────────────────────────────────────────
export function checkInfectionEnd() {
  if(S.gameMode !== 'infection') return false;
  if(!S.roundActive) return false;

  const survivors = countSurvivors();
  const zombies = countZombies();
  const timeUp = S.roundTimeRemaining <= 0;

  if(timeUp){
    S.roundActive = false;
    if(window._showMsg) window._showMsg('★ SURVIVORS WIN ★\nTime expired!\nSurvivors: ' + survivors + ' · Zombies: ' + zombies, 5000);
    beep(1200, 0.5, 'sine', 0.25);
    setTimeout(() => beep(1400, 0.4, 'sine', 0.20), 300);
    return true;
  }

  if(zombies === 0 && survivors > 0){
    S.roundActive = false;
    if(window._showMsg) window._showMsg('★ SURVIVORS WIN ★\nAll zombies eliminated!\nSurvivors: ' + survivors, 5000);
    beep(1000, 0.4, 'sine', 0.25);
    setTimeout(() => beep(1200, 0.4, 'sine', 0.20), 300);
    setTimeout(() => beep(1400, 0.4, 'sine', 0.20), 600);
    return true;
  }

  if(survivors === 0){
    S.roundActive = false;
    if(window._showMsg) window._showMsg('★ ZOMBIES WIN ★\nAll humans infected!\nZombies: ' + zombies, 5000);
    beep(200, 0.5, 'sawtooth', 0.30);
    setTimeout(() => beep(150, 0.4, 'sawtooth', 0.25), 300);
    return true;
  }

  return false;
}