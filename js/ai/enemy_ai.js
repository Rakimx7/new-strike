import * as THREE from 'three';
import { scene, solids, staticMeshes, losClear, collideBot, flat, MERC_BASE, CARTEL_BASE, BOMB_SITE_A, BOMB_SITE_B } from '../world.js';
import { S } from '../state.js';
import { beep } from '../utils.js';
import { getWeapon } from '../weapons.js';
import { BOT_SPECS, pickBotWeapon } from './bot_spawner.js';
import { SD_CONFIG, plantBomb, defuseBomb } from '../modes/search_and_destroy.js';
import { BOT_NAME_POOLS } from '../data/game_data.js';

export const bots = [];
export const squads = [];
export let CUSTOM_BOT_NAMES = { merc:{}, cartel:{} };
try { const r = localStorage.getItem('newstrike_bot_names'); if(r) CUSTOM_BOT_NAMES = JSON.parse(r); } catch(e){}
export function saveBotNames(){ try { localStorage.setItem('newstrike_bot_names', JSON.stringify(CUSTOM_BOT_NAMES)); } catch(e){} }

function updateHUD(){ if(window._updateHUD) window._updateHUD(); }
function addKillfeed(...a){ if(window._addKillfeed) window._addKillfeed(...a); }
function checkGameEnd(){ if(window._checkGameEnd) window._checkGameEnd(); }
function spawnAmmoPickup(pos){ if(window._spawnAmmoPickup) window._spawnAmmoPickup(pos); }
function spawnWeaponDrop(pos, id){ if(window._spawnWeaponDrop) window._spawnWeaponDrop(pos, id); }
function reportPlayerKill(){ if(window._reportPlayerKill) window._reportPlayerKill(); }
function refreshRenameList(){ if(window._refreshRenameList) window._refreshRenameList(); }

export function generateBotName(team){
  const p = BOT_NAME_POOLS[team];
  if(!p) return team.toUpperCase() + '-' + Math.floor(Math.random()*99);
  const n = S.botNameCounters[team] = (S.botNameCounters[team] || 0);
  S.botNameCounters[team]++;
  return p[n % p.length] + '-' + (Math.floor(n/p.length)+1);
}
export function pickSpawnPoints(team){
  if(team === 'merc') return [[-22,72],[22,72],[-8,80],[8,80],[-24,88],[24,88],[0,90],[0,68]];
  return [[-22,-72],[22,-72],[-8,-80],[8,-80],[-24,-88],[24,-88],[0,-90],[0,-68]];
}

const MERC_SPAWN_POS = new THREE.Vector3(0, 0, 80);
const CARTEL_SPAWN_POS = new THREE.Vector3(0, 0, -80);
const SPAWN_SAFE_RADIUS = 22;
function getEnemySpawn(botTeam){
  return botTeam === 'merc' ? CARTEL_SPAWN_POS : MERC_SPAWN_POS;
}
function wouldEnterEnemySpawn(pos, botTeam, radius = 0.7){
  const spawn = getEnemySpawn(botTeam);
  const dx = pos.x - spawn.x, dz = pos.z - spawn.z;
  return Math.sqrt(dx*dx + dz*dz) < (SPAWN_SAFE_RADIUS + radius);
}
function computeRetreatFromSpawn(pos, botTeam){
  const spawn = getEnemySpawn(botTeam);
  const dx = pos.x - spawn.x, dz = pos.z - spawn.z;
  const len = Math.sqrt(dx*dx + dz*dz) || 1;
  return new THREE.Vector3(dx/len, 0, dz/len);
}

export const SNIPER_CAMP_SPOTS = [
  new THREE.Vector3(-30,8.5,40), new THREE.Vector3(30,8.5,-40),
  new THREE.Vector3(-78,0,0), new THREE.Vector3(78,0,0),
  new THREE.Vector3(0,0,30), new THREE.Vector3(0,0,-30)
];

export const FFA_SPAWN_POINTS = [
  [-82, 82], [82, 82], [-82, -82], [82, -82],
  [-82, 0], [82, 0], [0, 82], [0, -82],
  [-55, 55], [55, 55], [-55, -55], [55, -55],
  [-50, 0], [50, 0], [0, 50], [0, -50]
];

export function getFFASpawnPoint(usedIndices){
  const available = [];
  for(let i = 0; i < FFA_SPAWN_POINTS.length; i++){
    if(!usedIndices || !usedIndices.has(i)) available.push(i);
  }
  if(!available.length){
    for(let i = 0; i < FFA_SPAWN_POINTS.length; i++) available.push(i);
  }
  const idx = available[Math.floor(Math.random() * available.length)];
  const [x, z] = FFA_SPAWN_POINTS[idx];
  return { pos: new THREE.Vector3(x, 0, z), index: idx };
}

export function getFFARespawnPoint(){
  const playerPos = S.player ? S.player.pos : new THREE.Vector3();
  const candidates = [];
  for(let i = 0; i < FFA_SPAWN_POINTS.length; i++){
    const [x, z] = FFA_SPAWN_POINTS[i];
    const dPlayer = Math.hypot(x - playerPos.x, z - playerPos.z);
    if(dPlayer < 25) continue;
    let minBotDist = 999;
    for(const ob of bots){
      if(!ob.alive) continue;
      const d = Math.hypot(x - ob.mesh.position.x, z - ob.mesh.position.z);
      if(d < minBotDist) minBotDist = d;
    }
    if(minBotDist < 8) continue;
    candidates.push({ x, z, score: dPlayer + minBotDist });
  }
  if(!candidates.length){
    let best = FFA_SPAWN_POINTS[0], bestD = -1;
    for(const [x, z] of FFA_SPAWN_POINTS){
      const d = Math.hypot(x - playerPos.x, z - playerPos.z);
      if(d > bestD){ bestD = d; best = [x, z]; }
    }
    return new THREE.Vector3(best[0] + (Math.random()-0.5)*4, 0, best[1] + (Math.random()-0.5)*4);
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return new THREE.Vector3(pick.x + (Math.random()-0.5)*4, 0, pick.z + (Math.random()-0.5)*4);
}

const SKIN = 0xd4a878, METAL = 0x0e0e0e, GUN_DARK = 0x1e1e1e, GUN_WOOD = 0x5a3a1a, MAG_DARK = 0x141414;
function makeHand(){ return new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.11), flat(SKIN)); }

function buildWeaponModel(category){
  const g = new THREE.Group();
  if(category === 'pistol'){
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.18), flat(GUN_DARK)));
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), flat(0x222222));
    grip.position.set(0, -0.09, 0.06); grip.rotation.x = 0.25; g.add(grip);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6), flat(METAL));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.13); g.add(barrel);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.03, 0.16), flat(0x3a3a3a));
    slide.position.set(0, 0.045, -0.02); g.add(slide);
    const rh = makeHand(); rh.position.set(0, -0.08, 0.06); rh.rotation.set(0.28, 0, 0); g.add(rh);
  }
  else if(category === 'smg'){
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.40), flat(GUN_DARK)));
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.15, 0.05), flat(MAG_DARK));
    mag.position.set(0, -0.11, 0.05); mag.rotation.x = 0.15; g.add(mag);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6), flat(METAL));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.018, -0.28); g.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.12), flat(GUN_DARK));
    stock.position.set(0, -0.01, 0.26); g.add(stock);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.09); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, -0.025, -0.14); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'shotgun'){
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 8), flat(METAL));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.28); g.add(barrel);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.18), flat(GUN_WOOD));
    pump.position.set(0, -0.04, -0.20); g.add(pump);
    const recv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.18), flat(GUN_DARK));
    recv.position.set(0, 0, 0.10); g.add(recv);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.25), flat(GUN_WOOD));
    stock.position.set(0, -0.02, 0.32); g.add(stock);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.14); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, -0.045, -0.20); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'sniper'){
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.75), flat(0x1e2a1e)));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.35, 6), flat(METAL));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.018, -0.55); g.add(barrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.28, 8), flat(0x0a0a0a));
    scope.rotation.x = Math.PI/2; scope.position.set(0, 0.085, -0.05); g.add(scope);
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), flat(0x0a0a0a));
    m1.position.set(0, 0.05, 0.05); g.add(m1);
    const m2 = m1.clone(); m2.position.z = -0.15; g.add(m2);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.075, 0.25), flat(0x1e2a1e));
    stock.position.set(0, -0.01, 0.50); g.add(stock);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.18); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, -0.025, -0.22); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'lmg'){
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.70), flat(GUN_DARK)));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.16), flat(0x2a2a1a));
    box.position.set(0, -0.13, 0.02); g.add(box);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.30, 6), flat(METAL));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.02, -0.55); g.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.22), flat(GUN_DARK));
    stock.position.set(0, -0.01, 0.48); g.add(stock);
    const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), flat(0x111111));
    bipod.position.set(-0.04, -0.06, -0.42); bipod.rotation.z = 0.3; g.add(bipod);
    const bipod2 = bipod.clone(); bipod2.position.x = 0.04; bipod2.rotation.z = -0.3; g.add(bipod2);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.18); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, -0.025, -0.24); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'launcher'){
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.85, 12), flat(0x3a4a2a));
    tube.rotation.x = Math.PI/2; tube.position.set(0, 0.02, -0.10); g.add(tube);
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.25, 8), flat(0xa04020));
    warhead.rotation.x = -Math.PI/2; warhead.position.set(0, 0.02, -0.65); g.add(warhead);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.15, 12), flat(0x2a2a2a));
    back.rotation.x = Math.PI/2; back.position.set(0, 0.02, 0.35); g.add(back);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), flat(0x222222));
    grip.position.set(0, -0.10, 0.05); grip.rotation.x = 0.25; g.add(grip);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.08); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, 0.06, -0.20); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'flamethrower'){
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.40), flat(0x8a3a1a)));
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.30, 8), flat(0x2a1a1a));
    tank.position.set(0, -0.13, 0.05); tank.rotation.x = 0.15; g.add(tank);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.30, 6), flat(0x1a1a1a));
    nozzle.rotation.x = Math.PI/2; nozzle.position.set(0, 0.03, -0.35); g.add(nozzle);
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), flat(0xff5000));
    torch.position.set(0, 0.03, -0.52); g.add(torch);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.14); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, -0.02, -0.18); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'cannon'){
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 12), flat(0x2a2a2a));
    tube.rotation.x = Math.PI/2; tube.position.set(0, 0.02, -0.15); g.add(tube);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.15, 12), flat(0x1a1a1a));
    muzzle.rotation.x = Math.PI/2; muzzle.position.set(0, 0.02, -0.72); g.add(muzzle);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), flat(0x1a1a1a));
    grip.position.set(0, -0.10, 0.05); grip.rotation.x = 0.25; g.add(grip);
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.08); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, 0.08, -0.20); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  else if(category === 'melee'){
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.30), flat(0xcfd6da));
    blade.position.set(0, 0.05, -0.15); g.add(blade);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.12), flat(0x2a2a2a));
    handle.position.set(0, 0, 0.06); g.add(handle);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.02, 0.02), flat(0x333333));
    guard.position.set(0, 0, -0.05); g.add(guard);
    const rh = makeHand(); rh.position.set(0, -0.02, 0.06); rh.rotation.set(0.10, 0, 0); g.add(rh);
  }
  else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.50), flat(GUN_DARK)));
    const rh = makeHand(); rh.position.set(0.005, -0.075, 0.14); rh.rotation.set(0.28, 0, 0); g.add(rh);
    const lh = makeHand(); lh.position.set(-0.005, -0.025, -0.18); lh.rotation.set(0.10, 0, 0); g.add(lh);
  }
  return g;
}

