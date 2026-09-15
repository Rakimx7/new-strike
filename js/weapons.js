import * as THREE from 'three';
import { scene, viewRig, camera, solids, muzzleFlashLight, flat } from './world.js';
import { S, getCustomWeapons, getCustomArmors, getCustomEquipment } from './state.js';
import { BASE_WEAPONS, BASE_ARMORS, BASE_EQUIPMENT, DEFAULT_VISUALS } from './data/game_data.js';
import { beep } from './utils.js';
import { PENETRATION_THRESHOLD, PENETRATION_DAMAGE_LOSS, MAX_PENETRATIONS } from './core/config.js';

export function allWeapons(){ return { ...BASE_WEAPONS, ...getCustomWeapons() }; }
export function allArmors(){ return { ...BASE_ARMORS, ...getCustomArmors() }; }
export function allEquipment(){ return { ...BASE_EQUIPMENT, ...getCustomEquipment() }; }
export function getWeapon(id){ return allWeapons()[id]; }
export function getEquipment(id){ return allEquipment()[id]; }
export function ensureAmmo(id){
  if(!S.ammoState[id]){
    const w = getWeapon(id); if(!w) return;
    S.ammoState[id] = { ammo: w.mag===Infinity?Infinity:w.mag, reserve: w.reserveMax===Infinity?Infinity:w.reserveMax };
  }
}

// =========================================================
// ⭐ AIM RAY — TPS + FPS AWARE
// FPS: player.yaw/pitch (fresh data)
// TPS: camera.quaternion (kasi camera ang reference ng crosshair)
// =========================================================
function getAimRay(spread = 0){
  const p = S.player;
  if(!p) return { origin: new THREE.Vector3(), dir: new THREE.Vector3(0,0,-1) };

  let dir, origin;

  if(S.cameraMode === 'tps' && !S.spectatorMode){
    /* ══════════════════════════════════════════════════════════
       TPS MODE — Use camera's forward direction
       Sa TPS, ang crosshair ay nasa SCREEN CENTER, which
       corresponds to camera's forward ray. Kaya dapat
       camera.quaternion ang gamitin, HINDI player.yaw/pitch.
       ══════════════════════════════════════════════════════════ */
    camera.updateMatrixWorld(true);
    dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    // Origin: camera position (para pareho sa crosshair)
    origin = camera.position.clone();
  } else {
    /* ══════════════════════════════════════════════════════════
       FPS MODE — Use player.yaw/pitch directly
       Fresh data, walang stale-camera issue. Ang camera sa FPS
       ay nagma-match sa player yaw/pitch so pareho ang visual
       at raycast reference.
       ══════════════════════════════════════════════════════════ */
    const pitch = p.pitch;
    dir = new THREE.Vector3(0, 0, -1)
      .applyEuler(new THREE.Euler(pitch, p.yaw, 0, 'YXZ'));
    // Origin: eye position (player.pos is already at eye height)
    origin = p.pos.clone();
  }

  // Apply spread (circular pattern perpendicular to forward)
  if(spread > 0){
    const worldUp = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(dir, worldUp);
    if(right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const angle  = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * spread * 0.5;
    dir.addScaledVector(right, Math.cos(angle) * radius);
    dir.addScaledVector(up,    Math.sin(angle) * radius);
    dir.normalize();
  }

  return { origin, dir };
}

// =========================================================
// VIEWMODELS
// =========================================================
function getVisual(w){ return { ...(DEFAULT_VISUALS[w.category]||DEFAULT_VISUALS.rifle), ...(w.visual||{}) }; }

function buildProceduralViewModel(w){
  const v = getVisual(w); const g = new THREE.Group(); const cat = w.category;
  const matBody = flat(v.bodyColor), matAccent = flat(v.accentColor), matBarrel = flat(v.barrelColor),
        matScope = flat(v.scopeColor), matMag = flat(v.magColor);

        
  if(cat === 'melee'){
    // ⭐ ZOMBIE HAND — special melee model
    if(w.name && w.name.toUpperCase().includes('ZOMBIE')){
      const skinMat = flat(0x4a6a3a);
      const nailMat = flat(0x1a1a1a);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.18), skinMat);
      g.add(palm);
      for (let i = 0; i < 4; i++) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.18), skinMat);
        finger.position.set(-0.06 + i * 0.04, 0.02, -0.16);
        finger.rotation.x = -0.15;
        g.add(finger);
        const nail = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), nailMat);
        nail.position.set(-0.06 + i * 0.04, 0.02, -0.26);
        nail.rotation.x = -Math.PI / 2;
        g.add(nail);
      }
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.12), skinMat);
      thumb.position.set(0.09, 0.01, -0.05);
      thumb.rotation.y = -0.5;
      g.add(thumb);
      const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.15), skinMat);
      wrist.position.z = 0.15;
      g.add(wrist);
    } else {
      // Standard knife
      const handle = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW, v.bodyH, v.bodyLen), matBody);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW * 0.5, v.bodyH * 0.9, v.barrelLen), flat(0xd8dee2));
      blade.position.set(0, v.bodyH * 0.15, -v.bodyLen/2 - v.barrelLen/2 + 0.05);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW * 3, v.bodyH * 1.2, 0.03), matAccent);
      guard.position.set(0, v.bodyH * 0.2, -v.bodyLen/2 + 0.02);
      g.add(handle, blade, guard);
    }
  } else if(cat === 'launcher'){
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(v.barrelR, v.barrelR, v.bodyLen, 10), matBody);
    tube.rotation.x = Math.PI/2; tube.position.set(0,0,-v.bodyLen*0.1);
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(v.barrelR*1.3, 0.28, 10), flat(0xb04a3a));
    warhead.rotation.x = -Math.PI/2; warhead.position.set(0, 0, -v.bodyLen/2 - 0.1);
    g.add(tube, warhead);
  } else if(cat === 'cannon'){
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(v.barrelR, v.barrelR, v.bodyLen, 12), matBody);
    tube.rotation.x = Math.PI/2; tube.position.set(0, 0.02, -v.bodyLen*0.1);
    g.add(tube);
  } else if(cat === 'flamethrower'){
    const body = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW, v.bodyH, v.bodyLen), matBody);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(v.barrelR, v.barrelR*0.6, v.barrelLen, 8), matBarrel);
    nozzle.rotation.x = Math.PI/2; nozzle.position.set(0, v.bodyH*0.15, -v.bodyLen/2 - v.barrelLen/2 + 0.02);
    g.add(body, nozzle);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW, v.bodyH, v.bodyLen), matBody); g.add(body);
    if(v.stockLen>0){ const s = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW*0.8, v.stockH||v.bodyH*0.7, v.stockLen), matAccent); s.position.set(0,-0.01,v.bodyLen/2+v.stockLen/2); g.add(s); }
    if(v.barrelLen>0){ const b = new THREE.Mesh(new THREE.CylinderGeometry(v.barrelR, v.barrelR, v.barrelLen, 8), matBarrel); b.rotation.x = Math.PI/2; b.position.set(0, v.bodyH*0.05, -v.bodyLen/2 - v.barrelLen/2 + 0.02); g.add(b); }
    if(v.magLen>0){ const m = new THREE.Mesh(new THREE.BoxGeometry(v.magW, v.magLen, v.magW*1.4), matMag); m.position.set(0, -v.bodyH/2 - v.magLen/2 + 0.05, -v.bodyLen*0.1); g.add(m); }
    if(cat === 'pistol'){
      const grip = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW*0.85, v.bodyH*1.4, v.bodyW*1.1), matAccent);
      grip.position.set(0, -v.bodyH*0.8, v.bodyLen*0.25); g.add(grip);
      const slide = new THREE.Mesh(new THREE.BoxGeometry(v.bodyW*1.05, v.bodyH*0.5, v.bodyLen*0.7), flat(0x555555));
      slide.position.set(0, v.bodyH*0.35, -v.bodyLen*0.05); g.add(slide);
    }
    if((w.scope || v.scopeLen>0.08) && v.scopeLen>0){
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(v.scopeR, v.scopeR, v.scopeLen, 8), matScope);
      sc.rotation.x = Math.PI/2; sc.position.set(0, v.bodyH*0.85, -v.bodyLen*0.15); g.add(sc);
    }
  }
  g.scale.setScalar(v.scale || 1.0);
  g.position.set(v.posX, v.posY, v.posZ);
  g.userData.basePos = g.position.clone();
  g.userData.baseY = g.position.y;
  return g;
}
function buildViewModel(w, id){ return buildProceduralViewModel(w); }

