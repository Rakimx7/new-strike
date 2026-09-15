import { initMobileControls, initLayoutEditor, goFullscreen, exitFullscreen, isFullscreen, updateAutoAim, setAutoAimEnabled, isAutoAimEnabled } from './mobile_input.js';
if(!S.mobile) S.mobile = { fireHeld: false, adsHeld: false };
import * as THREE from 'three';
import {
  scene, camera, renderer, viewRig, buildDefaultMap, buildWaypointGraph, losClear,
  solids, staticMeshes, MERC_BASE, CARTEL_BASE,
  BOMB_SITE_A, BOMB_SITE_B, bombSiteMeshA, bombSiteRingA, bombSiteMeshB, bombSiteRingB,
  tickPathfinding, rebuildPathfinding
} from './world.js';


import { S } from './state.js';
import { audioInit, beep, footstep, formatTime, escapeHtml } from './utils.js';
import { MM_ZOOM_LEVELS } from './core/constants.js';
import {
  STAND_EYE, CROUCH_EYE, PLAYER_BOUND, DEFAULT_FOV, DM_KILL_TARGET,
  BOMB_PLANT_TIME, DEFUSE_TIME_DEFAULT, DEFUSE_TIME_KIT, STREAK_WINDOW_MS, INTRO_DURATION, ADMIN_PASSWORD
} from './core/config.js';
import {
  AI_TUNING_DEFAULT, DIFFICULTY_PRESETS, DIFF_DESCS, SQUAD_COMMANDS,
  EQUIP_ORDER, BASE_WEAPONS, BASE_ARMORS, BASE_EQUIPMENT, VOICE_KEYS
} from './data/game_data.js';
import {
  createPlayer, updatePlayer, hurtPlayer, killPlayer,
  respawnPlayerAtBase, enterSpectatorMode, exitSpectatorMode
} from './player.js';
import {
  getWeapon, getEquipment, allWeapons, allArmors, allEquipment, ensureAmmo,
  refreshViewModels, renderWeaponBar, switchWeapon, shoot, startReload,
  updateProjectiles, updateDecals, updatePlacements, throwGrenade, throwSmoke,
  throwFlash, placeTurret, damageTurret, damageCannon, explode, spawnBulletDecal,
  placeCannon, fireCannonShell, spawnRocketAmmoPickup
} from './weapons.js';
import {
  bots, squads, spawnBot, spawnRound, updateBots, damageBot,
  buildBotMesh, resetBotNameCounters,
  FFA_SPAWN_POINTS, getFFASpawnPoint, getFFARespawnPoint
} from './ai/enemy_ai.js';

import {
  INFECTION_CONFIG, startInfectionRound, checkInfectionEnd,
  convertPlayerToZombie, tryZombieConvert, getInfectionHUDText,
  countSurvivors, countZombies, spawnInfectionZombies
} from './modes/infection.js';
import { getModeInstance } from './modes/special_modes.js';

import {
  SD_CONFIG, startSDRound, updateSD, resetSD,
  getBombSiteAt, isPlayerNearBomb,
  tickPlayerPlant, cancelPlayerPlant, tickPlayerDefuse, cancelPlayerDefuse,
  dropBombAt, playerPickupBomb
} from './modes/search_and_destroy.js';

window._startSDRound = startSDRound;

// =========================================================
// FFA CONFIG
// =========================================================
const FFA_ROUND_TIME = 600;
const FFA_TOTAL_ROUNDS = 10;
const FFA_RESPAWN_DELAY = 4000;

// =========================================================
// SCOREBOARD SCROLL CSS
// =========================================================
(function injectScoreboardScroll(){
  const style = document.createElement('style');
  style.textContent = `
    .sb-list {
      max-height: 45vh !important;
      overflow-y: auto !important;
      scrollbar-width: thin;
      scrollbar-color: #ffd75e #1a1a1a;
    }
    .sb-list::-webkit-scrollbar { width: 6px; }
    .sb-list::-webkit-scrollbar-track { background: #1a1a1a; border-radius: 3px; }
    .sb-list::-webkit-scrollbar-thumb { background: #ffd75e; border-radius: 3px; }
    .sb-list::-webkit-scrollbar-thumb:hover { background: #ffb300; }
    .sb-row { padding: 2px 8px !important; font-size: 11px !important; line-height: 1.4 !important; }
    .sb-team .sb-list { max-height: 50vh; }
  `;
  document.head.appendChild(style);
})();









// =========================================================
// 🎯 COMPACT SCOREBOARD — 8+ rows visible per team
// =========================================================
(function injectCleanScoreboard(){
  const style = document.createElement('style');
  style.textContent = `
    /* Wrapper — full height */
    #scoreboard { padding: 12px !important; justify-content: center !important; }
    #scoreboard .sb-header { margin-bottom: 4px !important; }
    #scoreboard .sb-title {
      font-size: 15px !important;
      letter-spacing: 4px !important;
      line-height: 1 !important;
      margin: 0 !important;
    }
    #scoreboard .sb-map, #scoreboard .sb-mode {
      font-size: 8px !important;
      letter-spacing: 1px !important;
      margin-top: 1px !important;
    }

    /* Teams container — compact panel */
    #scoreboard .sb-teams {
      height: auto !important;
      max-height: 60vh !important;
      gap: 6px !important;
      padding: 0 !important;
      align-items: stretch !important;
      width: 100% !important;
      max-width: 560px !important;
      margin: 0 auto !important;
    }

    /* Team card */
    #scoreboard .sb-team {
      padding: 3px 5px !important;
      max-width: none !important;
      display: flex !important;
      flex-direction: column !important;
      min-height: 0 !important;
      border-width: 1px !important;
    }
    #scoreboard .sb-team.merc { border-top-width: 2px !important; }
    #scoreboard .sb-team.cartel { border-top-width: 2px !important; }

    /* Team header line: NAME ... SCORE */
    #scoreboard .sb-team-header {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      font-family: 'Oswald', sans-serif !important;
      font-weight: 700 !important;
      font-size: 10px !important;
      letter-spacing: 2px !important;
      padding: 2px 3px !important;
      margin: 0 !important;
      border-bottom: 1px solid rgba(255,255,255,.1) !important;
      line-height: 1.1 !important;
    }
    #scoreboard .sb-team.merc .sb-team-header { color: #8fc4f0 !important; }
    #scoreboard .sb-team.cartel .sb-team-header { color: #ff5555 !important; }

    /* Big score — inline right, not centered, smaller */
    #scoreboard .sb-team-score {
      font-family: 'Anton', sans-serif !important;
      font-size: 16px !important;
      line-height: 1 !important;
      letter-spacing: 1px !important;
      color: #ffd75e !important;
      text-shadow: 0 0 6px rgba(255,215,94,.5) !important;
      padding: 0 !important;
      margin: 0 !important;
      min-width: 22px !important;
      text-align: right !important;
    }

    /* Alive count — small inline subtitle */
    #scoreboard .sb-team-count {
      font-size: 7px !important;
      letter-spacing: 1.5px !important;
      color: #7fa892 !important;
      text-align: left !important;
      padding: 1px 3px !important;
      margin: 0 !important;
      line-height: 1.2 !important;
      text-transform: uppercase !important;
    }

    /* Column headers */
    #scoreboard .sb-col-head {
      display: grid !important;
      grid-template-columns: 1fr 22px 14px !important;
      gap: 3px !important;
      padding: 2px 3px !important;
      font-size: 7px !important;
      letter-spacing: 1px !important;
      color: #5a6a62 !important;
      font-family: 'Oswald', sans-serif !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      border-bottom: 1px solid rgba(255,255,255,.06) !important;
      margin-bottom: 1px !important;
    }
    #scoreboard .sb-col-head .sb-col-k { text-align: center !important; }
    #scoreboard .sb-col-head .sb-col-status { text-align: center !important; }

    /* List — scroll, but 8+ rows visible */
    #scoreboard .sb-list {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow-y: auto !important;
      padding: 0 !important;
    }

    /* Rows — very compact */
    #scoreboard .sb-row {
      display: grid !important;
      grid-template-columns: 1fr 22px 14px !important;
      gap: 3px !important;
      align-items: center !important;
      padding: 1px 3px !important;
      min-height: 13px !important;
      font-size: 9px !important;
      line-height: 1.15 !important;
      border-bottom: 1px solid rgba(255,255,255,.04) !important;
    }
    #scoreboard .sb-row .sb-name {
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      min-width: 0 !important;
      color: #d6cdb8 !important;
    }
    #scoreboard .sb-row.you {
      background: rgba(240,165,0,.18) !important;
    }
    #scoreboard .sb-row.you .sb-name {
      color: #f0a500 !important;
      font-weight: 700 !important;
    }
    #scoreboard .sb-row .sb-kills {
      text-align: center !important;
      color: #ffd75e !important;
      font-weight: 700 !important;
      padding: 0 !important;
    }
    #scoreboard .sb-row .sb-status {
      text-align: center !important;
      font-size: 8px !important;
      color: #6a9c3f !important;
    }
    #scoreboard .sb-row.dead .sb-name { opacity: 0.35 !important; text-decoration: line-through !important; }
    #scoreboard .sb-row.dead .sb-status { color: #d21c1c !important; }
    #scoreboard .sb-row.dead .sb-kills { opacity: 0.4 !important; }

    /* Footer */
    #scoreboard .sb-footer {
      font-size: 7px !important;
      letter-spacing: 2px !important;
      margin-top: 3px !important;
      padding: 2px !important;
    }

    /* ⭐ MOBILE — same but tighter */
    @media (max-width: 900px), (max-height: 500px) {
      #scoreboard { padding: 3px 4px !important; }
      #scoreboard .sb-header { margin-bottom: 3px !important; }
      #scoreboard .sb-title { font-size: 13px !important; letter-spacing: 3px !important; }
      #scoreboard .sb-map, #scoreboard .sb-mode { font-size: 7px !important; }

      #scoreboard .sb-teams {
        height: auto !important;
        max-height: 62vh !important;
        gap: 4px !important;
        width: 100% !important;
        max-width: 360px !important;
        margin: 0 auto !important;
      }
      #scoreboard .sb-team { padding: 2px 4px !important; }
      #scoreboard .sb-team-header {
        font-size: 9px !important;
        letter-spacing: 1.5px !important;
        padding: 1px 3px !important;
      }
      #scoreboard .sb-team-score { font-size: 14px !important; min-width: 18px !important; }
      #scoreboard .sb-team-count { font-size: 6px !important; padding: 1px 3px !important; }
      #scoreboard .sb-col-head {
        font-size: 6px !important;
        padding: 1px 3px !important;
        grid-template-columns: 1fr 20px 12px !important;
      }
      #scoreboard .sb-row {
        font-size: 8px !important;
        padding: 1px 3px !important;
        min-height: 12px !important;
        grid-template-columns: 1fr 20px 12px !important;
      }
      #scoreboard .sb-row .sb-status { font-size: 7px !important; }
      #scoreboard .sb-footer { font-size: 6px !important; margin-top: 2px !important; }
    }
  `;
  document.head.appendChild(style);
})();











// =========================================================
// 📱 COMPACT FLOW UI + TINY DEV LOGIN (mobile)
// =========================================================
(function injectCompactFlowUI(){
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 900px), (max-height: 500px) {
      /* FACTION cards — maliit */
      #factionGrid {
        gap: 8px !important;
        max-height: 42vh !important;
        padding: 4px !important;
      }
      #factionGrid .cardChoice {
        min-height: 90px !important;
        padding: 0 !important;
      }
      #factionGrid .cardChoice .name {
        font-size: 14px !important;
        letter-spacing: 2px !important;
        margin-top: auto !important;
        margin-bottom: 3px !important;
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
      #factionGrid .cardChoice .desc {
        font-size: 9px !important;
        letter-spacing: 0.5px !important;
        line-height: 1.4 !important;
        padding-bottom: 10px !important;
        padding-left: 12px !important;
        padding-right: 12px !important;
      }
      #factionGrid .cardChoice.selected::after {
        font-size: 7px !important;
        padding: 2px 6px !important;
        letter-spacing: 1.5px !important;
        top: 6px !important;
        right: 6px !important;
      }

      /* All flow screens — compact cards */
      .flowGrid { gap: 8px !important; max-height: 52vh !important; }
      .cardChoice { min-height: 90px !important; }
      .cardChoice:not([data-faction]) {
        min-height: 78px !important;
        padding-top: 12px !important;
      }
      .cardChoice:not([data-faction]) .name {
        font-size: 14px !important;
        letter-spacing: 2px !important;
        margin-bottom: 3px !important;
      }
      .cardChoice:not([data-faction]) .desc {
        font-size: 9px !important;
        letter-spacing: 0.3px !important;
        line-height: 1.4 !important;
        padding-bottom: 10px !important;
      }
      .cardChoice .meta {
        font-size: 7px !important;
        letter-spacing: 1.5px !important;
        margin-bottom: 8px !important;
        padding-left: 12px !important;
      }

      /* Flow header — compact */
      .flowHeader { margin-bottom: 12px !important; }
      .flowStep {
        font-size: 8px !important;
        letter-spacing: 4px !important;
        padding: 3px 10px !important;
        margin-bottom: 6px !important;
      }
      .flowTitle {
        font-size: 20px !important;
        letter-spacing: 3px !important;
      }
      .flowSubtitle {
        font-size: 9px !important;
        letter-spacing: 1.5px !important;
        margin-top: 4px !important;
      }
      .flowBtn {
        padding: 8px 18px !important;
        font-size: 10px !important;
        letter-spacing: 2px !important;
      }
      .flowBtn.deploy {
        padding: 10px 26px !important;
        font-size: 12px !important;
        letter-spacing: 3px !important;
      }
      .flowFooter { margin-top: 12px !important; gap: 8px !important; }

      /* ⭐ DEV LOGIN — kasing-liit ng kalahati ng KILLS 0 (approx 7px) */
      #devLoginBtn {
        top: 4px !important;
        right: 4px !important;
        padding: 2px 6px !important;
        font-size: 7px !important;
        letter-spacing: 0.5px !important;
        border-width: 1px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();