function buildArm(parent, shoulderPos, handPos, color){
  const armMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
  const thickness = 0.10;
  const dx = handPos.x - shoulderPos.x, dy = handPos.y - shoulderPos.y, dz = handPos.z - shoulderPos.z;
  const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
  if(dist < 0.05) return;
  const upperLen = dist * 0.55;
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const outward = new THREE.Vector3(Math.sign(shoulderPos.x) || 1, 0, 0);
  const sideOffset = outward.clone().multiplyScalar(0.06);
  const elbowPos = new THREE.Vector3(
    shoulderPos.x + dir.x * upperLen + sideOffset.x,
    shoulderPos.y + dir.y * upperLen,
    shoulderPos.z + dir.z * upperLen + sideOffset.z
  );
  const upperVec = new THREE.Vector3().subVectors(elbowPos, shoulderPos);
  const upperLenActual = upperVec.length();
  if(upperLenActual > 0.01){
    const upperMesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness*0.9, thickness, upperLenActual, 6), armMat);
    upperMesh.position.copy(shoulderPos).add(upperVec.clone().multiplyScalar(0.5));
    upperMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), upperVec.clone().normalize());
    upperMesh.castShadow = true; parent.add(upperMesh);
  }
  const foreVec = new THREE.Vector3().subVectors(handPos, elbowPos);
  const foreLenActual = foreVec.length();
  if(foreLenActual > 0.01){
    const foreMesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness*0.85, thickness*0.9, foreLenActual, 6), armMat);
    foreMesh.position.copy(elbowPos).add(foreVec.clone().multiplyScalar(0.5));
    foreMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), foreVec.clone().normalize());
    foreMesh.castShadow = true; parent.add(foreMesh);
  }
  const shoulderSphere = new THREE.Mesh(new THREE.SphereGeometry(thickness*1.15, 8, 6), armMat);
  shoulderSphere.position.copy(shoulderPos); parent.add(shoulderSphere);
  const elbowSphere = new THREE.Mesh(new THREE.SphereGeometry(thickness*0.95, 6, 6), armMat);
  elbowSphere.position.copy(elbowPos); parent.add(elbowSphere);
}

export function buildBotMesh(kind, team, weaponId){
  const g = new THREE.Group();
  const isMerc = team === 'merc';
  const isZombie = team === 'zombie';
  const isTanker = kind === 'tanker';
  const isRunner = kind === 'runner';

  let uniformPrimary, uniformSecondary, helmetColor;
  if(isZombie){
    if(isTanker){
      uniformPrimary = 0x3a5a1a;
      uniformSecondary = 0x1a2a08;
      helmetColor = 0x4a2a2a;
    } else if(isRunner){
      uniformPrimary = 0xa8c020;
      uniformSecondary = 0x5a6a10;
      helmetColor = 0x3a4a08;
    } else {
      uniformPrimary = 0x4a6a3a;
      uniformSecondary = 0x2a3a20;
      helmetColor = 0x2a3a20;
    }
  } else {
    uniformPrimary = isMerc ? 0x4a6a9a : 0x8a4a3a;
    uniformSecondary = isMerc ? 0x2a3a5a : 0x4a2a1a;
    helmetColor = isMerc ? 0x2a3a5a : 0x2f2f2f;
  }
  const hipY = 0.88, chestY = 1.22, shoulderY = 1.42, headY = 1.62, helmetY = 1.78;
  const wpn = getWeapon(weaponId) || getWeapon('glock');
  const category = wpn ? wpn.category : 'rifle';

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.24), flat(uniformSecondary));
  pelvis.position.y = hipY; g.add(pelvis);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.28), flat(uniformPrimary));
  chest.position.y = chestY; g.add(chest);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.40, 0.32), flat(0x1a1a1a));
  vest.position.y = chestY + 0.02; g.add(vest);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), flat(SKIN));
  head.position.y = headY; g.add(head);
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.14, 0.30), flat(helmetColor));
  helmet.position.y = helmetY; g.add(helmet);

  const legGeo = new THREE.BoxGeometry(0.16, 0.78, 0.18);
  legGeo.translate(0, -0.39, 0);
  const legL = new THREE.Mesh(legGeo, flat(uniformSecondary));
  legL.position.set(-0.12, hipY, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo.clone(), flat(uniformSecondary));
  legR.position.set(0.12, hipY, 0); g.add(legR);
  const bootGeo = new THREE.BoxGeometry(0.19, 0.10, 0.26);
  bootGeo.translate(0, -0.05, -0.03);
  const bootL = new THREE.Mesh(bootGeo, flat(0x141414));
  bootL.position.set(0, -0.78, 0); legL.add(bootL);
  const bootR = bootL.clone(); legR.add(bootR);

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0.08, chestY - 0.02, -0.30);
  weaponGroup.rotation.set(0.04, 0.02, 0);
  g.add(weaponGroup);
  const gun = buildWeaponModel(category);
  weaponGroup.add(gun);

  let rightHandPos = null, leftHandPos = null;
  gun.children.forEach(child => {
    if(child.geometry && child.material && child.material.color){
      const params = child.geometry.parameters;
      if(params && Math.abs(params.width - 0.10) < 0.001 && Math.abs(params.height - 0.13) < 0.001){
        if(!rightHandPos) rightHandPos = child.position.clone();
        else leftHandPos = child.position.clone();
      }
    }
  });
  if(rightHandPos){
    const hw = new THREE.Vector3().addVectors(weaponGroup.position, rightHandPos);
    buildArm(g, new THREE.Vector3(0.20, shoulderY - 0.06, 0.04), hw, uniformPrimary);
  }
  if(leftHandPos){
    const hw = new THREE.Vector3().addVectors(weaponGroup.position, leftHandPos);
    buildArm(g, new THREE.Vector3(-0.20, shoulderY - 0.06, 0.04), hw, uniformPrimary);
  }

  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2; shadowDisc.position.y = 0.02;
  g.add(shadowDisc);

  g.userData.legL = legL; g.userData.legR = legR;
  g.userData.gun = weaponGroup;
  g.userData.category = category;
  g.userData._walkT = Math.random() * Math.PI * 2;
  [chest, head, helmet, vest, pelvis, legL, legR].forEach(m => { m.castShadow = true; m.receiveShadow = true; });

  if(isTanker){
    g.scale.setScalar(2.0);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.06, 1.65, 0.13); g.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.06, 1.65, 0.13); g.add(eyeR);
  }

  if(isRunner){
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.06, 1.65, 0.13); g.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.06, 1.65, 0.13); g.add(eyeR);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const auraRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 20), auraMat);
    auraRing.rotation.x = -Math.PI / 2;
    auraRing.position.y = 0.03;
    g.add(auraRing);
  }

  return g;
}

