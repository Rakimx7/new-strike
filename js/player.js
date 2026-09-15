import * as THREE from 'three';
import { scene, camera, viewRig, collideXZ, getGroundHeight, renderer } from './world.js';
import { S } from './state.js';
import { STAND_EYE, CROUCH_EYE, PLAYER_BOUND } from './core/config.js';
import { beep } from './utils.js';

export function createPlayer(){
  const p = {
    pos: new THREE.Vector3(0, STAND_EYE, 72),
    vel: new THREE.Vector3(), yaw: 0, pitch: 0,
    hp: 100, maxHp: 100, radius: 0.6, eye: STAND_EYE, onGround: true,
    money: 800, team: 'merc', kills: 0, alive: true,
    kevlar: 0, kevlarMax: 100, kevlarReduction: 0,
    helmet: 0, helmetMax: 100, helmetReduction: 0,
    armorOwnedKevlar: false, armorOwnedHelmet: false,
    ownedKevlarId: null, ownedHelmetId: null,
    painkiller: 0, streak: 0, streakExpiresAt: 0,
    waitingForRespawn: false, nvgActive: false, nvgTimeRemaining: 0,
    hasDefuseKit: false, blinded: 0, grappleTarget: null, grappleLine: null,
    crouching: false, lastAttacker: null,
    hasMilitaryBag: false
  };
  S.player = p;
  return p;
}

