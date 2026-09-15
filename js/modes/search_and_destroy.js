// =========================================================
// SEARCH & DESTROY MODE
// Cartel plants time-charged bomb; Mercs defuse.
// Bomb drops on carrier death — must be retrieved.
// =========================================================
import * as THREE from 'three';
import { scene, BOMB_SITE_A, BOMB_SITE_B } from '../world.js';
import { S } from '../state.js';
import { beep } from '../utils.js';

export const SD_CONFIG = {
  plantTime:       3.0,
  defuseTime:      10.0,
  defuseTimeKit:   5.0,
  siteRadius:      14,
  interactRange:   3.0,
  bombDamage:      900,       // ⭐ 600 → 900 (halos lahat one-shot sa gitna)
  bombRadius:      55,        // ⭐ 22 → 55 (abot sa malaking area)
  fleeWindow:      15,        // ⭐ 12 → 15 (mas maagang tumakbo)
  riskyChance:     0.30,
  discoveryRange:  60
};

let bombMesh = null;
let bombLight = null;
let nextBeepT = 0;
let dropMesh = null;

// ─────────────────────────────────────────────────────
function buildBombMesh(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.35, 0.40),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 })
  );
  body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.15, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x0a1a0a })
  );
  screen.position.set(0, 0.05, 0.21);
  g.add(screen);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2020 })
  );
  light.position.set(0, 0.25, 0);
  g.add(light);
  g.userData.light = light;
  const wireColors = [0xff3030, 0x30ff30, 0x3030ff];
  for(let i = 0; i < 3; i++){
    const w = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.015, 4, 8),
      new THREE.MeshBasicMaterial({ color: wireColors[i] })
    );
    w.rotation.x = Math.PI / 2;
    w.position.set(-0.15 + i * 0.15, 0.20, 0);
    g.add(w);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.06, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.7 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.15;
  g.add(ring);
  return g;
}

function buildDroppedBombMesh(){
  const g = buildBombMesh();
  const pickupRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.85 })
  );
  pickupRing.rotation.x = Math.PI / 2;
  pickupRing.position.y = -0.15;
  g.add(pickupRing);
  return g;
}

// ─────────────────────────────────────────────────────
export function getBombSiteAt(pos){
  const dA = Math.hypot(pos.x - BOMB_SITE_A.x, pos.z - BOMB_SITE_A.z);
  const dB = Math.hypot(pos.x - BOMB_SITE_B.x, pos.z - BOMB_SITE_B.z);
  if(dA < SD_CONFIG.siteRadius) return 'A';
  if(dB < SD_CONFIG.siteRadius) return 'B';
  return null;
}
export function getBombSitePos(site){
  return site === 'A' ? BOMB_SITE_A : BOMB_SITE_B;
}
export function isPlayerNearBomb(){
  if(!S.bombPlanted || !S.bombPos || !S.player) return false;
  return S.player.pos.distanceTo(S.bombPos) < SD_CONFIG.interactRange;
}

// ─────────────────────────────────────────────────────
// BOMB DROP / PICKUP
// ─────────────────────────────────────────────────────
export function dropBombAt(pos){
  if(!pos) return;
  if(dropMesh){ scene.remove(dropMesh); dropMesh = null; }

  S.bombDropped = true;
  S.bombDropPos = new THREE.Vector3(pos.x, 0.2, pos.z);
  S.bombCarrier = null;

  dropMesh = buildDroppedBombMesh();
  dropMesh.position.copy(S.bombDropPos);
  scene.add(dropMesh);

  if(window._addKillfeed) window._addKillfeed('SYSTEM', '', 'BOMB DROPPED', 'special');
  beep(600, 0.15, 'square', 0.12);
}
window._dropBombAt = dropBombAt;

function clearDroppedBomb(){
  if(dropMesh){ scene.remove(dropMesh); dropMesh = null; }
  S.bombDropped = false;
  S.bombDropPos = null;
}

export function playerPickupBomb(){
  if(!S.bombDropped || !S.player) return false;
  const d = S.player.pos.distanceTo(S.bombDropPos);
  if(d > 2.5) return false;

  clearDroppedBomb();
  S.bombCarrier = 'player';
  S.inventory.c4 = 1;
  S.currentEquip = 'c4';

  if(window._showMsg) window._showMsg('YOU HAVE THE BOMB\nHold [F] at A or B to plant', 2500);
  if(window._addKillfeed) window._addKillfeed('YOU', '', 'PICKED UP BOMB', 'special');
  beep(900, 0.2, 'sine', 0.18);
  return true;
}
window._playerPickupBomb = playerPickupBomb;