export function initBotInventory(bot){
  const r = S.round;

  if(S.gameMode === 'ffa'){
    bot.inventory = {
      grenade: 1 + Math.floor(Math.random() * 2),
      smoke: Math.random() < 0.5 ? 1 : 0,
      flash: Math.random() < 0.35 ? 1 : 0,
      medkit: Math.random() < 0.5 ? 1 : 0,
      turret: Math.random() < 0.2 ? 1 : 0,
      mine: Math.random() < 0.25 ? 1 : 0
    };
    bot.hasArmor = true;
    bot.armor = 200;
    bot.armorMax = 200;
    bot.armorReduction = 0.70;
    bot.helmet = 200;
    bot.helmetMax = 200;
    bot.helmetReduction = 0.70;
    bot.healingT = 0;
    return;
  }

  bot.inventory = {
    grenade: (r>=2 && Math.random()<0.5) ? (1 + Math.floor(Math.random()*2)) : 0,
    smoke: (r>=3 && Math.random()<0.35) ? 1 : 0,
    flash: (r>=2 && Math.random()<0.3) ? 1 : 0,
    medkit: ((bot.kind==='heavy'||bot.kind==='sniper') && r>=2) ? 1 : (r>=3 && Math.random()<0.25 ? 1 : 0),
    turret: (r>=3 && Math.random()<0.5) ? 1 : 0,
    mine: (r>=3 && Math.random()<0.35) ? 1 : 0
  };
  bot.hasArmor = r>=2 && Math.random()<(0.3+Math.min(0.5,r*0.06));
  bot.armor = bot.hasArmor ? 100 : 0;
  bot.armorMax = bot.hasArmor ? 100 : 0;
  bot.armorReduction = 0.5;
  bot.healingT = 0;
  bot._itemCooldown = 0;
  bot._lastTurretRound = 0;
  bot._grenadeCooldown = 0;
}

function assignBotRole(kind, team){
  const isSD = (S.gameMode === 'sd');

  const r = Math.random();
  if(kind === 'sniper'){
    if(r < 0.55) return 'SNIPER';
    if(r < 0.85) return 'AMBUSH';
    return 'CAMPER';
  }
  if(kind === 'heavy'){
    if(r < 0.35) return 'ASSAULT';
    if(r < 0.65) return 'DEFENDER';
    if(r < 0.85) return 'CAMPER';
    return 'HIT_AND_RUN';
  }
  if(isSD){
    if(r < 0.40) return 'OFFENSIVE';
    if(r < 0.60) return 'ASSAULT';
    if(r < 0.75) return 'HUNTER';
    if(r < 0.90) return 'FLANKER';
    return 'DEFENDER';
  }
  if(r < 0.18) return 'OFFENSIVE';
  if(r < 0.33) return 'FLANKER';
  if(r < 0.48) return 'HUNTER';
  if(r < 0.60) return 'AMBUSH';
  if(r < 0.70) return 'HIT_AND_RUN';
  if(r < 0.80) return 'HIDER';
  if(r < 0.92) return 'DEFENDER';
  return 'ASSAULT';
}

function getRoleTuning(role){
  switch(role){
    case 'CAMPER':      return { range: 8,  strafe: 0.3, speed: 0.90, wander: 0.2 };
    case 'DEFENDER':    return { range: 14, strafe: 0.5, speed: 1.00, wander: 0.6 };
    case 'OFFENSIVE':   return { range: 10, strafe: 0.7, speed: 1.15, wander: 0.3 };
    case 'HUNTER':      return { range: 8,  strafe: 0.5, speed: 1.20, wander: 0.5 };
    case 'HIDER':       return { range: 20, strafe: 0.4, speed: 0.95, wander: 0.8 };
    case 'SNIPER':      return { range: 35, strafe: 0.3, speed: 0.95, wander: 0.3 };
    case 'AMBUSH':      return { range: 12, strafe: 0.3, speed: 0.95, wander: 0.4 };
    case 'FLANKER':     return { range: 10, strafe: 0.8, speed: 1.10, wander: 0.7 };
    case 'ASSAULT':     return { range: 6,  strafe: 0.5, speed: 1.25, wander: 0.2 };
    case 'HIT_AND_RUN': return { range: 12, strafe: 1.0, speed: 1.10, wander: 0.6 };
    default:            return { range: 10, strafe: 0.6, speed: 1.10, wander: 0.5 };
  }
}

export function spawnBot(team, kind='grunt', pos=null, overrides={}, opts={}){
  const spawnPts = pickSpawnPoints(team);
  if(!pos){ const pt = spawnPts[Math.floor(Math.random()*spawnPts.length)]; pos = new THREE.Vector3(pt[0],0,pt[1]); }
  const spec = BOT_SPECS[kind] || BOT_SPECS.grunt;
  const enemyCannonExists = (S.placedCannons || []).some(c => c.alive && c.team !== team);
  let autoWeapon;
  if(enemyCannonExists && (kind === 'heavy' || kind === 'grunt') && Math.random() < 0.6){
    autoWeapon = 'rpg';
  } else {
    autoWeapon = pickBotWeapon(kind, S.round);
  }
  const weaponId = overrides.weaponId || autoWeapon;
  const baseHp = overrides.hp !== undefined ? overrides.hp : (spec.hp * (overrides.hpMult||1));

  const g = buildBotMesh(kind, team, weaponId);
  g.position.copy(pos); scene.add(g);

  const bot = {
    mesh: g, hp: baseHp, maxHp: baseHp, alive: true, kind, team, weaponId,
    name: overrides.name || generateBotName(team), botKills: 0,
    fireT: 0.5 + Math.random()*1.5,
    speed: spec.speed * (overrides.speedMult||1) + S.round*0.15,
    accuracy: overrides.accuracy !== undefined ? overrides.accuracy : spec.accuracy,
    reward: overrides.reward !== undefined ? overrides.reward : spec.reward,
    isLeader: opts.isLeader || false,
    followOffset: new THREE.Vector3((Math.random()-0.5)*3, 0, (Math.random()-0.5)*3),
    isBot: true,
    command: null, commandTime: 0, holdPosition: null,
    crouching: false,
    blinded: 0,
    role: assignBotRole(kind, team),
    _patrolDir: Math.random() * Math.PI * 2,
    _patrolTime: 0,
    _strafeDir: Math.random() < 0.5 ? 1 : -1,
    _stuckT: 0
  };
  initBotInventory(bot);
  bots.push(bot);
  return bot;
}

export function spawnRound(playerTeam, enemyTeam){
  bots.forEach(b => scene.remove(b.mesh));
  bots.length = 0; squads.length = 0;

  const enemyCount = 8;
  const allyCount  = 7;

  if(S.gameMode === 'ffa'){
    const usedIndices = new Set();

    const playerPos = S.player ? S.player.pos : new THREE.Vector3();
    let closestIdx = -1, closestDist = 999;
    for(let i = 0; i < FFA_SPAWN_POINTS.length; i++){
      const [x, z] = FFA_SPAWN_POINTS[i];
      const d = Math.hypot(x - playerPos.x, z - playerPos.z);
      if(d < closestDist){ closestDist = d; closestIdx = i; }
    }
    if(closestIdx >= 0 && closestDist < 15) usedIndices.add(closestIdx);

    const totalBots = enemyCount + allyCount;
    for(let i = 0; i < totalBots; i++){
      const spawn = getFFASpawnPoint(usedIndices);
      usedIndices.add(spawn.index);

      const team = (i < enemyCount) ? enemyTeam : playerTeam;
      let k = 'grunt';
      if(i === 0 && S.round >= 3) k = 'heavy';
      if(i === 1 && S.round >= 4) k = 'sniper';

      const jx = (Math.random() - 0.5) * 3;
      const jz = (Math.random() - 0.5) * 3;
      spawnBot(team, k, new THREE.Vector3(spawn.pos.x + jx, 0, spawn.pos.z + jz));
    }

    console.log('[FFA] Spawned ' + totalBots + ' bots distributed around map');
  } else {
    for(let i = 0; i < enemyCount; i++){
      let k = 'grunt';
      if(i === 0 && S.round >= 3) k = 'heavy';
      if(i === 1 && S.round >= 4) k = 'sniper';
      const pts = pickSpawnPoints(enemyTeam);
      const pt  = pts[Math.floor(Math.random() * pts.length)];
      const jitter = new THREE.Vector3((Math.random()-0.5)*4, 0, (Math.random()-0.5)*4);
      spawnBot(enemyTeam, k, new THREE.Vector3(pt[0] + jitter.x, 0, pt[1] + jitter.z));
    }

    for(let i = 0; i < allyCount; i++){
      let k = 'grunt';
      if(i === 0 && S.round >= 4) k = 'heavy';
      if(i === 1 && S.round >= 5) k = 'sniper';
      const pts = pickSpawnPoints(playerTeam);
      const pt  = pts[Math.floor(Math.random() * pts.length)];
      const jitter = new THREE.Vector3((Math.random()-0.5)*4, 0, (Math.random()-0.5)*4);
      spawnBot(playerTeam, k, new THREE.Vector3(pt[0] + jitter.x, 0, pt[1] + jitter.z));
    }

    console.log('[Round ' + S.round + '] Spawned ' + enemyCount + ' vs ' + (allyCount + 1) + ' (player + allies)');
  }

  S.roundActive = true;
  refreshRenameList();
}