export function updatePlayer(dt, keys){
  const player = S.player;
  if(!player) return;
  const targetEye = player.crouching ? CROUCH_EYE : STAND_EYE;
  player.eye += (targetEye - player.eye) * Math.min(1, dt * 12);

  if(S.spectatorMode){
    const spd = ((keys['ShiftLeft']||keys['ShiftRight']) ? 22 : 10) * dt;
    const cosP = Math.cos(S.spectatorPitch);
    const f = new THREE.Vector3(-Math.sin(S.spectatorYaw)*cosP, Math.sin(S.spectatorPitch), -Math.cos(S.spectatorYaw)*cosP);
    const r = new THREE.Vector3(-f.z, 0, f.x);
    if(keys['KeyW']) S.spectatorPos.addScaledVector(f, spd);
    if(keys['KeyS']) S.spectatorPos.addScaledVector(f, -spd);
    if(keys['KeyD']) S.spectatorPos.addScaledVector(r, spd);
    if(keys['KeyA']) S.spectatorPos.addScaledVector(r, -spd);
    if(keys['Space']) S.spectatorPos.y += spd;
    if(keys['ControlLeft']) S.spectatorPos.y -= spd;
    camera.position.copy(S.spectatorPos);
    camera.rotation.set(0,0,0);
    camera.rotateY(S.spectatorYaw); camera.rotateX(S.spectatorPitch);
    viewRig.visible = false;
    return;
  }

  const isMobile = document.body.classList.contains('is-mobile');
  const locked = isMobile ? true : (document.pointerLockElement === renderer.domElement);
  const canMove = player.alive && player.hp > 0 && locked && !S.gamePaused && !S.shopOpen && !S.consoleOpen && !S.commandMenuOpen && !S.chatOpen;

  let moving = false;
  if(canMove){
    viewRig.visible = true;
    const baseSpeed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 7.5 : 4.5;
    const crouchMult = player.crouching ? 0.55 : 1.0;

    // ⭐ MELEE SPEED BOOST: +40% movement speed kapag naka-melee
    const currentW = window._getWeapon ? window._getWeapon(S.currentWeaponKey) : null;
    const meleeBoost = (currentW && currentW.melee) ? 1.40 : 1.0;

    // ⭐ OOP — mode-specific speed modifier
    const modeMult = (S.activeMode && S.activeMode.getPlayerSpeedMult) ? S.activeMode.getPlayerSpeedMult(S) : 1.0;
    const speed = baseSpeed * crouchMult * (1 - S.adsT*0.6) * S.speedMultiplier * meleeBoost * modeMult;
    const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if(keys['KeyW']) wish.add(f); if(keys['KeyS']) wish.sub(f);
    if(keys['KeyD']) wish.add(r); if(keys['KeyA']) wish.sub(r);
    moving = wish.lengthSq() > 0;
    if(moving) wish.normalize().multiplyScalar(speed);
    player.vel.x = wish.x; player.vel.z = wish.z;
    player.vel.y -= 22 * dt;
    if(keys['Space'] && player.onGround && !S.noclip){ player.vel.y = 8.2; player.onGround = false; }
    if(S.noclip){ player.vel.y = 0; if(keys['Space']) player.vel.y = 6; if(keys['ControlLeft']) player.vel.y = -6; }
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;
    player.pos.y += player.vel.y * dt;
    if(!S.noclip){
      const feetY = player.pos.y - player.eye;
      const headY = player.pos.y + 0.2;
      collideXZ(player.pos, player.radius, feetY, headY);
      const groundHeight = getGroundHeight(player.pos, player.radius, player.eye);
      const floorY = groundHeight + player.eye;
      if(player.pos.y <= floorY){ player.pos.y = floorY; player.vel.y = 0; player.onGround = true; }
      else player.onGround = false;
    }
    player.pos.x = Math.max(-PLAYER_BOUND, Math.min(PLAYER_BOUND, player.pos.x));
    player.pos.z = Math.max(-PLAYER_BOUND, Math.min(PLAYER_BOUND, player.pos.z));
  } else if(!S.spectatorMode){
    viewRig.visible = player.alive;
  }

  // TPS mode with walk + jump animation
  if(S.cameraMode === 'tps' && player.alive && !S.spectatorMode){
    viewRig.visible = false;
    if(S.playerMesh){
      S.playerMesh.visible = true;
      S.playerMesh.position.x = player.pos.x;
      S.playerMesh.position.z = player.pos.z;
      S.playerMesh.position.y = player.pos.y - player.eye;
      S.playerMesh.rotation.y = player.yaw;

      const legL = S.playerMesh.userData.legL, legR = S.playerMesh.userData.legR;
      const armL = S.playerMesh.userData.armLPivot, armR = S.playerMesh.userData.armRPivot;
      const isCrouch = player.crouching;
      const legMult = isCrouch ? 0.5 : 1.0;
      if(moving && player.onGround){
        S.playerMesh.userData._walkT = (S.playerMesh.userData._walkT || 0) + dt * 9;
        const swing = Math.sin(S.playerMesh.userData._walkT) * 0.6 * legMult;
        if(legL) legL.rotation.x = swing;
        if(legR) legR.rotation.x = -swing;
        if(armL) armL.rotation.z = Math.sin(S.playerMesh.userData._walkT) * 0.03;
        if(armR) armR.rotation.z = Math.sin(S.playerMesh.userData._walkT + Math.PI) * 0.03;
      } else {
        if(legL) legL.rotation.x *= 0.82;
        if(legR) legR.rotation.x *= 0.82;
      }
      const targetScale = isCrouch ? 0.82 : 1.0;
      const curScale = S.playerMesh.scale.y || 1.0;
      S.playerMesh.scale.y = curScale + (targetScale - curScale) * Math.min(1, dt * 10);
    }
    const camDist = 3.5, camHeight = 1.8;
    const camPitch = player.pitch * 0.6;
    const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const camOffset = new THREE.Vector3(
      -f.x * camDist * Math.cos(camPitch),
      camHeight + Math.sin(camPitch) * camDist,
      -f.z * camDist * Math.cos(camPitch)
    );
    camera.position.copy(player.pos).add(camOffset);
    camera.rotation.set(0,0,0);
    camera.rotateY(player.yaw); camera.rotateX(camPitch);
  } else {
    viewRig.visible = true;
    if(S.playerMesh) S.playerMesh.visible = false;
    if(!S.spectatorMode){
      camera.position.copy(player.pos);
      if(player.alive){
        /* RECOIL PURELY VISUAL */
        camera.rotation.set(0,0,0);
        camera.rotateY(player.yaw);
        camera.rotateX(player.pitch);
        if(viewRig){
          viewRig.rotation.x = S.recoil * 2.2;
          viewRig.position.z = S.recoil * 0.15;
        }
      } else {
        camera.position.y = 0.4;
        camera.rotation.set(0,0,0);
        camera.rotateY(player.yaw);
        camera.rotateX(-0.15);
        if(viewRig){ viewRig.rotation.x = 0; viewRig.position.z = 0; }
      }
    }
  }

  S.recoil = Math.max(0, S.recoil - dt * 3.5);

  if(!player.alive || S.spectatorMode){
    if(viewRig){ viewRig.rotation.x = 0; viewRig.position.z = 0; }
  }

  Object.entries(S.viewModels).forEach(([k, m]) => {
    m.visible = (k === S.currentWeaponKey && player.alive && !S.spectatorMode && !S.cannonOperating);
  });
}