function tryBotPickupDroppedBomb(){
  if(!S.bombDropped || !S.bombDropPos) return;
  const bots = window._getAllBots ? window._getAllBots() : [];
  let nearest = null, nearestD = 2.5;
  for(const b of bots){
    if(!b.alive || b.team !== 'cartel') continue;
    if(b.hasBomb) continue;
    const d = b.mesh.position.distanceTo(S.bombDropPos);
    if(d < nearestD){ nearestD = d; nearest = b; }
  }
  if(nearest){
    clearDroppedBomb();
    nearest.hasBomb = true;
    S.bombCarrier = nearest;
    // ⭐ Re-assign sa safest site pag nakuha na yung bomb
    nearest._assignedSite = chooseSiteForCarrier(nearest);
    if(window._addKillfeed) window._addKillfeed('SYSTEM', '', 'BOMB: ' + nearest.name + ' → SITE ' + nearest._assignedSite, 'special');
    beep(800, 0.15, 'sine', 0.12);
  }
}





// ⭐ Pipiliin yung bombsite na pinaka-kaunti ang kalaban
function chooseSiteForCarrier(bot){
  if(!bot || !bot.mesh) return 'A';

  const bots = window._getAllBots ? window._getAllBots() : [];
  const mercs = bots.filter(x => x.alive && x.team === 'merc');

  let nearA = 0, nearB = 0;
  for(const m of mercs){
    const dA = Math.hypot(m.mesh.position.x - BOMB_SITE_A.x, m.mesh.position.z - BOMB_SITE_A.z);
    const dB = Math.hypot(m.mesh.position.x - BOMB_SITE_B.x, m.mesh.position.z - BOMB_SITE_B.z);
    if(dA < 30) nearA++;
    if(dB < 30) nearB++;
  }
  if(S.player && S.player.alive && S.playerTeam === 'merc'){
    const dA = Math.hypot(S.player.pos.x - BOMB_SITE_A.x, S.player.pos.z - BOMB_SITE_A.z);
    const dB = Math.hypot(S.player.pos.x - BOMB_SITE_B.x, S.player.pos.z - BOMB_SITE_B.z);
    if(dA < 30) nearA++;
    if(dB < 30) nearB++;
  }

  // Kung mas marami kalaban sa A → pumunta sa B (and vice versa)
  if(nearA < nearB) return 'A';
  if(nearB < nearA) return 'B';

  // Tie — piliin yung mas malapit sa bot
  const bdA = Math.hypot(bot.mesh.position.x - BOMB_SITE_A.x, bot.mesh.position.z - BOMB_SITE_A.z);
  const bdB = Math.hypot(bot.mesh.position.x - BOMB_SITE_B.x, bot.mesh.position.z - BOMB_SITE_B.z);
  return bdA <= bdB ? 'A' : 'B';
}
window._chooseSiteForCarrier = chooseSiteForCarrier;







// ─────────────────────────────────────────────────────
// ROUND SETUP
// ─────────────────────────────────────────────────────
export function startSDRound(playerTeam){
  resetSD();
  S.attackers = 'cartel';

  const bots = window._getAllBots ? window._getAllBots() : [];
  const cartelBots = bots.filter(b => b.alive && b.team === 'cartel');

  for(const b of bots){
    if(b._risky === undefined) b._risky = Math.random() < SD_CONFIG.riskyChance;
    b._knowsBombPos = false;
    b._defuseProgress = 0;
    b._plantProgress = 0;
  }

  const half = Math.ceil(cartelBots.length / 2);
  cartelBots.forEach((b, i) => { b._assignedSite = (i < half) ? 'A' : 'B'; });

  const mercBots = bots.filter(b => b.alive && b.team === 'merc');
  const halfM = Math.ceil(mercBots.length / 2);
  mercBots.forEach((b, i) => { b._assignedSite = (i < halfM) ? 'A' : 'B'; });

  if(playerTeam === 'cartel'){
    S.bombCarrier = 'player';
    if(S.player) S.inventory.c4 = 1;
    S.currentEquip = 'c4';
    if(window._showMsg) window._showMsg('YOU HAVE THE BOMB\nHold [F] at A or B to plant', 3500);
  } else if(cartelBots.length){
    const carrier = cartelBots[Math.floor(Math.random() * cartelBots.length)];
    carrier.hasBomb = true;
    S.bombCarrier = carrier;
    // ⭐ Re-assign carrier sa safest site
    carrier._assignedSite = chooseSiteForCarrier(carrier);
    if(window._addKillfeed) window._addKillfeed('SYSTEM', '', 'BOMB: ' + carrier.name + ' → SITE ' + carrier._assignedSite, 'special');
  }

  if(window._addKillfeed){
    window._addKillfeed('SYSTEM', 'CARTEL', 'PLANT THE BOMB', 'special', 'cartel', 'merc');
  }
}