function damageAtRange(w, dist){
  const rng = w.range || [0,200];
  const [rMin, rMax] = rng;
  if(dist <= rMin) return 1;
  if(dist >= rMax) return w.falloff ?? 0.7;
  const t = (dist-rMin)/(rMax-rMin);
  return 1 - t*(1-(w.falloff ?? 0.7));
}

// ⭐ Difficulty multipliers para sa bots
// S.AI_TUNING.accuracy: 0.5 (EASY) / 0.8 (NORMAL) / 1.2 (HARD) / 1.8 (EXPERT) / 2.5 (INSANE)
function getDifficultyMultipliers(){
  const acc = (S.AI_TUNING && S.AI_TUNING.accuracy) || 1.0;

  let speedMult = 1.0, accMult = 1.0, fireRateMult = 1.0;

  if(acc <= 0.55){           // EASY
    speedMult = 0.55; accMult = 0.40; fireRateMult = 2.20;
  } else if(acc <= 0.85){    // NORMAL
    speedMult = 0.75; accMult = 0.65; fireRateMult = 1.50;
  } else if(acc <= 1.25){    // HARD
    speedMult = 1.00; accMult = 1.00; fireRateMult = 1.00;
  } else if(acc <= 1.85){    // EXPERT
    speedMult = 1.15; accMult = 1.15; fireRateMult = 0.85;
  } else {                   // INSANE
    speedMult = 1.30; accMult = 1.30; fireRateMult = 0.70;
  }

  return { speedMult, accMult, fireRateMult };
}