export function hurtPlayer(dmg, isHead, killerInfo){
  const player = S.player;
  if(!player || !player.alive || player.hp <= 0 || S.godMode) return;
  if(killerInfo) player.lastAttacker = killerInfo;
  let remaining = dmg;
  if(player.painkiller > 0) remaining *= 0.65;
  if(isHead && player.helmet > 0 && player.helmetReduction > 0){
    const a = Math.min(player.helmet, remaining * player.helmetReduction);
    player.helmet -= a; remaining -= a;
    if(player.helmet <= 0) player.helmet = 0;
  }
  if(!isHead && player.kevlar > 0 && player.kevlarReduction > 0){
    const a = Math.min(player.kevlar, remaining * player.kevlarReduction);
    player.kevlar -= a; remaining -= a;
    if(player.kevlar <= 0) player.kevlar = 0;
  }
  player.hp -= remaining;
  const f = document.getElementById('damageFlash');
  if(f){ f.style.opacity = 1; setTimeout(()=>f.style.opacity = 0, 120); }
  beep(80,0.15,'sawtooth',0.2);
  if(window._updateHUD) window._updateHUD();
  if(player.hp <= 0) killPlayer();
}

export function killPlayer(){
  const player = S.player;
  if(!player || !player.alive) return;

  const pos = player.pos.clone(); pos.y = 0.45;
  const w = window._getWeapon ? window._getWeapon(S.currentWeaponKey) : null;
  // ⭐ Skip zombie_hand drop
  if(w && !w.melee && S.currentWeaponKey !== 'zombie_hand' && window._spawnWeaponPickupAt){
    const st = S.ammoState[S.currentWeaponKey] || { ammo: 0, reserve: 0 };
    window._spawnWeaponPickupAt(pos, S.currentWeaponKey, st.ammo, st.reserve);
  }
  if(player.armorOwnedKevlar && player.kevlarMax > 0 && window._spawnArmorPickupAt){
    const p2 = pos.clone(); p2.x += 0.6;
    window._spawnArmorPickupAt(p2, { type:'kevlar', hp: player.kevlarMax, reduction: player.kevlarReduction });
  }
  if(player.armorOwnedHelmet && player.helmetMax > 0 && window._spawnArmorPickupAt){
    const p3 = pos.clone(); p3.x -= 0.6;
    window._spawnArmorPickupAt(p3, { type:'helmet', hp: player.helmetMax, reduction: player.helmetReduction });
  }

  // ⭐ SD: drop bomb kung player ang carrier
  if(S.gameMode === 'sd' && S.playerTeam === 'cartel' && S.bombCarrier === 'player' && S.inventory.c4 > 0){
    S.inventory.c4 = 0;
    S.bombCarrier = null;
    if(window._dropBombAt) window._dropBombAt(pos);
  }

  player.alive = false; player.hp = 0; player.waitingForRespawn = true;
  S.playerDiedThisRound = true;
  viewRig.visible = false;
  const de = document.getElementById('deathOverlay'); if(de) de.style.display = 'block';
  const ch = document.getElementById('crosshair'); if(ch) ch.style.display = 'none';
  const chn = document.getElementById('crosshairName'); if(chn) chn.style.display = 'none';
  S.adsHeld = false; S.adsActive = false; S.adsT = 0;
  const so = document.getElementById('scopeOverlay'); if(so) so.style.display = 'none';
  camera.fov = 75; camera.updateProjectionMatrix();
  const kb = document.getElementById('killedBy');
  if(player.lastAttacker && kb){
    const nameEl = document.getElementById('kbKillerName');
    nameEl.textContent = player.lastAttacker.name || 'UNKNOWN';
    nameEl.className = 'kb-killer ' + (player.lastAttacker.team === 'merc' ? 'merc' : 'cartel');
    document.getElementById('kbWeaponName').textContent = player.lastAttacker.weapon || 'UNKNOWN';
    kb.style.display = 'block';
  } else if(kb){
    kb.style.display = 'none';
  }

  player.hasDefuseKit = false;
  player.nvgActive = false;
  player.nvgTimeRemaining = 0;
  player.painkiller = 0;
  player.armorOwnedKevlar = false;
  player.armorOwnedHelmet = false;
  S.playerDiedThisRound = true;

  beep(60,0.5,'sawtooth',0.3);
}