export function getViewModel(id){
  if(!S.viewModels[id]){
    const w = getWeapon(id); if(!w) return null;
    const m = buildViewModel(w, id);
    m.visible = false; viewRig.add(m); S.viewModels[id] = m;
  }
  return S.viewModels[id];
}
export function refreshViewModels(){
  Object.values(S.viewModels).forEach(m => viewRig.remove(m));
  for(const k in S.viewModels) delete S.viewModels[k];
  S.ownedWeapons.forEach(id => getViewModel(id));
  Object.entries(S.viewModels).forEach(([k,m]) => m.visible = (k===S.currentWeaponKey && S.player && S.player.alive));
}
export function renderWeaponBar(){
  const bar = document.getElementById('weaponBar'); if(!bar) return;
  bar.innerHTML = '';
  const maxDisplay = S.player && S.player.hasMilitaryBag ? 30 : 10;
  S.ownedWeapons.slice(0, maxDisplay).forEach((id, i) => {
    const w = getWeapon(id); if(!w) return;
    const div = document.createElement('div');
    div.className = 'slot' + (id===S.currentWeaponKey ? ' active' : '');
    // Slot numbering: 1-9 then 0 for slot 10
    const slotNum = i < 9 ? (i+1) : 0;
    div.textContent = slotNum + ' ' + w.name.split(' ')[0];
    bar.appendChild(div);
  });
}
export function switchWeapon(key){
  if(S.reloading || !S.player || !S.player.alive) return;
  if(!S.ownedWeapons.includes(key)) return;
  if(S.cannonOperating) return;
  S.currentWeaponKey = key; ensureAmmo(key);
  Object.entries(S.viewModels).forEach(([k,m]) => m.visible = (k===key));
  renderWeaponBar();
}

// === Decals ===
export function spawnBulletDecal(point, normal, size){
  // ⭐ Mas madaming segments kapag malaki ang butas (Barrett .50 cal)
  const segments = (size && size >= 0.15) ? 16 : 8;
  const geo = new THREE.CircleGeometry(size || 0.06, segments);
  const mat = new THREE.MeshBasicMaterial({color:0x0a0a0a, transparent:true, opacity:0.9, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2, side:THREE.DoubleSide});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(point).addScaledVector(normal, 0.015);
  mesh.lookAt(point.clone().add(normal));
  scene.add(mesh);
  S.decals.push({ mesh, age:0, life:25 });
  while(S.decals.length > 300){ const d = S.decals.shift(); scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
}

// =========================================================
// ⭐ HIT SPLASH — Blood/impact puff kapag tumama sa bot
// Size = radius. Mas malaki para sa Barrett .50 cal.
// =========================================================
export function spawnHitSplash(pos, radius, isHead){
  const g = new THREE.Group();

  // Main blood puff (dark red mist)
  const puffMat = new THREE.MeshBasicMaterial({
    color: 0x8a0a0a,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), puffMat);
  g.add(puff);

  // Bright inner core (mas maliit, mas maliwanag)
  const coreMat = new THREE.MeshBasicMaterial({
    color: isHead ? 0xff3030 : 0xc02020,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.5, 8, 6), coreMat);
  g.add(core);

  // Outer spray ring — mukhang impact shockwave
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x3a0000,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.7, radius * 1.4, 14), ringMat);
  ring.lookAt(camera.position);  // face camera for maximum visibility
  g.add(ring);

  g.position.copy(pos);
  scene.add(g);

  // Store in tracers array para may auto-cleanup
  S.tracers.push({
    t: g,
    life: 0.4,
    isSplash: true,
    baseRadius: radius,
    startTime: performance.now(),
    puffMat, coreMat, ringMat
  });
}
export function updateDecals(dt){
  for(let i=S.decals.length-1;i>=0;i--){
    const d = S.decals[i]; d.age += dt;
    if(d.age > d.life){ scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); S.decals.splice(i,1); }
    else if(d.age > d.life-4) d.mesh.material.opacity = 0.9 * (1 - (d.age - (d.life-4)) / 4);
  }
}

// === Explosions ===
export function explode(pos, dmg, radius, team){
  beep(60,0.35,'sawtooth',0.25); beep(110,0.2,'square',0.15);
  const flash = new THREE.PointLight(0xffa040, 12, radius*2.5);
  flash.position.copy(pos); scene.add(flash); setTimeout(()=>scene.remove(flash), 140);
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius*0.4, 14, 10), new THREE.MeshBasicMaterial({color:0xff8030, transparent:true, opacity:0.8}));
  s.position.copy(pos); scene.add(s);
  let t=0; const fade = setInterval(()=>{ t+=0.05; s.scale.setScalar(1+t*3); s.material.opacity = Math.max(0,0.8-t*1.8); if(t>0.5){clearInterval(fade); scene.remove(s);} },30);
  const falloff = d => { const n = Math.max(0, 1-d/radius); return 0.2 + 0.8*Math.pow(n,1.8); };
  if(window._damageBotsInRadius) window._damageBotsInRadius(pos, dmg, radius, team, falloff);
  if(window._damagePlayerInRadius) window._damagePlayerInRadius(pos, dmg, radius, team, falloff);
  if(window._damageCannonsInRadius) window._damageCannonsInRadius(pos, dmg, radius, team, falloff);
  if(window._damageTurretsInRadius) window._damageTurretsInRadius(pos, dmg, radius, team, falloff);
}

// =========================================================
// VALORANT-STYLE DAMAGE / RANGE
// =========================================================
function damageAtRange(w, dist, isHead){
  const tiers = w.damageTiers;
  if(Array.isArray(tiers) && tiers.length){
    for(const t of tiers){
      if(dist <= t.max){
        const body = t.body ?? w.dmg ?? 20;
        const head = t.head ?? (body * (w.headMul || 1));
        return Math.max(1, Math.round(isHead ? head : body));
      }
    }
    const last = tiers[tiers.length-1];
    const body = last.body ?? w.dmg ?? 20;
    const head = last.head ?? (body * (w.headMul || 1));
    return Math.max(1, Math.round(isHead ? head : body));
  }
  const rng = w.range || [0, 200];
  const [rMin, rMax] = rng;
  let mult = 1;
  if(dist <= rMin) mult = 1;
  else if(dist >= rMax) mult = w.falloff ?? 0.7;
  else { const t = (dist-rMin)/(rMax-rMin); mult = 1 - t*(1-(w.falloff ?? 0.7)); }
  const base = isHead ? (w.dmg||20)*(w.headMul||1) : (w.dmg||20);
  return Math.max(1, Math.round(base * mult));
}

function getMaxRange(w){
  if(w.maxRange) return w.maxRange;
  if(w.category === 'sniper')  return 500;
  if(w.category === 'rifle')   return 300;
  if(w.category === 'lmg')     return 250;
  if(w.category === 'smg')     return 150;
  if(w.category === 'pistol')  return 100;
  if(w.category === 'shotgun') return 40;
  if(w.melee) return 2.4;
  return 200;
}