export function updateBots(dt){
  const player = S.player;
  if(!player) return;

  const enemiesOf = { merc: [], cartel: [], zombie: [], survivor: [] };
  if(S.gameMode === 'ffa'){
    const aliveBots = bots.filter(b => b.alive);
    enemiesOf['merc'] = aliveBots;
    enemiesOf['cartel'] = aliveBots;
  } else if(S.gameMode === 'infection'){
    const zombies = bots.filter(b => b.alive && b.team === 'zombie');
    const survivors = bots.filter(b => b.alive && b.team === 'survivor');
    enemiesOf['zombie'] = survivors;
    enemiesOf['survivor'] = zombies;
  } else {
    for(const b of bots){ if(b.alive) enemiesOf[b.team==='merc'?'cartel':'merc'].push(b); }
  }

  for(const b of bots){
    if(!b.alive) continue;
    if(b.blinded > 0){ b.blinded -= dt; continue; }

    if(b.healingT > 0){
      b.healingT -= dt;
      if(b.healingT <= 0){ b.hp = Math.min(b.maxHp, b.hp + 75); beep(600,0.15,'sine',0.10); }
      continue;
    }
    if(b.hp < b.maxHp*0.4 && b.inventory && b.inventory.medkit>0 && Math.random()<0.02){
      b.healingT = 1.5; b.inventory.medkit--; continue;
    }

    const wep = getWeapon(b.weaponId) || getWeapon('glock');
    const p = b.mesh.position;
    let tuning = getRoleTuning(b.role);
    // ⭐ MELEE BOT — override: charge lang, no strafe, malapit ang range
    if(wep && wep.melee){
      // ⭐ Melee bot: laging charge (negatibong range = walang strafe zone)
      // Distansya > (range+4) = approach. Kasama lahat ng layo sa "approach".
      tuning = { range: -20, strafe: 0, speed: 1.6, wander: 0 };
    }

    /* ──── 1. FIND TARGET ──── */
    let bestTarget = null, bestDist = 999;

    const playerIsEnemy =
      (S.gameMode === 'ffa') ||
      (S.gameMode === 'infection' && b.team !== player.team) ||
      (S.gameMode !== 'ffa' && S.gameMode !== 'infection' && b.team !== player.team);

    if(playerIsEnemy && player.alive && player.hp > 0){
      const d = p.distanceTo(player.pos);
      if(d < 50){
        const from = p.clone().setY(1.2);
        const to = player.pos.clone().setY(1.2);
        if(losClear(from, to)){ bestTarget = { type:'player', pos: player.pos.clone(), ref: player }; bestDist = d; }
      }
    }

    const teamList = enemiesOf[b.team] || [];
    for(const o of teamList){
      if(o === b) continue;
      const d = p.distanceTo(o.mesh.position);
      if(d < bestDist && d < 50){
        const from = p.clone().setY(1.2);
        const to = o.mesh.position.clone().setY(1.2);
        if(losClear(from, to)){ bestTarget = { type:'bot', pos: o.mesh.position.clone(), ref: o }; bestDist = d; }
      }
    }
    if(bestTarget) b.lastSeenEnemy = bestTarget.pos.clone();

    /* ──── ZOMBIE BEHAVIOR ──── */
    const isZombieBot = (b.weaponId === 'zombie_hand');
    if(isZombieBot && (S.gameMode === 'infection' || S.gameMode === 'zombie_escape')){
      let zMoveDir = new THREE.Vector3();

      if(bestTarget){
        const to = new THREE.Vector3(bestTarget.pos.x - p.x, 0, bestTarget.pos.z - p.z);
        const dist = to.length();
        if(dist > 0.6) zMoveDir.copy(to.normalize());

        b.fireT -= dt;
        if(dist <= 3.2 && b.fireT <= 0){
          b.fireT = 0.5;
          const target = (bestTarget.type === 'player') ? player : bestTarget.ref;
          if(target && window._tryZombieConvert){
            window._tryZombieConvert(target, b);
          }
          beep(280, 0.08, 'square', 0.12);
        }

        b.mesh.rotation.y = Math.atan2(bestTarget.pos.x - p.x, bestTarget.pos.z - p.z) + Math.PI;
      } else {
        if(!b._zombieWanderDir || (b._zombieWanderTime || 0) <= 0){
          let wx = -p.x + (Math.random() - 0.5) * 40;
          let wz = -p.z + (Math.random() - 0.5) * 40;
          const wlen = Math.hypot(wx, wz);
          if(wlen < 1.0){
            const ang = Math.random() * Math.PI * 2;
            wx = Math.cos(ang);
            wz = Math.sin(ang);
          } else {
            wx /= wlen;
            wz /= wlen;
          }
          b._zombieWanderDir = new THREE.Vector3(wx, 0, wz);
          b._zombieWanderTime = 2 + Math.random() * 2;
        }
        b._zombieWanderTime -= dt;
        zMoveDir.copy(b._zombieWanderDir);
        if(zMoveDir.lengthSq() > 0.001){
          b.mesh.rotation.y = Math.atan2(zMoveDir.x, zMoveDir.z) + Math.PI;
        }
      }

      const now = performance.now();
      if(b._knockbackUntil && now < b._knockbackUntil && b._knockbackVec){
        const kbStep = b._knockbackSpeed * dt;
        const tryKb = p.clone();
        tryKb.x += b._knockbackVec.x * kbStep;
        tryKb.z += b._knockbackVec.z * kbStep;
        tryKb.y = 0;
        collideBot(tryKb, 0.65);
        p.x = tryKb.x; p.z = tryKb.z; p.y = 0;

        b._knockbackSpeed *= 0.88;

        const zLegL_kb = b.mesh.userData.legL, zLegR_kb = b.mesh.userData.legR;
        b.mesh.userData._walkT = (b.mesh.userData._walkT || 0) + dt * 12;
        const kbSwing = Math.sin(b.mesh.userData._walkT) * 0.7;
        if(zLegL_kb) zLegL_kb.rotation.x = kbSwing;
        if(zLegR_kb) zLegR_kb.rotation.x = -kbSwing;

        continue;
      }

      if(zMoveDir.lengthSq() > 0.001){
        const totalSpeed = b.speed;
        const stepX = zMoveDir.x * totalSpeed * dt;
        const stepZ = zMoveDir.z * totalSpeed * dt;

        const tryMain = p.clone(); tryMain.x += stepX; tryMain.z += stepZ; tryMain.y = 0;
        const testMain = tryMain.clone(); collideBot(testMain, 0.65);
        if(Math.hypot(testMain.x - tryMain.x, testMain.z - tryMain.z) < 0.05){
          p.x = testMain.x; p.z = testMain.z; p.y = 0;
        } else {
          const alt1X = -stepZ, alt1Z = stepX;
          const try1 = p.clone(); try1.x += alt1X; try1.z += alt1Z; try1.y = 0;
          const test1 = try1.clone(); collideBot(test1, 0.65);
          if(Math.hypot(test1.x - try1.x, test1.z - try1.z) < 0.05){
            p.x = test1.x; p.z = test1.z; p.y = 0;
          } else {
            const alt2X = stepZ, alt2Z = -stepX;
            const try2 = p.clone(); try2.x += alt2X; try2.z += alt2Z; try2.y = 0;
            const test2 = try2.clone(); collideBot(test2, 0.65);
            if(Math.hypot(test2.x - try2.x, test2.z - try2.z) < 0.05){
              p.x = test2.x; p.z = test2.z; p.y = 0;
            }
          }
        }
      }

      const zLegL = b.mesh.userData.legL, zLegR = b.mesh.userData.legR;
      const zIsMoving = zMoveDir.lengthSq() > 0.001;
      if(zIsMoving){
        b.mesh.userData._walkT = (b.mesh.userData._walkT || 0) + dt * 9;
        const swing = Math.sin(b.mesh.userData._walkT) * 0.6;
        if(zLegL) zLegL.rotation.x = swing;
        if(zLegR) zLegR.rotation.x = -swing;
      } else {
        if(zLegL) zLegL.rotation.x *= 0.85;
        if(zLegR) zLegR.rotation.x *= 0.85;
      }

      continue;
    }

    /* ──── 2. COMMAND OVERRIDE ──── */
    let moveDir = new THREE.Vector3();
    let shouldShoot = false;
    let commandHandled = false;

    if(b.command && b.team === player.team && player.alive && S.gameMode !== 'ffa'){
      commandHandled = true;
      const to = new THREE.Vector3(player.pos.x - p.x, 0, player.pos.z - p.z);
      const dToPlayer = to.length();
      const toN = dToPlayer > 0.1 ? to.clone().normalize() : new THREE.Vector3();

      switch(b.command){
        case 'FOLLOW':
          if(dToPlayer > 4) moveDir.copy(toN);
          else if(dToPlayer < 2) moveDir.copy(toN).multiplyScalar(-0.5);
          break;
        case 'MOVE': case 'STORM': {
          const enemyBase = b.team === 'merc' ? CARTEL_BASE : MERC_BASE;
          const nav = new THREE.Vector3(enemyBase.x - p.x, 0, enemyBase.z - p.z).normalize();
          moveDir.copy(nav);
          break;
        }
        case 'FALLBACK': {
          const ownBase = b.team === 'merc' ? MERC_BASE : CARTEL_BASE;
          moveDir.set(ownBase.x - p.x, 0, ownBase.z - p.z).normalize();
          break;
        }
        case 'HOLD':
          moveDir.set(0, 0, 0);
          break;
        case 'POSITION': {
          const allies = bots.filter(x => x.alive && x.team === player.team);
          const idx = Math.max(0, allies.indexOf(b));
          const total = Math.max(1, allies.length);
          const ang = (idx / total) * Math.PI * 2;
          const tx = player.pos.x + Math.cos(ang) * 6;
          const tz = player.pos.z + Math.sin(ang) * 6;
          const toSlot = new THREE.Vector3(tx - p.x, 0, tz - p.z);
          if(toSlot.length() > 1.5) moveDir.copy(toSlot.normalize());
          break;
        }
        case 'BACKUP':
          if(dToPlayer > 3) moveDir.copy(toN);
          break;
        case 'HIDE':
          if(bestTarget){
            const away = new THREE.Vector3(p.x - bestTarget.pos.x, 0, p.z - bestTarget.pos.z).normalize();
            moveDir.copy(away);
          }
          break;
        case 'HUNT':
          if(bestTarget) moveDir.set(bestTarget.pos.x - p.x, 0, bestTarget.pos.z - p.z).normalize();
          else {
            const enemyBase = b.team === 'merc' ? CARTEL_BASE : MERC_BASE;
            moveDir.set(enemyBase.x - p.x, 0, enemyBase.z - p.z).normalize();
          }
          break;
        default: commandHandled = false;
      }
      if(bestTarget) shouldShoot = true;
    }

    /* ──── 3. ROLE-BASED BEHAVIOR ──── */
    if(!commandHandled){
      let sdHandled = false;
      if(S.gameMode === 'sd' && S.roundActive){
        const site = b._assignedSite || 'A';
        const targetSite = site === 'A' ? BOMB_SITE_A : BOMB_SITE_B;

        if(bestTarget && bestDist < 45) shouldShoot = true;

        if(b.team === 'cartel' && !S.bombPlanted && S.bombDropped && S.bombDropPos && !b.hasBomb){
          const d = Math.hypot(p.x - S.bombDropPos.x, p.z - S.bombDropPos.z);
          if(d > 1.5){
            const to = new THREE.Vector3(S.bombDropPos.x - p.x, 0, S.bombDropPos.z - p.z).normalize();
            moveDir.copy(to);
          } else {
            moveDir.set(0,0,0);
          }
          sdHandled = true;
        }
        else if(b.team === 'cartel' && !S.bombPlanted){
          if(b.hasBomb){
            const d = Math.hypot(p.x - targetSite.x, p.z - targetSite.z);
            if(d > 3){
              const to = new THREE.Vector3(targetSite.x - p.x, 0, targetSite.z - p.z).normalize();
              moveDir.copy(to);
              b._plantProgress = 0;
            } else {
              moveDir.set(0,0,0);
              b._plantProgress = (b._plantProgress || 0) + dt;
              if(b._plantProgress >= SD_CONFIG.plantTime){
                plantBomb(site, p.clone());
                b.hasBomb = false;
                b._plantProgress = 0;
                addKillfeed('CARTEL', '', 'BOMB PLANTED @ ' + site, 'special');
              }
            }
            sdHandled = true;
          } else {
            const d = Math.hypot(p.x - targetSite.x, p.z - targetSite.z);
            if(d > 8){
              const to = new THREE.Vector3(targetSite.x - p.x, 0, targetSite.z - p.z).normalize();
              moveDir.copy(to);
            } else {
              moveDir.multiplyScalar(0.15);
            }
            sdHandled = true;
          }
        }
        else if(b.team === 'cartel' && S.bombPlanted && S.bombPos){
          const dBomb = Math.hypot(p.x - S.bombPos.x, p.z - S.bombPos.z);
          const timeLeft = S.bombTimer;
          const fleeWindow = SD_CONFIG.fleeWindow || 15;
          const blastRadius = SD_CONFIG.bombRadius || 55;

          if(timeLeft < fleeWindow && !b._risky && dBomb < blastRadius + 8){
            const away = new THREE.Vector3(p.x - S.bombPos.x, 0, p.z - S.bombPos.z).normalize();
            moveDir.copy(away);
          } else if(dBomb > 12){
            const to = new THREE.Vector3(S.bombPos.x - p.x, 0, S.bombPos.z - p.z).normalize();
            moveDir.copy(to);
          } else {
            moveDir.multiplyScalar(0.15);
          }
          sdHandled = true;
        }
        else if(b.team === 'merc' && S.bombPlanted && S.bombPos){
          const dBomb = Math.hypot(p.x - S.bombPos.x, p.z - S.bombPos.z);
          const timeLeft = S.bombTimer;
          const defuseTime = SD_CONFIG.defuseTime || 10;
          const canDefuse = timeLeft > defuseTime + 0.5;

          b._knowsBombPos = true;

          if(!canDefuse && !b._risky){
            const blastRadius = SD_CONFIG.bombRadius || 55;
            if(dBomb < blastRadius + 8){
              const away = new THREE.Vector3(p.x - S.bombPos.x, 0, p.z - S.bombPos.z).normalize();
              moveDir.copy(away);
            }
            b._defuseProgress = 0;
          } else {
            if(dBomb > 2.0){
              const to = new THREE.Vector3(S.bombPos.x - p.x, 0, S.bombPos.z - p.z).normalize();
              moveDir.copy(to);
              b._defuseProgress = 0;
            } else {
              moveDir.set(0,0,0);
              b._defuseProgress = (b._defuseProgress || 0) + dt;
              if(b._defuseProgress >= defuseTime){
                defuseBomb();
                b._defuseProgress = 0;
              }
            }
          }
          sdHandled = true;
        }
        else if(b.team === 'merc' && !S.bombPlanted){
          const d = Math.hypot(p.x - targetSite.x, p.z - targetSite.z);
          if(d > 6){
            const to = new THREE.Vector3(targetSite.x - p.x, 0, targetSite.z - p.z).normalize();
            moveDir.copy(to);
          } else {
            moveDir.multiplyScalar(0.15);
          }
          sdHandled = true;
        }
      }

      if(!sdHandled){
        const enemyBase = b.team === 'merc' ? CARTEL_BASE : MERC_BASE;
        const ownBase = b.team === 'merc' ? MERC_BASE : CARTEL_BASE;

        if(bestTarget){
          const to = new THREE.Vector3(bestTarget.pos.x - p.x, 0, bestTarget.pos.z - p.z);
          const dist = to.length();
          to.normalize();

          if(dist > tuning.range + 4){
            moveDir.copy(to);
          } else if(dist < tuning.range - 4){
            moveDir.copy(to).multiplyScalar(-0.7);
          } else {
            if(Math.random() < 0.01) b._strafeDir = -b._strafeDir;
            const strafe = new THREE.Vector3(-to.z, 0, to.x);
            moveDir.copy(strafe).multiplyScalar(b._strafeDir * tuning.strafe);
          }
          shouldShoot = true;
        } else {
          let destination;
          if(b.role === 'CAMPER'){
            if(!b._campPoint || p.distanceTo(b._campPoint) < 2.5){
              const ang = Math.random() * Math.PI * 2;
              const rad = 15 + Math.random() * 15;
              b._campPoint = new THREE.Vector3(enemyBase.x + Math.cos(ang) * rad, 0, enemyBase.z + Math.sin(ang) * rad);
            }
            destination = b._campPoint;
          } else if(b.role === 'SNIPER'){
            if(!b._campPoint){
              const midX = (enemyBase.x + ownBase.x) * 0.5;
              const midZ = (enemyBase.z + ownBase.z) * 0.5;
              const sideOffset = (Math.random() - 0.5) * 40;
              b._campPoint = new THREE.Vector3(midX + sideOffset, 0, midZ + sideOffset * 0.5);
            }
            destination = b._campPoint;
          } else if(b.role === 'DEFENDER'){
            const midZ = (enemyBase.z + ownBase.z) * 0.35;
            if(!b._defendPoint || p.distanceTo(b._defendPoint) < 3){
              b._defendPoint = new THREE.Vector3((Math.random() - 0.5) * 40, 0, midZ + (Math.random() - 0.5) * 20);
            }
            destination = b._defendPoint;
          } else if(b.role === 'FLANKER'){
            if(!b._flankPoint || p.distanceTo(b._flankPoint) < 3){
              const side = Math.random() < 0.5 ? 1 : -1;
              b._flankPoint = new THREE.Vector3(enemyBase.x + side * 30 + (Math.random() - 0.5) * 20, 0, enemyBase.z + (Math.random() - 0.5) * 20);
            }
            destination = b._flankPoint;
          } else {
            destination = b.lastSeenEnemy || enemyBase;
            if(b.lastSeenEnemy && p.distanceTo(b.lastSeenEnemy) < 3){
              b.lastSeenEnemy = null;
              destination = enemyBase;
            }
          }

          const toDest = new THREE.Vector3(destination.x - p.x, 0, destination.z - p.z);
          const dDest = toDest.length();
          if(dDest > 1.0){
            moveDir.copy(toDest).normalize();
          } else {
            b._campPoint = null;
            b._defendPoint = null;
            b._flankPoint = null;
            const toEnemy = new THREE.Vector3(enemyBase.x - p.x, 0, enemyBase.z - p.z).normalize();
            moveDir.copy(toEnemy);
          }
        }
      }
    }

    /* ──── 4. SPAWN PROTECTION ──── */
    if(S.gameMode !== 'ffa' && moveDir.lengthSq() > 0.001){
      const testNext = p.clone();
      testNext.x += moveDir.x * 0.5;
      testNext.z += moveDir.z * 0.5;
      if(wouldEnterEnemySpawn(testNext, b.team, 0.7)){
        const away = computeRetreatFromSpawn(p, b.team);
        const perp = new THREE.Vector3(-away.z, 0, away.x);
        moveDir.copy(perp).multiplyScalar(b._strafeDir || 1);
      }
    }

    /* ──── 5. MOVE ──── */
    if(moveDir.lengthSq() > 0.001){
      const speedMul = 1.0;

            const _diff = getDifficultyMultipliers();
      const botWep = getWeapon(b.weaponId);
      const isMelee = (botWep && botWep.melee);
      const meleeBoost = 1.0;
      const baseRun = isMelee ? 1.0 : 1.85;
      const GLOBAL_BOT_RUN = baseRun * _diff.speedMult;
      const sdBoost = (S.gameMode === 'sd') ? 1.35 : 1.15;

      let plantedBoost = 1.0;
      if(S.gameMode === 'sd' && S.bombPlanted){
        if(b.team === 'merc') plantedBoost = 1.60;
        else if(b.team === 'cartel' && S.bombTimer < 10) plantedBoost = 1.40;
      }

      // ⭐ OOP — mode-specific bot speed modifier
      const modeMult = (S.activeMode && S.activeMode.getBotSpeedMult) ? S.activeMode.getBotSpeedMult(b, S) : 1.0;
      const totalSpeed = b.speed * speedMul * tuning.speed * meleeBoost * sdBoost * GLOBAL_BOT_RUN * plantedBoost * modeMult;
      const stepX = moveDir.x * totalSpeed * dt;
      const stepZ = moveDir.z * totalSpeed * dt;
      const now = performance.now();

      if(b._escapeUntil && now < b._escapeUntil && b._escapeVec){
        const escStep = totalSpeed * dt;
        const tryEsc = p.clone();
        tryEsc.x += b._escapeVec.x * escStep;
        tryEsc.z += b._escapeVec.z * escStep;
        tryEsc.y = 0;
        const preX = tryEsc.x, preZ = tryEsc.z;
        collideBot(tryEsc, 0.65);
        const pushDist = Math.hypot(tryEsc.x - preX, tryEsc.z - preZ);

        if(pushDist > 0.03){
          b._escapeUntil = 0;
          b._escapeVec = null;
          b._stuckT = 0.5;
        } else {
          p.x = tryEsc.x; p.z = tryEsc.z; p.y = 0;
        }
      } else {
        if(b._escapeUntil) { b._escapeUntil = 0; b._escapeVec = null; }

        const tryMain = p.clone();
        tryMain.x += stepX; tryMain.z += stepZ; tryMain.y = 0;
        const preMainX = tryMain.x, preMainZ = tryMain.z;
        collideBot(tryMain, 0.65);
        const mainPush = Math.hypot(tryMain.x - preMainX, tryMain.z - preMainZ);
        const blockedMain = mainPush > 0.05;

        if(!blockedMain){
          p.x = tryMain.x; p.z = tryMain.z; p.y = 0;
          b._stuckT = 0;
        } else {
          let moved = false;
          const perpA_X = -stepZ, perpA_Z = stepX;
          const perpB_X = stepZ, perpB_Z = -stepX;

          for(const perp of [[perpA_X, perpA_Z], [perpB_X, perpB_Z]]){
            const tryP = p.clone();
            tryP.x += perp[0]; tryP.z += perp[1]; tryP.y = 0;
            const prePX = tryP.x, prePZ = tryP.z;
            collideBot(tryP, 0.65);
            if(Math.hypot(tryP.x - prePX, tryP.z - prePZ) < 0.05){
              p.x = tryP.x; p.z = tryP.z; p.y = 0;
              moved = true;
              break;
            }
          }

          if(!moved){
            b._stuckT += dt;
            if(b._stuckT > 0.12){
              const curLen = Math.hypot(moveDir.x, moveDir.z) || 1;
              const cdx = moveDir.x / curLen, cdz = moveDir.z / curLen;

              let bestDir = null, bestScore = -Infinity;
              for(let i = 0; i < 24; i++){
                const ang = (i / 24) * Math.PI * 2;
                const dx = Math.cos(ang), dz = Math.sin(ang);
                let clearDist = 0;
                for(let s = 1; s <= 20; s++){
                  const probe = new THREE.Vector3(p.x + dx * 0.35 * s, 0, p.z + dz * 0.35 * s);
                  const preX = probe.x, preZ = probe.z;
                  collideBot(probe, 0.65);
                  if(Math.hypot(probe.x - preX, probe.z - preZ) > 0.05) break;
                  clearDist = s * 0.35;
                }
                const dot = dx * cdx + dz * cdz;
                const score = clearDist * 1.0 + (1 - dot) * 3.0;
                if(score > bestScore){
                  bestScore = score;
                  bestDir = { x: dx, z: dz, dist: clearDist };
                }
              }

              if(bestDir && bestDir.dist > 0.4){
                b._escapeVec = new THREE.Vector3(bestDir.x, 0, bestDir.z);
                b._escapeUntil = now + 1400;
                b._stuckT = 0;
              } else {
                const tryNudge = p.clone();
                tryNudge.x += cdx * 0.20;
                tryNudge.z += cdz * 0.20;
                tryNudge.y = 0;
                collideBot(tryNudge, 0.65);
                p.x = tryNudge.x; p.z = tryNudge.z; p.y = 0;
                b._stuckT = 0;
                b._escapeUntil = 0;
                b._escapeVec = null;
              }
            }
          }
        }
      }
    }

    /* ──── 6. FACE TARGET ──── */
    if(bestTarget){
      b.mesh.rotation.y = Math.atan2(bestTarget.pos.x - p.x, bestTarget.pos.z - p.z) + Math.PI;
    } else if(moveDir.lengthSq() > 0.001){
      b.mesh.rotation.y = Math.atan2(moveDir.x, moveDir.z) + Math.PI;
    }

    /* ──── 7. WALK ANIMATION ──── */
    const legL = b.mesh.userData.legL, legR = b.mesh.userData.legR;
    const isMoving = moveDir.lengthSq() > 0.001;
    if(isMoving){
      b.mesh.userData._walkT = (b.mesh.userData._walkT || 0) + dt * 9;
      const swing = Math.sin(b.mesh.userData._walkT) * 0.6;
      if(legL) legL.rotation.x = swing;
      if(legR) legR.rotation.x = -swing;
    } else {
      if(legL) legL.rotation.x *= 0.85;
      if(legR) legR.rotation.x *= 0.85;
    }

    /* ──── 7.5 BOT ITEM USAGE ──── */
    const duringBuyPhase = (S.gameMode === 'infection' && S.buyPhaseActive);
    if(!duringBuyPhase){
      b._itemCooldown = (b._itemCooldown || 0) - dt;
      b._grenadeCooldown = (b._grenadeCooldown || 0) - dt;

      if(b.inventory && b.inventory.turret > 0 && S.round >= 3 && b._lastTurretRound < S.round){
        if(Math.random() < 0.5){
          if(!bestTarget || bestDist > 20 || b.role === 'DEFENDER' || b.role === 'CAMPER'){
            if(window._spawnBotTurret){
              if(window._spawnBotTurret(b)){
                b.inventory.turret--;
                b._lastTurretRound = S.round;
                beep(650, 0.15, 'square', 0.08);
              }
            }
          }
        } else {
          b._lastTurretRound = S.round;
        }
      }

      if(b.inventory && b.inventory.grenade > 0 && b._grenadeCooldown <= 0 && bestTarget && S.round >= 2){
        if(bestDist > 8 && bestDist < 25 && Math.random() < 0.15){
          if(window._spawnBotGrenade){
            if(window._spawnBotGrenade(b, bestTarget.pos, 'grenade')){
              b.inventory.grenade--;
              b._grenadeCooldown = 3 + Math.random() * 3;
            }
          }
        }
      }

      if(b.inventory && b._grenadeCooldown <= 0 && S.round >= 3){
        if(b.inventory.smoke > 0 && (!bestTarget || b.role === 'DEFENDER') && Math.random() < 0.05){
          const smokeTarget = b.mesh.position.clone();
          const fwd = new THREE.Vector3(-Math.sin(b.mesh.rotation.y), 0, -Math.cos(b.mesh.rotation.y));
          smokeTarget.addScaledVector(fwd, 8);
          if(window._spawnBotGrenade){
            if(window._spawnBotGrenade(b, smokeTarget, 'smoke')){
              b.inventory.smoke--;
              b._grenadeCooldown = 4 + Math.random() * 3;
            }
          }
        }
        else if(b.inventory.flash > 0 && bestTarget && bestDist > 6 && bestDist < 20 && Math.random() < 0.08){
          if(window._spawnBotGrenade){
            if(window._spawnBotGrenade(b, bestTarget.pos, 'flash')){
              b.inventory.flash--;
              b._grenadeCooldown = 5 + Math.random() * 3;
            }
          }
        }
      }

      if(b.inventory && b.inventory.mine > 0 && S.round >= 3 && b._itemCooldown <= 0){
        if((b.role === 'DEFENDER' || b.role === 'CAMPER') && !bestTarget && Math.random() < 0.03){
          const mineMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8),
            flat(0x3a3a3a)
          );
          const mp = b.mesh.position.clone(); mp.y = 0.05;
          mineMesh.position.copy(mp);
          scene.add(mineMesh);
          if(!S.placedMines) S.placedMines = [];
          S.placedMines.push({
            mesh: mineMesh, pos: mp.clone(),
            dmg: 220, radius: 4.5, team: b.team,
            alive: true, armT: 2.0, trigger: 2.0
          });
          b.inventory.mine--;
          b._itemCooldown = 5;
          beep(400, 0.15, 'square', 0.06);
        }
      }
    }

    /* ──── 8. SHOOT / MELEE ──── */
    b.fireT -= dt;
    if(shouldShoot && bestTarget && b.fireT <= 0 && S.roundActive){
    const _diff2 = getDifficultyMultipliers();
      // ⭐ MELEE BOT — slash lang, walang tracer
      if(wep.melee){
        const dist = p.distanceTo(bestTarget.pos);
        const meleeRange = (wep.rangeMelee || 2.4) + 0.4;

        if(dist <= meleeRange){
          b.fireT = (wep.fireRate || 0.5) * 1.15 + Math.random() * 0.15;

          // Whoosh sound
          beep(180, 0.08, 'triangle', 0.08);

          // ⭐ Backstab check (mode-specific)
          let dmg = wep.dmg;
          let isBackstab = false;
          if(S.activeMode && typeof S.activeMode.modifyMeleeDamage === 'function'){
            // Only for player target (backstab on player)
            if(bestTarget.type === 'player'){
              const playerYaw = player.yaw;
              const playerFwd = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
              const toBot = new THREE.Vector3().subVectors(b.mesh.position, player.pos).normalize();
              const dot = playerFwd.dot(toBot);
              if(dot < -0.3){
                dmg = S.activeMode.modifyMeleeDamage(dmg, { mesh: { rotation: { y: playerYaw } }, isPlayer: true }, false);
                isBackstab = true;
              }
            }
          }

          // Apply damage
          if(bestTarget.type === 'player'){
            if((S.gameMode === 'ffa' || b.team !== player.team) && window._hurtPlayer){
              window._hurtPlayer(dmg, false, { name: b.name, team: b.team, weapon: wep.name });
            }
          } else if(bestTarget.ref){
            const wasAlive = bestTarget.ref.alive;
            damageBot(bestTarget.ref, dmg, false, { name: b.name, team: b.team, weapon: wep.name });
            if(wasAlive && !bestTarget.ref.alive) b.botKills++;
          }
        } else {
          // Too far — recheck next frame quickly
          b.fireT = 0.1;
        }
        return; // ⭐ WALANG tracer/tuloy sa shooting code
      }

      // === RANGED WEAPON (normal shooting) ===
      b.fireT = Math.max(0.08, (wep.fireRate * 1.15 + Math.random() * 0.15) * _diff2.fireRateMult);
      if(b.fireT < 0.08) b.fireT = 0.08;

      const from = p.clone().setY(1.35);
      const to = bestTarget.pos.clone().setY(bestTarget.type === 'player' ? player.eye : 1.2);
      const dist = from.distanceTo(to);

      if(losClear(from, to)){
        const baseAcc = (S.AI_TUNING && S.AI_TUNING.accuracy) || 1.0;
        const distPenalty = Math.max(0.55, 1 - dist * 0.006);
        const hitChance = Math.min(0.92, baseAcc * 0.85 * distPenalty * (b.accuracy || 1) * 1.4 * _diff2.accMult);
        const willHit = Math.random() < hitChance;

        const tracerEnd = willHit
          ? to.clone()
          : to.clone().add(new THREE.Vector3(
              (Math.random()-0.5) * 3,
              (Math.random()-0.5) * 1.5,
              (Math.random()-0.5) * 3
            ));

        const tr = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([from, tracerEnd]),
          new THREE.LineBasicMaterial({ color: b.team==='merc' ? 0x6ec6ff : (b.team==='zombie' ? 0xff6030 : 0xff6a4a) })
        );
        scene.add(tr); S.tracers.push({ t: tr, life: 0.07 });
        beep(200, 0.05, 'square', 0.04);

        if(willHit){
          const mult = damageAtRange(wep, dist);
          const dmg = Math.max(4, Math.round(wep.dmg * mult * 0.9));
          if(bestTarget.type === 'player'){
            if((S.gameMode === 'ffa' || b.team !== player.team) && window._hurtPlayer){
              window._hurtPlayer(dmg, false, { name: b.name, team: b.team, weapon: wep.name });
            }
          } else if(bestTarget.ref){
            const wasAlive = bestTarget.ref.alive;
            damageBot(bestTarget.ref, dmg, false, { name: b.name, team: b.team, weapon: wep.name });
            if(wasAlive && !bestTarget.ref.alive) b.botKills++;
          }
        }

        if(!b._burstLeft) b._burstLeft = 0;
        b._burstLeft++;
        if(b._burstLeft >= 3 + Math.floor(Math.random() * 3)){
          b._burstLeft = 0;
          b.fireT += 0.3 + Math.random() * 0.4;
        }
      }
    }
  }

  /* ──── BOT SEPARATION ──── */
  for(let i = 0; i < bots.length; i++){
    const a = bots[i];
    if(!a.alive) continue;
    for(let j = i+1; j < bots.length; j++){
      const b = bots[j];
      if(!b.alive) continue;
      const dx = b.mesh.position.x - a.mesh.position.x;
      const dz = b.mesh.position.z - a.mesh.position.z;
      const d2 = dx*dx + dz*dz;
      if(d2 < 2.25 && d2 > 0.01){
        const d = Math.sqrt(d2);
        const overlap = (1.5 - d) * 0.35;
        const nx = dx/d, nz = dz/d;
        a.mesh.position.x -= nx * overlap;
        a.mesh.position.z -= nz * overlap;
        b.mesh.position.x += nx * overlap;
        b.mesh.position.z += nz * overlap;
      }
    }
  }

  // ⭐ Collision re-check
  for(const b of bots){
    if(!b.alive) continue;
    const preX = b.mesh.position.x, preZ = b.mesh.position.z;
    collideBot(b.mesh.position, 0.65);
    const pushed = Math.hypot(b.mesh.position.x - preX, b.mesh.position.z - preZ);
    if(pushed > 0.15) b._stuckT = 0;
  }
}

