// =========================================================
// SPECIAL MODES — Knife & Sniper
// OOP: Abstraction · Inheritance · Polymorphism · Encapsulation
// =========================================================
import * as THREE from 'three';
import { S } from '../state.js';

// ═══════════════════════════════════════════════════════════
// 🔷 ABSTRACTION — Base class
// Hindi mo ito direktang gagamitin. Extend mo lang.
// ═══════════════════════════════════════════════════════════
class GameMode {
  constructor(id, name, desc) {
    // 🔷 ENCAPSULATION — private fields (_ prefix)
    this._id = id;
    this._name = name;
    this._desc = desc;
  }

  // Getters — controlled access
  get id()   { return this._id; }
  get name() { return this._name; }
  get desc() { return this._desc; }

  // 🔷 POLYMORPHISM — override sa subclasses
  setupPlayerLoadout(S) {}
  setupBotLoadout(bot, S) {}
  getPlayerSpeedMult(S) { return 1.0; }
  getBotSpeedMult(bot, S) { return 1.0; }
  modifyMeleeDamage(baseDmg, target, isPlayerAttacker) { return baseDmg; }
  getHUDModeText(S) { return ''; }
  update(dt, S, bots) {}

  // Shared helper
  _log(msg) { console.log('[' + this._id.toUpperCase() + '] ' + msg); }
}






// ═══════════════════════════════════════════════════════════
// 🔷 INHERITANCE — ContinuousMode "IS-A" GameMode
// Continuous rounds (like Deathmatch) — bots respawn after death
// KnifeMode at SniperMode ay mag-e-extend dito.
// ═══════════════════════════════════════════════════════════
export class ContinuousMode extends GameMode {
  constructor(id, name, desc) {
    super(id, name, desc);
    this._respawnDelayMs = 4000;
    this._roundBased = true;
  }

  // 🔷 POLYMORPHISM — override
  get allowsBotRespawn() { return true; }
  get respawnDelayMs()   { return this._respawnDelayMs; }
  get isRoundBased()     { return this._roundBased; }

  // Use team spawn (MERC/CARTEL base) instead of FFA distributed spawn
  get usesTeamSpawn() { return true; }
}











// ═══════════════════════════════════════════════════════════
// 🔷 INHERITANCE — KnifeMode "IS-A" GameMode
// ═══════════════════════════════════════════════════════════
export class KnifeMode extends ContinuousMode {
  constructor() {
    super('knife', 'KNIFE MODE', 'Melee only · fast · brutal');
    this.SPEED_MULT = 1.20;        // Karagdagan sa melee boost
    this.BACKSTAB_MULT = 3.0;      // ⭐ ×3 damage mula sa likod
    this.EXTRA_HP = 25;            // Mas matibay para tumagal ang laban
    this._backstabFlashT = 0;
  }

  setupPlayerLoadout(S) {
    S.ownedWeapons = ['knife'];
    S.currentWeaponKey = 'knife';
    S.ammoState = { knife: { ammo: Infinity, reserve: Infinity } };
    if(S.player){
      S.player.maxHp = 100 + this.EXTRA_HP;
      S.player.hp = S.player.maxHp;
    }
    this._log('Player loadout: KNIFE only');
  }

  setupBotLoadout(bot, S) {
    bot.weaponId = 'knife';
    bot.maxHp += this.EXTRA_HP;
    bot.hp = bot.maxHp;
  }

  getPlayerSpeedMult(S) { return this.SPEED_MULT; }
  getBotSpeedMult(bot, S) { return this.SPEED_MULT; }

  // ⭐ BACKSTAB — ×3 damage kung nasa likod ng target
  modifyMeleeDamage(baseDmg, target, isPlayerAttacker) {
    if(!target || !target.mesh) return baseDmg;
    const attacker = isPlayerAttacker ? S.player : null;
    if(!attacker) return baseDmg;

    // Bot's facing direction (default -Z rotated by yaw)
    const botYaw = target.mesh.rotation.y;
    const botForward = new THREE.Vector3(-Math.sin(botYaw), 0, -Math.cos(botYaw));

    // Direction from bot to attacker
    const toAttacker = new THREE.Vector3()
      .subVectors(attacker.pos, target.mesh.position)
      .normalize();

    // dot < -0.3 → attacker is behind (roughly >107° cone from front)
    const dot = botForward.dot(toAttacker);
    if(dot < -0.3){
      this._backstabFlashT = 0.6;
      return Math.round(baseDmg * this.BACKSTAB_MULT);
    }
    return baseDmg;
  }

  getHUDModeText(S) {
    return 'KNIFE MODE · BACKSTAB ×' + this.BACKSTAB_MULT;
  }

  update(dt, S, bots) {
    // Backstab flash timeout
    if(this._backstabFlashT > 0) this._backstabFlashT -= dt;
  }
}

// ═══════════════════════════════════════════════════════════
// 🔷 INHERITANCE — SniperMode "IS-A" GameMode
// ═══════════════════════════════════════════════════════════
export class SniperMode extends ContinuousMode {
  constructor() {
    super('sniper', 'SNIPER MODE', 'One shot · one kill');
    this.SCOPED_SLOW_MULT = 0.40;   // Bagal kapag naka-scope
    this.BOT_ACCURACY_MULT = 0.65;  // Bawasan accuracy ng bots (fairness)
    this.BOT_FIRE_MULT = 1.60;      // Bawasan fire rate ng bots
  }

  setupPlayerLoadout(S) {
    S.ownedWeapons = ['scout', 'knife'];
    S.currentWeaponKey = 'scout';
    S.ammoState = {};
    if(S.player){
      S.player.maxHp = 100;
      S.player.hp = 100;
    }
    this._log('Player loadout: SCOUT + KNIFE');
  }

  setupBotLoadout(bot, S) {
    bot.weaponId = Math.random() < 0.5 ? 'scout' : 'awp';
    // 🔷 ENCAPSULATION — binago natin ang internal state ng bot
    bot.accuracy *= this.BOT_ACCURACY_MULT;
    bot.fireT = 0.8 + Math.random() * 1.2;   // mas mahaba ang unang delay
    bot._sniperFireMult = this.BOT_FIRE_MULT;
  }

  // Bagal kapag naka-scope
  getPlayerSpeedMult(S) {
    if(S.adsActive && S.adsT > 0.5) return this.SCOPED_SLOW_MULT;
    return 1.0;
  }

  getHUDModeText(S) {
    return 'SNIPER MODE · ONE SHOT ONE KILL';
  }

  update(dt, S, bots) {
    // Walang special per-frame behavior — pang-hook lang
  }
}

// ═══════════════════════════════════════════════════════════
// FACTORY — returns instance by ID
// ═══════════════════════════════════════════════════════════
export function getModeInstance(id) {
  if(id === 'knife')  return new KnifeMode();
  if(id === 'sniper') return new SniperMode();
  return null;
}