function rayAABB(origin, dir, box, maxT){
  const invX = 1/(dir.x||1e-9), invY = 1/(dir.y||1e-9), invZ = 1/(dir.z||1e-9);
  const t1=(box.min.x-origin.x)*invX, t2=(box.max.x-origin.x)*invX;
  const t3=(box.min.y-origin.y)*invY, t4=(box.max.y-origin.y)*invY;
  const t5=(box.min.z-origin.z)*invZ, t6=(box.max.z-origin.z)*invZ;
  const tminX=Math.min(t1,t2), tminY=Math.min(t3,t4), tminZ=Math.min(t5,t6);
  const tmin=Math.max(tminX,tminY,tminZ);
  const tmax=Math.min(Math.max(t1,t2),Math.max(t3,t4),Math.max(t5,t6));
  if(tmin<0 || tmax<tmin || tmin>maxT) return null;
  let normal;
  if(tmin===tminX) normal = new THREE.Vector3(t1<t2?-1:1, 0, 0);
  else if(tmin===tminY) normal = new THREE.Vector3(0, t3<t4?-1:1, 0);
  else normal = new THREE.Vector3(0, 0, t5<t6?-1:1);
  return { entry:tmin, exit:tmax, thickness:tmax-tmin, normal };
}

function getTurretMult(w){
  if(!w) return 1;
  if(w.explosive) return 25;
  if(w.category === 'sniper') return 5;
  if(w.category === 'rifle') return 3;
  if(w.category === 'lmg') return 2;
  if(w.category === 'shotgun') return 2.5;
  if(w.category === 'smg') return 1.5;
  if(w.category === 'pistol') return 1;
  return 1;
}

export function fireBulletRay(w, spread, range, color){
  const { origin, dir } = getAimRay(spread);

  let muzzleStart;
  if(S.cameraMode === 'tps' && S.playerMesh && S.playerMesh.visible && S.playerMesh.userData.gun){
    const gun = S.playerMesh.userData.gun;
    const gunWorld = new THREE.Vector3();
    gun.getWorldPosition(gunWorld);
    const fwd = new THREE.Vector3(-Math.sin(S.player.yaw), 0, -Math.cos(S.player.yaw));
    muzzleStart = gunWorld.clone().addScaledVector(fwd, 0.45);
    muzzleStart.y += 0.02;
  } else if(w.category === 'sniper' && S.adsActive && S.adsT > 0.75){
    // ⭐ Sniper scoped: ilabas ang muzzle sa labas ng scope para hindi humarang
    const scopeOffset = new THREE.Vector3(0, -0.15, -1.8).applyQuaternion(camera.quaternion);
    muzzleStart = origin.clone().add(scopeOffset);
  } else {
    const offset = new THREE.Vector3(0.10, -0.05, -0.35).applyQuaternion(camera.quaternion);
    muzzleStart = origin.clone().add(offset);
  }

  const maxTracerRange = Math.min(range, getMaxRange(w));

  const botMeshes = (window._getEnemyMeshes ? window._getEnemyMeshes() : []);
  const turretMeshes = S.placedTurrets.filter(t => t.alive && t.team !== S.player.team).map(t => t.mesh);
  const cannonMeshes = S.placedCannons.filter(c => c.alive && c.team !== S.player.team).map(c => c.mesh);
  const targetMeshes = [...botMeshes, ...turretMeshes, ...cannonMeshes];

  const targetHits = [];
  if(targetMeshes.length){
    const ray = new THREE.Raycaster(origin, dir, 0, maxTracerRange);
    const hits = ray.intersectObjects(targetMeshes, true);
    for(const h of hits){
      let o = h.object; while(o.parent && o.parent!==scene) o = o.parent;
      const b = window._matchBotMesh ? window._matchBotMesh(o) : null;
      if(b && b.alive){ targetHits.push({ t: h.distance, point: h.point, kind:'bot', target: b }); continue; }
      const tr = S.placedTurrets.find(x => x.mesh === o);
      if(tr && tr.alive){ targetHits.push({ t: h.distance, point: h.point, kind:'turret', target: tr }); continue; }
      const cn = S.placedCannons.find(x => x.mesh === o);
      if(cn && cn.alive){ targetHits.push({ t: h.distance, point: h.point, kind:'cannon', target: cn }); }
    }
  }

  const wallHits = [];
  for(const s of solids){ const hit = rayAABB(origin, dir, s, maxTracerRange); if(hit) wallHits.push({...hit, box:s}); }
  const events = [...targetHits.map(h=>({t:h.t, type:h.kind, data:h})), ...wallHits.map(h=>({t:h.entry, type:'wall', data:h}))].sort((a,b)=>a.t-b.t);

  let dmgMult = 1, endPoint = null, penetrations = 0;

  // ⭐ Determine bullet hole size based on weapon caliber
  let holeSize = 0.06;  // default
  let holeSizePen = 0.05;  // para sa penetration exit hole

  if(w.category === 'sniper'){
    const isBarrett = w.name && w.name.toUpperCase().includes('BARRETT');
    holeSize    = isBarrett ? 0.28 : 0.14;   // ⭐ Barrett = napakalaking butas
    holeSizePen = isBarrett ? 0.22 : 0.10;
  } else if(w.category === 'lmg'){
    holeSize = 0.09; holeSizePen = 0.07;
  } else if(w.category === 'rifle'){
    holeSize = 0.075; holeSizePen = 0.06;
  } else if(w.category === 'smg'){
    holeSize = 0.06; holeSizePen = 0.05;
  } else if(w.category === 'pistol'){
    holeSize = 0.045; holeSizePen = 0.035;
  } else if(w.category === 'shotgun'){
    holeSize = 0.05; holeSizePen = 0.04;
  }

  // ⭐ Function: hit splash size based sa weapon caliber
  function getHitSplashSize(weapon, isHead){
    let size = 0.10;
    if(weapon.category === 'sniper'){
      const isBarrett = weapon.name && weapon.name.toUpperCase().includes('BARRETT');
      size = isBarrett ? 0.35 : 0.20;   // Barrett = napakalaking blood puff
    } else if(weapon.category === 'lmg'){
      size = 0.15;
    } else if(weapon.category === 'rifle'){
      size = 0.10;
    } else if(weapon.category === 'smg'){
      size = 0.075;
    } else if(weapon.category === 'pistol'){
      size = 0.06;
    } else if(weapon.category === 'shotgun'){
      size = 0.09;
    } else if(weapon.category === 'launcher' || weapon.category === 'cannon'){
      size = 0.40;   // explosion type — malaki
    }
    // ⭐ Headshot = 1.5× bigger splash
    if(isHead) size *= 1.5;
    return size;
  }

  for(const ev of events){
    if(ev.type === 'wall'){
      const hp = origin.clone().addScaledVector(dir, ev.data.entry);
      if(ev.data.thickness <= PENETRATION_THRESHOLD && penetrations < MAX_PENETRATIONS){
        penetrations++; dmgMult *= (1 - PENETRATION_DAMAGE_LOSS);
        spawnBulletDecal(hp, ev.data.normal, holeSizePen); continue;
      } else { spawnBulletDecal(hp, ev.data.normal, holeSize); endPoint = hp; break; }
    }
    if(ev.type === 'bot'){
      const b = ev.data.target; if(!b.alive) continue;
      const dist = ev.data.t;
      // ⭐ Scale-aware head Y (tanker = 2x scale)
      const scaleY = (b.mesh.scale && b.mesh.scale.y) || 1;
      const headY = b.mesh.position.y + 1.45 * scaleY;
      const head = ev.data.point.y > headY;
      const dmg = Math.max(1, Math.round(damageAtRange(w, dist, head) * dmgMult));
      if(window._damageBot) window._damageBot(b, dmg, head, { name:'YOU', team:S.player.team, weapon:w.name });
      flashHitmarker();
      // ⭐ Blood splash — size depends sa caliber at kung headshot
      const splashSize = getHitSplashSize(w, head);
      spawnHitSplash(ev.data.point.clone(), splashSize, head);
      endPoint = ev.data.point.clone(); break;
    }
    if(ev.type === 'turret'){
      const t = ev.data.target; if(!t.alive) continue;
      const mult = getTurretMult(w);
      const dmg = Math.round((w.dmg || 20) * mult);
      if(window._damageTurret) window._damageTurret(t, dmg);
      flashHitmarker();
      endPoint = ev.data.point.clone(); break;
    }
    if(ev.type === 'cannon'){
      const c = ev.data.target; if(!c.alive) continue;
      const mult = getTurretMult(w);
      const dmg = Math.round((w.dmg || 20) * mult);
      if(window._damageCannon) window._damageCannon(c, dmg);
      flashHitmarker();
      endPoint = ev.data.point.clone(); break;
    }
  }
  if(!endPoint) endPoint = origin.clone().addScaledVector(dir, maxTracerRange);

  const tracerColor = color || 0xffe866;

  // ⭐ SNIPER: napaka-manipis na tracer para hindi humarang sa scope/aim
  if(w.category === 'sniper'){
    const isBarrett = (w.name && w.name.toUpperCase().includes('BARRETT'));
    const t = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([muzzleStart, endPoint]),
      new THREE.LineBasicMaterial({
        color: isBarrett ? 0xffd84a : 0xffe866,
        transparent: true,
        opacity: 0.5   // mas faint para hindi sagabal sa aim
      })
    );
    scene.add(t);
    // Napaka-ikli ng buhay ng tracer — halos hindi mo makikita
    S.tracers.push({ t, life: 0.035 });
    return;
  }

  // Standard tracer line for other weapons
  const t = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([muzzleStart, endPoint]),
    new THREE.LineBasicMaterial({ color: tracerColor, transparent:true, opacity:0.75 })
  );
  scene.add(t);
  S.tracers.push({ t, life: w.flamethrower ? 0.10 : 0.05 });
}