export function damageBot(b, dmg, head, killerInfo){
  if(!b.alive) return;

  if(b.kind === 'tanker'){
    const wname = ((killerInfo && killerInfo.weapon) || '').toUpperCase();
    let mult = 0.20;
    if(wname.includes('BARRETT'))       mult = 2.00;
    else if(wname.includes('AWP'))      mult = 1.50;
    else if(wname.includes('SCOUT'))    mult = 1.50;
    else if(wname.includes('RPG'))      mult = 1.50;
    else if(wname.includes('EXPLOSION'))mult = 1.50;
    else if(wname.includes('CANNON'))   mult = 1.80;
    else if(wname.includes('ARTILLERY'))mult = 1.80;
    else if(wname.includes('M249'))     mult = 0.70;
    else if(wname.includes('PKM'))      mult = 0.70;
    else if(wname.includes('SHOTGUN'))  mult = 0.50;
    else if(wname.includes('DEAGLE'))   mult = 0.40;
    else if(wname.includes('AK'))       mult = 0.50;
    else if(wname.includes('M4'))       mult = 0.50;
    else if(wname.includes('SCAR'))     mult = 0.50;
    else if(wname.includes('GALIL'))    mult = 0.50;
    else if(wname.includes('M1911'))    mult = 0.15;
    else if(wname.includes('GLOCK'))    mult = 0.10;
    else if(wname.includes('UZI'))      mult = 0.10;
    else if(wname.includes('MP5'))      mult = 0.10;
    else if(wname.includes('P90'))      mult = 0.10;
    else if(wname.includes('KNIFE'))    mult = 0.02;
    else if(wname.includes('ZOMBIE'))   mult = 0.02;
    dmg = Math.max(1, Math.round(dmg * mult));
  }

  if(b.armor > 0 && !head){
    const absorbed = Math.min(b.armor, dmg * b.armorReduction);
    b.armor -= absorbed; dmg -= absorbed;
    if(b.armor <= 0) b.armor = 0;
  }
  b.hp -= dmg;
  beep(head?900:600, 0.05, 'triangle', 0.12);

  if(b.kind === 'runner' && b.alive){
    const shooterPos = S.player ? S.player.pos : null;
    if(shooterPos){
      const dx = b.mesh.position.x - shooterPos.x;
      const dz = b.mesh.position.z - shooterPos.z;
      const len = Math.hypot(dx, dz) || 1;
      const kbSpeed = Math.min(20, Math.max(8, dmg * 0.3));
      b._knockbackVec = new THREE.Vector3(dx/len, 0, dz/len);
      b._knockbackUntil = performance.now() + 280;
      b._knockbackSpeed = kbSpeed;
    }
  }
  if(b.hp <= 0){
    b.alive = false;
    b.mesh.rotation.x = Math.PI/2; b.mesh.position.y = 0.4;
    beep(150, 0.25, 'sawtooth', 0.18);

    if(b.hasBomb){
      b.hasBomb = false;
      if(window._dropBombAt) window._dropBombAt(b.mesh.position.clone());
    }

    const killer = killerInfo || { name:'WORLD', team:null };
    const kfWeapon = killer.weapon || 'RIFLE';
    addKillfeed(killer.name, b.name, kfWeapon, null, killer.team, b.team);
    if(killer.name === 'YOU'){
      const player = S.player;
      if(player){ player.kills++; S.kills++; player.money += b.reward; reportPlayerKill(); }
    }

    if(b.team === 'cartel') S.mercScore++;
    else if(b.team === 'merc') S.cartelScore++;

    spawnAmmoPickup(b.mesh.position);
    if(b.weaponId !== 'zombie_hand'){
      spawnWeaponDrop(b.mesh.position, b.weaponId);
    }
    updateHUD(); refreshRenameList(); checkGameEnd();

        // ⭐ OOP — continuous modes (DM, Knife, Sniper) respawn bots
        const isContinuous = (
          S.gameMode === 'ffa' || S.gameMode === 'dm' ||
          (S.activeMode && S.activeMode.allowsBotRespawn)
        );
    if(isContinuous){
      setTimeout(() => {
        if(!b.alive && isContinuous && S.gameState === 'playing' && S.roundActive){
          let spawnPos;
          const useTeam = (S.gameMode === 'dm' || (S.activeMode && S.activeMode.usesTeamSpawn));
          if(useTeam){
            const pts = pickSpawnPoints(b.team);
            const pt = pts[Math.floor(Math.random() * pts.length)];
            spawnPos = new THREE.Vector3(pt[0] + (Math.random()-0.5)*4, 0, pt[1] + (Math.random()-0.5)*4);
          } else {
            spawnPos = getFFARespawnPoint();
          }


          b.mesh.position.copy(spawnPos);
          b.mesh.rotation.x = 0;
          b.mesh.rotation.y = 0;
          b.hp = b.maxHp;
          b.alive = true;
          b.armor = 200;
          b.armorMax = 200;
          b.armorReduction = 0.70;
          b.helmet = 200;
          b.helmetMax = 200;
          b.helmetReduction = 0.70;
          b.hasArmor = true;
          b.blinded = 0;
          b.healingT = 0;
          b.lastSeenEnemy = null;
          b._escapeUntil = 0;
          b._escapeVec = null;
          b._campPoint = null;
          b._defendPoint = null;
          b._flankPoint = null;
          initBotInventory(b);
          refreshRenameList();
        }
      }, 4000);
    }
  }
}

