// =========================================================
// MELEE WEAPON CLASSES — Four Pillars of OOP
// =========================================================
import * as THREE from 'three';
import { flat } from './world.js';

// ═══════════════════════════════════════════════════════════
// 🔷 ABSTRACTION — Base class
// Hindi mo ito direktang gagamitin. Nag-e-extend ka lang.
// ═══════════════════════════════════════════════════════════
class MeleeWeapon {
  constructor(config) {
    // 🔷 ENCAPSULATION — private fields (may _ prefix)
    this._id          = config.id;
    this._name        = config.name;
    this._damage      = config.damage;
    this._range       = config.range;
    this._fireRate    = config.fireRate;
    this._color       = config.color;
    this._onHitEffect = config.onHitEffect || null;
    this._cooldown    = 0;
  }

  // Controlled access (getters)
  get id()       { return this._id; }
  get name()     { return this._name; }
  get damage()   { return this._damage; }
  get range()    { return this._range; }
  get fireRate() { return this._fireRate; }
  get color()    { return this._color; }
  get melee()    { return true; }

  // Controlled mutation (setter with validation)
  set damage(v) {
    if (typeof v !== 'number' || v < 0) throw new Error('Invalid damage');
    this._damage = v;
  }

  // Cooldown management
  tickCooldown(dt) { this._cooldown = Math.max(0, this._cooldown - dt); }
  canAttack()      { return this._cooldown <= 0; }
  startCooldown()  { this._cooldown = this._fireRate; }

  // 🔷 POLYMORPHISM — subclasses override this
  onHit(target, attacker) {
    if (this._onHitEffect) this._onHitEffect(target, attacker);
  }

  // 🔷 POLYMORPHISM — overridable view model
  buildViewModel() {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.14, 0.30),
      flat(this._color)
    );
    blade.position.set(0, 0.05, -0.15);
    g.add(blade);
    return g;
  }

  // Convert to weapon registry format
  toWeaponDef() {
    return {
      name: this._name,
      category: 'melee',
      mag: Infinity, dmg: this._damage, headMul: 2.0,
      reserveMax: Infinity, fireRate: this._fireRate,
      reloadMs: 0, auto: false, spread: 0, price: -1,
      melee: true, rangeMelee: this._range, maxRange: this._range,
      color: this._color,
      damageTiers: [{ max: Infinity, body: this._damage, head: this._damage * 2 }]
    };
  }
}

// ═══════════════════════════════════════════════════════════
// 🔷 INHERITANCE — ZombieHand "IS-A" MeleeWeapon
// ═══════════════════════════════════════════════════════════
class ZombieHand extends MeleeWeapon {
  constructor() {
    super({
      id: 'zombie_hand',
      name: 'ZOMBIE HAND',
      damage: 50,
      range: 2.4,
      fireRate: 0.55,
      color: 0x4a6a3a,
      // 🔷 POLYMORPHISM — unique behavior ng zombie
      onHitEffect: (target, attacker) => {
        // Conversion happens ONLY sa Infection at Zombie Escape
        if (target && target.alive && window._zombieModeAllowsConversion?.()) {
          window._convertToZombie?.(target, attacker);
        }
      }
    });
  }

  // ⭐ OVERRIDE — Zombie hand model
  buildViewModel() {
    const g = new THREE.Group();
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

    g.position.set(0.28, -0.22, -0.45);
    g.userData.basePos = g.position.clone();
    g.userData.baseY = g.position.y;
    return g;
  }
}

// ═══════════════════════════════════════════════════════════
// FACTORY — Abstraction ng creation logic
// ═══════════════════════════════════════════════════════════
export const MELEE_REGISTRY = {
  zombie_hand: new ZombieHand()
};

export function getMeleeInstance(id) {
  return MELEE_REGISTRY[id] || null;
}

export function getAllMeleeDefs() {
  const defs = {};
  for (const [id, inst] of Object.entries(MELEE_REGISTRY)) {
    defs[id] = inst.toWeaponDef();
  }
  return defs;
}

export { MeleeWeapon, ZombieHand };