export function flashHitmarker(){
  const hm = document.getElementById('hitmarker');
  if(!hm) return;
  hm.style.opacity = 1; setTimeout(()=>hm.style.opacity=0, 90);
}
export function muzzleFlash(){ muzzleFlashLight.intensity = 3.2; setTimeout(()=>{ muzzleFlashLight.intensity = 0; }, 45); }

// =========================================================
// SPREAD / RECOIL HELPERS
// =========================================================
function computeSpread(w, player){
  const vel = player.vel || {x:0, z:0};
  const moveSpeed = Math.hypot(vel.x, vel.z);
  const moveFactor = moveSpeed > 0.3 ? Math.min(1, moveSpeed / 7) : 0;
  const spreadBase = w.spread || 0.008;
  let spread;
  if(S.adsActive){
    spread = spreadBase * (w.adsSpreadMult ?? 0.15);
  } else if(player.crouching){
    spread = spreadBase * (w.crouchSpreadMult ?? 0.6);
  } else {
    spread = spreadBase;
  }
  spread *= 1 + moveFactor * (w.moveSpreadMult ?? 1.5);
  if(!w._sprayShots) w._sprayShots = 0;
  const sprayFactor = 1 + Math.min(w._sprayShots, 5) * (w.sprayGrowth ?? 0.06);
  spread *= sprayFactor;
  return Math.max(spread, 0.0004);
}
function computeRecoil(w){
  const baseRecoil = w.recoilPerShot ?? (
    w.category === 'lmg'    ? 0.008 :
    w.category === 'sniper' ? 0.04  :
    w.category === 'rifle'  ? 0.005 :
    w.category === 'smg'    ? 0.004 :
    w.category === 'pistol' ? 0.010 : 0.008
  );
  const mult = 1 + Math.min(w._sprayShots || 0, 5) * 0.04;
  return baseRecoil * mult;
}
function trackSpray(w){
  if(!w._sprayShots) w._sprayShots = 0;
  w._sprayShots++;
  clearTimeout(w._sprayReset);
  w._sprayReset = setTimeout(() => { w._sprayShots = 0; }, 350);
}

// =========================================================
// SHOOT
// =========================================================
export function shoot(){
  const player = S.player;
  if(!player || !player.alive || player.hp <= 0) return;
  if(player.blinded > 0) return;
  if(S.cannonOperating) return;
  const w = getWeapon(S.currentWeaponKey);
  const st = S.ammoState[S.currentWeaponKey];
  if(!w || S.reloading || S.fireCooldown > 0) return;
  if(w.category === 'cannon') return;

  if(w.melee){
    S.fireCooldown = w.fireRate; beep(220,0.08,'triangle',0.15);
    const { origin, dir } = getAimRay(0);
    const ray = new THREE.Raycaster(origin, dir, 0, w.rangeMelee||2.4);
    const targets = (window._getEnemyMeshes ? window._getEnemyMeshes() : []);
    const hits = ray.intersectObjects(targets, true);
    if(hits.length){
      let o = hits[0].object; while(o.parent && o.parent!==scene) o = o.parent;
      const b = window._matchBotMesh ? window._matchBotMesh(o) : null;
      if(b){
        const head = hits[0].point.y > b.mesh.position.y + 1.45;
        const dist = hits[0].distance;
        let dmg = damageAtRange(w, dist, head);
        const origDmg = dmg;

        // ⭐ OOP — mode-specific damage modifier (backstab)
        if(S.activeMode && typeof S.activeMode.modifyMeleeDamage === 'function'){
          dmg = S.activeMode.modifyMeleeDamage(dmg, b, true);
          if(dmg > origDmg && window._showMsg){
            window._showMsg('★ BACKSTAB ★', 700);
            beep(1200, 0.15, 'sine', 0.2);
          }
        }

        window._damageBot(b, dmg, head, { name:'YOU', team:player.team, weapon:w.name });
        flashHitmarker();

        // ⭐ MELEE ONHIT — zombie hand converts target
        if(window._meleeOnHit){
          window._meleeOnHit(S.currentWeaponKey, b, player);
        }
      }
    }
    if(window._updateHUD) window._updateHUD();
    return;
  }

  if(w.explosive){
    if(st.ammo<=0){ startReload(); return; }
    st.ammo--; S.fireCooldown = w.fireRate;
    S.recoil = Math.min(S.recoil + 0.08, 0.20);
    muzzleFlash(); beep(120,0.18,'sawtooth',0.22); fireRocket(); return;
  }

  if(w.flamethrower){
    if(st.ammo<=0){ startReload(); return; }
    st.ammo--; S.fireCooldown = w.fireRate;
    S.recoil = Math.min(S.recoil + 0.005, 0.04);
    muzzleFlash(); beep(80,0.05,'sawtooth',0.12);
    fireBulletRay(w, 0.09, 10, 0xff8030); return;
  }

  if(w.category==='shotgun'){
    if(st.ammo<=0){ startReload(); return; }
    st.ammo--;
    S.fireCooldown = w.fireRate;
    S.recoil = Math.min(S.recoil + computeRecoil(w), w.maxRecoil ?? 0.20);
    muzzleFlash();
    beep(130,0.08,'square',0.22); beep(80,0.15,'triangle',0.18);
    const spread = computeSpread(w, player);
    const pellets = w.pellets || 6;
    for(let i=0;i<pellets;i++) fireBulletRay(w, spread, getMaxRange(w));
    trackSpray(w);
    return;
  }

  if(st.ammo<=0){ startReload(); return; }
  st.ammo--;
  S.fireCooldown = w.fireRate;

  const spread = computeSpread(w, player);
  const recoilAdd = computeRecoil(w);
  S.recoil = Math.min(S.recoil + recoilAdd, w.maxRecoil ?? 0.20);

  muzzleFlash();
  beep(w.category==='lmg'?110:140, 0.06, 'square', 0.2);
  fireBulletRay(w, spread, getMaxRange(w));

  trackSpray(w);
}

export function startReload(){
  const player = S.player;
  if(!player || !player.alive) return;
  const w = getWeapon(S.currentWeaponKey);
  if(!w || S.reloading || w.melee) return;
  const st = S.ammoState[S.currentWeaponKey];
  if(st.ammo === w.mag || st.reserve <= 0) return;
  S.reloading = true; S.adsHeld = false;
  const rh = document.getElementById('reloadHint'); if(rh) rh.style.display = 'block';
  beep(300,0.08,'sawtooth',0.1);
  setTimeout(() => {
    const need = w.mag - st.ammo, take = Math.min(need, st.reserve);
    st.ammo += take; st.reserve -= take;
    S.reloading = false;
    const rh2 = document.getElementById('reloadHint'); if(rh2) rh2.style.display = 'none';
    beep(500,0.08,'sawtooth',0.1);
    if(window._updateHUD) window._updateHUD();
  }, w.reloadMs);
}