export function convertBotToZombie(bot, attacker){
  if(!bot || !bot.alive) return;
  if(bot.team === 'zombie') return;

  bot.team = 'zombie';
  bot.weaponId = 'zombie_hand';
  bot.hp = bot.maxHp;
  bot.alive = true;
  bot.armor = 0;
  bot.armorReduction = 0;
  bot.role = 'OFFENSIVE';
  bot.lastSeenEnemy = null;
  bot._campPoint = null;
  bot._defendPoint = null;
  bot._flankPoint = null;
  bot.name = 'ZOMBIE-' + (bot.name.split('-').pop() || Math.floor(Math.random()*99));

  const pos = bot.mesh.position.clone();
  scene.remove(bot.mesh);
  bot.mesh = buildBotMesh(bot.kind, 'zombie', 'zombie_hand');
  bot.mesh.position.copy(pos);
  scene.add(bot.mesh);

  addKillfeed(attacker?.name || 'ZOMBIE', bot.name, 'ZOMBIE BITE', null, 'zombie', 'merc');
  updateHUD();
  refreshRenameList();
}

window._convertToZombie = (target, attacker) => {
  if(!target) return;
  if(target.isBot) convertBotToZombie(target, attacker);
  else if(target === S.player) window._convertPlayerToZombie?.(attacker);
};

