import * as THREE from 'three';

export const S = {
  player: null,
  currentWeaponKey: 'glock',
  ownedWeapons: ['glock','knife'],
  ammoState: {},
  viewModels: {},
  reloading: false, fireCooldown: 0, recoil: 0,
  adsHeld: false, adsActive: false, adsT: 0,
  inventory: { grenade:2, smoke:0, flash:0, c4:0, fake_c4:0, mine:0, medkit:0, painkiller:0, shield:0, turret:0, detonator:0, nvg:0, defuse_kit:0, grapple:0, military_bag:0 },
  currentEquip: 'grenade',
  placedC4: [], placedFakeC4: [], placedMines: [], placedTurrets: [], placedCannons: [],
  cannonOperating: false, cannonTarget: null, _prevCameraMode: null,
  bagOpen: false,
  smokeClouds: [], decals: [], projectiles: [], tracers: [], pickups: [],
  activeShield: null,
  gameState: 'menu', gameMode: 'dm', gamePaused: false,
  playerTeam: 'merc', enemyTeam: 'cartel',
  cameraMode: 'fps', playerMesh: null,
  pendingMapId: 'dust_outpost', isAdmin: false,
  godMode: false, noclip: false, speedMultiplier: 1,
  spectatorMode: false, spectatorPos: new THREE.Vector3(), spectatorYaw: 0, spectatorPitch: 0,
  activeMode: null,
  playerDiedThisRound: false,
  roundActive: true, round: 1, sdRound: 1, attackers: 'cartel',
  mercScore: 0, cartelScore: 0, kills: 0,
  firstBloodDone: false, streak: { count:0, lastTime:0 },
  currentCommand: null, botNameCounters: { merc:0, cartel:0 },
  mapTimeLimit: 1800, roundTimeLimit: 115, bombFuseTime: 40,
  mapTimeRemaining: 0, roundTimeRemaining: 0,
  bombCarrier: null, bombPlanted: false, bombPlantT: 0, bombDefuseT: 0,
  bombPlantProgress: 0, bombDefuseProgress: 0,
  bombDropped: false, bombDropPos: null,
  bombPos: null, bombMesh: null, bombTimer: 0, currentBombSite: null,
  shopOpen: false, consoleOpen: false,
  commandMenuOpen: false, chatOpen: false, chatMode: 'all',
  scoreboardVisible: false, tabHeld: false,
  AI_TUNING: null
};

export let CUSTOM_WEAPONS = {}, CUSTOM_ARMORS = {}, CUSTOM_EQUIPMENT = {};
try {
  let r = localStorage.getItem('lowpoly_ops_custom_weapons_v4'); if(r) CUSTOM_WEAPONS = JSON.parse(r);
  r = localStorage.getItem('lowpoly_ops_custom_armors_v4'); if(r) CUSTOM_ARMORS = JSON.parse(r);
  r = localStorage.getItem('lowpoly_ops_custom_equip_v4'); if(r) CUSTOM_EQUIPMENT = JSON.parse(r);
} catch(e){}
export function setCustomWeapons(v){ CUSTOM_WEAPONS = v; try{ localStorage.setItem('lowpoly_ops_custom_weapons_v4', JSON.stringify(v)); }catch(e){} }
export function setCustomArmors(v){ CUSTOM_ARMORS = v; try{ localStorage.setItem('lowpoly_ops_custom_armors_v4', JSON.stringify(v)); }catch(e){} }
export function setCustomEquipment(v){ CUSTOM_EQUIPMENT = v; try{ localStorage.setItem('lowpoly_ops_custom_equip_v4', JSON.stringify(v)); }catch(e){} }
export function getCustomWeapons(){ return CUSTOM_WEAPONS; }
export function getCustomArmors(){ return CUSTOM_ARMORS; }
export function getCustomEquipment(){ return CUSTOM_EQUIPMENT; }