// ─────────────────────────────────────────────────────
// PLANT / DEFUSE / EXPLODE
// ─────────────────────────────────────────────────────
export function plantBomb(site, pos){
  S.bombPlanted = true;
  S.currentBombSite = site;
  S.bombPos = pos.clone();
  S.bombPos.y = 0.2;
  S.bombTimer = S.bombFuseTime || 40;
  S.bombPlantProgress = 0;
  S.bombDefuseProgress = 0;

  if(S.bombCarrier === 'player') S.inventory.c4 = 0;
  else if(S.bombCarrier && S.bombCarrier.isBot) S.bombCarrier.hasBomb = false;
  S.bombCarrier = null;

  clearDroppedBomb();

  if(bombMesh) scene.remove(bombMesh);
  bombMesh = buildBombMesh();
  bombMesh.position.copy(S.bombPos);
  scene.add(bombMesh);
  bombLight = bombMesh.userData.light;
  nextBeepT = 0;

  if(window._showMsg) window._showMsg('★ BOMB PLANTED AT SITE ' + site + ' ★', 2500);
  if(window._addKillfeed) window._addKillfeed('CARTEL', '', 'BOMB PLANTED @ ' + site, 'special');
  beep(1400, 0.30, 'sine', 0.22);
  setTimeout(() => beep(1200, 0.25, 'sine', 0.20), 200);
}

export function defuseBomb(){
  if(!S.bombPlanted) return;
  S.bombPlanted = false;
  S.bombDefuseProgress = 0;
  if(bombMesh){ scene.remove(bombMesh); bombMesh = null; bombLight = null; }
  if(window._showMsg) window._showMsg('★ BOMB DEFUSED ★\nMERCENARIES WIN ROUND', 3500);
  if(window._addKillfeed) window._addKillfeed('MERC', '', 'BOMB DEFUSED', 'special', 'merc', 'cartel');
  beep(2000, 0.30, 'sine', 0.22);
  setTimeout(() => beep(2400, 0.30, 'sine', 0.20), 200);
  if(window._sdEndRound) window._sdEndRound('merc', 'BOMB DEFUSED');
}

export function explodeBomb(){
  if(!S.bombPlanted || !S.bombPos) return;
  const pos = S.bombPos.clone();
  S.bombPlanted = false;
  S.bombDefuseProgress = 0;

  // ⭐ Linear falloff pero mas mataas ang floor damage
  const falloff = d => {
    const t = d / SD_CONFIG.bombRadius;
    return Math.max(0.15, 1 - t * 0.9);   // 0m = 1.0x, 55m = ~0.1x
  };
  if(window._damageBotsInRadius){
    window._damageBotsInRadius(pos, SD_CONFIG.bombDamage, SD_CONFIG.bombRadius, 'merc', falloff);
    window._damageBotsInRadius(pos, SD_CONFIG.bombDamage, SD_CONFIG.bombRadius, 'cartel', falloff);
  }
  if(window._damagePlayerInRadius){
    window._damagePlayerInRadius(pos, SD_CONFIG.bombDamage, SD_CONFIG.bombRadius, 'merc', falloff);
    window._damagePlayerInRadius(pos, SD_CONFIG.bombDamage, SD_CONFIG.bombRadius, 'cartel', falloff);
  }

  beep(60, 0.6, 'sawtooth', 0.35);
  const flash = new THREE.PointLight(0xffa040, 40, 60);
  flash.position.copy(pos); scene.add(flash);
  setTimeout(() => scene.remove(flash), 300);

  const s = new THREE.Mesh(
    new THREE.SphereGeometry(2, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff8030, transparent: true, opacity: 0.9 })
  );
  s.position.copy(pos); scene.add(s);
  let t = 0;
  const fade = setInterval(() => {
    t += 0.05;
    s.scale.setScalar(1 + t * 4);
    s.material.opacity = Math.max(0, 0.9 - t * 1.5);
    if(t > 0.6){ clearInterval(fade); scene.remove(s); }
  }, 30);

  if(bombMesh){ scene.remove(bombMesh); bombMesh = null; bombLight = null; }
  if(window._showMsg) window._showMsg('★ BOMB DETONATED ★\nCARTEL WINS ROUND', 3500);
  if(window._addKillfeed) window._addKillfeed('CARTEL', '', 'TARGET DESTROYED', 'special', 'cartel', 'merc');
  if(window._sdEndRound) window._sdEndRound('cartel', 'BOMB DETONATED');
}