window._meleeOnHit = (weaponId, target, attacker) => {
  if(weaponId === 'zombie_hand') window._convertToZombie(target, attacker);
};

export function resetBotNameCounters(){ S.botNameCounters = { merc:0, cartel:0, zombie:0, survivor:0 }; }
window._getAllBots = () => bots;

export function promoteBotToZombieKind(bot, newKind){
  if(!bot || !bot.alive) return;
  if(bot.team === 'zombie' && bot.kind === newKind) return;

  bot.team = 'zombie';
  bot.kind = newKind;
  bot.weaponId = 'zombie_hand';
  bot.armor = 0;
  bot.armorReduction = 0;
  bot.role = 'OFFENSIVE';
  bot.lastSeenEnemy = null;
  bot._campPoint = null;
  bot._defendPoint = null;
  bot._flankPoint = null;
  bot._knockbackUntil = 0;
  bot._knockbackVec = null;
  bot._knockbackSpeed = 0;

  if(newKind === 'tanker'){
    bot.hp = 1500; bot.maxHp = 1500;
    bot.speed = 1.15 + Math.random() * 0.2;
    bot.reward = 5000;
    bot.name = '☣ ' + (['BEHEMOTH','COLOSSUS','LEVIATHAN','HYDRA','OGRE'][Math.floor(Math.random()*5)]) + '-' + (Math.floor(Math.random()*99)+1);
  } else if(newKind === 'runner'){
    bot.hp = 1000; bot.maxHp = 1000;
    bot.speed = 3.5;
    bot.reward = 800;
    bot.name = '⚡ ' + (['SPRINTER','DASHER','CHARGER','BOLT','RUSH','BLITZ'][Math.floor(Math.random()*6)]) + '-' + (Math.floor(Math.random()*99)+1);
  } else {
    bot.hp = 250; bot.maxHp = 250;
    bot.speed = 2.2 * 1.45;
    bot.reward = 200;
    bot.name = 'ZOMBIE-' + (Math.floor(Math.random()*99)+1);
  }

  const pos = bot.mesh.position.clone();
  scene.remove(bot.mesh);
  bot.mesh = buildBotMesh(newKind, 'zombie', 'zombie_hand');
  bot.mesh.position.copy(pos);
  scene.add(bot.mesh);

  addKillfeed('SYSTEM', bot.name, 'INFECTED', null, 'zombie', 'survivor');
  updateHUD();
  refreshRenameList();
}

window._promoteBotToZombieKind = (bot, kind) => promoteBotToZombieKind(bot, kind);

export function rebuildBotMesh(bot, kind, team, weaponId){
  if(!bot || !bot.mesh) return;
  const pos = bot.mesh.position.clone();
  const rotY = bot.mesh.rotation.y;
  scene.remove(bot.mesh);
  bot.mesh = buildBotMesh(kind, team, weaponId);
  bot.mesh.position.copy(pos);
  bot.mesh.rotation.y = rotY;
  scene.add(bot.mesh);
}
window._rebuildBotMesh = (bot, kind, team, weaponId) => rebuildBotMesh(bot, kind, team, weaponId);