// =========================================================
// 📱 MOBILE DEATH UI — compact & balanced
// =========================================================
(function injectMobileDeathUI(){
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 900px), (max-height: 500px) {
      /* DEATH overlay text */
      #deathOverlay .dtext {
        font-size: 28px !important;
        letter-spacing: 5px !important;
        top: 16% !important;
      }

      /* KILLED-BY panel — compact */
      #killedBy {
        right: 8px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        padding: 8px 12px !important;
        min-width: 0 !important;
        max-width: 175px !important;
        border-width: 2px !important;
        border-left-width: 3px !important;
      }
      #killedBy .kb-title {
        font-size: 7px !important;
        letter-spacing: 2px !important;
        margin-bottom: 4px !important;
      }
      #killedBy .kb-killer {
        font-size: 15px !important;
        letter-spacing: 1.5px !important;
        margin-bottom: 4px !important;
      }
      #killedBy .kb-weapon {
        font-size: 9px !important;
        margin-bottom: 5px !important;
      }
      #killedBy .kb-hint {
        font-size: 7px !important;
        letter-spacing: 1px !important;
        padding-top: 5px !important;
      }

      /* Respawn timer */
      #respawnTimer {
        bottom: 72px !important;
        font-size: 9px !important;
        padding: 3px 10px !important;
        letter-spacing: 1px !important;
        white-space: nowrap !important;
      }

      /* Spectator HUD */
      #spectatorHud {
        font-size: 12px !important;
        letter-spacing: 3px !important;
        padding: 7px 16px !important;
        top: 12% !important;
      }
      #spectatorHud .sub {
        font-size: 8px !important;
        letter-spacing: 1.5px !important;
        margin-top: 3px !important;
      }

      /* Streak badge */
      #streakBadge {
        font-size: 12px !important;
        padding: 6px 14px !important;
        letter-spacing: 3px !important;
        top: 9% !important;
      }

      /* Big message */
      #msg {
        font-size: 13px !important;
        padding: 5px 12px !important;
        letter-spacing: 1.5px !important;
        max-width: 250px !important;
        top: 32% !important;
      }
      #msg.small {
        font-size: 10px !important;
        padding: 4px 8px !important;
      }

      /* Hitmarker + crosshair name */
      #hitmarker { font-size: 18px !important; }
      #crosshairName {
        font-size: 9px !important;
        padding: 2px 8px !important;
        top: calc(50% + 20px) !important;
      }
    }
  `;
  document.head.appendChild(style);
})();



// =========================================================
// 📱 MOBILE HUD SCALING
// =========================================================
(function injectMobileHUD(){
  const style = document.createElement('style');
  style.textContent = `
    #killfeed {
      max-width: 200px !important;
      top: 90px !important;
      left: 8px !important;
    }
    .kf-row {
      font-size: 6px !important;
      padding: 0px 4px !important;
      line-height: 1.15 !important;
      letter-spacing: 0px !important;
    }
    .kf-row.special {
      font-size: 7px !important;
      padding: 1px 5px !important;
    }

    .chat-line {
      font-size: 6px !important;
      padding: 0px 4px !important;
      line-height: 1.15 !important;
      letter-spacing: 0px !important;
    }
    #chatBox, #chatLog {
      max-width: 200px !important;
    }
    #chatLog > div {
      font-size: 6px !important;
      padding: 0px 3px !important;
      line-height: 1.15 !important;
    }

    #msg {
      font-size: 11px !important;
      padding: 4px 10px !important;
      letter-spacing: 1px !important;
      line-height: 1.3 !important;
      max-width: 240px !important;
    }
    #msg.small { font-size: 10px !important; padding: 3px 8px !important; }

    #announceBig, .announceBig {
      font-size: 16px !important;
      letter-spacing: 2px !important;
    }

    #scoreboard {
      padding: 8px !important;
    }
    .sb-header {
      padding: 4px 8px !important;
    }
    .sb-title {
      font-size: 16px !important;
      letter-spacing: 3px !important;
    }
    .sb-map, .sb-mode {
      font-size: 9px !important;
      letter-spacing: 1px !important;
    }
    .sb-teams {
      gap: 6px !important;
      padding: 6px !important;
    }
    .sb-team-header {
      font-size: 10px !important;
      letter-spacing: 2px !important;
      padding: 3px 4px !important;
    }
    .sb-team-score {
      font-size: 22px !important;
      line-height: 1 !important;
      margin: 2px 0 !important;
    }
    .sb-team-count {
      font-size: 9px !important;
      margin-bottom: 4px !important;
    }
    .sb-list {
      max-height: 40vh !important;
    }
    .sb-row {
      font-size: 10px !important;
      padding: 2px 6px !important;
      line-height: 1.3 !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 4px !important;
    }
    .sb-row .sb-name {
      flex: 1 1 auto !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      min-width: 0 !important;
    }
    .sb-row .sb-kills {
      flex: 0 0 auto !important;
      min-width: 24px !important;
      text-align: center !important;
    }
    .sb-row .sb-status {
      flex: 0 0 auto !important;
      min-width: 14px !important;
      text-align: center !important;
    }
    .sb-footer {
      font-size: 9px !important;
      padding: 3px !important;
    }

    #score, #teamScore, #modeInfo, #timeHud {
      font-size: 10px !important;
      padding: 2px 8px !important;
      line-height: 1.3 !important;
    }
    #score { top: 4px !important; }
    #teamScore { top: 22px !important; }
    #modeInfo { top: 40px !important; }
    #timeHud { top: 58px !important; font-size: 9px !important; }

    #hp, #armorHud, #money, #faction, #slotCounter {
      font-size: 11px !important;
      padding: 2px 6px !important;
      line-height: 1.2 !important;
    }
    #ammo, #weaponName {
      font-size: 11px !important;
      padding: 2px 6px !important;
    }
    #equipHud {
      font-size: 10px !important;
      padding: 3px 8px !important;
    }
    #weaponBar .slot {
      font-size: 9px !important;
      padding: 2px 6px !important;
    }

    @media (max-width: 700px), (max-height: 420px) {
      #killfeed {
        max-width: 150px !important;
        top: 70px !important;
        left: 5px !important;
      }
      .kf-row {
        font-size: 5px !important;
        padding: 0px 3px !important;
        line-height: 1.1 !important;
      }
      .kf-row.special { font-size: 6px !important; }

      .chat-line {
        font-size: 5px !important;
        padding: 0px 3px !important;
        line-height: 1.1 !important;
      }
      #chatBox, #chatLog {
        max-width: 150px !important;
      }
      #chatLog > div {
        font-size: 5px !important;
        padding: 0px 2px !important;
        line-height: 1.1 !important;
      }

      #msg {
        font-size: 11px !important;
        padding: 3px 8px !important;
        max-width: 200px !important;
      }
      #msg.small { font-size: 9px !important; }

      #scoreboard { padding: 6px !important; }
      .sb-title { font-size: 13px !important; letter-spacing: 2px !important; }
      .sb-map, .sb-mode { font-size: 8px !important; }
      .sb-team-header { font-size: 9px !important; padding: 2px 3px !important; }
      .sb-team-score { font-size: 18px !important; }
      .sb-team-count { font-size: 8px !important; }
      .sb-row { font-size: 9px !important; padding: 1px 4px !important; }
      .sb-row .sb-kills { min-width: 20px !important; }
      .sb-row .sb-status { min-width: 12px !important; }
      .sb-list { max-height: 35vh !important; }
      .sb-footer { font-size: 8px !important; }

      #score, #teamScore, #modeInfo, #timeHud {
        font-size: 9px !important;
        padding: 1px 5px !important;
        line-height: 1.2 !important;
      }
      #score { top: 2px !important; }
      #teamScore { top: 18px !important; }
      #modeInfo { top: 34px !important; }
      #timeHud { top: 50px !important; font-size: 8px !important; }

      #hp, #armorHud, #money, #faction, #slotCounter {
        font-size: 10px !important;
        padding: 1px 5px !important;
      }
      #ammo, #weaponName {
        font-size: 10px !important;
        padding: 1px 5px !important;
      }

      .hint { display: none !important; }

      #minimap {
        width: 85px !important;
        height: 85px !important;
      }
      #mapZoomLabel { font-size: 8px !important; }

      #weaponBar .slot {
        font-size: 8px !important;
        padding: 1px 4px !important;
      }

      #equipHud { font-size: 9px !important; padding: 2px 5px !important; }
      #respawnTimer { font-size: 12px !important; }
      #crosshairName { font-size: 9px !important; }
      #streakBadge { font-size: 12px !important; }
      #actionPrompt, #pickupHint, #reloadHint { font-size: 9px !important; }
    }

    @media (max-height: 500px) {
      #minimap {
        width: 90px !important;
        height: 90px !important;
      }
      .hint { display: none !important; }
    }
  `;
  document.head.appendChild(style);
})();

// =========================================================
// SHARED STATE INIT
// =========================================================
S.AI_TUNING = { ...AI_TUNING_DEFAULT };
try {
  const r = localStorage.getItem('newstrike_ai_tuning_v2');
  if(r) S.AI_TUNING = { ...AI_TUNING_DEFAULT, ...JSON.parse(r) };
} catch(e){}
function saveAITuning(){
  try { localStorage.setItem('newstrike_ai_tuning_v2', JSON.stringify(S.AI_TUNING)); } catch(e){}
}

function getMaxSlots(){ return (S.player && S.player.hasMilitaryBag) ? 30 : 10; }

// =========================================================
// WINDOW CALLBACKS
// =========================================================
window._spawnInfectionZombies = () => spawnInfectionZombies();
window._refreshViewModels = refreshViewModels;
window._renderWeaponBar = renderWeaponBar;
window._updateHUD = () => updateHUD();
window._addKillfeed = (a,b,c,d,e,f) => addKillfeed(a,b,c,d,e,f);
window._checkGameEnd = () => checkGameEnd();
window._spawnAmmoPickup = (pos) => spawnAmmoPickup(pos);
window._spawnWeaponDrop = (pos, id) => spawnWeaponDrop(pos, id);
window._spawnRocketAmmoPickup = (pos) => spawnRocketAmmoPickup(pos);
window._reportPlayerKill = () => reportPlayerKill();
window._refreshRenameList = () => refreshRenameList();
window._hurtPlayer = (dmg, head, k) => hurtPlayer(dmg, head, k);
window._damageBot = (b, dmg, head, k) => damageBot(b, dmg, head, k);
window._losClear = (a, b) => losClear(a, b);
window._getWeapon = (id) => getWeapon(id);
window._tryZombieConvert = (target, attacker) => tryZombieConvert(target, attacker);
window._convertPlayerToZombie = (attacker) => convertPlayerToZombie(attacker);

window._getEnemyMeshes = () => bots.filter(b => b.alive && (S.gameMode === 'ffa' || b.team !== S.playerTeam)).map(b => b.mesh);
window._matchBotMesh = (mesh) => bots.find(b => b.mesh === mesh);
window._getAllTurrets = () => S.placedTurrets;
window._getAllCannons = () => S.placedCannons;
window._showMsg = (t, m) => showMsg(t, m);
window._weaponsDamageTurret = damageTurret;
window._weaponsDamageCannon = damageCannon;
window._damageTurret = (t, dmg) => { if(window._weaponsDamageTurret) window._weaponsDamageTurret(t, dmg); };
window._damageCannon = (c, dmg) => { if(window._weaponsDamageCannon) window._weaponsDamageCannon(c, dmg); };

window._damageBotsInRadius = (pos, dmg, radius, team, falloff) => {
  for(const b of bots){
    if(!b.alive) continue;
    if(S.gameMode !== 'ffa' && b.team === team) continue;
    const d = b.mesh.position.distanceTo(pos);
    if(d < radius) damageBot(b, Math.round(dmg*falloff(d)), false, { name:'EXPLOSION', team, weapon:'EXPLOSION' });
  }
};

window._damagePlayerInRadius = (pos, dmg, radius, team, falloff) => {
  if(!S.player || !S.player.alive || S.godMode) return;
  if(S.gameMode !== 'ffa' && team === S.player.team) return;
  const pd = S.player.pos.distanceTo(pos);
  if(pd < radius) hurtPlayer(Math.round(dmg*falloff(pd)*0.85), false, { name:'EXPLOSION', team, weapon:'EXPLOSION' });
};

window._damageCannonsInRadius = (pos, dmg, radius, team, falloff) => {
  if(!S.placedCannons) return;
  for(const c of S.placedCannons){
    if(!c.alive) continue;
    if(S.gameMode !== 'ffa' && c.team === team) continue;
    const d = c.pos.distanceTo(pos);
    if(d < radius){
      const scaledDmg = Math.round(dmg * falloff(d) * 1.5);
      damageCannon(c, scaledDmg);
    }
  }
};

if(!S.placedMines) S.placedMines = [];
window._getAllMines = () => S.placedMines;

window._damageTurretsInRadius = (pos, dmg, radius, team, falloff) => {
  if(!S.placedTurrets) return;
  for(const t of S.placedTurrets){
    if(!t.alive) continue;
    if(S.gameMode !== 'ffa' && t.team === team) continue;
    const d = t.pos.distanceTo(pos);
    if(d < radius){
      const scaledDmg = Math.round(dmg * falloff(d) * 2.5);
      damageTurret(t, scaledDmg);
    }
  }
};

// =========================================================
// DROP-ON-DEATH pickup spawners
// =========================================================
window._spawnWeaponPickupAt = (pos, weaponId, ammo, reserve) => {
  const w = getWeapon(weaponId); if(!w) return;
  const g = new THREE.Group();
  const col = w.color || 0x2b2b2b;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.75), new THREE.MeshStandardMaterial({ color:col }));
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.20,0.08), new THREE.MeshStandardMaterial({ color:0x1a1a1a }));
  mag.position.set(0,-0.15,-0.05); mag.rotation.x = 0.25;
  g.add(b,mag);
  if(w.scope){ const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.30,8), new THREE.MeshStandardMaterial({ color:0x111111 })); s.rotation.x = Math.PI/2; s.position.y = 0.11; g.add(s); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35,0.03,6,20), new THREE.MeshBasicMaterial({color:0xffd75e}));
  ring.rotation.x = Math.PI/2; ring.position.y = -0.28; g.add(ring);
  g.position.set(pos.x, 0.45, pos.z); scene.add(g);
  const label = makePickupLabel(w.name, '#ffd75e');
  if(label){ label.position.set(pos.x, 1.3, pos.z); label.visible = false; scene.add(label); }
  S.pickups.push({ mesh:g, pos:g.position.clone(), kind:'weapon', weaponId, ammo, reserve, label });
};
window._spawnArmorPickupAt = (pos, armorData) => {
  const isKevlar = armorData.type === 'kevlar';
  const col = isKevlar ? 0x6ec6ff : 0x7CFC9A;
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.15), new THREE.MeshStandardMaterial({ color:col }));
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.16), new THREE.MeshStandardMaterial({ color:0x1a1a1a }));
  strap.position.y = 0.15; g.add(b, strap);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42,0.03,6,20), new THREE.MeshBasicMaterial({color:col}));
  ring.rotation.x = Math.PI/2; ring.position.y = -0.4; g.add(ring);
  g.position.set(pos.x, 0.5, pos.z); scene.add(g);
  S.pickups.push({ mesh:g, pos:g.position.clone(), kind:'armor', armor: armorData });
};

// =========================================================
// ROUND CLEANUP — alisin lahat ng dropped items pag end ng round
// =========================================================
function clearRoundDrops(){
  // 1. Dropped weapons / armor / ammo
  for(const p of S.pickups){
    scene.remove(p.mesh);
    if(p.label) scene.remove(p.label);
  }
  S.pickups.length = 0;

  // 2. Mines
  if(S.placedMines){
    for(const m of S.placedMines){
      if(m.mesh) scene.remove(m.mesh);
    }
    S.placedMines.length = 0;
  }

  // 3. Turrets
  for(const t of S.placedTurrets){
    if(t.mesh) scene.remove(t.mesh);
  }
  S.placedTurrets.length = 0;

  // 4. Cannons
  for(const c of S.placedCannons){
    if(c.mesh) scene.remove(c.mesh);
  }
  S.placedCannons.length = 0;

  // 5. In-flight projectiles (grenades, rockets)
  for(const p of S.projectiles){
    scene.remove(p.mesh);
    if(p.trailMesh) scene.remove(p.trailMesh);
  }
  S.projectiles.length = 0;

  // 6. Tracers (bullet lines)
  for(const t of S.tracers){
    scene.remove(t.t);
  }
  S.tracers.length = 0;

  // 7. Smoke clouds
  for(const s of S.smokeClouds){
    scene.remove(s.mesh);
  }
  S.smokeClouds.length = 0;

  // 8. Unmount cannon kung nakaupo pa
  if(S.cannonOperating){
    if(S.cannonTarget && S.cannonTarget.mesh) S.cannonTarget.mesh.visible = true;
    S.cannonOperating = false;
    S.cannonTarget = null;
  }
}

createPlayer();
S.player.bagStorage = [];

// =========================================================
// TIMERS
// =========================================================
try {
  const mt = localStorage.getItem('newstrike_map_time'); if(mt) S.mapTimeLimit = parseInt(mt) || 1800;
  const rt = localStorage.getItem('newstrike_round_time'); if(rt) S.roundTimeLimit = parseInt(rt) || 115;
  const bt = localStorage.getItem('newstrike_bomb_fuse'); if(bt) S.bombFuseTime = parseInt(bt) || 40;
} catch(e){}
function saveTimeLimits(){
  try {
    localStorage.setItem('newstrike_map_time', S.mapTimeLimit);
    localStorage.setItem('newstrike_round_time', S.roundTimeLimit);
    localStorage.setItem('newstrike_bomb_fuse', S.bombFuseTime);
  } catch(e){}
}

// =========================================================
// ANNOUNCER
// =========================================================
const Announcer = {
  voiceUrls: {}, volume: 0.8,
  play(key){
    const freqs = { first_blood:1000, ks_2:900, ks_3:1000, ks_4:1100, ks_5:1200, ks_6:1300, ks_7:1400, savage:1600, enemy_down:500, enemy_neutralized:600 };
    const f = freqs[key] || 600;
    beep(f, 0.12, 'sine', 0.15);
    setTimeout(()=>beep(f*1.2, 0.10, 'sine', 0.13), 90);
  }
};
const ANNOUNCE_NAMES = { first_blood:'FIRST BLOOD', ks_2:'DOUBLE KILL', ks_3:'TRIPLE KILL', ks_4:'QUADRA KILL', ks_5:'PENTA KILL', ks_6:'MONSTER KILL', ks_7:'GODLIKE', savage:'SAVAGE' };
function announce(key){
  Announcer.play(key);
  const el = document.getElementById('streakBadge');
  if(el && ANNOUNCE_NAMES[key]){
    el.textContent = '★ ' + ANNOUNCE_NAMES[key] + ' ★';
    el.style.display = 'block';
    clearTimeout(el._to);
    el._to = setTimeout(()=>{ el.style.display = 'none'; }, 2200);
  }
}

// =========================================================
// KILLFEED
// =========================================================
function addKillfeed(killerName, victimName, weaponName, extraType, killerTeam, victimTeam){
  const feed = document.getElementById('killfeed');
  if(!feed) return;
  const row = document.createElement('div');
  row.className = 'kf-row' + (killerTeam ? ' ' + killerTeam : '');
  if(killerName && killerName.length > 10) killerName = killerName.substring(0, 10) + '…';
  if(victimName && victimName.length > 10) victimName = victimName.substring(0, 10) + '…';
  if(weaponName && weaponName.length > 12) weaponName = weaponName.substring(0, 12) + '…';
  if(extraType === 'special'){ row.classList.add('special'); row.textContent = weaponName; }
  else {
    row.innerHTML = `<span class="kf-name ${killerTeam||''}">${escapeHtml(killerName)}</span>
      <span class="kf-arrow">▸</span><span class="kf-weapon">${escapeHtml(weaponName||'?')}</span>
      <span class="kf-arrow">▸</span><span class="kf-name ${victimTeam||''}">${escapeHtml(victimName)}</span>`;
  }
  feed.appendChild(row);
  while(feed.children.length > 6) feed.removeChild(feed.firstChild);
  setTimeout(()=>{ row.style.transition = 'opacity .5s'; row.style.opacity = '0'; setTimeout(()=>row.remove(), 500); }, 5000);
}

// =========================================================
// CHAT
// =========================================================
const chatLog = document.getElementById('chatLog');
const chatInputWrap = document.getElementById('chatInputWrap');
const chatInput = document.getElementById('chatInput');
const chatPrefix = document.getElementById('chatPrefix');

function addChatLine(name, text, cls){
  if(!chatLog) return;
  const div = document.createElement('div');
  div.className = 'chat-line ' + cls;
  let n = name || '';
  let t = text || '';
  if(n.length > 12) n = n.substring(0, 12) + '…';
  if(t.length > 40) t = t.substring(0, 40) + '…';
  div.innerHTML = `<span class="chat-name">${escapeHtml(n)}:</span> ${escapeHtml(t)}`;
  chatLog.appendChild(div);
  while(chatLog.children.length > 5) chatLog.removeChild(chatLog.firstChild);
  setTimeout(()=>{ div.style.transition='opacity .6s'; div.style.opacity='0'; setTimeout(()=>div.remove(), 600); }, 5000);
}
function openChat(mode){
  if(S.gameState !== 'playing' || !S.player.alive) return;
  S.chatOpen = true; S.chatMode = mode;
  chatInputWrap.style.display = 'flex';
  chatPrefix.textContent = mode === 'all' ? '[ALL]' : '[TEAM]';
  chatInput.value = ''; chatInput.focus();
  if(document.pointerLockElement) document.exitPointerLock();
}
function closeChat(){
  S.chatOpen = false;
  chatInputWrap.style.display = 'none';
  chatInput.blur();
  if(S.gameState === 'playing' && !S.shopOpen && !S.consoleOpen && !S.commandMenuOpen && !S.gamePaused && S.player.alive){
    renderer.domElement.requestPointerLock();
  }
}
function sendChat(text){
  text = text.trim();
  if(!text){ closeChat(); return; }
  addChatLine('YOU', text, S.chatMode === 'all' ? 'all' : 'team ' + S.playerTeam);
  if(S.chatMode === 'all'){
    setTimeout(()=>{
      if(Math.random() < 0.35){
        const alive = bots.filter(b => b.alive);
        if(alive.length){
          const bot = alive[Math.floor(Math.random()*alive.length)];
          const responses = ['...','HAHAHA','SHUT UP','COME GET SOME','NOOB','GG','AFFIRMATIVE','NICE TRY','LOL'];
          addChatLine(bot.name, responses[Math.floor(Math.random()*responses.length)], 'all');
        }
      }
    }, 700 + Math.random()*1400);
  } else {
    setTimeout(()=>{
      const allies = bots.filter(b => b.alive && b.team === S.playerTeam);
      if(allies.length){
        const bot = allies[Math.floor(Math.random()*allies.length)];
        const responses = ['ROGER','AFFIRMATIVE','COPY THAT','ON IT','YES SIR','10-4','MOVING OUT'];
        addChatLine(bot.name, responses[Math.floor(Math.random()*responses.length)], 'team ' + bot.team);
      }
    }, 500 + Math.random()*800);
  }
  closeChat();
}
if(chatInput){
  chatInput.addEventListener('keydown', e => {
    if(e.code === 'Enter'){ sendChat(chatInput.value); e.preventDefault(); }
    else if(e.code === 'Escape'){ closeChat(); e.preventDefault(); }
    e.stopPropagation();
  });
  chatInput.addEventListener('keyup', e => e.stopPropagation());
}

// =========================================================
// STREAK
// =========================================================
function reportPlayerKill(){
  const now = performance.now();
  if(now - S.streak.lastTime < STREAK_WINDOW_MS) S.streak.count++; else S.streak.count = 1;
  S.streak.lastTime = now;
  if(!S.player) return;
  S.player.streak = S.streak.count;
  S.player.streakExpiresAt = now + STREAK_WINDOW_MS;
  if(!S.firstBloodDone){
    announce('first_blood');
    addKillfeed('', '', 'FIRST BLOOD', 'special');
    S.firstBloodDone = true;
    return;
  }
  if(S.streak.count >= 8){ announce('savage'); addKillfeed('','','SAVAGE','special'); }
  else if(S.streak.count >= 2 && S.streak.count <= 7){ announce('ks_' + S.streak.count); addKillfeed('','',ANNOUNCE_NAMES['ks_' + S.streak.count],'special'); }
  else { Announcer.play('enemy_down'); }
}

// =========================================================
// DROPS
// =========================================================
function spawnAmmoPickup(pos){
  if(Math.random() > 0.4) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.4), new THREE.MeshStandardMaterial({ color:0xffd75e }));
  m.position.set(pos.x, 0.3, pos.z); m.castShadow = true; scene.add(m);
  S.pickups.push({ mesh:m, pos:m.position.clone(), kind:'ammo' });
}
function makePickupLabel(text, color){
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = color || '#ffd75e';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.fillStyle = color || '#ffd75e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}
function spawnWeaponDrop(pos, weaponId){
  const w = getWeapon(weaponId); if(!w) return;
  const g = new THREE.Group();
  const col = w.color || 0x2b2b2b;
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.75), new THREE.MeshStandardMaterial({ color:col }));
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.20,0.08), new THREE.MeshStandardMaterial({ color:0x1a1a1a }));
  mag.position.set(0,-0.15,-0.05); mag.rotation.x = 0.25;
  g.add(b,mag);
  if(w.scope){ const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.30,8), new THREE.MeshStandardMaterial({ color:0x111111 })); s.rotation.x = Math.PI/2; s.position.y = 0.11; g.add(s); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35,0.03,6,20), new THREE.MeshBasicMaterial({color:0xffd75e}));
  ring.rotation.x = Math.PI/2; ring.position.y = -0.28; g.add(ring);
  g.position.set(pos.x, 0.45, pos.z); scene.add(g);
  const label = makePickupLabel(w.name, '#ffd75e');
  label.position.set(pos.x, 1.3, pos.z);
  label.visible = false;
  scene.add(label);
  S.pickups.push({ mesh:g, pos:g.position.clone(), kind:'weapon', weaponId, label });
}

// =========================================================
// HUD
// =========================================================
function showMsg(txt, ms, cls){
  const m = document.getElementById('msg'); if(!m) return;
  m.innerHTML = txt.replace(/\n/g, '<br>');
  m.className = cls || '';
  m.style.display = 'block';
  clearTimeout(m._timer);
  m._timer = setTimeout(()=>m.style.display = 'none', ms);
}
function updateHUD(){
  const player = S.player; if(!player) return;
  const w = getWeapon(S.currentWeaponKey); if(!w) return;
  const st = S.ammoState[S.currentWeaponKey] || { ammo:0, reserve:0 };
  const setT = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setT('hp', 'HP ' + Math.max(0, Math.round(player.hp)) + (S.godMode?' ∞':''));
  const arm = document.getElementById('armorHud');
  if(arm) arm.innerHTML = 'KEVLAR: ' + Math.round(player.kevlar) + '<br>HELMET: ' + Math.round(player.helmet);
  setT('money', '$' + player.money);

  const baseZ = (S.playerTeam === 'merc') ? 80 : -80;
  const dxz = player.pos.x - 0;
  const dzz = player.pos.z - baseZ;
  const inBuyZone = (dxz*dxz + dzz*dzz) < 900;
  const moneyEl = document.getElementById('money');
  if(moneyEl){
    if(inBuyZone) moneyEl.style.borderLeftColor = '#6a9c3f';
    else moneyEl.style.borderLeftColor = 'var(--iron)';
  }

  const fac = document.getElementById('faction');
  if(fac){
    if(S.gameMode === 'ffa'){ fac.textContent = 'FFA'; fac.style.color = '#ff9d5e'; }
    else { fac.textContent = S.playerTeam.toUpperCase(); fac.style.color = S.playerTeam==='merc' ? '#6ec6ff' : '#ff5555'; }
  }
  setT('ammo', w.melee ? 'MELEE' : (st.ammo + ' / ' + st.reserve));
  setT('weaponName', w.name);
  setT('score', 'KILLS ' + S.kills);

  const teamScoreEl = document.getElementById('teamScore');
  if(teamScoreEl){
    if(S.gameMode === 'ffa'){
      teamScoreEl.textContent = 'FREE FOR ALL · ROUND ' + S.round + '/' + FFA_TOTAL_ROUNDS;
    } else if(S.gameMode === 'infection'){
      teamScoreEl.textContent = getInfectionHUDText();
    } else {
      teamScoreEl.textContent = 'MERC ' + S.mercScore + ' — ' + S.cartelScore + ' CARTEL';
    }
  }

  const slotEl = document.getElementById('slotCounter');
  if(slotEl){
    const max = getMaxSlots();
    slotEl.textContent = 'SLOTS ' + S.ownedWeapons.length + ' / ' + max + (player.hasMilitaryBag ? ' 🎒' : '');
    slotEl.style.color = player.hasMilitaryBag ? '#ffd75e' : '#8fc4f0';
  }

  const mi = document.getElementById('modeInfo');
  if(mi){
    if(S.gameMode === 'dm')       mi.textContent = 'DEATHMATCH · ROUND ' + S.round;
    else if(S.gameMode === 'ffa') mi.textContent = 'FREE FOR ALL · ROUND ' + S.round + '/' + FFA_TOTAL_ROUNDS;
    else if(S.gameMode === 'infection') mi.textContent = 'INFECTION · SURVIVE 5 MIN';
    else if(S.activeMode) mi.textContent = S.activeMode.getHUDModeText(S);
    else mi.textContent = 'SEARCH & DESTROY · ROUND ' + S.sdRound;
  }

  const sc = document.getElementById('shopCash'); if(sc) sc.textContent = '$' + player.money;
  const gi = document.getElementById('godIndicator'); if(gi) gi.style.display = S.godMode ? 'block' : 'none';
  const eqEl = document.getElementById('equipHud');
  if(eqEl){
    if(S.gameState === 'playing' && player.alive){
      eqEl.style.display = 'block';
      const eq = getEquipment(S.currentEquip);
      const lb = document.getElementById('equipLabel'); if(lb) lb.textContent = (eq?.name || S.currentEquip.toUpperCase());
      const cnt = document.getElementById('equipCount'); if(cnt) cnt.textContent = (S.inventory[S.currentEquip]||0);
    } else eqEl.style.display = 'none';
  }
}
function updateTimeHud(){
  const hud = document.getElementById('timeHud'); if(!hud) return;
  if(S.gameState !== 'playing'){ hud.style.display = 'none'; return; }
  hud.style.display = 'block';
  const mapEl = document.getElementById('timeMap'), roundEl = document.getElementById('timeRound');
  if(mapEl){ mapEl.textContent = 'MAP ' + formatTime(S.mapTimeRemaining); mapEl.className = S.mapTimeRemaining < 60 ? 'warn' : ''; }
  if(roundEl){
    if(S.gameMode === 'sd'){
      roundEl.style.display = '';
      roundEl.textContent = 'ROUND ' + formatTime(S.roundTimeRemaining);
      roundEl.className = S.roundTimeRemaining < 20 ? 'warn' : '';
    } else if(S.gameMode === 'ffa'){
      roundEl.style.display = '';
      roundEl.textContent = 'ROUND ' + S.round + '/' + FFA_TOTAL_ROUNDS + ' · ' + formatTime(S.roundTimeRemaining);
      roundEl.className = S.roundTimeRemaining < 30 ? 'warn' : '';
    } else if(S.gameMode === 'infection'){
      roundEl.style.display = '';
      if(S.buyPhaseActive){
        roundEl.textContent = 'BUY PHASE · ' + Math.ceil(S.buyPhaseTimeRemaining) + 's';
        roundEl.className = 'warn';
      } else {
        roundEl.textContent = 'INFECTION · ' + formatTime(S.roundTimeRemaining);
        roundEl.className = S.roundTimeRemaining < 30 ? 'warn' : '';
      }
    } else {
      roundEl.style.display = 'none';
    }
  }
}

// =========================================================
// ADS
// =========================================================
function updateADS(dt){
  const w = getWeapon(S.currentWeaponKey);
  const player = S.player;
  const canADS = w && !w.melee && !S.reloading && player && player.alive;
  const locked = document.pointerLockElement === renderer.domElement;
  const _adsHeld = S.adsHeld || (S.mobile && S.mobile.adsHeld);
  const isMobile = document.body.classList.contains('is-mobile');
  const _locked  = isMobile ? true : locked;
  const wantADS  = _adsHeld && canADS && player.hp > 0 && _locked && S.gameState === 'playing';
  S.adsActive = wantADS;

  let targetFov = DEFAULT_FOV;
  if(S.adsActive && w){
    if(w.scope) targetFov = w.adsFov || 18;
    else if(w.category === 'pistol') targetFov = 58;
    else if(w.category === 'smg') targetFov = 55;
    else if(w.category === 'shotgun') targetFov = 58;
    else if(w.category === 'lmg') targetFov = 50;
    else if(w.category === 'launcher' || w.category === 'cannon') targetFov = 60;
    else targetFov = 50;
  }
  S.adsT += (S.adsActive ? dt*7 : -dt*7);
  S.adsT = Math.max(0, Math.min(1, S.adsT));
  camera.fov = DEFAULT_FOV + (targetFov - DEFAULT_FOV) * S.adsT;
  camera.updateProjectionMatrix();

  const so = document.getElementById('scopeOverlay');
  const ch = document.getElementById('crosshair');
  const chn = document.getElementById('crosshairName');
  const isScoped = w && w.scope && S.adsT > 0.75;
  const vm = S.viewModels[S.currentWeaponKey];

  if(isScoped){
    if(so) so.style.display = 'block';
    if(ch) ch.style.display = 'none';
    if(chn) chn.style.display = 'none';
    if(vm) vm.visible = false;
  } else {
    if(so) so.style.display = 'none';
    if(ch && player && player.alive && S.gameState === 'playing') ch.style.display = '';
    if(vm && player) vm.visible = player.alive;
  }

  if(vm && !isScoped){
    const base = vm.userData.basePos || vm.position.clone();
    const targetX = 0.0;
    const targetY = -0.10;
    const targetZ = base.z + 0.05;
    vm.position.x = base.x + (targetX - base.x) * S.adsT;
    vm.position.y = base.y + (targetY - base.y) * S.adsT;
    vm.position.z = base.z + (targetZ - base.z) * S.adsT;
  }
}

// =========================================================
// CROSSHAIR TARGET
// =========================================================
let crosshairNameEl = document.getElementById('crosshairName');
function updateCrosshairTarget(){
  const crosshair = document.getElementById('crosshair');
  if(!crosshair || !crosshairNameEl) return;
  if(!S.player || !S.player.alive || !S.player.hp){
    crosshair.className = ''; crosshairNameEl.style.display = 'none'; return;
  }
  if(S.adsActive && S.adsT > 0.7) return;
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster(origin, dir, 0, 200);
  const alive = bots.filter(b => b.alive);
  const botHits = alive.length ? ray.intersectObjects(alive.map(b=>b.mesh), true) : [];
  const wallHits = ray.intersectObjects(staticMeshes, false);
  const botDist = botHits.length ? botHits[0].distance : Infinity;
  const wallDist = wallHits.length ? wallHits[0].distance : Infinity;
  if(botHits.length && botDist < wallDist){
    let o = botHits[0].object; while(o.parent && o.parent!==scene) o = o.parent;
    const b = bots.find(x=>x.mesh===o);
    if(b){
      const isEnemy = (S.gameMode === 'ffa') ? true : (b.team !== S.playerTeam);
      crosshair.className = isEnemy ? 'enemy' : 'friendly';
      crosshairNameEl.style.display = 'block';
      crosshairNameEl.className = isEnemy ? 'enemy' : 'friendly';
      crosshairNameEl.textContent = (isEnemy ? '⚠ ' : '✔ ') + b.name + ' · ' + b.kind.toUpperCase();
      return;
    }
  }
  crosshair.className = '';
  crosshairNameEl.style.display = 'none';
}

// =========================================================
// MINIMAP
// =========================================================
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas ? mmCanvas.getContext('2d') : null;
let mmZoomIndex = 1;
function cycleMMZoom(){
  mmZoomIndex = (mmZoomIndex + 1) % MM_ZOOM_LEVELS.length;
  const lbl = document.getElementById('mapZoomLabel');
  if(lbl) lbl.textContent = 'ZOOM: ' + MM_ZOOM_LEVELS[mmZoomIndex] + 'm';
  beep(700, 0.05, 'square', 0.08);
}
function drawMinimap(){
  if(!mmCtx) return;
  const Sv = 170;
  const worldRange = MM_ZOOM_LEVELS[mmZoomIndex];
  const halfRange = worldRange / 2;
  mmCtx.clearRect(0,0,Sv,Sv);
  mmCtx.fillStyle = 'rgba(20,30,20,0.5)';
  mmCtx.fillRect(0,0,Sv,Sv);
  const refPos = S.spectatorMode ? S.spectatorPos : (S.player ? S.player.pos : new THREE.Vector3());
  const refYaw = S.spectatorMode ? S.spectatorYaw : (S.player ? S.player.yaw : 0);
  const toMM = (x, z) => { const dx = x - refPos.x, dz = z - refPos.z; return [ Sv/2 + (dx/halfRange)*Sv, Sv/2 + (dz/halfRange)*Sv ]; };
  const [mbx,mbz] = toMM(0,80);
  mmCtx.fillStyle = 'rgba(110,198,255,0.12)'; mmCtx.fillRect(mbx-35, mbz-22, 70, 44);
  mmCtx.strokeStyle = '#6ec6ff'; mmCtx.lineWidth=1; mmCtx.strokeRect(mbx-35, mbz-22, 70, 44);
  const [cbx,cbz] = toMM(0,-80);
  mmCtx.fillStyle = 'rgba(255,85,85,0.12)'; mmCtx.fillRect(cbx-35, cbz-22, 70, 44);
  mmCtx.strokeStyle = '#ff5555'; mmCtx.strokeRect(cbx-35, cbz-22, 70, 44);
  for(const b of bots){
    if(!b.alive) continue;
    const [mx,mz] = toMM(b.mesh.position.x, b.mesh.position.z);
    if(mx < -10 || mx > Sv+10 || mz < -10 || mz > Sv+10) continue;

    if(S.gameMode === 'infection' || S.gameMode === 'zombie_escape'){
      if(b.team === 'zombie'){
        if(b.kind === 'tanker'){
          mmCtx.fillStyle = '#ff2020';
          mmCtx.fillRect(mx-5, mz-5, 10, 10);
          mmCtx.strokeStyle = '#ff8080';
          mmCtx.lineWidth = 1;
          mmCtx.strokeRect(mx-5, mz-5, 10, 10);
        } else if(b.kind === 'runner'){
          mmCtx.fillStyle = '#ffdd00';
          mmCtx.fillRect(mx-3, mz-3, 6, 6);
        } else {
          mmCtx.fillStyle = '#ff6030';
          mmCtx.fillRect(mx-2, mz-2, 4, 4);
        }
      } else {
        mmCtx.fillStyle = '#6ec6ff';
        mmCtx.fillRect(mx-2, mz-2, 4, 4);
      }
    }
    else if(S.gameMode === 'ffa'){
      mmCtx.fillStyle = '#ff5555';
      mmCtx.fillRect(mx-2, mz-2, 4, 4);
    } else {
      mmCtx.fillStyle = b.team==='merc' ? '#6ec6ff' : (b.kind==='heavy' ? '#ff8a4a' : b.kind==='sniper' ? '#ffd75e' : '#ff5555');
      mmCtx.fillRect(mx-2, mz-2, 4, 4);
    }
  }
  mmCtx.fillStyle = '#7CFC9A';
  mmCtx.beginPath(); mmCtx.arc(Sv/2, Sv/2, 4, 0, Math.PI*2); mmCtx.fill();
  mmCtx.strokeStyle = '#7CFC9A'; mmCtx.lineWidth = 2;
  mmCtx.beginPath(); mmCtx.moveTo(Sv/2, Sv/2);
  mmCtx.lineTo(Sv/2 - Math.sin(refYaw)*10, Sv/2 - Math.cos(refYaw)*10);
  mmCtx.stroke();

  // ⭐ SEARCH & DESTROY — bomb site markers
  if(S.gameMode === 'sd'){
    // Site A
    const [ax, az] = toMM(BOMB_SITE_A.x, BOMB_SITE_A.z);
    if(ax > -20 && ax < Sv+20 && az > -20 && az < Sv+20){
      mmCtx.fillStyle = 'rgba(255,157,94,0.25)';
      mmCtx.beginPath(); mmCtx.arc(ax, az, 14, 0, Math.PI*2); mmCtx.fill();
      mmCtx.strokeStyle = '#ff9d5e'; mmCtx.lineWidth = 2;
      mmCtx.beginPath(); mmCtx.arc(ax, az, 14, 0, Math.PI*2); mmCtx.stroke();
      mmCtx.fillStyle = '#ff9d5e';
      mmCtx.font = 'bold 14px monospace';
      mmCtx.textAlign = 'center';
      mmCtx.textBaseline = 'middle';
      mmCtx.fillText('A', ax, az);
    }
    // Site B
    const [bx, bz] = toMM(BOMB_SITE_B.x, BOMB_SITE_B.z);
    if(bx > -20 && bx < Sv+20 && bz > -20 && bz < Sv+20){
      mmCtx.fillStyle = 'rgba(255,157,94,0.25)';
      mmCtx.beginPath(); mmCtx.arc(bx, bz, 14, 0, Math.PI*2); mmCtx.fill();
      mmCtx.strokeStyle = '#ff9d5e'; mmCtx.lineWidth = 2;
      mmCtx.beginPath(); mmCtx.arc(bx, bz, 14, 0, Math.PI*2); mmCtx.stroke();
      mmCtx.fillStyle = '#ff9d5e';
      mmCtx.fillText('B', bx, bz);
    }
    // Planted bomb — pulsing red dot
    if(S.bombPlanted && S.bombPos){
      const [px, pz] = toMM(S.bombPos.x, S.bombPos.z);
      mmCtx.fillStyle = '#ff2020';
      mmCtx.beginPath(); mmCtx.arc(px, pz, 6, 0, Math.PI*2); mmCtx.fill();
      const pulse = 10 + Math.sin(performance.now() * 0.008) * 6;
      mmCtx.strokeStyle = '#ff2020'; mmCtx.lineWidth = 2;
      mmCtx.beginPath(); mmCtx.arc(px, pz, pulse, 0, Math.PI*2); mmCtx.stroke();
    }
  }



  mmCtx.strokeStyle = '#2f4f3a'; mmCtx.lineWidth = 2;
  mmCtx.strokeRect(0,0,Sv,Sv);
}

// =========================================================
// SCOREBOARD
// =========================================================
function showScoreboard(){
  S.scoreboardVisible = true;
  const sb = document.getElementById('scoreboard'); if(sb) sb.style.display = 'flex';
  renderScoreboard();
}
function hideScoreboard(){
  S.scoreboardVisible = false;
  const sb = document.getElementById('scoreboard'); if(sb) sb.style.display = 'none';
}




// =========================================================
// SCOREBOARD — Column Labels Injector
// =========================================================
function ensureScoreboardLabels(teamHeader, teamCount){
  // Add column headers if not already present
  const parent = teamHeader ? teamHeader.parentElement : null;
  if(!parent) return;
  if(parent.querySelector('.sb-col-head')) return;

  const colHead = document.createElement('div');
  colHead.className = 'sb-col-head';
  colHead.innerHTML = '<span class="sb-col-name">NAME</span><span class="sb-col-k">K</span><span class="sb-col-status">●</span>';
  if(teamCount && teamCount.parentNode){
    teamCount.parentNode.insertBefore(colHead, teamCount.nextSibling);
  }
}






function renderScoreboard(){
  const setT = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  setT('sbMapName', 'DUST OUTPOST');

  // ⭐ FIX: Reset team headers & display state — para walang mode contamination
  const _mercTeamEl = document.querySelector('.sb-team.merc');
  const _cartelTeamEl = document.querySelector('.sb-team.cartel');
  const _mercHeaderEl = document.querySelector('.sb-team.merc .sb-team-header');
  const _cartelHeaderEl = document.querySelector('.sb-team.cartel .sb-team-header');
  if(_mercTeamEl){ _mercTeamEl.style.display = ''; _mercTeamEl.style.flex = '1'; }
  if(_cartelTeamEl){ _cartelTeamEl.style.display = ''; _cartelTeamEl.style.flex = '1'; }
  if(_mercHeaderEl) _mercHeaderEl.textContent = 'MERCENARIES';
  if(_cartelHeaderEl) _cartelHeaderEl.textContent = 'CARTEL';

  // ⭐ Inject column headers kung wala pa
  ['sbMercList', 'sbCartelList'].forEach(id => {
    const list = document.getElementById(id);
    if(!list) return;
    const prev = list.previousElementSibling;
    if(prev && prev.classList.contains('sb-col-head')) return;

    const colHead = document.createElement('div');
    colHead.className = 'sb-col-head';
    colHead.innerHTML = '<span class="sb-col-name">NAME</span><span class="sb-col-k">K</span><span class="sb-col-status">●</span>';
    list.parentNode.insertBefore(colHead, list);
  });

  if(S.gameMode === 'infection'){
    setT('sbMode', 'INFECTION · SURVIVE 5 MIN');
    const mercList = document.getElementById('sbMercList');
    const cartelList = document.getElementById('sbCartelList');

    const mercTeam = document.querySelector('.sb-team.merc');
    const cartelTeam = document.querySelector('.sb-team.cartel');
    if(mercTeam){ mercTeam.style.display = ''; mercTeam.style.flex = '1'; }
    if(cartelTeam){ cartelTeam.style.display = ''; cartelTeam.style.flex = '1'; }

    const mercHeader = document.querySelector('.sb-team.merc .sb-team-header');
    const cartelHeader = document.querySelector('.sb-team.cartel .sb-team-header');
    if(mercHeader) mercHeader.textContent = '🧍 SURVIVORS';
    if(cartelHeader) cartelHeader.textContent = '🧟 ZOMBIES';

    const survivors = bots.filter(b => b.alive && b.team === 'survivor').length + (S.player && S.player.alive && S.player.team === 'survivor' ? 1 : 0);
    const zombies = bots.filter(b => b.alive && b.team === 'zombie').length + (S.player && S.player.alive && S.player.team === 'zombie' ? 1 : 0);

    setT('sbMercScore', survivors);
    setT('sbCartelScore', zombies);
    setT('sbMercCount', 'ALIVE: ' + survivors);
    setT('sbCartelCount', 'ALIVE: ' + zombies);

    if(!mercList || !cartelList) return;
    mercList.innerHTML = '';
    cartelList.innerHTML = '';

    if(S.player){
      const isZ = S.player.team === 'zombie';
      const tag = isZ ? '🧟' : '🧍';
      const r = `<div class="sb-row you ${!S.player.alive?'dead':''}">` +
        `<span class="sb-name">► YOU ${tag}</span>` +
        `<span class="sb-kills">${S.player.kills || 0}</span>` +
        `<span class="sb-status">${S.player.alive?'●':'✕'}</span>` +
        `</div>`;
      if(isZ) cartelList.innerHTML += r; else mercList.innerHTML += r;
    }

    for(const b of bots){
      const isZ = b.team === 'zombie';
      const isBoss = b.kind === 'tanker';
      const isRunner = b.kind === 'runner';
      const tag = isZ ? (isRunner ? '⚡' : '🧟') : '🧍';
      const bossTag = isBoss ? ' 💀 BOSS' : '';
      const r = `<div class="sb-row ${!b.alive?'dead':''}">` +
        `<span class="sb-name">${tag} ${escapeHtml(b.name)}${bossTag}</span>` +
        `<span class="sb-kills">${b.botKills || 0}</span>` +
        `<span class="sb-status">${b.alive?'●':'✕'}</span>` +
        `</div>`;
      if(isZ) cartelList.innerHTML += r; else mercList.innerHTML += r;
    }
    return;
  }

  if(S.gameMode === 'ffa'){
    setT('sbMode', 'FREE FOR ALL · ROUND ' + S.round + '/' + FFA_TOTAL_ROUNDS);
    const mercList = document.getElementById('sbMercList');
    const cartelList = document.getElementById('sbCartelList');
    const mercTeam = document.querySelector('.sb-team.merc');
    const cartelTeam = document.querySelector('.sb-team.cartel');
    if(mercTeam) mercTeam.style.flex = '2';
    if(cartelTeam) cartelTeam.style.display = 'none';

    const mercHeader = document.querySelector('.sb-team.merc .sb-team-header');
    if(mercHeader) mercHeader.textContent = 'FREE FOR ALL';
    setT('sbMercScore', S.kills);
    setT('sbMercCount', 'PLAYERS: ' + (bots.length + 1));

    if(!mercList) return;
    mercList.innerHTML = '';

    const entries = [];
    if(S.player) entries.push({ name: '► YOU', kills: S.player.kills || 0, alive: S.player.alive, you: true });
    for(const b of bots){
      entries.push({ name: b.name || b.kind.toUpperCase(), kills: b.botKills || 0, alive: b.alive, you: false });
    }
    entries.sort((a,b) => b.kills - a.kills);

    for(const e of entries){
      const r = `<div class="sb-row ${e.you?'you':''} ${!e.alive?'dead':''}">` +
        `<span class="sb-name">${escapeHtml(e.name)}</span>` +
        `<span class="sb-kills">${e.kills}</span>` +
        `<span class="sb-status">${e.alive?'●':'✕'}</span>` +
        `</div>`;
      mercList.innerHTML += r;
    }
    return;
  }

  setT('sbMode', S.gameMode === 'dm' ? 'DEATHMATCH · FIRST TO '+DM_KILL_TARGET : 'S&D · ROUND '+S.sdRound);
  setT('sbMercScore', S.mercScore);
  setT('sbCartelScore', S.cartelScore);
  const mercList = document.getElementById('sbMercList'), cartelList = document.getElementById('sbCartelList');
  if(!mercList || !cartelList) return;
  mercList.innerHTML = ''; cartelList.innerHTML = '';
  const mercAlive = bots.filter(b=>b.alive && b.team==='merc').length + (S.playerTeam==='merc' && S.player && S.player.alive ? 1 : 0);
  const cartelAlive = bots.filter(b=>b.alive && b.team==='cartel').length + (S.playerTeam==='cartel' && S.player && S.player.alive ? 1 : 0);
  const mercTotal = bots.filter(b=>b.team==='merc').length + (S.playerTeam==='merc' ? 1 : 0);
  const cartelTotal = bots.filter(b=>b.team==='cartel').length + (S.playerTeam==='cartel' ? 1 : 0);
  setT('sbMercCount', 'ALIVE: '+mercAlive+' / '+mercTotal);
  setT('sbCartelCount', 'ALIVE: '+cartelAlive+' / '+cartelTotal);
  const row = (name, k, you, alive) =>
    `<div class="sb-row ${you?'you':''} ${!alive?'dead':''}">` +
    `<span class="sb-name">${escapeHtml(name)}</span>` +
    `<span class="sb-kills">${k}</span>` +
    `<span class="sb-status">${alive?'●':'✕'}</span>` +
    `</div>`;
  const pr = row('► YOU', S.player ? S.player.kills || 0 : 0, true, S.player ? S.player.alive : false);
  if(S.playerTeam === 'merc') mercList.innerHTML += pr; else cartelList.innerHTML += pr;
  for(const b of bots){
    const r = row(b.name || b.kind.toUpperCase(), b.botKills || 0, false, b.alive);
    if(b.team === 'merc') mercList.innerHTML += r; else cartelList.innerHTML += r;
  }
}

// =========================================================
// BOT RENAME LIST
// =========================================================
function refreshRenameList(){
  const cont = document.getElementById('renameList'); if(!cont) return;
  cont.innerHTML = '';
  if(!bots.length){ cont.innerHTML = '<div style="padding:10px;color:#7fa892;font-size:11px;">No bots yet.</div>'; return; }
  for(const b of bots){
    if(!b.alive) continue;
    const rowEl = document.createElement('div'); rowEl.className = 'renameRow';
    rowEl.innerHTML = `<span class="team-tag ${b.team}">${b.team.toUpperCase()}</span><input type="text" value="${escapeHtml(b.name)}" maxlength="24"><button>RENAME</button>`;
    const inp = rowEl.querySelector('input'), btn = rowEl.querySelector('button');
    const doRename = () => { const v = inp.value.trim(); if(v){ b.name = v; showMsg('RENAMED: '+v, 900); } };
    btn.onclick = doRename;
    inp.addEventListener('keydown', e => { if(e.code === 'Enter'){ doRename(); inp.blur(); } });
    cont.appendChild(rowEl);
  }
}

// =========================================================
// SHOP
// =========================================================
const SHOP_CATS = ['pistol','smg','rifle','lmg','shotgun','sniper','launcher','flamethrower','cannon','melee','armor','equipment','ammo'];
const CAT_LABELS = { pistol:'PISTOLS', smg:'SMGs', rifle:'RIFLES', lmg:'MG', shotgun:'SHOTGUNS', sniper:'SNIPERS', launcher:'LAUNCHERS', flamethrower:'FLAME', cannon:'CANNON', melee:'MELEE', armor:'ARMOR', equipment:'EQUIP', ammo:'AMMO' };
let shopCat = 'pistol';


// ⭐ Body class helpers (para sa CSS hiding)
function setBodyClass(name, on){
  if(on) document.body.classList.add(name);
  else   document.body.classList.remove(name);
}


function openShop(){
  if(!S.player || !S.player.alive || S.player.hp <= 0) return;

  const canBuyAnywhere =
    S.gameMode === 'ffa' ||
    (S.gameMode === 'infection' && S.buyPhaseActive);

  if(!canBuyAnywhere){
    const baseZ = (S.playerTeam === 'merc') ? 80 : -80;
    const dx = S.player.pos.x - 0;
    const dz = S.player.pos.z - baseZ;
    const distSq = dx*dx + dz*dz;
    const BUY_ZONE_RADIUS = 30;

    if(distSq > BUY_ZONE_RADIUS * BUY_ZONE_RADIUS){
      showMsg('⚠ RETURN TO BASE\nShop only in buy zone', 2200, 'small');
      beep(200, 0.15, 'sawtooth', 0.15);
      return;
    }
  }

  if(S.gameMode === 'knife'){
    showMsg('⚠ KNIFE MODE — No shop', 1500);
    return;
  }

  S.shopOpen = true;
  const el = document.getElementById('shop'); if(el) el.style.display = 'flex';
  document.exitPointerLock();
  setBodyClass('shopOpen', true);   // ⭐ hide dev login
  renderShop();
}
function closeShop(){
  S.shopOpen = false;
  const el = document.getElementById('shop'); if(el) el.style.display = 'none';
  setBodyClass('shopOpen', false);   // ⭐ FIX — restore dev login
  if(S.gameState === 'playing') renderer.domElement.requestPointerLock();
}
function renderShop(){
  const tabs = document.getElementById('shopTabs'); if(!tabs) return;
  tabs.innerHTML = '';
  SHOP_CATS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'tab' + (c===shopCat ? ' active' : '');
    b.textContent = CAT_LABELS[c];
    b.onclick = () => { shopCat = c; renderShop(); };
    tabs.appendChild(b);
  });
  const grid = document.getElementById('shopGrid'); if(!grid) return;
  grid.innerHTML = '';
  const flashErr = (el) => { el.style.borderColor='#ff5555'; setTimeout(()=>el.style.borderColor='',350); beep(120,0.15,'sawtooth',0.12); };

  if(shopCat === 'armor'){
    Object.entries(allArmors()).forEach(([id,it]) => {
      const owned = (it.type==='kevlar' && S.player.ownedKevlarId === id) ||
                    (it.type==='helmet' && S.player.ownedHelmetId === id);
      const card = document.createElement('div'); card.className = 'card' + (owned?' owned':'');
      card.innerHTML = `<h3>${it.name}</h3><div class="cat">${it.type.toUpperCase()}</div><div class="stats">HP: <span>${it.hp}</span> · RED: <span>${Math.round(it.reduction*100)}%</span><br>PRICE: <span>$${it.price}</span></div><button ${owned?'disabled':''}>${owned?'EQUIPPED':'BUY $'+it.price}</button>`;
      card.querySelector('button').onclick = () => {
        if(S.player.money < it.price) return flashErr(card);
        S.player.money -= it.price;
        if(it.type === 'kevlar'){
          S.player.kevlar = it.hp;
          S.player.kevlarMax = it.hp;
          S.player.kevlarReduction = it.reduction;
          S.player.armorOwnedKevlar = true;
          S.player.ownedKevlarId = id;
        } else {
          S.player.helmet = it.hp;
          S.player.helmetMax = it.hp;
          S.player.helmetReduction = it.reduction;
          S.player.armorOwnedHelmet = true;
          S.player.ownedHelmetId = id;
        }
        updateHUD(); renderShop();
      };
      grid.appendChild(card);
    });
    return;
  }
  if(shopCat === 'equipment'){
    Object.entries(allEquipment()).forEach(([id,it]) => {
      const card = document.createElement('div'); card.className = 'card';

      if(it.type === 'rocket_ammo'){
        if(!S.ownedWeapons.includes('rpg')) return;
        ensureAmmo('rpg');
        const rpgSt = S.ammoState['rpg'];
        const currentReserve = rpgSt ? rpgSt.reserve : 0;
        const maxRes = it.maxReserve || 10;

        if(currentReserve >= maxRes){
          card.style.opacity = '0.5';
          card.innerHTML = `<h3>${it.name}</h3><div class="cat">ROCKET AMMO</div><div class="stats">RESERVE: <span>${currentReserve} / ${maxRes}</span><br><span style="color:#ff5555;">MAXED OUT</span></div><button disabled>MAX</button>`;
        } else {
          card.innerHTML = `<h3>${it.name}</h3><div class="cat">ROCKET AMMO</div><div class="stats">RESERVE: <span>${currentReserve} / ${maxRes}</span><br>+${it.rockets} ROCKETS<br>PRICE: <span>$${it.price}</span></div><button>BUY $${it.price}</button>`;
          card.querySelector('button').onclick = () => {
            if(S.player.money < it.price) return flashErr(card);
            S.player.money -= it.price;
            const newRes = Math.min(maxRes, currentReserve + it.rockets);
            rpgSt.reserve = newRes;
            showMsg('+ ' + (newRes - currentReserve) + ' ROCKET' + ((newRes - currentReserve) !== 1 ? 'S' : ''), 1200);
            beep(900, 0.15, 'sine', 0.18);
            setTimeout(() => beep(1100, 0.12, 'sine', 0.15), 100);
            updateHUD(); renderShop();
          };
        }
        grid.appendChild(card);
        return;
      }

      const have = S.inventory[id] || 0;
      let s = '';
      if(it.dmg) s = `DMG: <span>${it.dmg}</span>`;
      else if(it.heal) s = `HEAL: <span>${it.heal}</span> HP`;
      else if(it.duration) s = `DUR: <span>${it.duration}s</span>`;
      else s = it.type.toUpperCase();
      card.innerHTML = `<h3>${it.name}</h3><div class="cat">${it.type.toUpperCase()}</div><div class="stats">${s}<br>HAVE: <span>${have}</span> · PRICE: <span>$${it.price}</span></div><button>BUY $${it.price}</button>`;
      card.querySelector('button').onclick = () => {
        if(S.player.money < it.price) return flashErr(card);
        S.player.money -= it.price;
        S.inventory[id] = (S.inventory[id]||0) + 1;
        updateHUD(); renderShop();
      };
      grid.appendChild(card);
    });
    return;
  }


  if(shopCat === 'ammo'){
    const refill = document.createElement('div'); refill.className = 'card';
    refill.innerHTML = `<h3>FULL AMMO REFILL</h3><div class="cat">AMMO</div><div class="stats">PRICE: <span>$400</span></div><button>BUY $400</button>`;
    refill.querySelector('button').onclick = () => {
      if(S.player.money < 400) return flashErr(refill);
      S.player.money -= 400;
      S.ownedWeapons.forEach(id => { const w = getWeapon(id); if(!w || w.melee) return; ensureAmmo(id); S.ammoState[id].reserve = w.reserveMax; });
      updateHUD(); renderShop();
    };
    grid.appendChild(refill);
    return;
  }
  const list = Object.entries(allWeapons()).filter(([id,w]) => w.category === shopCat).sort((a,b)=>a[1].price-b[1].price);
  if(!list.length){ grid.innerHTML = '<div style="color:#7fa892;padding:20px;">No weapons.</div>'; return; }
  list.forEach(([id,w]) => {
    const owned = S.ownedWeapons.includes(id);
    const card = document.createElement('div'); card.className = 'card' + (owned?' owned':'');
    card.innerHTML = `<h3>${w.name}</h3><div class="cat">${(w.category||'').toUpperCase()}</div><div class="stats">DMG: <span>${w.dmg}</span> · HEAD ×<span>${w.headMul}</span><br>MAG: <span>${w.mag===Infinity?'∞':w.mag}</span> · RATE: <span>${w.fireRate}s</span><br>PRICE: <span>$${w.price}</span></div><button ${owned?'disabled':''}>${owned?'OWNED':'BUY $'+w.price}</button>`;
    if(!owned) card.querySelector('button').onclick = () => {
      if(S.player.money < w.price) return flashErr(card);
      const maxSlots = getMaxSlots();
      if(S.ownedWeapons.length >= maxSlots){
        showMsg(`SLOTS FULL (${maxSlots}/${maxSlots}) — BUY MILITARY BAG`, 2200);
        beep(200,0.2,'sawtooth',0.15);
        return;
      }
      S.player.money -= w.price;
      S.ownedWeapons.push(id); ensureAmmo(id);
      refreshViewModels(); renderWeaponBar(); updateHUD(); renderShop();
      beep(700,0.12,'sawtooth',0.14);
    };
    grid.appendChild(card);
  });
}

// =========================================================
// SQUAD COMMANDS
// =========================================================
const commandMenuEl = document.getElementById('commandMenu');
function openCommandMenu(){
  if(S.gameState !== 'playing' || !S.player || !S.player.alive) return;
  if(S.shopOpen || S.consoleOpen || S.chatOpen) return;
  if(S.gameMode === 'ffa') return;
  S.commandMenuOpen = true;
  if(commandMenuEl) commandMenuEl.style.display = 'flex';
  if(document.pointerLockElement) document.exitPointerLock();
  beep(500, 0.05, 'square', 0.08);
}
function closeCommandMenu(){
  S.commandMenuOpen = false;
  if(commandMenuEl) commandMenuEl.style.display = 'none';
  if(S.gameState === 'playing' && !S.shopOpen && !S.consoleOpen && !S.gamePaused && !S.chatOpen && S.player && S.player.alive){
    renderer.domElement.requestPointerLock();
  }
}
function issueSquadCommand(cmd){
  if(!S.player || !S.player.alive){ showMsg('YOU ARE DEAD', 1000); return; }
  const info = SQUAD_COMMANDS[cmd]; if(!info) return;
  S.currentCommand = cmd;
  let count = 0;
  for(const b of bots){
    if(!b.alive || b.team !== S.playerTeam) continue;
    b.command = cmd;
    b.commandTime = performance.now();
    b.isLeader = false; b.squadId = null;
    b.patrolTarget = null; b.holdTarget = null;
    if(cmd === 'HOLD') b.holdPosition = b.mesh.position.clone();
    else if(cmd === 'MOVE' || cmd === 'STORM'){
      const target = b.team === 'merc' ? CARTEL_BASE : MERC_BASE;
      b.patrolTarget = target.clone();
    }
    count++;
  }
  if(count === 0){ showMsg('NO ALLIES AVAILABLE', 1200); beep(200,0.1,'square',0.1); return; }
  showMsg('► ' + info.name + ' ◄', 1600);
  beep(700,0.08,'square',0.14);
  const ci = document.getElementById('commandIndicator');
  if(ci){
    ci.textContent = '► ' + info.name;
    ci.style.color = info.color;
    ci.style.borderColor = info.color;
    ci.style.display = 'block';
    clearTimeout(ci._to);
    ci._to = setTimeout(()=>{ ci.style.display='none'; }, 4000);
  }
}
document.querySelectorAll('#commandMenu button[data-cmd]').forEach(btn => {
  btn.onclick = () => { issueSquadCommand(btn.dataset.cmd); closeCommandMenu(); };
});

// =========================================================
// CONSOLE
// =========================================================
const consoleEl = document.getElementById('console');
const consoleLog = document.getElementById('consoleLog');
const consoleCmd = document.getElementById('consoleCmd');
function openConsole(){
  S.consoleOpen = true;
  if(consoleEl) consoleEl.style.display = 'flex';
  document.exitPointerLock();
  if(consoleCmd) consoleCmd.focus();
}
function closeConsole(){
  S.consoleOpen = false;
  if(consoleEl) consoleEl.style.display = 'none';
  if(S.gameState === 'playing') renderer.domElement.requestPointerLock();
}
function cprint(text, cls='info'){
  if(!consoleLog) return;
  const d = document.createElement('div');
  d.className = 'line ' + cls; d.textContent = text;
  consoleLog.appendChild(d); consoleLog.scrollTop = consoleLog.scrollHeight;
}
function execCommand(raw){
  const str = raw.trim(); if(!str) return;
  cprint('> ' + str, 'cmd');
  const parts = str.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const a1 = parts[1];
  switch(cmd){
    case 'help':
      if(!S.isAdmin){ cprint('access denied.','err'); break; }
      ['money <n>','god','heal','noclip','speed <n>','spawn_enemy [n]','spawn_ally [n]','killall','give <id>','giveall','give_equip <id> [n]','tp <x> <z>','bag (unlock military bag)'].forEach(c=>cprint('  '+c));
      break;
    case 'money': if(S.player) S.player.money = Math.max(0, parseInt(a1)||0); updateHUD(); cprint('money=$'+(S.player?S.player.money:0),'ok'); break;
    case 'addmoney': if(S.player) S.player.money += parseInt(a1)||0; updateHUD(); cprint('ok','ok'); break;
    case 'god': S.godMode = !S.godMode; updateHUD(); cprint('god: '+(S.godMode?'ON':'OFF'),'ok'); break;
    case 'heal': if(S.player){ S.player.hp = S.player.maxHp; S.player.kevlar = S.player.kevlarMax; S.player.helmet = S.player.helmetMax; } updateHUD(); cprint('healed','ok'); break;
    case 'noclip': S.noclip = !S.noclip; cprint('noclip: '+(S.noclip?'ON':'OFF'),'ok'); break;
    case 'speed': S.speedMultiplier = Math.max(0.2, Math.min(10, parseFloat(a1)||1)); cprint('speed='+S.speedMultiplier,'ok'); break;
    case 'spawn_enemy': { const n = Math.max(1, Math.min(30, parseInt(a1)||1)); for(let i=0;i<n;i++) spawnBot(S.enemyTeam, 'grunt'); cprint('spawned '+n,'ok'); break; }
    case 'spawn_ally': { const n = Math.max(1, Math.min(30, parseInt(a1)||1)); for(let i=0;i<n;i++) spawnBot(S.playerTeam, 'grunt'); cprint('spawned '+n,'ok'); break; }
    case 'killall': { let c=0; for(const b of bots){ if(b.alive && (S.gameMode==='ffa' || b.team !== S.playerTeam)){ damageBot(b, 99999, false, { name:'DEV', team:S.playerTeam, weapon:'ADMIN' }); c++; } } cprint('killed '+c,'ok'); break; }
    case 'give': { const w = getWeapon(a1); if(!w){ cprint('unknown: '+a1,'err'); break; } if(!S.ownedWeapons.includes(a1)){ S.ownedWeapons.push(a1); ensureAmmo(a1); refreshViewModels(); renderWeaponBar(); updateHUD(); } cprint('gave '+w.name,'ok'); break; }
    case 'giveall': { for(const id of Object.keys(allWeapons())){ if(!S.ownedWeapons.includes(id)) S.ownedWeapons.push(id); ensureAmmo(id); } refreshViewModels(); renderWeaponBar(); updateHUD(); cprint('all given','ok'); break; }
    case 'give_equip': { const eq = getEquipment(a1); if(!eq){ cprint('unknown equip','err'); break; } const n = parseInt(parts[2])||1; S.inventory[a1] = (S.inventory[a1]||0) + n; updateHUD(); cprint('gave '+n,'ok'); break; }
    case 'bag': { if(S.player){ S.player.hasMilitaryBag = true; updateHUD(); cprint('military bag unlocked (30 slots)','ok'); } break; }
    case 'tp': { const x = parseFloat(a1), z = parseFloat(parts[2]); if(isNaN(x)||isNaN(z)||!S.player){ cprint('usage: tp <x> <z>','err'); break; } S.player.pos.set(x, S.player.eye, z); cprint('tp','ok'); break; }
    case 'clear': if(consoleLog) consoleLog.innerHTML = ''; break;
    default: cprint('unknown: '+cmd,'err');
  }
}
if(consoleCmd){
  consoleCmd.addEventListener('keydown', e => {
    if(e.code === 'Enter'){ execCommand(consoleCmd.value); consoleCmd.value = ''; e.preventDefault(); }
    else if(e.code === 'Escape'){ closeConsole(); e.preventDefault(); }
    e.stopPropagation();
  });
  consoleCmd.addEventListener('keyup', e => e.stopPropagation());
}
document.querySelectorAll('#quickAdmin button[data-cmd]').forEach(btn => {
  btn.onclick = () => { if(!S.isAdmin) return; execCommand(btn.dataset.cmd); };
});

// =========================================================
// GAME MODES REGISTRY
// =========================================================
const GAME_MODES_REGISTRY = [
  { id:'dm',       name:'DEATHMATCH',       desc:'Unlimited respawns.<br>First team to 30 kills wins.',  available:true,  color:'#ffd75e', tag:'CLASSIC' },
  { id:'sd',       name:'SEARCH & DESTROY', desc:'Plant/defuse at Site A or B.',                          available:true,  color:'#7CFC9A', tag:'CLASSIC' },
  { id:'ffa',      name:'FREE FOR ALL',     desc:'10 rounds × 10 min. Most kills wins.',                  available:true,  color:'#ff9d5e', tag:'CLASSIC' },
  { id:'knife',    name:'KNIFE MODE',       desc:'Only melee weapons. Fast and brutal.',                  available:true,  color:'#c8a8ff', tag:'FUN' },
  { id:'sniper',   name:'SNIPER MODE',      desc:'Snipers only. One shot, one kill.',                     available:true,  color:'#3a8a8a', tag:'FUN' },
  { id:'heist',    name:'BANK HEIST',       desc:'Steal cartel cash and escape to base.',                 available:false, color:'#ffd75e', tag:'OBJECTIVE' },
  { id:'hostage',  name:'HOSTAGE RESCUE',   desc:'Rescue hostages, extract to safety.',                   available:false, color:'#6ec6ff', tag:'OBJECTIVE' },
  { id:'urban',    name:'URBAN WAR',        desc:'Deathmatch in a dense city map.',                       available:false, color:'#ff9d5e', tag:'MAP' },
  { id:'mp',       name:'MULTIPLAYER',      desc:'Online matches vs real players.',                       available:false, color:'#ff5555', tag:'ONLINE' },
  { id:'covert',   name:'COVERT OPERATIONS',desc:'Single-player stealth missions.',                       available:false, color:'#4a7ba8', tag:'CAMPAIGN' },
  { id:'story',    name:'CARTEL STORY',     desc:'Follow the syndicate storyline.',                       available:false, color:'#d21c1c', tag:'CAMPAIGN' },
  { id:'zombie',   name:'ZOMBIE MODE',      desc:'Survive endless waves of undead.',                      available:false, color:'#8a4a3a', tag:'PVE' },
  { id:'infection',name:'INFECTION',        desc:'Humans vs Zombies. One bite converts.',                 available:true,  color:'#a04020', tag:'PVP' },
  { id:'zescape',  name:'ZOMBIE ESCAPE',    desc:'Co-op escape from the horde.',                          available:false, color:'#6a8a3a', tag:'CO-OP' },
  { id:'alien',    name:'ALIEN SCENARIO',   desc:'Humans vs Aliens. Survive the encounter.',           available:false, color:'#3a8a3a', tag:'SURVIVAL' }
];

const GAME_MAPS_REGISTRY = [
  { id:'dust_outpost', name:'DUST OUTPOST', desc:'Large arena · A/B bomb sites · mid corridor · sniper towers', available:true, tag:'LARGE' },
  { id:'urban_city',   name:'URBAN CITY',   desc:'City streets · vehicles · close quarters',                     available:false, tag:'MEDIUM' },
  { id:'warehouse',    name:'WAREHOUSE',    desc:'Industrial interior · tight corners',                          available:false, tag:'SMALL' }
];

const flowState = { mode: 'dm', map: 'dust_outpost', faction: 'merc' };
let loadInterval = null;

const ALL_SCREENS = ['menu', 'modeSelectScreen', 'mapSelectScreen', 'loadingScreen', 'factionSelectScreen'];

function showFlowScreen(id){
  ALL_SCREENS.forEach(s => {
    const el = document.getElementById(s);
    if(!el) return;
    if(s === id){ el.style.display = 'flex'; if(el.classList) el.classList.add('active'); }
    else { el.style.display = 'none'; if(el.classList) el.classList.remove('active'); }
  });
  if(id === 'menu'){
    const menu = document.getElementById('menu');
    if(menu) menu.style.display = 'flex';
  }
  if(document.pointerLockElement) document.exitPointerLock();
  beep(600, 0.05, 'square', 0.06);
}

function renderModeGrid(){
  const grid = document.getElementById('modeGrid');
  if(!grid) return;
  grid.innerHTML = '';
  GAME_MODES_REGISTRY.forEach(m => {
    const card = document.createElement('div');
    card.className = 'cardChoice' + (m.id === flowState.mode ? ' selected' : '') + (m.available ? '' : ' locked');
    card.innerHTML = `
      <div class="name" style="color:${m.color}">${m.name}</div>
      <div class="desc">${m.desc}</div>
      <div class="meta">${m.tag}</div>
    `;
    if(m.available){
      card.onclick = () => {
        flowState.mode = m.id;
        renderModeGrid();
        beep(800, 0.08, 'square', 0.10);
        setTimeout(() => {
          renderMapGrid();
          showFlowScreen('mapSelectScreen');
        }, 250);
      };
    }
    grid.appendChild(card);
  });
}

function renderMapGrid(){
  const grid = document.getElementById('mapGrid');
  if(!grid) return;
  grid.innerHTML = '';

  const nextBtn = document.getElementById('mapNextBtn');
  if(nextBtn) nextBtn.disabled = true;

  GAME_MAPS_REGISTRY.forEach(m => {
    const card = document.createElement('div');
    card.className = 'cardChoice' + (m.id === flowState.map ? ' selected' : '') + (m.available ? '' : ' locked');
    card.innerHTML = `
      <div class="name">${m.name}</div>
      <div class="desc">${m.desc}</div>
      <div class="meta">${m.tag}</div>
    `;
    if(m.available){
      card.onclick = () => {
        flowState.map = m.id;
        renderMapGrid();
        const nb = document.getElementById('mapNextBtn');
        if(nb) nb.disabled = false;
        beep(800, 0.08, 'square', 0.10);
      };
    }
    grid.appendChild(card);
  });
}

function renderFactionGrid(){
  const grid = document.getElementById('factionGrid');
  if(!grid) return;
  grid.querySelectorAll('[data-faction]').forEach(el => {
    el.classList.toggle('selected', el.dataset.faction === flowState.faction);
    el.onclick = () => {
      flowState.faction = el.dataset.faction;
      renderFactionGrid();
      beep(800, 0.08, 'square', 0.10);
    };
  });
}

function initMenuFlow(){
  const startFlowBtn = document.getElementById('startFlowBtn');
  if(startFlowBtn) startFlowBtn.onclick = () => {
    renderModeGrid();
    showFlowScreen('modeSelectScreen');
  };

  const modeBackBtn = document.getElementById('modeBackBtn');
  if(modeBackBtn) modeBackBtn.onclick = () => showFlowScreen('menu');

  const mapBackBtn = document.getElementById('mapBackBtn');
  if(mapBackBtn) mapBackBtn.onclick = () => { renderModeGrid(); showFlowScreen('modeSelectScreen'); };

  const mapNextBtn = document.getElementById('mapNextBtn');
  if(mapNextBtn) mapNextBtn.onclick = () => {
    if(flowState.map === null) return;
    startLoadingSequence();
  };

  const factionBackBtn = document.getElementById('factionBackBtn');
  if(factionBackBtn) factionBackBtn.onclick = () => { renderMapGrid(); showFlowScreen('mapSelectScreen'); };

  const deployBtn = document.getElementById('deployBtn');
  if(deployBtn) deployBtn.onclick = async () => {
    // ⭐ Request fullscreen BEFORE starting game (user gesture requirement)
    if(document.body.classList.contains('is-mobile') || ('ontouchstart' in window)){
      try { await goFullscreen(); } catch(e){}
    }

    menuFaction = flowState.faction;
    menuMode = flowState.mode;
    startGame();
  };

  renderModeGrid();
  renderMapGrid();
  renderFactionGrid();
}

function startLoadingSequence(){
  showFlowScreen('loadingScreen');
  const fill = document.getElementById('loadingBarFill');
  const text = document.getElementById('loadingText');
  if(fill) fill.style.width = '0%';

  const steps = [
    { pct: 20, txt: 'BUILDING WORLD...' },
    { pct: 45, txt: 'SPAWNING BOTS...' },
    { pct: 70, txt: 'LOADING TEXTURES...' },
    { pct: 90, txt: 'FINALIZING...' },
    { pct: 100, txt: 'READY' }
  ];
  let i = 0;
  clearInterval(loadInterval);
  loadInterval = setInterval(() => {
    if(i >= steps.length){
      clearInterval(loadInterval);
      setTimeout(() => {
        renderFactionGrid();
        showFlowScreen('factionSelectScreen');
      }, 400);
      return;
    }
    if(fill) fill.style.width = steps[i].pct + '%';
    if(text) text.textContent = steps[i].txt;
    i++;
  }, 550);
}

document.querySelectorAll('.menuTab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.menuTab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menuPage').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const pageId = 'page' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
    const pg = document.getElementById(pageId); if(pg) pg.classList.add('active');
    beep(600, 0.06, 'square', 0.08);
  });
});

const FUTURE_MODULES = [
  { id:'zombie',      name:'ZOMBIE MODE',        desc:'Survive waves of undead',        url:'zombie.html',       color:'#8a4a3a' },
  { id:'infection',   name:'INFECTION MODE',     desc:'Player vs infected PvP',         url:'infection.html',    color:'#a04020' },
  { id:'zescape',     name:'ZOMBIE ESCAPE',      desc:'Co-op escape from horde',        url:'zescape.html',      color:'#6a8a3a' },
  { id:'alien',       name:'ALIEN SCENARIO',     desc:'Xenomorph encounter',            url:'alien.html',        color:'#3a8a8a' },
  { id:'weapons',     name:'WEAPON FORGE',       desc:'Advanced weapon crafting',       url:'weapons.html',      color:'#ff9d5e' },
  { id:'bots',        name:'BOT LAB',            desc:'AI behavior editor',             url:'bots.html',         color:'#6ec6ff' },
  { id:'maps',        name:'MAP EDITOR',         desc:'Create custom maps',             url:'maps.html',         color:'#7CFC9A' },
  { id:'vehicles',    name:'VEHICLES',           desc:'Drivable vehicles',              url:'vehicles.html',     color:'#ffd75e' },
  { id:'skills',      name:'SKILL TREE',         desc:'Unlockable abilities',           url:'skills.html',       color:'#c8a8ff' },
  { id:'loadout',     name:'LOADOUT',            desc:'Custom kits & presets',          url:'loadout.html',      color:'#ffd75e' },
  { id:'campaign',    name:'CAMPAIGN',           desc:'Story mode',                     url:'campaign.html',     color:'#ff5555' },
  { id:'mp',          name:'MULTIPLAYER',        desc:'Online matches',                 url:'multiplayer.html',  color:'#ff9d5e' },
  { id:'stats',       name:'STATS',              desc:'Career & match history',         url:'stats.html',        color:'#cfe8cf' },
  { id:'skins',       name:'SKINS',              desc:'Cosmetics shop',                 url:'skins.html',        color:'#ffd75e' }
];

let modulePage = 0;
const MODULES_PER_PAGE = 6;

function renderModulePage(){
  const cont = document.getElementById('moduleLinks');
  const info = document.getElementById('modulePageInfo');
  const prev = document.getElementById('modulePrev');
  const next = document.getElementById('moduleNext');
  if(!cont) return;

  const totalPages = Math.max(1, Math.ceil(FUTURE_MODULES.length / MODULES_PER_PAGE));
  modulePage = Math.max(0, Math.min(totalPages - 1, modulePage));

  const start = modulePage * MODULES_PER_PAGE;
  const visible = FUTURE_MODULES.slice(start, start + MODULES_PER_PAGE);

  cont.innerHTML = '';
  visible.forEach(m => {
    const card = document.createElement('div');
    card.className = 'cardChoice';
    card.style.cursor = 'pointer';
    card.innerHTML = `<div class="name" style="color:${m.color}">${m.name}</div><div class="desc">${m.desc}</div>`;
    card.onclick = () => { window.open(m.url, '_blank', 'noopener'); beep(700,0.08,'square',0.10); };
    cont.appendChild(card);
  });

  if(info) info.textContent = `PAGE ${modulePage + 1} / ${totalPages}`;
  if(prev) prev.style.display = totalPages > 1 ? 'block' : 'none';
  if(next) next.style.display = totalPages > 1 ? 'block' : 'none';
  if(prev) prev.disabled = modulePage === 0;
  if(next) next.disabled = modulePage >= totalPages - 1;
  if(prev) prev.style.opacity = modulePage === 0 ? 0.35 : 1;
  if(next) next.style.opacity = modulePage >= totalPages - 1 ? 0.35 : 1;
}

(function buildModuleLinks(){
  renderModulePage();
  const prev = document.getElementById('modulePrev');
  const next = document.getElementById('moduleNext');
  if(prev) prev.onclick = () => { modulePage--; renderModulePage(); beep(600,0.05,'square',0.08); };
  if(next) next.onclick = () => { modulePage++; renderModulePage(); beep(700,0.05,'square',0.08); };
})();

const introEl = document.getElementById('intro');
const menuEl = document.getElementById('menu');
function showIntroThenMenu(){
  if(!introEl || !menuEl) return;
  introEl.style.display = 'flex';
  introEl.classList.remove('fade-out');
  menuEl.style.display = 'none';
  setTimeout(()=>{
    introEl.classList.add('fade-out');
    setTimeout(()=>{ introEl.style.display = 'none'; menuEl.style.display = 'flex'; }, 800);
  }, INTRO_DURATION);
}
showIntroThenMenu();

const authEl = document.getElementById('auth');
const authPass = document.getElementById('authPass');
const authErr = document.getElementById('authErr');
const devLoginBtn = document.getElementById('devLoginBtn');
if(devLoginBtn) devLoginBtn.onclick = () => {
  if(S.isAdmin){ S.isAdmin = false; updateDevUI(); return; }
  if(authEl){ authEl.style.display = 'flex'; authPass.value = ''; authErr.textContent = ''; authPass.focus(); }
};
const authCancel = document.getElementById('authCancel');
if(authCancel) authCancel.onclick = () => { authEl.style.display = 'none'; };
const authConfirm = document.getElementById('authConfirm');
if(authConfirm) authConfirm.onclick = () => {
  if(authPass.value === ADMIN_PASSWORD){
    S.isAdmin = true; authEl.style.display = 'none'; updateDevUI();
    showMsg('DEV MODE UNLOCKED', 1800);
  } else { authErr.textContent = '❌ WRONG PASSWORD'; }
};
if(authPass) authPass.addEventListener('keydown', e => { if(e.code === 'Enter' && authConfirm) authConfirm.click(); });
function updateDevUI(){
  const btn = document.getElementById('devLoginBtn');
  if(btn) btn.textContent = S.isAdmin ? '[ DEV ✓ ]' : '[ DEV LOGIN ]';
  const qa = document.getElementById('quickAdmin');
  if(qa) qa.style.display = (S.isAdmin && S.gameState === 'playing') ? 'flex' : 'none';
}

const mapTimeInput = document.getElementById('mapTimeInput');
const roundTimeInput = document.getElementById('roundTimeInput');
const bombFuseInput = document.getElementById('bombFuseInput');
if(mapTimeInput){ mapTimeInput.value = S.mapTimeLimit; mapTimeInput.addEventListener('change', ()=>{ S.mapTimeLimit = Math.max(60, parseInt(mapTimeInput.value)||1800); saveTimeLimits(); }); }
if(roundTimeInput){ roundTimeInput.value = S.roundTimeLimit; roundTimeInput.addEventListener('change', ()=>{ S.roundTimeLimit = Math.max(30, parseInt(roundTimeInput.value)||115); saveTimeLimits(); }); }
if(bombFuseInput){ bombFuseInput.value = S.bombFuseTime; bombFuseInput.addEventListener('change', ()=>{ S.bombFuseTime = Math.max(10, parseInt(bombFuseInput.value)||40); saveTimeLimits(); }); }
// =========================================================
// MOBILE CONTROLS SETTINGS
// =========================================================
function applyMobileSettings(){
  const mc = document.getElementById('mobileControls');
  if(!mc) return;

  let size = 1.0, opacity = 1.0, mode = 'auto';
  try {
    size    = parseFloat(localStorage.getItem('newstrike_mobile_size'))  || 1.0;
    opacity = parseFloat(localStorage.getItem('newstrike_mobile_opacity'))|| 1.0;
    mode    = localStorage.getItem('newstrike_mobile_mode') || 'auto';
  } catch(e){}

  // Apply size using CSS zoom (works in all modern browsers)
  mc.style.zoom = String(size);
  // Apply opacity
  mc.style.opacity = String(opacity);

  // Show/hide based on mode
  const isMobileDetected = document.body.classList.contains('is-mobile');
  let shouldShow = false;
  if(mode === 'on')  shouldShow = true;
  if(mode === 'off') shouldShow = false;
  if(mode === 'auto') shouldShow = isMobileDetected;

  // Show only during game — animate() will re-check state
  // But force visibility right now based on mode
  if(!shouldShow){
    mc.style.display = 'none';
  } else if(S.gameState === 'playing' && S.player && S.player.alive){
    mc.style.display = 'block';
  }
}

function initMobileSettings(){
  const modeSel = document.getElementById('mobileModeSelect');
  const sizeR   = document.getElementById('mobileSizeRange');
  const sizeV   = document.getElementById('mobileSizeValue');
  const opaR    = document.getElementById('mobileOpacityRange');
  const opaV    = document.getElementById('mobileOpacityValue');

  if(modeSel){
    try { modeSel.value = localStorage.getItem('newstrike_mobile_mode') || 'auto'; } catch(e){}
    modeSel.addEventListener('change', () => {
      try { localStorage.setItem('newstrike_mobile_mode', modeSel.value); } catch(e){}
      // If switching to "on" and we're on desktop, add is-mobile class
      if(modeSel.value === 'on') document.body.classList.add('is-mobile');
      if(modeSel.value === 'off') document.body.classList.remove('is-mobile');
      applyMobileSettings();
      showMsg('MOBILE MODE: ' + modeSel.value.toUpperCase(), 1500);
    });
  }

  if(sizeR){
    try { sizeR.value = localStorage.getItem('newstrike_mobile_size') || '1.0'; } catch(e){}
    if(sizeV) sizeV.textContent = parseFloat(sizeR.value).toFixed(1) + '×';
    sizeR.addEventListener('input', () => {
      const v = parseFloat(sizeR.value) || 1.0;
      try { localStorage.setItem('newstrike_mobile_size', String(v)); } catch(e){}
      if(sizeV) sizeV.textContent = v.toFixed(1) + '×';
      applyMobileSettings();
    });
  }

  if(opaR){
    try { opaR.value = localStorage.getItem('newstrike_mobile_opacity') || '1.0'; } catch(e){}
    if(opaV) opaV.textContent = parseFloat(opaR.value).toFixed(1);
    opaR.addEventListener('input', () => {
      const v = parseFloat(opaR.value) || 1.0;
      try { localStorage.setItem('newstrike_mobile_opacity', String(v)); } catch(e){}
      if(opaV) opaV.textContent = v.toFixed(1);
      applyMobileSettings();
    });
  }

  // Auto-aim toggle
  const aaSelect = document.getElementById('mobileAutoAimSelect');
  if(aaSelect){
    try { aaSelect.value = localStorage.getItem('newstrike_autoaim') === '0' ? 'off' : 'on'; } catch(e){}
    aaSelect.addEventListener('change', () => {
      const on = aaSelect.value === 'on';
      if(window._setAutoAim) window._setAutoAim(on);
      showMsg('AUTO-AIM: ' + (on ? 'ON' : 'OFF'), 1200);
    });
  }




  // Apply initial
  applyMobileSettings();
}
window._applyMobileSettings = applyMobileSettings;

let menuFaction = 'merc', menuMode = 'dm';
const diffSelectEl = document.getElementById('diffSelect');
if(diffSelectEl) diffSelectEl.addEventListener('change', ()=>{
  const p = DIFFICULTY_PRESETS[diffSelectEl.value];
  if(p){ Object.assign(S.AI_TUNING, p); saveAITuning(); }
  const d = document.getElementById('diffDesc');
  if(d) d.textContent = DIFF_DESCS[diffSelectEl.value] || '';
});

// =========================================================
// START GAME
// =========================================================
function startGame(){
  clearRoundDrops();
  ALL_SCREENS.forEach(id => {
    const el = document.getElementById(id);
    if(el){ el.style.display = 'none'; if(el.classList) el.classList.remove('active'); }
  });

  S.playerTeam = menuFaction;
  S.enemyTeam = menuFaction === 'merc' ? 'cartel' : 'merc';
  S.player.team = S.playerTeam;
  S.gameMode = menuMode;
  S.attackers = S.enemyTeam;

  buildDefaultMap();
  rebuildPathfinding();
  buildWaypointGraph();

  const hud = document.getElementById('hud'); if(hud) hud.style.display = 'block';

  S.gameState = 'playing'; S.gamePaused = false;
  S.mercScore = 0; S.cartelScore = 0; S.kills = 0; S.player.kills = 0;
  S.round = 1; S.sdRound = 1;
  S.buyPhaseActive = false;
  S.buyPhaseTimeRemaining = 0;

  if(S.gameMode === 'ffa'){
    S.roundTimeRemaining = FFA_ROUND_TIME;
    S.mapTimeRemaining = FFA_ROUND_TIME * FFA_TOTAL_ROUNDS;
    S.player.money = 16000;
  } else if(S.gameMode === 'infection'){
    S.roundTimeRemaining = INFECTION_CONFIG.roundTime;
    S.mapTimeRemaining = INFECTION_CONFIG.roundTime;
    S.player.money = 10000;
  } else {
    S.roundTimeRemaining = S.roundTimeLimit;
    S.mapTimeRemaining = S.mapTimeLimit;
    S.player.money = 16000;
  }

  resetBotNameCounters();
  S.firstBloodDone = false; S.streak.count = 0;
  S.currentCommand = null;
  S.player.bagStorage = [];
  S.bagOpen = false;
  S.player.armorOwnedKevlar = false; S.player.armorOwnedHelmet = false;
  S.player.ownedKevlarId = null; S.player.ownedHelmetId = null;
  S.player.hasMilitaryBag = false;
  S.player._respawnAt = null;
  S.ownedWeapons = ['glock', 'knife'];
  S.currentWeaponKey = 'glock';
  S.ammoState = {};
  ensureAmmo('glock'); ensureAmmo('knife');
  refreshViewModels();
  renderWeaponBar();

  S.playerDiedThisRound = false;
  respawnPlayerAtBase();

  if(S.gameMode === 'ffa'){
    const spawn = getFFASpawnPoint(new Set());
    S.player.pos.set(spawn.pos.x, S.player.eye, spawn.pos.z);
    S.player.yaw = Math.atan2(-spawn.pos.x, -spawn.pos.z);
  }

  if(S.playerMesh){ scene.remove(S.playerMesh); S.playerMesh = null; }
  S.playerMesh = buildBotMesh('grunt', S.playerTeam, 'glock');
  S.playerMesh.visible = false;
  scene.add(S.playerMesh);

  if(S.gameMode === 'infection'){
    if(S.playerMesh){ scene.remove(S.playerMesh); S.playerMesh = null; }
    S.playerMesh = buildBotMesh('grunt', 'survivor', 'glock');
    S.playerMesh.visible = false;
    scene.add(S.playerMesh);

    bots.forEach(b => scene.remove(b.mesh));
    bots.length = 0;

    startInfectionRound((team, kind, pos, ov) => spawnBot(team, kind, pos, ov || {}));

    showMsg('INFECTION MODE\nZombies vs Survivors\nSurvive for 5 minutes!', 4000, 'small');
    addChatLine('SYSTEM', 'Infection mode. Zombies convert humans on contact.', 'system');
  } else {
    clearRoundDrops(); spawnRound(S.playerTeam, S.enemyTeam);
    updateHUD(); updateDevUI(); audioInit();

    if(S.gameMode === 'ffa'){
      showMsg('FREE FOR ALL\n10 Rounds × 10 min\nEveryone is your enemy!', 4000, 'small');
    }

  }

  // ⭐ OOP — activate special mode (Knife / Sniper)
  S.activeMode = getModeInstance(S.gameMode);
  if(S.activeMode){
    S.activeMode.setupPlayerLoadout(S);
    for(const b of bots){
      S.activeMode.setupBotLoadout(b, S);
      if(window._rebuildBotMesh) window._rebuildBotMesh(b, b.kind, b.team, b.weaponId);
    }
    S.ownedWeapons.forEach(id => ensureAmmo(id));
    refreshViewModels();
    renderWeaponBar();
    showMsg(S.activeMode.name + '\n' + S.activeMode.desc, 3000, 'small');
    if(window._updateHUD) window._updateHUD();
  } else {
    S.activeMode = null;
  }

  if(!document.body.classList.contains('is-mobile')){
    try { renderer.domElement.requestPointerLock(); } catch(e){}
  } else {
    S.gamePaused = false;   // Walang pointer lock sa mobile
    const ov = document.getElementById('overlay');
    if(ov) ov.style.display = 'none';
  }
  addChatLine('SYSTEM', 'Match started. [Y] chat, [U] team, [B] shop, [H] squad.', 'system');

  // ⭐ SEARCH & DESTROY — arm the bomb AFTER all other messages
  if(S.gameMode === 'sd'){
    startSDRound(S.playerTeam);
  } else {
    showMsg('START WITH PISTOL + KNIFE\nEarn money to buy weapons', 3200, 'small');
  }
}

const keys = {};
function closeAnyPanel(){
  if(S.bagOpen){ closeBag(); return true; }
  if(S.chatOpen){ closeChat(); return true; }
  if(S.commandMenuOpen){ closeCommandMenu(); return true; }
  if(S.shopOpen){ closeShop(); return true; }
  if(S.consoleOpen){ closeConsole(); return true; }
  return false;
}

function handleInteractKey(){
  if(!S.player || !S.player.alive) return;
  if(S.cannonOperating){
    S.cannonOperating = false;
    if(S.cannonTarget && S.cannonTarget.mesh) S.cannonTarget.mesh.visible = true;
    S.cannonTarget = null;
    if(S._prevCameraMode) S.cameraMode = S._prevCameraMode;
    else S.cameraMode = 'fps';
    S._prevCameraMode = null;
    const crosshair = document.getElementById('crosshair');
    if(crosshair) crosshair.style.display = '';
    if(S.playerMesh) S.playerMesh.visible = (S.cameraMode === 'tps');
    showMsg('EXITED CANNON', 1000);
    beep(400, 0.1, 'square', 0.1);
    return;
  }
  for(const t of S.placedTurrets){
    if(!t.alive) continue;
    const d = S.player.pos.distanceTo(t.pos);
    if(d < 2.5){
      t.active = !t.active;
      if(t.eye) t.eye.material.color.setHex(t.active ? 0xff2020 : 0x336633);
      beep(t.active ? 850 : 350, 0.12, 'square', 0.15);
      showMsg(t.active ? '▶ TURRET ACTIVATED' : '■ TURRET DEACTIVATED', 1000);
      updateHUD();
      return;
    }
  }
  for(const c of S.placedCannons){
    if(!c.alive || !c.active) continue;
    const d = S.player.pos.distanceTo(c.pos);
    if(d < 5.0){
      S._prevCameraMode = S.cameraMode;
      S.cameraMode = 'fps';
      S.cannonOperating = true;
      S.cannonTarget = c;
      if(c.mesh) c.mesh.visible = false;
      const crosshair = document.getElementById('crosshair');
      if(crosshair) crosshair.style.display = '';
      if(S.playerMesh) S.playerMesh.visible = false;
      showMsg('CANNON — mouse aim · LMB fire · [E] exit', 2800);
      beep(600, 0.2, 'sine', 0.15);
      return;
    }
  }
  showMsg('NOTHING TO INTERACT', 800);
}

function openBag(){
  if(!S.player || !S.player.alive) return;
  S.bagOpen = true;
  const el = document.getElementById('bagPanel');
  if(el) el.style.display = 'flex';
  if(document.pointerLockElement) document.exitPointerLock();
  renderBagUI();
}
function closeBag(){
  S.bagOpen = false;
  const el = document.getElementById('bagPanel');
  if(el) el.style.display = 'none';
  if(S.gameState === 'playing' && !S.shopOpen && !S.consoleOpen && !S.commandMenuOpen && !S.chatOpen){
    renderer.domElement.requestPointerLock();
  }
}
function toggleBag(){
  if(S.bagOpen) closeBag();
  else openBag();
}
function renderBagUI(){
  const grid = document.getElementById('bagGrid'); if(!grid) return;
  grid.innerHTML = '';
  const storage = S.player.bagStorage || [];
  const maxBagSlots = 20;
  for(let i=0; i<maxBagSlots; i++){
    const slot = document.createElement('div');
    slot.className = 'bagSlot';
    const item = storage[i];
    if(item){
      slot.classList.add('filled');
      let label = '?', sub = '';
      if(item.type === 'weapon'){ const w = getWeapon(item.id); label = w ? w.name : item.id; sub = 'WEAPON'; }
      else if(item.type === 'armor'){ const a = allArmors()[item.id]; label = a ? a.name : item.id; sub = 'ARMOR'; }
      else if(item.type === 'equipment'){ const eq = getEquipment(item.id); label = eq ? eq.name : item.id; sub = 'EQUIP'; }
      slot.innerHTML = `<div class="bagSlotName">${label}</div><div class="bagSlotSub">${sub}</div>`;
      slot.onclick = () => { equipFromBag(i); };
      slot.oncontextmenu = (e) => { e.preventDefault(); dropFromBag(i); };
    } else {
      slot.innerHTML = `<div class="bagSlotEmpty">-</div>`;
    }
    grid.appendChild(slot);
  }
  const info = document.getElementById('bagInfo');
  if(info) info.textContent = `ITEMS: ${storage.length} / ${maxBagSlots}  ·  LMB equip  ·  RMB drop`;
}
function addToBag(type, id){
  if(!S.player) return false;
  if(!S.player.bagStorage) S.player.bagStorage = [];
  if(S.player.bagStorage.length >= 20){ showMsg('BAG FULL (20)', 1200); return false; }
  S.player.bagStorage.push({ type, id });
  return true;
}
function equipFromBag(idx){
  const storage = S.player.bagStorage || [];
  const item = storage[idx];
  if(!item) return;
  if(item.type === 'weapon'){
    if(!S.ownedWeapons.includes(item.id)){ S.ownedWeapons.push(item.id); ensureAmmo(item.id); }
    refreshViewModels(); renderWeaponBar();
    showMsg('EQUIPPED: ' + (getWeapon(item.id)?.name || item.id), 1200);
  } else if(item.type === 'armor'){
    const a = allArmors()[item.id];
    if(a){
      if(a.type === 'kevlar'){
        S.player.kevlar = a.hp; S.player.kevlarMax = a.hp; S.player.kevlarReduction = a.reduction;
        S.player.armorOwnedKevlar = true; S.player.ownedKevlarId = item.id;
      } else {
        S.player.helmet = a.hp; S.player.helmetMax = a.hp; S.player.helmetReduction = a.reduction;
        S.player.armorOwnedHelmet = true; S.player.ownedHelmetId = item.id;
      }
    }
    showMsg('EQUIPPED ARMOR', 1200);
  } else if(item.type === 'equipment'){
    S.inventory[item.id] = (S.inventory[item.id] || 0) + 1;
    showMsg('EQUIPPED: ' + (getEquipment(item.id)?.name || item.id), 1200);
  }
  storage.splice(idx, 1);
  renderBagUI();
  updateHUD();
}
function dropFromBag(idx){
  const storage = S.player.bagStorage || [];
  const item = storage[idx];
  if(!item) return;
  const pos = S.player.pos.clone();
  pos.x += (Math.random()-0.5) * 1.5;
  pos.z += (Math.random()-0.5) * 1.5;
  pos.y = 0.45;
  if(item.type === 'weapon' && window._spawnWeaponPickupAt){ window._spawnWeaponPickupAt(pos, item.id, undefined, undefined); }
  else if(item.type === 'armor' && window._spawnArmorPickupAt){
    const a = allArmors()[item.id];
    if(a) window._spawnArmorPickupAt(pos, { type: a.type, hp: a.hp, reduction: a.reduction });
  } else if(item.type === 'equipment'){ if(window._spawnAmmoPickup) window._spawnAmmoPickup(pos); }
  storage.splice(idx, 1);
  renderBagUI();
  showMsg('DROPPED', 800);
}
window._bagAdd = addToBag;
window._bagRender = renderBagUI;

addEventListener('keydown', e => {
  if(S.chatOpen) return;
  if(e.code === 'Escape'){ if(closeAnyPanel()){ e.preventDefault(); return; } }
  keys[e.code] = true;
  if(e.code === 'Tab'){ e.preventDefault(); if(!S.tabHeld){ S.tabHeld = true; showScoreboard(); } return; }
  if(S.gameState !== 'playing') return;
  if(S.consoleOpen){ if(e.code === 'F2') closeConsole(); return; }
  if(S.shopOpen){ if(e.code === 'KeyB') closeShop(); return; }
  if(S.commandMenuOpen){
    const CMD_KEYMAP = { Digit1:'FOLLOW', Digit2:'MOVE', Digit3:'STORM', Digit4:'FALLBACK', Digit5:'HOLD', Digit6:'BACKUP', Digit7:'POSITION', Digit8:'TURRET', Digit9:'MEDIC', Digit0:'HIDE', Minus:'HUNT', Equal:'GRENADE' };
    if(CMD_KEYMAP[e.code]){ issueSquadCommand(CMD_KEYMAP[e.code]); closeCommandMenu(); e.preventDefault(); }
    else if(e.code === 'KeyH'){ closeCommandMenu(); e.preventDefault(); }
    return;
  }
  if(!S.player || !S.player.alive){
    // ⭐ SEARCH & DESTROY — NO RESPAWN until next round
    if(S.gameMode === 'sd'){
      if(e.code === 'Space'){ e.preventDefault(); return; }   // block respawn
      if(e.code === 'KeyV'){ enterSpectatorMode(); e.preventDefault(); return; }
      if(e.code === 'KeyY'){ e.preventDefault(); openChat('all'); }
      if(e.code === 'KeyU'){ e.preventDefault(); openChat('team'); }
      return;
    }
    if(S.gameMode !== 'ffa'){
      if(e.code === 'Space' && S.player){ respawnPlayerAtBase(); e.preventDefault(); return; }
    }
    if(e.code === 'KeyV'){ enterSpectatorMode(); e.preventDefault(); return; }
    if(e.code === 'KeyY'){ e.preventDefault(); openChat('all'); }
    if(e.code === 'KeyU'){ e.preventDefault(); openChat('team'); }
    return;
  }
  if(e.code === 'KeyY'){ e.preventDefault(); openChat('all'); return; }
  if(e.code === 'KeyU'){ e.preventDefault(); openChat('team'); return; }
  if(e.code === 'KeyR') startReload();
  if(e.code === 'KeyB') openShop();
  if(e.code === 'KeyM') cycleMMZoom();
  if(e.code === 'KeyT'){
    S.cameraMode = S.cameraMode === 'fps' ? 'tps' : 'fps';
    showMsg('CAMERA: ' + S.cameraMode.toUpperCase(), 1200);
    beep(S.cameraMode === 'fps' ? 800 : 500, 0.1, 'square', 0.12);
    return;
  }
  if(e.code === 'F2'){ e.preventDefault(); openConsole(); return; }
  if(e.code === 'KeyH'){ openCommandMenu(); e.preventDefault(); return; }
  if(e.code === 'KeyC'){ S.player.crouching = true; e.preventDefault(); return; }
  if(e.code === 'ControlLeft'){ S.player.crouching = true; }
  if(e.code === 'KeyF'){
    if(S.currentWeaponKey === 'cannon'){
      placeCannon();
      S.ownedWeapons = S.ownedWeapons.filter(id => id !== 'cannon');
      S.currentWeaponKey = S.ownedWeapons[0] || 'glock';
      refreshViewModels(); renderWeaponBar(); updateHUD();
    } else if(S.gameMode === 'sd'){
      // ⭐ S&D — HOLD F to plant/defuse (handled in animate loop)
      // Do nothing on tap here
    } else {
      useCurrentEquip();
    }
  }
  if(e.code === 'KeyE'){ handleInteractKey(); e.preventDefault(); return; }
  if(e.code === 'KeyP'){ toggleBag(); e.preventDefault(); return; }
  if(e.code === 'KeyQ') cycleEquip();

  if(e.code.startsWith('Digit') || e.code.startsWith('Numpad')){
    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey;
    const digitStr = e.code.replace('Digit','').replace('Numpad','');
    const n = parseInt(digitStr);
    if(isNaN(n)) return;
    const baseIdx = (n === 0) ? 9 : n - 1;
    let slotIdx = baseIdx;
    if(isShift) slotIdx = 10 + baseIdx;
    if(isCtrl) slotIdx = 20 + baseIdx;
    if(slotIdx >= 0 && slotIdx < S.ownedWeapons.length){
      switchWeapon(S.ownedWeapons[slotIdx]);
      e.preventDefault();
    }
  }
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if(e.code === 'Tab'){ S.tabHeld = false; hideScoreboard(); }
  if(e.code === 'KeyC' || e.code === 'ControlLeft'){ if(S.player) S.player.crouching = false; }
});

addEventListener('mousemove', e => {
  if(document.pointerLockElement !== renderer.domElement) return;
  if(S.spectatorMode){
    S.spectatorYaw -= e.movementX * 0.0022;
    S.spectatorPitch -= e.movementY * 0.0022;
    S.spectatorPitch = Math.max(-1.45, Math.min(1.45, S.spectatorPitch));
    return;
  }
  if(!S.player || !S.player.alive) return;
  if(S.cannonOperating && S.cannonTarget){
    const c = S.cannonTarget;
    c.yaw -= e.movementX * 0.0022;
    c.pitch -= e.movementY * 0.0022;
    c.pitch = Math.max(-0.20, Math.min(1.30, c.pitch));
    return;
  }
  const sens = S.adsActive ? 0.0009 : 0.0022;
  S.player.yaw -= e.movementX * sens;
  S.player.pitch -= e.movementY * sens;
  S.player.pitch = Math.max(-1.45, Math.min(1.45, S.player.pitch));
});

let mouseHeld = false;
addEventListener('mousedown', e => {
  if(document.pointerLockElement !== renderer.domElement) return;
  if(!S.player || !S.player.alive) return;
  if(e.button === 0){ mouseHeld = true; shoot(); }
  if(e.button === 2){ S.adsHeld = true; }
});
addEventListener('mouseup', e => {
  if(e.button === 0) mouseHeld = false;
  if(e.button === 2) S.adsHeld = false;
});
addEventListener('contextmenu', e => { if(document.pointerLockElement === renderer.domElement) e.preventDefault(); });
addEventListener('wheel', e => {
  if(document.pointerLockElement !== renderer.domElement) return;
  if(!S.player || !S.player.alive) return;
  if(S.ownedWeapons.length < 2) return;
  let i = S.ownedWeapons.indexOf(S.currentWeaponKey);
  i = (i + (e.deltaY > 0 ? 1 : -1) + S.ownedWeapons.length) % S.ownedWeapons.length;
  switchWeapon(S.ownedWeapons[i]);
});

function cycleEquip(){
  const avail = EQUIP_ORDER.filter(k => (S.inventory[k]||0) > 0);
  if(!avail.length){ showMsg('NO EQUIPMENT', 800); return; }
  let i = avail.indexOf(S.currentEquip);
  i = (i + 1) % avail.length;
  S.currentEquip = avail[i];
  updateHUD();
  beep(420,0.05,'square',0.08);
}
function useCurrentEquip(){
  if(!S.player || !S.player.alive) return;
  switch(S.currentEquip){
    case 'grenade': throwGrenade(); break;
    case 'smoke': throwSmoke(); break;
    case 'flash': throwFlash(); break;
    case 'turret': placeTurret(); break;
    case 'military_bag':
      if(!S.player.hasMilitaryBag){
        S.player.hasMilitaryBag = true;
        S.inventory.military_bag = Math.max(0, (S.inventory.military_bag || 1) - 1);
        showMsg('MILITARY BAG EQUIPPED — 30 SLOTS UNLOCKED', 2500);
        addChatLine('SYSTEM', 'Military Bag equipped. Weapon slots: 10 → 30.', 'system');
        beep(900, 0.2, 'sine', 0.15);
      } else {
        showMsg('MILITARY BAG ALREADY EQUIPPED', 1000);
      }
      break;
    default: showMsg('NOT IMPLEMENTED', 800);
  }
  updateHUD();
}

function tryPickupNearest(){
  if(!S.player || !S.player.alive) return;
  let best = null, bestD = 2.2;
  for(const pk of S.pickups){
    const d = pk.pos.distanceTo(S.player.pos);
    if(d < bestD){ bestD = d; best = pk; }
  }
  if(!best) return;
  const idx = S.pickups.indexOf(best);
  if(idx < 0) return;
  if(best.kind === 'weapon'){
    if(best.weaponId === 'zombie_hand'){
      scene.remove(best.mesh);
      if(best.label) scene.remove(best.label);
      S.pickups.splice(idx,1);
      return;
    }
    const w = getWeapon(best.weaponId); if(!w) return;
    if(S.ownedWeapons.includes(best.weaponId)){
      ensureAmmo(best.weaponId);
      const st = S.ammoState[best.weaponId];
      st.reserve = Math.min(w.reserveMax, st.reserve + (best.reserve || w.mag*2));
      if(best.ammo !== undefined) st.ammo = Math.min(w.mag, best.ammo);
      showMsg('AMMO: ' + w.name, 900);
    } else {
      const maxSlots = getMaxSlots();
      if(S.ownedWeapons.length >= maxSlots){
        showMsg(`SLOTS FULL (${maxSlots}/${maxSlots})`, 1800);
        beep(200,0.15,'sawtooth',0.12);
        return;
      }
      S.ownedWeapons.push(best.weaponId);
      ensureAmmo(best.weaponId);
      const st = S.ammoState[best.weaponId];
      if(best.ammo !== undefined) st.ammo = Math.min(w.mag, best.ammo);
      if(best.reserve !== undefined) st.reserve = Math.min(w.reserveMax, best.reserve);
      refreshViewModels(); renderWeaponBar();
      showMsg('PICKED UP: ' + w.name, 1200);
      beep(800,0.12,'sawtooth',0.14);
    }
    } else if(best.kind === 'armor'){
    const a = best.armor;
    if(a.type === 'kevlar'){
      S.player.kevlar = a.hp; S.player.kevlarMax = a.hp; S.player.kevlarReduction = a.reduction;
      S.player.armorOwnedKevlar = true;
      showMsg('PICKED UP KEVLAR', 1000);
    } else {
      S.player.helmet = a.hp; S.player.helmetMax = a.hp; S.player.helmetReduction = a.reduction;
      S.player.armorOwnedHelmet = true;
      showMsg('PICKED UP HELMET', 1000);
    }
    beep(700,0.12,'sine',0.15);
  } else if(best.kind === 'rocket_ammo'){
    const rpg = getWeapon('rpg');
    if(rpg){
      ensureAmmo('rpg');
      const st = S.ammoState['rpg'];
      if(st){
        const oldReserve = st.reserve;
        st.reserve = Math.min(rpg.reserveMax + 6, st.reserve + 2);
        const gained = st.reserve - oldReserve;
        showMsg('+ ' + gained + ' ROCKET' + (gained !== 1 ? 'S' : ''), 1400);
        beep(900, 0.15, 'sine', 0.18);
        setTimeout(() => beep(1100, 0.12, 'sine', 0.15), 100);
      }
    }
    if(!S.ownedWeapons.includes('rpg')){
      S.ownedWeapons.push('rpg');
      ensureAmmo('rpg');
      const rpgSt = S.ammoState['rpg'];
      if(rpgSt){ rpgSt.ammo = 1; rpgSt.reserve = 2; }
      refreshViewModels();
      renderWeaponBar();
      showMsg('RPG ACQUIRED!', 1500);
    }
    updateHUD();
  } else {
    const w = getWeapon(S.currentWeaponKey);
    if(w && !w.melee){
      ensureAmmo(S.currentWeaponKey);
      const st = S.ammoState[S.currentWeaponKey];
      st.reserve = Math.min(w.reserveMax, st.reserve + w.mag*2);
    }
    S.inventory.grenade++;
    beep(500,0.1,'sawtooth',0.12);
  }
  scene.remove(best.mesh);
  if(best.label) scene.remove(best.label);
  S.pickups.splice(idx,1);
  updateHUD();
}
window._tryPickupNearest = tryPickupNearest;

function grabOrDropWeapon(){
  if(!S.player || !S.player.alive) return;

  let nearestPickup = null, bestD = 2.2;
  for(const pk of S.pickups){
    const d = pk.pos.distanceTo(S.player.pos);
    if(d < bestD){ bestD = d; nearestPickup = pk; }
  }

  if(nearestPickup){
    tryPickupNearest();
    return;
  }

  const w = getWeapon(S.currentWeaponKey);
  if(!w) return;
  if(w.melee){ showMsg('CANNOT DROP MELEE', 1000); beep(200,0.1,'square',0.1); return; }
  if(S.ownedWeapons.length <= 1){ showMsg('LAST WEAPON — CANNOT DROP', 1200); beep(200,0.1,'square',0.1); return; }

  const pos = S.player.pos.clone(); pos.y = 0.45;
  if(window._spawnWeaponPickupAt){
    const st = S.ammoState[S.currentWeaponKey] || { ammo:0, reserve:0 };
    window._spawnWeaponPickupAt(pos, S.currentWeaponKey, st.ammo, st.reserve);
  }

  S.ownedWeapons = S.ownedWeapons.filter(id => id !== S.currentWeaponKey);
  const fallback = S.ownedWeapons.includes('glock') ? 'glock' : S.ownedWeapons[S.ownedWeapons.length - 1];
  S.currentWeaponKey = fallback;
  ensureAmmo(fallback);
  refreshViewModels(); renderWeaponBar(); updateHUD();
  showMsg('DROPPED: ' + w.name, 1200);
  beep(400,0.1,'sawtooth',0.12);
}

addEventListener('keydown', e => {
  if(e.code === 'KeyG' && S.gameState === 'playing' && S.player && S.player.alive){
    // ⭐ SD — pickup dropped bomb
    if(S.gameMode === 'sd' && S.playerTeam === 'cartel' && S.bombDropped && S.bombDropPos){
      const d = S.player.pos.distanceTo(S.bombDropPos);
      if(d < 2.5){
        if(window._playerPickupBomb) window._playerPickupBomb();
        e.preventDefault();
        return;
      }
    }
    grabOrDropWeapon();
    e.preventDefault();
  }
});
window._grabOrDropWeapon = grabOrDropWeapon;

document.addEventListener('pointerlockchange', () => {
  // ⭐ Mobile: huwag gamitin ang pointerlock change para sa pause
  if(document.body.classList.contains('is-mobile')) return;

  const locked = document.pointerLockElement === renderer.domElement;
  if(S.gameState === 'playing' && !S.shopOpen && !S.consoleOpen && !S.chatOpen && !S.commandMenuOpen && !S.bagOpen){
    const ov = document.getElementById('overlay');
    if(ov) ov.style.display = locked ? 'none' : 'flex';
    S.gamePaused = !locked;
  }
  if(!locked) S.adsHeld = false;
});
const overlayEl = document.getElementById('overlay');
if(overlayEl) overlayEl.addEventListener('click', e => {
  if(e.target.id === 'overlay' || e.target.classList.contains('go') || e.target.tagName === 'H2' || e.target.tagName === 'P'){
    if(document.body.classList.contains('is-mobile')){
      // ⭐ Mobile: huwag i-request pointer lock, resume lang
      S.gamePaused = false;
      overlayEl.style.display = 'none';
      return;
    }
    try { renderer.domElement.requestPointerLock(); } catch(err){}
  }
});
const changeTeamBtn = document.getElementById('changeTeamBtn');
if(changeTeamBtn) changeTeamBtn.onclick = (e) => { e.stopPropagation(); changeTeam(); };
const disconnectBtn = document.getElementById('disconnectBtn');
if(disconnectBtn) disconnectBtn.onclick = (e) => { e.stopPropagation(); disconnect(); };
const shopCloseBtn = document.getElementById('shopClose');
if(shopCloseBtn) shopCloseBtn.onclick = closeShop;
const qaLogout = document.getElementById('qaLogout');
if(qaLogout) qaLogout.onclick = () => { S.isAdmin = false; updateDevUI(); };
const qaOpenConsole = document.getElementById('qaOpenConsole');
if(qaOpenConsole) qaOpenConsole.onclick = () => openConsole();
const qaOpenDev = document.getElementById('qaOpenDev');
if(qaOpenDev) qaOpenDev.onclick = () => showMsg('DEV panel not yet ported', 1500);

function changeTeam(){
  S.playerTeam = S.playerTeam === 'merc' ? 'cartel' : 'merc';
  S.enemyTeam = S.playerTeam === 'merc' ? 'cartel' : 'merc';
  if(S.player) S.player.team = S.playerTeam;

  if(S.player){
    S.player.hasMilitaryBag = false;
    S.player.armorOwnedKevlar = false;
    S.player.armorOwnedHelmet = false;
    S.player.ownedKevlarId = null;
    S.player.ownedHelmetId = null;
    S.player.kevlar = 0; S.player.helmet = 0;
    S.player.kevlarReduction = 0; S.player.helmetReduction = 0;
    S.player.bagStorage = [];
  }
  S.ownedWeapons = ['glock', 'knife'];
  S.currentWeaponKey = 'glock';
  S.ammoState = {};
  ensureAmmo('glock'); ensureAmmo('knife');
  S.inventory = { grenade:2, smoke:0, flash:0, c4:0, fake_c4:0, mine:0, medkit:0, painkiller:0, shield:0, turret:0, detonator:0, nvg:0, defuse_kit:0, grapple:0, military_bag:0 };
  refreshViewModels(); renderWeaponBar();

  showMsg('TEAM CHANGED → ' + S.playerTeam.toUpperCase() + ' — LOADOUT WIPED', 2400);
  beep(900, 0.15, 'sawtooth', 0.18);
  if(S.gameState === 'playing'){
    if(S.playerMesh){ scene.remove(S.playerMesh); S.playerMesh = null; }
    S.playerMesh = buildBotMesh('grunt', S.playerTeam, S.currentWeaponKey);
    S.playerMesh.visible = false;
    scene.add(S.playerMesh);
    respawnPlayerAtBase();
    clearRoundDrops(); spawnRound(S.playerTeam, S.enemyTeam);
  }
  updateHUD();
}
function disconnect(){
  S.gameState = 'menu'; S.gamePaused = false;
  hideScoreboard();
  if(S.spectatorMode) exitSpectatorMode();
  const hud = document.getElementById('hud'); if(hud) hud.style.display = 'none';
  const menu = document.getElementById('menu'); if(menu) menu.style.display = 'flex';
  const ov = document.getElementById('overlay'); if(ov) ov.style.display = 'none';
  const de = document.getElementById('deathOverlay'); if(de) de.style.display = 'none';
  if(document.pointerLockElement) document.exitPointerLock();
  bots.forEach(b => scene.remove(b.mesh)); bots.length = 0; squads.length = 0;
  S.pickups.forEach(p => { scene.remove(p.mesh); if(p.label) scene.remove(p.label); }); S.pickups.length = 0;
  S.projectiles.forEach(p => scene.remove(p.mesh)); S.projectiles.length = 0;
  S.smokeClouds.forEach(s => scene.remove(s.mesh)); S.smokeClouds.length = 0;
  S.decals.forEach(d => scene.remove(d.mesh)); S.decals.length = 0;
  if(S.playerMesh){ scene.remove(S.playerMesh); S.playerMesh = null; }
  updateDevUI();
}




// =========================================================
// S&D ROUND END
// =========================================================
function sdEndRound(winner, reason){
  if(!S.roundActive) return;
  S.roundActive = false;

  if(winner === 'merc') S.mercScore++; else S.cartelScore++;

  showMsg((winner === 'merc' ? '★ MERCENARIES WIN ★' : '★ CARTEL WINS ★') + '\n' + reason, 3000);
  beep(winner === 'merc' ? 1200 : 300, 0.4, 'sine', 0.25);

  setTimeout(() => {
    S.sdRound = (S.sdRound || 1) + 1;
    S.roundTimeRemaining = S.roundTimeLimit;
    clearRoundDrops();
    if(S.spectatorMode) exitSpectatorMode();
    respawnPlayerAtBase();
    spawnRound(S.playerTeam, S.enemyTeam);
    if(window._startSDRound) window._startSDRound(S.playerTeam);
    S.roundActive = true;
    updateHUD();
    showMsg('ROUND ' + S.sdRound + '\nGet ready...', 2000, 'small');
  }, 3500);
}
window._sdEndRound = sdEndRound;






// =========================================================
// GAME END — ⭐ FIXED: Accepts BOTH 'dm' AND 'sd' modes
// =========================================================
function checkGameEnd(){
  if(S.gameMode === 'ffa'){
    if(!S.roundActive) return;

    const roundEnded = (S.roundTimeRemaining <= 0);
    if(!roundEnded) return;

    S.roundActive = false;

    let leaderName = 'YOU';
    let leaderKills = S.player ? S.player.kills : 0;
    for(const b of bots){
      if((b.botKills || 0) > leaderKills){
        leaderKills = b.botKills || 0;
        leaderName = b.name;
      }
    }

    const isFinalRound = (S.round >= FFA_TOTAL_ROUNDS);

    if(isFinalRound){
      const playerWon = (S.player && S.player.kills >= leaderKills);
      if(playerWon){
        showMsg('★ MATCH OVER ★\nYOU WIN!\nFinal Kills: ' + S.player.kills, 5500);
        beep(1200, 0.5, 'sine', 0.25);
        setTimeout(()=>beep(1400, 0.4, 'sine', 0.22), 300);
        setTimeout(()=>beep(1600, 0.4, 'sine', 0.20), 600);
        if(S.player) S.player.money += 5000;
      } else {
        showMsg('★ MATCH OVER ★\n' + leaderName + ' WINS\nKills: ' + leaderKills, 5500);
        beep(400, 0.5, 'sine', 0.22);
      }

      setTimeout(() => {
        S.round = 1;
        S.kills = 0;
        if(S.player) S.player.kills = 0;
        for(const b of bots){ b.botKills = 0; }
        S.firstBloodDone = false;
        S.streak.count = 0;
        S.roundTimeRemaining = FFA_ROUND_TIME;
        respawnPlayerAtBase();
        clearRoundDrops(); spawnRound(S.playerTeam, S.enemyTeam);
        S.roundActive = true;
        showMsg('NEW MATCH STARTING\nRound 1 / ' + FFA_TOTAL_ROUNDS, 2500, 'small');
      }, 6000);
    } else {
      showMsg('ROUND ' + S.round + ' ENDED\n' + leaderName + ' LEADS with ' + leaderKills + ' kills', 4200);
      beep(800, 0.3, 'sine', 0.20);
      setTimeout(()=>beep(900, 0.3, 'sine', 0.18), 200);

      setTimeout(() => {
        S.round++;
        S.roundTimeRemaining = FFA_ROUND_TIME;
        if(S.player) S.player.kills = 0;
        S.kills = 0;
        for(const b of bots){ b.botKills = 0; }
        respawnPlayerAtBase();
        clearRoundDrops(); spawnRound(S.playerTeam, S.enemyTeam);
        S.roundActive = true;
        showMsg('ROUND ' + S.round + ' / ' + FFA_TOTAL_ROUNDS + '\nGet ready...', 2500, 'small');
        beep(1000, 0.15, 'sine', 0.18);
      }, 4200);
    }
    return;
  }

  // ⭐ SEARCH & DESTROY — separate round logic
  if(S.gameMode === 'sd'){
    if(!S.roundActive) return;
    if(S.bombPlanted) return;  // bomb events handled in search_and_destroy.js

    const mercAliveSD = bots.filter(b => b.alive && b.team === 'merc').length
                      + (S.playerTeam === 'merc' && S.player && S.player.alive ? 1 : 0);
    const cartelAliveSD = bots.filter(b => b.alive && b.team === 'cartel').length
                        + (S.playerTeam === 'cartel' && S.player && S.player.alive ? 1 : 0);

    // All cartel eliminated → merc wins
    if(cartelAliveSD === 0){
      if(window._sdEndRound) window._sdEndRound('merc', 'CARTEL ELIMINATED');
      return;
    }
    // All merc eliminated → cartel wins
    if(mercAliveSD === 0){
      if(window._sdEndRound) window._sdEndRound('cartel', 'DEFENDERS ELIMINATED');
      return;
    }
    // Time expired → merc wins
    if(S.roundTimeRemaining <= 0){
      if(window._sdEndRound) window._sdEndRound('merc', 'TIME EXPIRED');
      return;
    }
    return;
  }

  // ── DEATHMATCH ONLY from here ──
  if(S.gameMode !== 'dm') return;
  if(!S.roundActive) return;

  // ⭐ DEATHMATCH — round ends on TIME, not kill target
  if(S.gameMode === 'dm'){
    if(S.roundTimeRemaining > 0) return;

    S.roundActive = false;

    let winner = 'DRAW';
    if(S.mercScore > S.cartelScore) winner = 'MERC';
    else if(S.cartelScore > S.mercScore) winner = 'CARTEL';

    const line = S.mercScore + ' — ' + S.cartelScore;
    if(winner === 'DRAW'){
      showMsg('★ ROUND ' + S.round + ' DRAW ★\n' + line, 3500);
    } else {
      showMsg('★ ' + winner + ' WINS ROUND ' + S.round + ' ★\n' + line, 3500);
      beep(winner === 'MERC' ? 1000 : 400, 0.4, 'sine', 0.25);
    }

    setTimeout(() => {
      S.round++;
      S.mercScore = 0; S.cartelScore = 0;
      S.firstBloodDone = false; S.streak.count = 0;
      S.kills = 0;
      if(S.player) S.player.kills = 0;
      for(const b of bots){ b.botKills = 0; }
      S.roundTimeRemaining = S.roundTimeLimit;
      clearRoundDrops();
      respawnPlayerAtBase();
      spawnRound(S.playerTeam, S.enemyTeam);
      S.roundActive = true;
      showMsg('ROUND ' + S.round + '\nGet ready...', 2000, 'small');
      updateHUD();
    }, 4000);
    return;
  }





  // Legacy kill-target check (kept as fallback, normally unreachable for DM)
  if(S.mercScore >= DM_KILL_TARGET || S.cartelScore >= DM_KILL_TARGET){
    S.roundActive = false;
    const winner = S.mercScore >= DM_KILL_TARGET ? 'MERC' : 'CARTEL';
    showMsg(winner + ' WINS THE MATCH!\nFinal: ' + S.mercScore + ' — ' + S.cartelScore, 4000);
    const playerWon = (winner.toLowerCase() === S.playerTeam);
    if(S.player) S.player.money += playerWon ? 3000 : 1000;

    setTimeout(() => {
      S.mercScore = 0; S.cartelScore = 0; S.round = 1;
      S.firstBloodDone = false; S.streak.count = 0;
      S.mapTimeRemaining = S.mapTimeLimit;
      respawnPlayerAtBase();
      clearRoundDrops(); spawnRound(S.playerTeam, S.enemyTeam);
      S.roundActive = true;
    }, 4200);
    return;
  }

  const mercAlive = bots.filter(b => b.alive && b.team === 'merc').length
                  + (S.playerTeam === 'merc' && S.player && S.player.alive ? 1 : 0);
  const cartelAlive = bots.filter(b => b.alive && b.team === 'cartel').length
                    + (S.playerTeam === 'cartel' && S.player && S.player.alive ? 1 : 0);

  if(mercAlive === 0 || cartelAlive === 0){
    S.roundActive = false;
    let winner = 'DRAW';
    if(mercAlive > 0 && cartelAlive === 0) winner = 'MERC';
    else if(cartelAlive > 0 && mercAlive === 0) winner = 'CARTEL';

    if(winner === 'DRAW'){
      showMsg('ROUND DRAW\nAll teams eliminated', 3200, 'small');
    } else {
      showMsg(winner + ' WINS THE ROUND!\n' + S.mercScore + ' — ' + S.cartelScore, 3200);
      if(winner === 'MERC') S.mercScore += 1;
      else S.cartelScore += 1;
      beep(winner === 'MERC' ? 900 : 400, 0.4, 'sine', 0.22);
    }
    updateHUD();

    setTimeout(() => {
      S.round++;
      respawnPlayerAtBase();
      clearRoundDrops(); spawnRound(S.playerTeam, S.enemyTeam);
      S.roundActive = true;
      showMsg('ROUND ' + S.round + '\nGet ready...', 2000, 'small');
      updateHUD();
    }, 3400);
  }
}

// =========================================================
// MAIN LOOP
// =========================================================
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.fireCooldown = Math.max(0, S.fireCooldown - dt);

  const inBuyPhase = (S.gameMode === 'infection' && S.buyPhaseActive);

  if(S.gameState === 'playing' && !S.gamePaused && (S.roundActive || inBuyPhase)){
    S.mapTimeRemaining = Math.max(0, S.mapTimeRemaining - dt);

    if(S.gameMode === 'ffa' || S.gameMode === 'sd' || S.gameMode === 'dm'){
      S.roundTimeRemaining = Math.max(0, S.roundTimeRemaining - dt);
    }
    if(S.gameMode === 'infection' && !S.buyPhaseActive){
      S.roundTimeRemaining = Math.max(0, S.roundTimeRemaining - dt);
    }
    updateTimeHud();

    if(inBuyPhase){
      S.buyPhaseTimeRemaining = Math.max(0, S.buyPhaseTimeRemaining - dt);
      if(S.buyPhaseTimeRemaining <= 0){
        S.buyPhaseActive = false;
        if(window._spawnInfectionZombies) window._spawnInfectionZombies();
      }
    }

    if(S.gameMode === 'infection' && !S.buyPhaseActive){
      if(checkInfectionEnd()){
        setTimeout(() => {
          S.round = (S.round || 1) + 1;
          bots.forEach(b => scene.remove(b.mesh));
          bots.length = 0;
          S.pickups.forEach(p => {
            scene.remove(p.mesh);
            if(p.label) scene.remove(p.label);
          });
          S.pickups.length = 0;
          startInfectionRound((team, kind, pos, ov) => spawnBot(team, kind, pos, ov || {}));
          updateHUD();
        }, 6000);
      }
    }
  }




  // ⭐ AUTO-RESPAWN kung dead at walang Space key (mobile)
  if(S.gameMode !== 'sd' && S.gameMode !== 'infection' && S.gameMode !== 'ffa'
     && S.player && !S.player.alive && !S.spectatorMode
     && S.gameState === 'playing' && S.roundActive){
    if(!S.player._autoRespawnAt) S.player._autoRespawnAt = performance.now() + 3000;
    const left = Math.ceil((S.player._autoRespawnAt - performance.now()) / 1000);
    const rt = document.getElementById('respawnTimer');
    if(rt){ rt.textContent = 'AUTO-RESPAWN ' + Math.max(0, left) + 's'; rt.style.display = 'block'; }
    if(performance.now() >= S.player._autoRespawnAt){
      S.player._autoRespawnAt = null;
      S.playerDiedThisRound = true;
      respawnPlayerAtBase();
      if(rt) rt.style.display = 'none';
    }
  }
  if(S.player && S.player.alive) S.player._autoRespawnAt = null;







  if(S.gameMode === 'ffa' && S.player && !S.player.alive && !S.spectatorMode && S.gameState === 'playing' && S.roundActive){
    if(!S.player._respawnAt) S.player._respawnAt = performance.now() + FFA_RESPAWN_DELAY;
    const remaining = Math.ceil((S.player._respawnAt - performance.now()) / 1000);
    const rt = document.getElementById('respawnTimer');
    if(rt){ rt.textContent = 'RESPAWNING IN ' + Math.max(0, remaining) + '...'; rt.style.display = 'block'; }
    if(performance.now() >= S.player._respawnAt){
      S.player._respawnAt = null;
      S.playerDiedThisRound = true;
      respawnPlayerAtBase();
      const farSpawn = getFFARespawnPoint();
      S.player.pos.set(farSpawn.x, S.player.eye, farSpawn.z);
      S.player.yaw = Math.atan2(-farSpawn.x, -farSpawn.z);
      if(rt) rt.style.display = 'none';
    }
  }



    // ⭐ S&D — auto-spectate sa namatay na player
  if(S.gameMode === 'sd' && S.player && !S.player.alive && !S.spectatorMode && S.gameState === 'playing' && S.roundActive){
    enterSpectatorMode();
  }
  if(S.player && S.player.alive) S.player._sdAutoSpectated = false;











  if(S.player && S.player.alive){
    S.player._respawnAt = null;
    const rt = document.getElementById('respawnTimer');
    if(rt) rt.style.display = 'none';
  }

  if(S.gameState === 'playing'){
    updatePlayer(dt, keys);

    if(S.cannonOperating && S.cannonTarget){
      const c = S.cannonTarget;
      if(c.mesh) c.mesh.visible = false;
      const seatHeight = 1.65;
      const seatFwd = 0.4;
      const camX = c.pos.x - Math.sin(c.yaw) * seatFwd;
      const camZ = c.pos.z - Math.cos(c.yaw) * seatFwd;
      camera.position.set(camX, seatHeight, camZ);
      camera.rotation.set(0,0,0);
      camera.rotateY(c.yaw);
      camera.rotateX(c.pitch);
      Object.values(S.viewModels).forEach(vm => vm.visible = false);
      if(S.playerMesh) S.playerMesh.visible = false;
      if(mouseHeld && c.fireCooldown <= 0){
        c.fireCooldown = 3.5;
        fireCannonShell(c);
      }
    }

    tickPathfinding();
    if(S.roundActive || (S.gameMode === 'infection' && S.buyPhaseActive)){
      updateBots(dt);
    }
    updateProjectiles(dt);
    updatePlacements(dt);
    updateDecals(dt);
    if(window._updateAutoAim) window._updateAutoAim();
    updateADS(dt);
    updateHUD();

    // ⭐ SEARCH & DESTROY — bomb timer + hold-F interactions
    updateSD(dt);

        // ⭐ OOP — mode per-frame update
    if(S.activeMode && typeof S.activeMode.update === 'function'){
      S.activeMode.update(dt, S, bots);
    }

    if(S.gameMode === 'sd' && S.player && S.player.alive){
      if(keys['KeyF']){
        if(S.playerTeam === 'cartel' && !S.bombPlanted){
          tickPlayerPlant(dt);
        } else if(S.playerTeam === 'merc' && S.bombPlanted && isPlayerNearBomb()){
          tickPlayerDefuse(dt);
        }
      } else {
        cancelPlayerPlant();
        cancelPlayerDefuse();
      }
    }
    const _fireHeld = mouseHeld || (S.mobile && S.mobile.fireHeld);
    if(_fireHeld){
      const w = getWeapon(S.currentWeaponKey);
      if(w && w.auto && !S.reloading) shoot();
    }
    // Tracer cleanup
    for(let i=S.tracers.length-1;i>=0;i--){
      const tr = S.tracers[i];
      tr.life -= dt;

      if(tr.isSplash && tr.life > 0){
        const elapsed = (performance.now() - tr.startTime) / 1000;
        const t = Math.min(1, elapsed / 0.4);
        const scale = 1 + t * 0.9;
        tr.t.scale.setScalar(scale);
        tr.puffMat.opacity = 0.85 * (1 - t);
        tr.coreMat.opacity = 0.95 * (1 - t);
        tr.ringMat.opacity = 0.6 * (1 - t);
      }

      if(tr.life <= 0){
        const obj = tr.t;
        scene.remove(obj);
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material){
          if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
        if(obj.children && obj.children.length){
          obj.children.forEach(child => {
            if(child.geometry) child.geometry.dispose();
            if(child.material){
              if(Array.isArray(child.material)) child.material.forEach(m => m.dispose());
              else child.material.dispose();
            }
          });
        }
        S.tracers.splice(i,1);
      }
    }
    if(S.player && S.player.streak > 0 && performance.now() > S.player.streakExpiresAt){
      const el = document.getElementById('streakBadge');
      if(el) el.style.display = 'none';
      S.player.streak = 0;
    }
  }

  if(S.player && S.player.alive) updateCrosshairTarget();
  else {
    const ch = document.getElementById('crosshair');
    if(ch) ch.className = '';
    if(crosshairNameEl) crosshairNameEl.style.display = 'none';
  }
  drawMinimap();
  if(S.scoreboardVisible) renderScoreboard();

  if(S.player && S.player.alive){
    const LABEL_RANGE = 8.0;
    for(const pk of S.pickups){
      if(!pk.label) continue;
      const d = pk.pos.distanceTo(S.player.pos);
      pk.label.visible = (d < LABEL_RANGE);
    }
  }




  // ⭐ Auto show/hide mobile controls based on game state
  const mc = document.getElementById('mobileControls');
  if(mc && document.body.classList.contains('is-mobile')){
    // ⭐ Skip auto-hide kapag nasa LAYOUT EDITOR
    if(window._mobileEditMode){
      if(mc.style.display !== 'block') mc.style.display = 'block';
    } else {
      const anyPanelOpen = S.shopOpen || S.chatOpen || S.consoleOpen || S.commandMenuOpen || S.bagOpen || S.gamePaused || S.scoreboardVisible;
      const shouldShow = (S.gameState === 'playing' && S.player && S.player.alive && !anyPanelOpen);
      if(shouldShow && mc.style.display !== 'block') mc.style.display = 'block';
      else if(!shouldShow && mc.style.display !== 'none') mc.style.display = 'none';
    }
  }


  renderer.render(scene, camera);
}


function forceResize(){
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', forceResize);
window.addEventListener('orientationchange', () => setTimeout(forceResize, 150));
if(window.visualViewport) window.visualViewport.addEventListener('resize', forceResize);
document.addEventListener('visibilitychange', () => { if(!document.hidden) setTimeout(forceResize, 150); });
if(typeof ResizeObserver !== 'undefined'){
  try { new ResizeObserver(forceResize).observe(document.body); } catch(e){}
}
// Initial delayed checks (DevTools mobile toggle)
setTimeout(forceResize, 300);
setTimeout(forceResize, 1200);
forceResize();

// =========================================================
// INIT
// =========================================================
buildDefaultMap();
buildWaypointGraph();
ensureAmmo('glock');
ensureAmmo('knife');
switchWeapon('glock');
renderWeaponBar();
updateHUD();
updateDevUI();
initMenuFlow();
initMobileSettings();
window._updateAutoAim = updateAutoAim;
window._setAutoAim = setAutoAimEnabled;
window._isAutoAim = isAutoAimEnabled;
// ⭐ Continuously check orientation
setInterval(() => {
  if(!document.body.classList.contains('is-mobile')) return;
  const rw = document.getElementById('rotateWarning');
  if(!rw) return;
  if(rw.style.display === 'flex'){
    const isPortrait = window.innerHeight > window.innerWidth;
    if(!isPortrait) rw.style.display = 'none';
  }
}, 500);

try { initLayoutEditor(); } catch(e){ console.warn('[LayoutEditor]', e); }


// ⭐ Mobile touch controls
window._gameKeys = keys;
try {
  initMobileControls(keys);
} catch(e){
  console.warn('[MobileInput] init failed:', e);
}

// ⭐ Expose mobile-friendly hooks (after all funcs are defined)
window._shoot              = () => { if(typeof shoot === 'function') shoot(); };
window._startReload        = () => { if(typeof startReload === 'function') startReload(); };
window._switchWeapon       = (id) => { if(typeof switchWeapon === 'function') switchWeapon(id); };
window._handleInteractKey  = () => { if(typeof handleInteractKey === 'function') handleInteractKey(); };
window._useEquip    = () => { if(typeof useCurrentEquip === 'function') useCurrentEquip(); };
window._cycleEquip  = () => { if(typeof cycleEquip === 'function') cycleEquip(); };
window._openShop           = () => { if(typeof openShop === 'function') openShop(); };


// ⭐ Mobile pause toggle
window._mobileTogglePause = () => {
  if(S.gameState !== 'playing') return;
  const ov = document.getElementById('overlay');
  if(!ov) return;

  if(S.gamePaused){
    // Resume
    S.gamePaused = false;
    ov.style.display = 'none';
    if(!document.body.classList.contains('is-mobile')){
      try { renderer.domElement.requestPointerLock(); } catch(e){}
    }
  } else {
    // Pause
    S.gamePaused = true;
    ov.style.display = 'flex';
    const t = document.getElementById('ovTitle');
    if(t) t.textContent = 'PAUSED';
    const s = document.getElementById('ovSub');
    if(s) s.textContent = '';
  }
};

animate();

window._zombieModeAllowsConversion = () => {
  return S.gameMode === 'infection' || S.gameMode === 'zombie_escape';
};

console.log('[NewStrike Modular] Ready. FFA: 10 rounds × 10 min. Binds: 1-0 weapons · G grab/drop · P bag · H squad · B shop · T TPS');