// ─────────────────────────────────────────────────────
export function updateSD(dt){
  if(S.gameMode !== 'sd' || S.gameState !== 'playing') return;
  if(S.bombDropped) tryBotPickupDroppedBomb();
  if(!S.bombPlanted) return;

  S.bombTimer -= dt;

  if(bombLight){
    const speed = S.bombTimer < 10 ? 0.020 : (S.bombTimer < 20 ? 0.012 : 0.006);
    const pulse = 0.5 + Math.sin(performance.now() * speed) * 0.5;
    bombLight.material.color.setRGB(1, 0.1 * pulse, 0.1 * pulse);
    bombLight.scale.setScalar(0.7 + pulse * 0.6);
  }

  nextBeepT -= dt;
  if(nextBeepT <= 0){
    const t = S.bombTimer;
    let interval = 1.0;
    if(t < 5)       interval = 0.10;
    else if(t < 10) interval = 0.25;
    else if(t < 20) interval = 0.50;
    nextBeepT = interval;
    beep(t < 10 ? 1600 : 1000, 0.06, 'square', 0.12);
  }

  if(S.bombTimer <= 0) explodeBomb();
}

// ─────────────────────────────────────────────────────
export function tickPlayerPlant(dt){
  if(S.gameMode !== 'sd') return;
  if(S.playerTeam !== 'cartel' || S.bombPlanted) return;
  if(!S.player || !S.player.alive) return;
  if((S.inventory.c4 || 0) <= 0) return;

  const site = getBombSiteAt(S.player.pos);
  if(!site){ cancelPlayerPlant(); return; }

  S.bombPlantProgress += dt;
  const pct = Math.min(100, Math.round((S.bombPlantProgress / SD_CONFIG.plantTime) * 100));
  if(window._showMsg) window._showMsg('PLANTING... ' + pct + '%', 250);

  if(S.bombPlantProgress >= SD_CONFIG.plantTime){
    plantBomb(site, S.player.pos.clone());
  }
}

export function cancelPlayerPlant(){
  if(S.bombPlantProgress > 0){
    S.bombPlantProgress = 0;
    if(window._showMsg) window._showMsg('PLANT CANCELLED', 800);
  }
}

export function tickPlayerDefuse(dt){
  if(S.gameMode !== 'sd') return;
  if(S.playerTeam !== 'merc' || !S.bombPlanted) return;
  if(!S.player || !S.player.alive){ cancelPlayerDefuse(); return; }
  if(!isPlayerNearBomb()){ cancelPlayerDefuse(); return; }

  const dur = S.player.hasDefuseKit ? SD_CONFIG.defuseTimeKit : SD_CONFIG.defuseTime;
  S.bombDefuseProgress += dt;
  const pct = Math.min(100, Math.round((S.bombDefuseProgress / dur) * 100));
  if(window._showMsg) window._showMsg('DEFUSING... ' + pct + '%', 250);

  if(S.bombDefuseProgress >= dur) defuseBomb();
}

export function cancelPlayerDefuse(){
  if(S.bombDefuseProgress > 0){
    S.bombDefuseProgress = 0;
    if(window._showMsg) window._showMsg('DEFUSE CANCELLED', 800);
  }
}

// ─────────────────────────────────────────────────────
export function resetSD(){
  S.bombPlanted = false;
  S.bombPlantT = 0;
  S.bombDefuseT = 0;
  S.bombPlantProgress = 0;
  S.bombDefuseProgress = 0;
  S.bombPos = null;
  S.bombTimer = 0;
  S.currentBombSite = null;
  S.bombCarrier = null;
  clearDroppedBomb();

  const bots = window._getAllBots ? window._getAllBots() : [];
  for(const b of bots){
    b.hasBomb = false;
    b._plantProgress = 0;
    b._defuseProgress = 0;
    b._knowsBombPos = false;
  }
  if(bombMesh){ scene.remove(bombMesh); bombMesh = null; bombLight = null; }
}