// =========================================================
// ROCKET — Proper missile-shaped projectile
// =========================================================
function buildRocketMesh(){
  const g = new THREE.Group();

  // ⭐ Main body — MAS MALAKI para kitang-kita at tumatama sa malayo
  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.24, 1.8, 14);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo,
    new THREE.MeshStandardMaterial({ color: 0x5a6a3a, flatShading: true, roughness: 0.7, metalness: 0.2 })
  );
  g.add(body);

  // Nose cone — mas malaki
  const noseGeo = new THREE.ConeGeometry(0.22, 0.65, 14);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a3a1a, flatShading: true, metalness: 0.3 })
  );
  nose.position.z = 1.20;
  g.add(nose);

  // Red tip stripe
  const tipGeo = new THREE.ConeGeometry(0.22, 0.18, 14);
  tipGeo.rotateX(Math.PI / 2);
  const tip = new THREE.Mesh(tipGeo,
    new THREE.MeshStandardMaterial({ color: 0xc02020, flatShading: true })
  );
  tip.position.z = 1.45;
  g.add(tip);

  // 4 Tail fins — mas malaki
  const finMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true });
  for(let i = 0; i < 4; i++){
    const finGeo = new THREE.BoxGeometry(0.05, 0.55, 0.55);
    const fin = new THREE.Mesh(finGeo, finMat);
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    fin.position.set(Math.cos(ang) * 0.26, Math.sin(ang) * 0.26, -0.65);
    fin.rotation.z = ang;
    g.add(fin);
  }

  // Rear nozzle — mas malaki
  const nozzleGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.24, 14);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzle = new THREE.Mesh(nozzleGeo,
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true })
  );
  nozzle.position.z = -1.00;
  g.add(nozzle);

  // Outer flame (extends toward -Z, behind the rocket)
  const outerFlameGeo = new THREE.ConeGeometry(0.24, 1.0, 10);
  outerFlameGeo.rotateX(-Math.PI / 2);
  const outerFlame = new THREE.Mesh(outerFlameGeo,
    new THREE.MeshBasicMaterial({ color: 0xff8030, transparent: true, opacity: 0.85, depthWrite: false })
  );
  outerFlame.position.z = -1.7;
  g.add(outerFlame);

  // Inner bright core
  const innerFlameGeo = new THREE.ConeGeometry(0.13, 0.7, 10);
  innerFlameGeo.rotateX(-Math.PI / 2);
  const innerFlame = new THREE.Mesh(innerFlameGeo,
    new THREE.MeshBasicMaterial({ color: 0xffe866, transparent: true, opacity: 0.95, depthWrite: false })
  );
  innerFlame.position.z = -1.55;
  g.add(innerFlame);

  // Point light for glow
  const light = new THREE.PointLight(0xffaa40, 5, 14);
  light.position.z = -1.4;
  g.add(light);

  // White smoke trail puffs
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5, depthWrite: false });
  const smokeGeo = new THREE.SphereGeometry(0.15, 6, 6);
  const smoke1 = new THREE.Mesh(smokeGeo, smokeMat); smoke1.position.z = -2.0; g.add(smoke1);
  const smoke2 = new THREE.Mesh(smokeGeo, smokeMat); smoke2.position.z = -2.4; smoke2.scale.setScalar(1.4); g.add(smoke2);

  return g;
}

export function fireRocket(){
  const w = getWeapon(S.currentWeaponKey);
  const { origin, dir } = getAimRay(0);
  const mesh = buildRocketMesh();
  mesh.position.copy(origin).addScaledVector(dir, 2.0);
  // lookAt makes +Z (nose) point toward target
  mesh.lookAt(mesh.position.clone().add(dir));
  scene.add(mesh);
  // ⭐ Mas mabilis + larger collision radius para tumama kahit malayo
  S.projectiles.push({
    mesh, kind:'rocket', team:S.player.team,
    vel: dir.clone().multiplyScalar(75),
    age:0, fuse:10, dmg:w.dmg, radius:w.blastRadius||9,
    noGravity: true,
    collisionRadius: 0.4
  });
}
export function fireRocketOrCannon(){ fireRocket(); }

// =========================================================
// CANNON PLATFORM
// =========================================================
export function buildCannonMesh(){
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 2.2), flat(0x2a2a2a));
  base.position.y = 0.125; base.castShadow = true; base.receiveShadow = true;
  g.add(base);
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.15, 0.4), flat(0x1a1a1a));
  leg1.position.y = 0.08; g.add(leg1);
  const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 3.0), flat(0x1a1a1a));
  leg2.position.y = 0.08; g.add(leg2);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.40, 0.9, 12), flat(0x3a3a3a));
  col.position.y = 0.7; col.castShadow = true; g.add(col);
  const yawGroup = new THREE.Group();
  yawGroup.position.y = 1.15;
  g.add(yawGroup);
  g.userData.yawGroup = yawGroup;
  const pitchGroup = new THREE.Group();
  yawGroup.add(pitchGroup);
  g.userData.pitchGroup = pitchGroup;
  const shield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.12), flat(0x3a3a3a));
  shield.position.set(0, 0.2, 0.6); shield.castShadow = true;
  pitchGroup.add(shield);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.6, 14), flat(0x1a1a1a));
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.15, -1.3);
  barrel.castShadow = true;
  pitchGroup.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.35, 14), flat(0x111111));
  muzzle.rotation.x = Math.PI/2; muzzle.position.set(0, 0.15, -3.2);
  pitchGroup.add(muzzle);
  const breech = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), flat(0x333333));
  breech.position.set(0, 0.15, 0.5); pitchGroup.add(breech);
  const recoil = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), flat(0x666666));
  recoil.rotation.z = Math.PI/2; recoil.position.set(0, 0.55, 0.5); pitchGroup.add(recoil);
  const grip1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.30, 0.08), flat(0x222222));
  grip1.position.set(-0.5, -0.1, 0.9); pitchGroup.add(grip1);
  const grip2 = grip1.clone(); grip2.position.x = 0.5; pitchGroup.add(grip2);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), flat(0x1a1a1a));
  eye.position.set(0, 0.55, 0.9); pitchGroup.add(eye);
  return g;
}

export function placeCannon(){
  const player = S.player;
  if(!player || !player.alive) return;
  const dir = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const pos = player.pos.clone().addScaledVector(dir, 3.0);
  pos.y = 0;
  const mesh = buildCannonMesh();
  mesh.position.copy(pos);
  mesh.rotation.y = player.yaw;
  scene.add(mesh);
  S.placedCannons.push({
    mesh, pos: pos.clone(),
    yaw: player.yaw, pitch: 0.1,
    active: true, alive: true,
    team: player.team,
    fireCooldown: 0,
    hp: 800
  });
  beep(200, 0.3, 'sawtooth', 0.2);
  if(window._showMsg) window._showMsg('CANNON DEPLOYED — walk to it & press [E]', 2200);
}

export function updateCannons(dt){
  for(let i=S.placedCannons.length-1;i>=0;i--){
    const c = S.placedCannons[i];
    if(!c.alive){ scene.remove(c.mesh); S.placedCannons.splice(i,1); continue; }
    if(c.mesh.userData.yawGroup) c.mesh.userData.yawGroup.rotation.y = c.yaw;
    if(c.mesh.userData.pitchGroup) c.mesh.userData.pitchGroup.rotation.x = -c.pitch;
    if(c.fireCooldown > 0) c.fireCooldown -= dt;
  }
}