export function respawnPlayerAtBase(){
  const player = S.player;
  if(!player) return;

  // UNMOUNT CANNON
  if(S.cannonOperating){
    if(S.cannonTarget && S.cannonTarget.mesh) S.cannonTarget.mesh.visible = true;
    S.cannonOperating = false;
    S.cannonTarget = null;
    if(S._prevCameraMode) S.cameraMode = S._prevCameraMode;
    else S.cameraMode = 'fps';
    S._prevCameraMode = null;
  }

  if(S.spectatorMode){
    S.spectatorMode = false;
    const sh = document.getElementById('spectatorHud'); if(sh) sh.style.display = 'none';
  }
  player.alive = true; player.hp = player.maxHp;
  player.waitingForRespawn = false;
  player.kevlar = 0; player.kevlarReduction = 0;
  player.helmet = 0; player.helmetReduction = 0;
  player.blinded = 0; player.nvgActive = false; player.nvgTimeRemaining = 0;
  player.eye = STAND_EYE; player.crouching = false;
  player.lastAttacker = null;
  player.painkiller = 0;

  // ═══════════════════════════════════════════════════════════
  // ⭐ INFECTION: Kapag zombie ang player, dapat zombie_hand pa rin
  // ═══════════════════════════════════════════════════════════
  const isInfectionZombie = (S.gameMode === 'infection' && player.team === 'zombie');
  const isZombieEscapeZombie = (S.gameMode === 'zombie_escape' && player.team === 'zombie');
  const playerIsZombie = isInfectionZombie || isZombieEscapeZombie;

  if(S.playerDiedThisRound){
    // ⭐ OOP MODE — Knife / Sniper (or any active mode with custom loadout)
    if(S.activeMode && typeof S.activeMode.setupPlayerLoadout === 'function'){
      S.activeMode.setupPlayerLoadout(S);
      if(window._refreshViewModels) window._refreshViewModels();
      if(window._renderWeaponBar) window._renderWeaponBar();
      if(window._updateHUD) window._updateHUD();
    }
    else if(playerIsZombie){
      // ⭐ ZOMBIE: keep zombie hand, no pistol/knife
      S.ownedWeapons = ['zombie_hand'];
      S.currentWeaponKey = 'zombie_hand';
      S.ammoState = { zombie_hand: { ammo: Infinity, reserve: Infinity } };
      player.hasMilitaryBag = false;
      player.armorOwnedKevlar = false; player.ownedKevlarId = null;
      player.armorOwnedHelmet = false; player.ownedHelmetId = null;
      S.inventory = { grenade:0, smoke:0, flash:0, c4:0, fake_c4:0, mine:0, medkit:0, painkiller:0, shield:0, turret:0, detonator:0, nvg:0, defuse_kit:0, grapple:0, military_bag:0 };
      if(window._refreshViewModels) window._refreshViewModels();
      if(window._renderWeaponBar) window._renderWeaponBar();
    } else {
      // Normal human death wipe
      S.ownedWeapons = ['glock', 'knife'];
      S.currentWeaponKey = 'glock';
      S.ammoState = {};
      S.ownedWeapons.forEach(id => {
        const w = window._getWeapon ? window._getWeapon(id) : null;
        if(w) S.ammoState[id] = {
          ammo: w.mag === Infinity ? Infinity : w.mag,
          reserve: w.reserveMax === Infinity ? Infinity : w.reserveMax
        };
      });
      player.armorOwnedKevlar = false; player.ownedKevlarId = null;
      player.armorOwnedHelmet = false; player.ownedHelmetId = null;
      S.inventory = { grenade:2, smoke:0, flash:0, c4:0, fake_c4:0, mine:0, medkit:0, painkiller:0, shield:0, turret:0, detonator:0, nvg:0, defuse_kit:0, grapple:0, military_bag:0 };
      player.hasMilitaryBag = false;
      if(window._refreshViewModels) window._refreshViewModels();
      if(window._renderWeaponBar) window._renderWeaponBar();

      // FFA heavy armor
      if(S.gameMode === 'ffa'){
        player.kevlar = 200; player.kevlarMax = 200; player.kevlarReduction = 0.70;
        player.helmet = 200; player.helmetMax = 200; player.helmetReduction = 0.70;
        player.armorOwnedKevlar = true; player.ownedKevlarId = 'heavyKevlar';
        player.armorOwnedHelmet = true; player.ownedHelmetId = 'heavyHelmet';
      }
    }

    S.playerDiedThisRound = false;
  } else {
    // Refill ammo reserves
    for(const id in S.ammoState){
      const w = (window._getWeapon ? window._getWeapon(id) : null);
      if(!w || w.melee) continue;
      S.ammoState[id].ammo = w.mag;
      S.ammoState[id].reserve = w.reserveMax;
    }
    if(player.armorOwnedKevlar && player.kevlarMax > 0) player.kevlar = player.kevlarMax;
    if(player.armorOwnedHelmet && player.helmetMax > 0) player.helmet = player.helmetMax;

    // FFA heavy armor din kapag buhay pa
    if(S.gameMode === 'ffa'){
      player.kevlar = 200; player.kevlarMax = 200; player.kevlarReduction = 0.70;
      player.helmet = 200; player.helmetMax = 200; player.helmetReduction = 0.70;
      player.armorOwnedKevlar = true; player.ownedKevlarId = 'heavyKevlar';
      player.armorOwnedHelmet = true; player.ownedHelmetId = 'heavyHelmet';
    }
  }

  /* ⭐ Teleport — iba-iba depende sa team/mode */
  if(playerIsZombie){
    // Zombie respawn — random position malayo sa gitna
    const randX = (Math.random() - 0.5) * 140;
    const randZ = (Math.random() - 0.5) * 140;
    player.pos.set(randX, player.eye, randZ);
    player.yaw = Math.atan2(-randX, -randZ);
  } else if(S.playerTeam === 'merc'){
    player.pos.set(0, player.eye, 72); player.yaw = 0;
  } else if(S.playerTeam === 'cartel'){
    player.pos.set(0, player.eye, -72); player.yaw = Math.PI;
  } else {
    // FFA o iba pang team
    player.pos.set(0, player.eye, 72); player.yaw = 0;
  }

  viewRig.visible = true;
  Object.entries(S.viewModels).forEach(([k,m]) => m.visible = (k===S.currentWeaponKey));

  /* Update UI */
  const nv = document.getElementById('nvOverlay'); if(nv) nv.classList.remove('active');
  const kb = document.getElementById('killedBy'); if(kb) kb.style.display = 'none';
  const de = document.getElementById('deathOverlay'); if(de) de.style.display = 'none';
  const ch = document.getElementById('crosshair'); if(ch) ch.style.display = '';
  if(window._updateHUD) window._updateHUD();
}

export function enterSpectatorMode(){
  const player = S.player;
  if(!player || player.alive) return;
  S.spectatorMode = true;
  S.spectatorPos.copy(player.pos); S.spectatorPos.y = 6;
  S.spectatorYaw = player.yaw; S.spectatorPitch = -0.3;
  const sh = document.getElementById('spectatorHud'); if(sh) sh.style.display = 'block';
  const de = document.getElementById('deathOverlay'); if(de) de.style.display = 'none';
  const kb = document.getElementById('killedBy'); if(kb) kb.style.display = 'none';
}

export function exitSpectatorMode(){
  S.spectatorMode = false;
  const sh = document.getElementById('spectatorHud'); if(sh) sh.style.display = 'none';
  const de = document.getElementById('deathOverlay'); if(de) de.style.display = 'block';
}