export function fireCannonShell(cannon){
  const yaw = cannon.yaw;
  const pitch = cannon.pitch;
  const dir = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
  let muzzlePos;
  if(cannon.mesh.userData.yawGroup){
    cannon.mesh.updateMatrixWorld(true);
    muzzlePos = cannon.mesh.userData.yawGroup.localToWorld(new THREE.Vector3(0, 0.15, -3.5));
  } else {
    muzzlePos = cannon.pos.clone();
    muzzlePos.y = 1.3;
  }
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), flat(0x1a1a1a));
  shell.position.copy(muzzlePos);
  scene.add(shell);
  const speed = 50;
  const vel = dir.clone().multiplyScalar(speed);
  S.projectiles.push({
    mesh: shell, kind: 'cannon_shell', team: cannon.team,
    vel, age: 0, fuse: 15,
    dmg: 1200, radius: 28,
    noGravity: false,
    trail: [muzzlePos.clone()],
    trailMesh: null
  });
  beep(70, 0.7, 'sawtooth', 0.35);
  const flash = new THREE.PointLight(0xffa040, 40, 25);
  flash.position.copy(muzzlePos); scene.add(flash);
  setTimeout(()=>scene.remove(flash), 200);
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 10, 8),
    new THREE.MeshBasicMaterial({ color:0x888888, transparent:true, opacity:0.8, depthWrite:false })
  );
  smoke.position.copy(muzzlePos); scene.add(smoke);
  let t=0; const fade=setInterval(()=>{
    t+=0.05; smoke.scale.setScalar(1+t*2); smoke.material.opacity = Math.max(0, 0.8 - t*1.2);
    if(t>0.7){ clearInterval(fade); scene.remove(smoke); }
  }, 30);
}

// =========================================================
// TURRET
// =========================================================
export function buildTurretMesh(){
  const g = new THREE.Group();
  const hubY = 0.85;
  const legLen = 0.9;
  const tilt = 0.7;
  const spread = legLen * Math.sin(tilt);
  const drop = legLen * Math.cos(tilt);
  for(let i=0;i<3;i++){
    const ang = (i/3) * Math.PI * 2 + Math.PI/2;
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, legLen, 6), flat(0x2a2a2a));
    const footX = cosA * spread, footZ = sinA * spread;
    leg.position.set(footX/2, hubY - drop/2, footZ/2);
    const topPt = new THREE.Vector3(0, hubY, 0);
    const botPt = new THREE.Vector3(footX, hubY - drop, footZ);
    const dirV = botPt.clone().sub(topPt).normalize();
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dirV);
    leg.castShadow = true;
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.05, 8), flat(0x1a1a1a));
    foot.position.set(footX, 0.025, footZ);
    foot.castShadow = true;
    g.add(foot);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), flat(0x3a3a3a));
    joint.position.set(0, hubY, 0);
    g.add(joint);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.25, 12), flat(0x3a3a3a));
  hub.position.y = hubY; hub.castShadow = true; g.add(hub);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), flat(0x2a2a2a));
  pole.position.y = hubY + 0.20; g.add(pole);
  const body = new THREE.Group();
  body.position.y = hubY + 0.45;
  g.add(body);
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), flat(0x4a5a4a));
  core.castShadow = true; body.add(core);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.30), flat(0x2a3a2a)); sideL.position.set(-0.25, 0, 0.05); body.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = 0.25; body.add(sideR);
  for(const dx of [-0.09, 0.09]){
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), flat(0x1a1a1a));
    barrel.rotation.x = Math.PI/2; barrel.position.set(dx, -0.02, -0.48); body.add(barrel);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), flat(0x333333));
    muzzle.position.set(dx, -0.02, -0.72); body.add(muzzle);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.06), flat(0x2e3a2e));
  plate.position.set(0, 0.02, -0.22); body.add(plate);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), new THREE.MeshBasicMaterial({color:0xff2020}));
  eye.position.set(0, 0.10, -0.20); body.add(eye);
  g.userData.body = body; g.userData.eye = eye;
  g.userData.active = true;
  return g;
}

export function placeTurret(){
  const player = S.player;
  if(!player || !player.alive || S.inventory.turret <= 0) return;
  S.inventory.turret--;
  const eq = getEquipment('turret');
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); dir.y = 0; dir.normalize();
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const pos = origin.clone().addScaledVector(dir, 2.0); pos.y = 0;
  const mesh = buildTurretMesh();
  mesh.position.copy(pos); scene.add(mesh);
  S.placedTurrets.push({
    mesh, pos: pos.clone(), body: mesh.userData.body, eye: mesh.userData.eye,
    hp: eq.hp||200, maxHp: eq.hp||200, dmg: eq.dmg||25, fireRate: eq.fireRate||0.3, range: eq.range||30,
    team: player.team, fireT:0, alive:true, active:true, yaw:0, sweepDir: 1
  });
  beep(520,0.12,'sawtooth',0.12);
  if(window._showMsg) window._showMsg('TURRET DEPLOYED — press [E] near it to toggle', 1800);
}

export function updatePlacements(dt){
  for(let i=S.placedTurrets.length-1;i>=0;i--){
    const t = S.placedTurrets[i];
    if(!t.alive){ scene.remove(t.mesh); S.placedTurrets.splice(i,1); continue; }
    if(t.eye) t.eye.material.color.setHex(t.active ? 0xff2020 : 0x336633);

    let best = null, bestD = t.range;
    const turretEye = t.pos.clone().setY(1.30);

    if(t.active){
      for(const b of (window._getAllBots ? window._getAllBots() : [])){
        if(!b.alive || b.team === t.team) continue;
        const d = b.mesh.position.distanceTo(t.pos);
        if(d < bestD){
          const bEye = b.mesh.position.clone().setY(1.2);
          if(window._losClear(turretEye, bEye)){ bestD = d; best = b; }
        }
      }
      if(t.team !== S.playerTeam && S.player && S.player.alive){
        const pd = S.player.pos.distanceTo(t.pos);
        if(pd < bestD && window._losClear(turretEye, S.player.pos.clone().setY(S.player.eye))){
          bestD = pd; best = { isPlayer: true };
        }
      }
    }

    if(t.body){
      if(best){
        const targetPos = best.isPlayer ? S.player.pos : best.mesh.position;
        const dx = targetPos.x - t.pos.x, dz = targetPos.z - t.pos.z;
        const desiredYaw = Math.atan2(dx, dz);
        let diff = desiredYaw - t.yaw;
        while(diff > Math.PI) diff -= Math.PI * 2;
        while(diff < -Math.PI) diff += Math.PI * 2;
        t.yaw += diff * Math.min(1, dt * 8);
      } else {
        if(!t.sweepDir) t.sweepDir = Math.random() < 0.5 ? 1 : -1;
        t.yaw += t.sweepDir * 0.6 * dt;
        if(Math.random() < 0.005) t.sweepDir *= -1;
      }
      // ⭐ + Math.PI para i-flip — barrel (local -Z) tumuturo sa target
      t.body.rotation.y = t.yaw + Math.PI;
    }

    if(best){
      if(t.fireT > 0) t.fireT -= dt;
      if(t.fireT <= 0){
        t.fireT = t.fireRate;

        // ⭐ MUZZLE WORLD POSITION — compute mula sa aktwal na barrel tip
        t.mesh.updateMatrixWorld(true);
        // Barrel muzzle is at body-local (±0.09, -0.02, -0.72)
        // Use center between two barrels, slight forward para lumabas sa tip
        const muzzleLocal = new THREE.Vector3(0, -0.02, -0.80);
        const muzzleWorld = muzzleLocal.clone();
        t.body.localToWorld(muzzleWorld);

        const to = best.isPlayer ? S.player.pos.clone() : best.mesh.position.clone().setY(1.2);
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzleWorld, to]), new THREE.LineBasicMaterial({color:0xffcc55}));
        scene.add(line); S.tracers.push({ t: line, life: 0.08 });
        if(best.isPlayer){
          if(window._hurtPlayer) window._hurtPlayer(t.dmg, false, { name:'TURRET', team:t.team, weapon:'AUTO TURRET' });
        } else {
          if(window._damageBot) window._damageBot(best, t.dmg, false, { name:'TURRET', team:t.team, weapon:'AUTO TURRET' });
        }
      }
    }
  }
  updateCannons(dt);
  if(S.player && S.player.painkiller > 0) S.player.painkiller -= dt;
  if(S.player && S.player.blinded > 0) S.player.blinded = Math.max(0, S.player.blinded - dt);
}

export function damageTurret(t, dmg){
  if(!t.alive) return;
  t.hp -= dmg;
  if(t.hp <= 0){
    t.alive = false;
    explode(t.pos.clone().setY(0.6), 180, 4.5, t.team);
    scene.remove(t.mesh);
    const idx = S.placedTurrets.indexOf(t);
    if(idx >= 0) S.placedTurrets.splice(idx, 1);
  }
  if(window._updateHUD) window._updateHUD();
}

export function damageCannon(c, dmg){
  if(!c.alive) return;
  c.hp -= dmg;
  if(c.hp <= 0){
    c.alive = false;
    explode(c.pos.clone().setY(0.6), 400, 8, c.team);
    scene.remove(c.mesh);
    const idx = S.placedCannons.indexOf(c);
    if(idx >= 0) S.placedCannons.splice(idx, 1);
  }
  if(window._updateHUD) window._updateHUD();
}

// === Grenades / Smoke / Flash ===
export function throwGrenade(){
  const player = S.player;
  if(!player || !player.alive || S.inventory.grenade<=0 || S.reloading) return;
  S.inventory.grenade--;
  beep(320,0.08,'triangle',0.12);
  const eq = getEquipment('grenade');
  const { origin, dir } = getAimRay(0);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6), flat(0x2c3a2c));
  mesh.position.copy(origin).addScaledVector(dir, 0.6); mesh.castShadow = true; scene.add(mesh);
  S.projectiles.push({ mesh, kind:'grenade', team:player.team, vel: dir.multiplyScalar(14).add(new THREE.Vector3(0,4,0)), age:0, fuse:2.8, dmg:eq.dmg, radius:eq.radius });
}
export function throwSmoke(){
  const player = S.player;
  if(!player || !player.alive || S.inventory.smoke<=0 || S.reloading) return;
  S.inventory.smoke--;
  beep(280,0.10,'triangle',0.12);
  const eq = getEquipment('smoke');
  const { origin, dir } = getAimRay(0);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6), flat(0x8a8a8a));
  mesh.position.copy(origin).addScaledVector(dir, 0.6); scene.add(mesh);
  S.projectiles.push({ mesh, kind:'smoke', team:player.team, vel: dir.multiplyScalar(13).add(new THREE.Vector3(0,4,0)), age:0, fuse:1.8, radius:eq.radius, duration:eq.duration });
}
export function throwFlash(){
  const player = S.player;
  if(!player || !player.alive || S.inventory.flash<=0 || S.reloading) return;
  S.inventory.flash--;
  beep(1400,0.06,'square',0.10);
  const eq = getEquipment('flash');
  const { origin, dir } = getAimRay(0);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13,8,6), flat(0xdddddd));
  mesh.position.copy(origin).addScaledVector(dir, 0.6); scene.add(mesh);
  S.projectiles.push({ mesh, kind:'flash', team:player.team, vel: dir.multiplyScalar(15).add(new THREE.Vector3(0,4,0)), age:0, fuse:1.6, radius:eq.radius, duration:eq.duration });
}
export function spawnSmokeCloud(pos, radius, duration){
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 16),
    new THREE.MeshBasicMaterial({ color:0xb8b8b8, transparent:true, opacity:0.9, depthWrite:false, side:THREE.DoubleSide })
  );
  mesh.position.copy(pos); mesh.position.y = 1.5; mesh.renderOrder = 5; scene.add(mesh);
  S.smokeClouds.push({ mesh, pos: mesh.position.clone(), radius:0.1, maxRadius:radius, life:duration, age:0 });
  beep(180, 0.3, 'triangle', 0.15);
}
export function detonateFlashbang(pos, radius, duration, team){
  const light = new THREE.PointLight(0xffffff, 30, radius*3);
  light.position.copy(pos); scene.add(light); setTimeout(()=>scene.remove(light), 200);
  beep(1600, 0.4, 'sine', 0.25);
  const player = S.player;
  if(player && player.alive && team !== player.team){
    const pd = player.pos.distanceTo(pos);
    if(pd < radius){
      const toFlash = pos.clone().sub(player.pos).normalize();
      const lookDir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
      const dot = toFlash.dot(lookDir);
      if(dot > 0.2){
        const blindDur = 2 + (1-pd/radius)*4 + dot*2;
        const el = document.getElementById('flashOverlay');
        if(el){
          el.style.transition = 'none'; el.style.opacity = '1';
          requestAnimationFrame(()=>{ el.style.transition = `opacity ${blindDur}s ease-out`; el.style.opacity = '0'; });
        }
        player.blinded = Math.max(player.blinded, blindDur);
      }
    }
  }
}

export function updateProjectiles(dt){
  for(let i=S.projectiles.length-1;i>=0;i--){
    const p = S.projectiles[i]; p.age += dt;

    if(!p.noGravity && (p.kind==='grenade'||p.kind==='smoke'||p.kind==='flash'||p.kind==='cannon_shell')){
      p.vel.y -= 22*dt;
    }

    p.mesh.position.addScaledVector(p.vel, dt);

    if(p.kind === 'cannon_shell'){
      p.trail.push(p.mesh.position.clone());
      if(p.trail.length > 60) p.trail.shift();
      if(!p.trailMesh && p.trail.length >= 2){
        p.trailMesh = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(p.trail),
          new THREE.LineBasicMaterial({ color: 0xffcc88, transparent:true, opacity:0.6 })
        );
        scene.add(p.trailMesh);
      } else if(p.trailMesh){
        p.trailMesh.geometry.dispose();
        p.trailMesh.geometry = new THREE.BufferGeometry().setFromPoints(p.trail);
      }
    }

    if(p.mesh.position.y <= 0.15 && (p.kind==='grenade'||p.kind==='smoke'||p.kind==='flash')){
      p.mesh.position.y = 0.15;
      p.vel.y = -p.vel.y*0.35; p.vel.x *= 0.7; p.vel.z *= 0.7;
    }
    if(p.mesh.position.y <= 0.15 && (p.kind==='rocket' || p.kind==='cannon_shell')){
      explode(p.mesh.position, p.dmg, p.radius, p.team);
      scene.remove(p.mesh);
      if(p.trailMesh){ scene.remove(p.trailMesh); p.trailMesh.geometry.dispose(); }
      S.projectiles.splice(i,1);
      continue;
    }

    let hitWorld = false;
    for(const b of solids){
      if(p.mesh.position.x>b.min.x && p.mesh.position.x<b.max.x &&
         p.mesh.position.y>b.min.y && p.mesh.position.y<b.max.y &&
         p.mesh.position.z>b.min.z && p.mesh.position.z<b.max.z){ hitWorld = true; break; }
    }

    // ⭐ ROCKET / CANNON SHELL — direct hit sa bots + player
    let hitEntity = false;
    if(p.kind === 'rocket' || p.kind === 'cannon_shell'){
      const projPos = p.mesh.position;

      // Check vs bots
      const allBots = window._getAllBots ? window._getAllBots() : [];
      for(const b of allBots){
        if(!b.alive) continue;
        // Skip same team (rocket hits enemies only sa ilang cases)
        // Pero sa FFA at infection, kalaban ang lahat
        const isFFA = S.gameMode === 'ffa';
        const isInfection = S.gameMode === 'infection' || S.gameMode === 'zombie_escape';
        const sameTeam = (b.team === p.team);
        if(sameTeam && !isFFA) continue;

        // Bot hitbox: ~0.5 radius, height 1.8 (may scale)
        const scaleY = (b.mesh.scale && b.mesh.scale.y) || 1;
        const botCenter = b.mesh.position.clone();
        botCenter.y += 0.9 * scaleY;
        const botRadius = 0.55 * scaleY;

        const dx = projPos.x - botCenter.x;
        const dz = projPos.z - botCenter.z;
        const dy = projPos.y - botCenter.y;
        const distXZ = Math.hypot(dx, dz);

        // Check kung nasa loob ng bot hitbox
        if(distXZ < botRadius && Math.abs(dy) < 1.0 * scaleY){
          hitEntity = true;
          break;
        }
      }

      // Check vs player (kung kalaban)
      if(!hitEntity && S.player && S.player.alive){
        const sameTeam = (S.player.team === p.team);
        const isFFA = S.gameMode === 'ffa';
        if(!sameTeam || isFFA){
          const playerCenter = S.player.pos.clone();
          playerCenter.y -= 0.5; // player.pos is eye height
          const dx = projPos.x - playerCenter.x;
          const dz = projPos.z - playerCenter.z;
          const dy = projPos.y - playerCenter.y;
          const distXZ = Math.hypot(dx, dz);
          if(distXZ < 0.65 && Math.abs(dy) < 1.0){
            hitEntity = true;
          }
        }
      }

      // ⭐ Also check vs cannons + turrets
      if(!hitEntity && S.placedCannons){
        for(const c of S.placedCannons){
          if(!c.alive) continue;
          if(c.team === p.team && S.gameMode !== 'ffa') continue;
          const d = projPos.distanceTo(c.pos);
          if(d < 1.5){ hitEntity = true; break; }
        }
      }
      if(!hitEntity && S.placedTurrets){
        for(const t of S.placedTurrets){
          if(!t.alive) continue;
          if(t.team === p.team && S.gameMode !== 'ffa') continue;
          const d = projPos.distanceTo(t.pos);
          if(d < 0.8){ hitEntity = true; break; }
        }
      }
    }

    const detonate = ((p.kind==='grenade'||p.kind==='smoke'||p.kind==='flash') && p.age>=p.fuse) ||
                     ((p.kind==='rocket'||p.kind==='cannon_shell') && (hitWorld || hitEntity));
    if(detonate){
      if(p.kind === 'grenade' || p.kind === 'rocket' || p.kind === 'cannon_shell') explode(p.mesh.position, p.dmg, p.radius, p.team);
      else if(p.kind === 'smoke') spawnSmokeCloud(p.mesh.position, p.radius, p.duration);
      else if(p.kind === 'flash') detonateFlashbang(p.mesh.position, p.radius, p.duration, p.team);
      scene.remove(p.mesh);
      if(p.trailMesh){ scene.remove(p.trailMesh); p.trailMesh.geometry.dispose(); }
      S.projectiles.splice(i,1);
    }
  }
  for(let i=S.smokeClouds.length-1;i>=0;i--){
    const s = S.smokeClouds[i]; s.age += dt;
    if(s.age > s.life){ scene.remove(s.mesh); S.smokeClouds.splice(i,1); continue; }
    const growT = Math.min(1, s.age/1.2);
    s.radius = s.maxRadius * growT;
    s.mesh.scale.setScalar(s.radius);
    const fadeT = s.age > s.life-3 ? 1 - (s.age - (s.life-3))/3 : 1;
    s.mesh.material.opacity = 0.9 * fadeT;
  }
}

// =========================================================
// ⭐ ROCKET AMMO PICKUP SPAWNER
// =========================================================
export function spawnRocketAmmoPickup(pos){
  const g = new THREE.Group();

  // Crate body (dark green metal box)
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, flatShading: true, roughness: 0.7, metalness: 0.3 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.75), crateMat);
  crate.castShadow = true;
  g.add(crate);

  // Yellow warning stripe (top)
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd75e });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.15), stripeMat);
  stripe.position.y = 0.20;
  g.add(stripe);

  // Red hazard triangle on sides
  const hazardMat = new THREE.MeshBasicMaterial({ color: 0xc02020 });
  const hazard1 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.14, 3), hazardMat);
  hazard1.rotation.z = Math.PI;
  hazard1.position.set(0, 0.20, 0.15);
  hazard1.rotation.x = Math.PI / 2;
  g.add(hazard1);

  // Handle on top
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.02, 6, 16), handleMat);
  handle.rotation.y = Math.PI / 2;
  handle.position.y = 0.24;
  g.add(handle);

  // Small rocket icon on crate (visual)
  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.35, 8),
    new THREE.MeshBasicMaterial({ color: 0x5a6a3a })
  );
  rocketBody.rotation.z = Math.PI / 2;
  rocketBody.position.set(0, 0.02, 0);
  g.add(rocketBody);
  const rocketTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.10, 8),
    new THREE.MeshBasicMaterial({ color: 0xc02020 })
  );
  rocketTip.rotation.z = -Math.PI / 2;
  rocketTip.position.set(0.22, 0.02, 0);
  g.add(rocketTip);

  g.position.set(pos.x, 0.30, pos.z);
  scene.add(g);

  // Label
  const label = makePickupLabel('ROCKET AMMO ×2', '#ffd75e');
  if(label){
    label.position.set(pos.x, 1.1, pos.z);
    label.visible = false;
    scene.add(label);
  }

  S.pickups.push({
    mesh: g,
    pos: g.position.clone(),
    kind: 'rocket_ammo',
    label
  });
}




// =========================================================
// ⭐ BOT TURRET SPAWNER — ginagamit ng bot AI
// =========================================================
export function spawnBotTurretAt(bot){
  if(!bot || !bot.alive) return false;
  const eq = getEquipment('turret');
  if(!eq) return false;

  // Place turret 2 units ahead of bot facing
  const fwd = new THREE.Vector3(-Math.sin(bot.mesh.rotation.y), 0, -Math.cos(bot.mesh.rotation.y));
  const pos = bot.mesh.position.clone().addScaledVector(fwd, 2.0);
  pos.y = 0;

  const mesh = buildTurretMesh();
  mesh.position.copy(pos);
  scene.add(mesh);

  S.placedTurrets.push({
    mesh, pos: pos.clone(), body: mesh.userData.body, eye: mesh.userData.eye,
    hp: eq.hp || 200, maxHp: eq.hp || 200,
    dmg: eq.dmg || 25, fireRate: eq.fireRate || 0.3, range: eq.range || 30,
    team: bot.team, fireT: 0, alive: true, active: true, yaw: 0, sweepDir: 1
  });

  beep(520, 0.12, 'sawtooth', 0.08);
  return true;
}

// =========================================================
// ⭐ BOT GRENADE THROWER — frag / smoke / flash
// =========================================================
export function spawnBotGrenadeAt(bot, targetPos, kind){
  if(!bot || !bot.alive || !targetPos) return false;
  const eq = getEquipment(kind);
  if(!eq) return false;

  const origin = bot.mesh.position.clone();
  origin.y += 1.4;
  const dir = targetPos.clone().sub(origin).normalize();

  let mesh, vel, dmg, radius, duration;
  if(kind === 'grenade'){
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), flat(0x2c3a2c));
    vel = dir.multiplyScalar(14).add(new THREE.Vector3(0, 4, 0));
    dmg = eq.dmg; radius = eq.radius;
  } else if(kind === 'smoke'){
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), flat(0x8a8a8a));
    vel = dir.multiplyScalar(13).add(new THREE.Vector3(0, 4, 0));
    radius = eq.radius; duration = eq.duration;
  } else if(kind === 'flash'){
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), flat(0xdddddd));
    vel = dir.multiplyScalar(15).add(new THREE.Vector3(0, 4, 0));
    radius = eq.radius; duration = eq.duration;
  } else return false;

  mesh.position.copy(origin).addScaledVector(dir, 0.6);
  scene.add(mesh);

  S.projectiles.push({
    mesh, kind, team: bot.team,
    vel, age: 0, fuse: kind === 'grenade' ? 2.8 : (kind === 'smoke' ? 1.8 : 1.6),
    dmg, radius, duration
  });

  beep(kind === 'flash' ? 1400 : 320, 0.08, 'triangle', 0.10);
  return true;
}


window._spawnBotTurret = (bot) => spawnBotTurretAt(bot);
window._spawnBotGrenade = (bot, targetPos, kind) => spawnBotGrenadeAt(bot, targetPos, kind);