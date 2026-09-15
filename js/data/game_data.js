export const AI_TUNING_DEFAULT = {
  accuracy: 0.5, reaction: 2.6, aggression: 0.7, patrolSpeed: 0.8,
  engageRange: 45, headBias: 0.05, squadEnabled: false, squadSize: 1
};

export const DIFFICULTY_PRESETS = {
  EASY:   { accuracy:0.5, reaction:2.6, aggression:0.7, patrolSpeed:0.8, engageRange:45,  headBias:0.05, squadEnabled:false, squadSize:1 },
  NORMAL: { accuracy:0.8, reaction:2.0, aggression:1.0, patrolSpeed:1.0, engageRange:55,  headBias:0.08, squadEnabled:false, squadSize:1 },
  HARD:   { accuracy:1.2, reaction:1.5, aggression:1.4, patrolSpeed:1.2, engageRange:70,  headBias:0.12, squadEnabled:false, squadSize:2 },
  EXPERT: { accuracy:1.8, reaction:1.0, aggression:1.9, patrolSpeed:1.5, engageRange:90,  headBias:0.18, squadEnabled:true,  squadSize:3 },
  INSANE: { accuracy:2.5, reaction:0.6, aggression:2.5, patrolSpeed:1.8, engageRange:120, headBias:0.25, squadEnabled:true,  squadSize:5 }
};

export const DIFF_DESCS = {
  EASY:'Relaxed bots', NORMAL:'Balanced', HARD:'Aggressive',
  EXPERT:'Squad tactics', INSANE:'Near-perfect aim'
};

export const BOT_NAME_POOLS = {
  merc:     ['ALPHA','BRAVO','CHARLIE','DELTA','ECHO','FOXTROT','GOLF','HOTEL','INDIA','JULIET'],
  cartel:   ['EL LOBO','SICARIO','FANTASMA','DIABLO','COBRA','TIBURON','HALCON','PANTERA','VIBORA','RATON'],
  // ⭐ Infection mode name pools
  zombie:   ['INFECTED','ROTTER','WALKER','STALKER','CRAWLER','SHAMBLER','GRAWLER','FEEDER','HOST','BITER'],
  survivor: ['REAPER','GHOST','VANGUARD','OUTBREAK','SURVIVOR','FALCON','WOLF','RAVEN','TITAN','SPECTRE'],
  // ⭐ BOSS TANKER names
  tanker:   ['BEHEMOTH','COLOSSUS','LEVIATHAN','HYDRA','OGRE','CYCLOPS','GOLIATH'],
  // ⭐ RUNNER names — fast zombie variant
  runner:   ['SPRINTER','DASHER','CHARGER','STREAK','BOLT','RUSH','BLITZ','FLASH','DART','SCOUT']
};

export const SQUAD_COMMANDS = {
  FOLLOW:{name:'FOLLOW ME',color:'#7CFC9A'}, MOVE:{name:'GO, GO, GO',color:'#ffd75e'},
  STORM:{name:'STORM THE FRONT',color:'#ff5555'}, FALLBACK:{name:'FALL BACK',color:'#6ec6ff'},
  HOLD:{name:'HOLD POSITION',color:'#7fa892'}, BACKUP:{name:'NEED BACK UP',color:'#ff9d5e'},
  POSITION:{name:'GET IN POSITION',color:'#7CFC9A'}, TURRET:{name:'SET UP TURRET',color:'#ff9d5e'},
  MEDIC:{name:'MEDIC!',color:'#7CFC9A'}, HIDE:{name:'TAKE COVER',color:'#7fa892'},
  HUNT:{name:'FIND ENEMIES',color:'#ff5555'}, GRENADE:{name:'FRAG OUT',color:'#ffd75e'},
  SMOKE:{name:'POP SMOKE',color:'#cfe8cf'}
};

export const EQUIP_ORDER = ['grenade','smoke','flash','c4','fake_c4','mine','medkit','painkiller','shield','turret','grapple','nvg','defuse_kit','military_bag'];

export const DEFAULT_VISUALS = {
  pistol:      { bodyLen:0.45,bodyW:0.09,bodyH:0.16,stockLen:0,stockH:0.05,barrelLen:0.10,barrelR:0.020,magLen:0.20,magW:0.06,magRotX:0.15,scopeLen:0,scopeR:0.025,bodyColor:0x2b2b2b,accentColor:0x1a1a1a,barrelColor:0x555555,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.22,posY:-0.22,posZ:-0.42 },
  smg:         { bodyLen:0.65,bodyW:0.10,bodyH:0.14,stockLen:0.15,stockH:0.08,barrelLen:0.25,barrelR:0.022,magLen:0.25,magW:0.06,magRotX:0.20,scopeLen:0,scopeR:0.025,bodyColor:0x2b2b2b,accentColor:0x1a1a1a,barrelColor:0x1a1a1a,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.24,posY:-0.23,posZ:-0.46 },
  rifle:       { bodyLen:0.85,bodyW:0.10,bodyH:0.14,stockLen:0.30,stockH:0.10,barrelLen:0.45,barrelR:0.025,magLen:0.30,magW:0.07,magRotX:0.25,scopeLen:0.05,scopeR:0.025,bodyColor:0x2e3a2b,accentColor:0x1e261c,barrelColor:0x1a1a1a,scopeColor:0x111111,magColor:0x1e261c,scale:1.0,gripAngle:0,posX:0.25,posY:-0.24,posZ:-0.50 },
  lmg:         { bodyLen:1.00,bodyW:0.12,bodyH:0.16,stockLen:0.30,stockH:0.10,barrelLen:0.55,barrelR:0.030,magLen:0.10,magW:0.10,magRotX:0,scopeLen:0.05,scopeR:0.025,bodyColor:0x2e3a2b,accentColor:0x1e261c,barrelColor:0x1a1a1a,scopeColor:0x111111,magColor:0x1e261c,scale:1.0,gripAngle:0,posX:0.25,posY:-0.25,posZ:-0.52 },
  shotgun:     { bodyLen:0.85,bodyW:0.11,bodyH:0.14,stockLen:0.30,stockH:0.10,barrelLen:0.55,barrelR:0.028,magLen:0,magW:0,magRotX:0,scopeLen:0,scopeR:0.025,bodyColor:0x4a3020,accentColor:0x1e1610,barrelColor:0x1a1a1a,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.25,posY:-0.24,posZ:-0.50 },
  sniper:      { bodyLen:1.10,bodyW:0.10,bodyH:0.15,stockLen:0.40,stockH:0.11,barrelLen:0.65,barrelR:0.022,magLen:0.15,magW:0.06,magRotX:0.10,scopeLen:0.30,scopeR:0.030,bodyColor:0x1e2a1e,accentColor:0x141a14,barrelColor:0x111111,scopeColor:0x0a0a0a,magColor:0x141a14,scale:1.0,gripAngle:0,posX:0.28,posY:-0.24,posZ:-0.60 },
  launcher:    { bodyLen:0.90,bodyW:0.16,bodyH:0.16,stockLen:0,stockH:0,barrelLen:0.30,barrelR:0.055,magLen:0,magW:0,magRotX:0,scopeLen:0,scopeR:0.025,bodyColor:0x3a4a2a,accentColor:0x1a1a1a,barrelColor:0x1a1a1a,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.30,posY:-0.24,posZ:-0.55 },
  flamethrower:{ bodyLen:0.70,bodyW:0.14,bodyH:0.18,stockLen:0,stockH:0,barrelLen:0.50,barrelR:0.030,magLen:0,magW:0,magRotX:0,scopeLen:0,scopeR:0.025,bodyColor:0x8a3a1a,accentColor:0x2a1a1a,barrelColor:0x1a1a1a,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.26,posY:-0.24,posZ:-0.50 },
  cannon:      { bodyLen:1.20,bodyW:0.20,bodyH:0.20,stockLen:0,stockH:0,barrelLen:0.70,barrelR:0.090,magLen:0,magW:0,magRotX:0,scopeLen:0,scopeR:0.025,bodyColor:0x2a2a2a,accentColor:0x111111,barrelColor:0x111111,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.32,posY:-0.26,posZ:-0.58 },
  melee:       { bodyLen:0.18,bodyW:0.05,bodyH:0.05,stockLen:0,stockH:0,barrelLen:0.42,barrelR:0.010,magLen:0,magW:0,magRotX:0,scopeLen:0,scopeR:0.025,bodyColor:0x1a1a1a,accentColor:0x333333,barrelColor:0xd8dee2,scopeColor:0x111111,magColor:0x1a1a1a,scale:1.0,gripAngle:0,posX:0.30,posY:-0.25,posZ:-0.50 }
};

// =========================================================
// BASE_WEAPONS — VALORANT-STYLE VALUES
// damageTiers: [{max: meters, body: dmg, head: dmg}, ...]
// maxRange: absolute bullet travel distance (meters)
// recoilPerShot: recoil added per shot
// maxRecoil: recoil cap
// adsSpreadMult: multiplier sa spread kapag ADS (0.15 = sobrang tumpak)
// crouchSpreadMult: multiplier kapag crouch
// moveSpreadMult: multiplier kapag gumagalaw
// sprayGrowth: spread growth per shot sa full auto
// =========================================================
// =========================================================
// BASE_WEAPONS — BALANCED FOR PLAYABILITY
// =========================================================
export const BASE_WEAPONS = {
  // ============ PISTOLS ============
  glock: {
    name:'GLOCK 17', category:'pistol',
    mag:17, dmg:25, headMul:3.0, reserveMax:102,
    fireRate:0.14, reloadMs:1100, auto:false,
    spread:0.010, price:200, color:0x2b2b2b,
    maxRange:100,
    recoilPerShot:0.010, maxRecoil:0.12,
    adsSpreadMult:0.25, crouchSpreadMult:0.6,
    moveSpreadMult:2.0, sprayGrowth:0.05,
    damageTiers:[
      { max:30,       body:26, head:78 },
      { max:Infinity, body:22, head:66 }
    ]
  },


  




  m1911: {
    name:'M1911', category:'pistol',
    mag:7, dmg:40, headMul:3.0, reserveMax:42,
    fireRate:0.22, reloadMs:1300, auto:false,
    spread:0.012, price:500, color:0x3b2e2e,
    maxRange:120,
    recoilPerShot:0.016, maxRecoil:0.14,
    adsSpreadMult:0.22, crouchSpreadMult:0.6,
    moveSpreadMult:2.2, sprayGrowth:0.08,
    damageTiers:[
      { max:25,       body:40, head:120 },
      { max:Infinity, body:35, head:105 }
    ]
  },
  deagle: {
    name:'DESERT EAGLE', category:'pistol',
    mag:7, dmg:55, headMul:3.0, reserveMax:35,
    fireRate:0.42, reloadMs:1500, auto:false,
    spread:0.009, price:700, color:0x3b3b3b,
    maxRange:150,
    recoilPerShot:0.024, maxRecoil:0.18,
    adsSpreadMult:0.20, crouchSpreadMult:0.55,
    moveSpreadMult:2.5, sprayGrowth:0.15,
    damageTiers:[
      { max:30,       body:55, head:165 },
      { max:Infinity, body:50, head:150 }
    ]
  },

  // ============ SMGs ============
  uzi: {
    name:'UZI', category:'smg',
    mag:32, dmg:18, headMul:2.5, reserveMax:128,
    fireRate:0.06, reloadMs:1400, auto:true,
    spread:0.018, price:1100, color:0x2a2a2a,
    maxRange:100,
    recoilPerShot:0.005, maxRecoil:0.12,
    adsSpreadMult:0.22, crouchSpreadMult:0.55,
    moveSpreadMult:1.0, sprayGrowth:0.08,
    damageTiers:[
      { max:20,       body:18, head:45 },
      { max:Infinity, body:15, head:38 }
    ]
  },
  mp5: {
    name:'MP5', category:'smg',
    mag:30, dmg:22, headMul:2.5, reserveMax:120,
    fireRate:0.08, reloadMs:1500, auto:true,
    spread:0.012, price:1500, color:0x333333,
    maxRange:120,
    recoilPerShot:0.005, maxRecoil:0.12,
    adsSpreadMult:0.20, crouchSpreadMult:0.55,
    moveSpreadMult:1.0, sprayGrowth:0.07,
    damageTiers:[
      { max:20,       body:22, head:55 },
      { max:Infinity, body:18, head:45 }
    ]
  },
  p90: {
    name:'P90', category:'smg',
    mag:50, dmg:20, headMul:2.5, reserveMax:100,
    fireRate:0.07, reloadMs:1600, auto:true,
    spread:0.014, price:2350, color:0x2f3a2f,
    maxRange:120,
    recoilPerShot:0.005, maxRecoil:0.12,
    adsSpreadMult:0.20, crouchSpreadMult:0.55,
    moveSpreadMult:1.0, sprayGrowth:0.07,
    damageTiers:[
      { max:20,       body:20, head:50 },
      { max:Infinity, body:16, head:40 }
    ]
  },

  // ============ RIFLES ============
  galil: {
    name:'GALIL', category:'rifle',
    mag:35, dmg:30, headMul:3.0, reserveMax:105,
    fireRate:0.09, reloadMs:1650, auto:true,
    spread:0.010, price:2000, color:0x3a3a2a,
    maxRange:250,
    recoilPerShot:0.007, maxRecoil:0.14,
    adsSpreadMult:0.16, crouchSpreadMult:0.6,
    moveSpreadMult:2.0, sprayGrowth:0.10,
    damageTiers:[
      { max:30,       body:30, head:90 },
      { max:Infinity, body:25, head:75 }
    ]
  },
  ak47: {
    name:'AK-47', category:'rifle',
    mag:30, dmg:42, headMul:3.0, reserveMax:90,
    fireRate:0.10, reloadMs:1700, auto:true,
    spread:0.012, price:2700, color:0x4a3520,
    maxRange:300,
    recoilPerShot:0.008, maxRecoil:0.16,
    adsSpreadMult:0.16, crouchSpreadMult:0.6,
    moveSpreadMult:2.2, sprayGrowth:0.11,
    damageTiers:[
      { max:30,       body:42, head:126 },
      { max:Infinity, body:36, head:108 }
    ]
  },
  m4: {
    name:'M4 CARBINE', category:'rifle',
    mag:30, dmg:35, headMul:3.0, reserveMax:120,
    fireRate:0.10, reloadMs:1600, auto:true,
    spread:0.009, price:3100, color:0x2e3a2b,
    maxRange:300,
    recoilPerShot:0.006, maxRecoil:0.13,
    adsSpreadMult:0.15, crouchSpreadMult:0.6,
    moveSpreadMult:2.0, sprayGrowth:0.09,
    damageTiers:[
      { max:30,       body:33, head:99 },
      { max:Infinity, body:28, head:84 }
    ]
  },
  scar: {
    name:'SCAR-H', category:'rifle',
    mag:20, dmg:48, headMul:3.0, reserveMax:80,
    fireRate:0.11, reloadMs:1800, auto:true,
    spread:0.011, price:4200, color:0x2f2f28,
    maxRange:300,
    recoilPerShot:0.009, maxRecoil:0.16,
    adsSpreadMult:0.16, crouchSpreadMult:0.6,
    moveSpreadMult:2.2, sprayGrowth:0.12,
    damageTiers:[
      { max:30,       body:48, head:144 },
      { max:Infinity, body:42, head:126 }
    ]
  },

  // ============ LMGs ============
  m249: {
    name:'M249 SAW', category:'lmg',
    mag:100, dmg:40, headMul:2.8, reserveMax:200,
    fireRate:0.075, reloadMs:4500, auto:true,
    spread:0.018, price:5200, color:0x2e3a2b,
    maxRange:250,
    recoilPerShot:0.010, maxRecoil:0.20,
    adsSpreadMult:0.22, crouchSpreadMult:0.65,
    moveSpreadMult:2.5, sprayGrowth:0.12,
    damageTiers:[
      { max:30,       body:35, head:98 },
      { max:Infinity, body:28, head:78 }
    ]
  },
  pkm: {
    name:'PKM', category:'lmg',
    mag:100, dmg:45, headMul:3.0, reserveMax:200,
    fireRate:0.09, reloadMs:5000, auto:true,
    spread:0.020, price:6000, color:0x3a2a1a,
    maxRange:250,
    recoilPerShot:0.012, maxRecoil:0.22,
    adsSpreadMult:0.22, crouchSpreadMult:0.65,
    moveSpreadMult:2.5, sprayGrowth:0.14,
    damageTiers:[
      { max:30,       body:45, head:135 },
      { max:Infinity, body:36, head:108 }
    ]
  },

  // ============ SHOTGUNS ============
    pump: {
    name:'PUMP SHOTGUN', category:'shotgun',
    mag:8, dmg:200, headMul:1.5, pellets:24, reserveMax:32,
    fireRate:0.85, reloadMs:2200, auto:false,
    spread:0.16, price:2000, color:0x4a3020,
    maxRange:40,
    recoilPerShot:0.030, maxRecoil:0.20,
    adsSpreadMult:0.55, crouchSpreadMult:0.70,
    moveSpreadMult:1.5, sprayGrowth:0,
    // ⭐ 24 pellets × ~8 = 200 total. WIDE spread — classic shotgun blast feel.
    damageTiers:[
      { max:8,        body:8,  head:12 },
      { max:20,       body:5,  head:7  },
      { max:Infinity, body:2,  head:3  }
    ]
  },
  autoS: {
    name:'AUTO SHOTGUN', category:'shotgun',
    mag:8, dmg:100, headMul:1.5, pellets:8, reserveMax:32,
    fireRate:0.28, reloadMs:2400, auto:true,
    spread:0.12, price:3200, color:0x302010,
    maxRange:60,
    recoilPerShot:0.025, maxRecoil:0.18,
    adsSpreadMult:0.55, crouchSpreadMult:0.7,
    moveSpreadMult:1.5, sprayGrowth:0,
    // ⭐ 100 total per shot (8 pellets × 13) + extended medium range
    damageTiers:[
      { max:15,       body:13, head:20 },
      { max:40,       body:10, head:15 },
      { max:Infinity, body:5,  head:8 }
    ]
  },

  // ============ SNIPERS ============
  scout: {
    name:'SCOUT', category:'sniper',
    mag:10, dmg:75, headMul:4.0, reserveMax:40,
    fireRate:0.9, reloadMs:2200, auto:false,
    spread:0.002, price:2750, color:0x2a2a2a,
    scope:true, adsFov:25,
    maxRange:400,
    recoilPerShot:0.05, maxRecoil:0.20,
    adsSpreadMult:0.10, crouchSpreadMult:0.5,
    moveSpreadMult:4.0, sprayGrowth:0.3,
    damageTiers:[
      { max:Infinity, body:75, head:300 }
    ]
  },
  awp: {
    name:'AWP', category:'sniper',
    mag:10, dmg:115, headMul:4.0, reserveMax:30,
    fireRate:1.4, reloadMs:2800, auto:false,
    spread:0.001, price:4750, color:0x1e2a1e,
    scope:true, adsFov:18,
    maxRange:500,
    recoilPerShot:0.06, maxRecoil:0.24,
    adsSpreadMult:0.08, crouchSpreadMult:0.45,
    moveSpreadMult:5.0, sprayGrowth:0.3,
    damageTiers:[
      { max:Infinity, body:115, head:460 }
    ]
  },
  barrett: {
    name:'BARRETT .50', category:'sniper',
    mag:5, dmg:600, headMul:4.0, reserveMax:20,
    fireRate:1.6, reloadMs:3200, auto:false,
    spread:0.002, price:6500, color:0x2a2018,
    scope:true, adsFov:14,
    maxRange:600,
    recoilPerShot:0.08, maxRecoil:0.26,
    adsSpreadMult:0.08, crouchSpreadMult:0.45,
    moveSpreadMult:5.0, sprayGrowth:0.3,
    // ⭐ 600 body damage — one shot through any armor
    damageTiers:[
      { max:Infinity, body:600, head:2400 }
    ]
  },

  // ============ SPECIAL ============
    rpg: {
    name:'RPG-7', category:'launcher',
    mag:1, dmg:1500, headMul:1.0, reserveMax:6,   // ⭐ 600 → 1500 damage (universal buff)
    fireRate:1.5, reloadMs:3000, auto:false,
    spread:0.003, price:7000, color:0x3a4a2a,
    explosive:true, blastRadius:16,
    maxRange:300
  },
  flamer: {
    name:'FLAMETHROWER', category:'flamethrower',
    mag:200, dmg:40, headMul:1.0, reserveMax:400,
    fireRate:0.05, reloadMs:3500, auto:true,
    spread:0.08, price:4500, color:0x8a3a1a,
    flamethrower:true,
    maxRange:20
  },
  cannon: {
    name:'ARTILLERY CANNON', category:'cannon',
    mag:1, dmg:1200, headMul:1.0, reserveMax:4,
    fireRate:3.5, reloadMs:5500, auto:false,
    spread:0.001, price:25000, color:0x2a2a2a,
    artillery:true, blastRadius:28,
    maxRange:9999
  },
  knife: {
    name:'COMBAT KNIFE', category:'melee',
    mag:Infinity, dmg:75, headMul:2.0, reserveMax:Infinity,
    fireRate:0.45, reloadMs:0, auto:false,
    spread:0, price:0, melee:true, rangeMelee:2.4, color:0xcfd6da,
    maxRange:2.4,
    damageTiers:[
      { max:Infinity, body:75, head:150 }
    ]
  },

  // ⭐ ZOMBIE HAND — para sa Infection at Zombie Escape modes
  zombie_hand: {
    name:'ZOMBIE HAND', category:'melee',
    mag:Infinity, dmg:50, headMul:2.0, reserveMax:Infinity,
    fireRate:0.55, reloadMs:0, auto:false,
    spread:0, price:-1, melee:true, rangeMelee:2.4, color:0x4a6a3a,
    maxRange:2.4,
    damageTiers:[
      { max:Infinity, body:50, head:100 }
    ]
  }
  
};






export const BASE_ARMORS = {
  // ⭐ Light armor: parang dati pero buffed (65%)
  lightKevlar:{name:'LIGHT KEVLAR',type:'kevlar',hp:100, reduction:0.65,price:500},
  // ⭐ Heavy armor: near-invincible at 200 HP (85% reduction)
  heavyKevlar:{name:'HEAVY KEVLAR',type:'kevlar',hp:200,reduction:0.85,price:1000},
  lightHelmet:{name:'LIGHT HELMET',type:'helmet',hp:100, reduction:0.65,price:400},
  heavyHelmet:{name:'HEAVY HELMET',type:'helmet',hp:200,reduction:0.85,price:900}
};

export const BASE_EQUIPMENT = {
  grenade:      {name:'FRAG GRENADE',      type:'grenade',    dmg:200, radius:11.0,  price:300,  count:1},
  smoke:        {name:'SMOKE GRENADE',     type:'smoke',      radius:6.5, duration:15, price:300, count:1},
  flash:        {name:'FLASHBANG',         type:'flash',      radius:12, duration:4,  price:300, count:1},
  c4:           {name:'C4 EXPLOSIVE',      type:'c4',         dmg:700, radius:20,  price:800,  count:1},
  fake_c4:      {name:'DECOY C4',          type:'c4',         dmg:600, radius:11,  price:400,  count:1, fake:true},
  mine:         {name:'PERSONNEL MINE',    type:'mine',       dmg:220, radius:4.5, price:400,  count:1, trigger:2.0},
  medkit:       {name:'MEDKIT',            type:'medkit',     heal:100,  price:500,  count:1},
  painkiller:   {name:'PAINKILLER',        type:'painkiller', duration:10, reduction:0.35, price:600, count:1},
  shield:       {name:'RIOT SHIELD',       type:'shield',     hp:250, duration:25, price:1200, count:1},
  turret:       {name:'AUTO TURRET',       type:'turret',     hp:200, dmg:25, fireRate:0.3, range:30, duration:0, price:2500, count:1},
  detonator:    {name:'REMOTE DETONATOR',  type:'detonator',  price:400, count:1},
  nvg:          {name:'NIGHT VISION',      type:'nvg',        duration:90, price:1000, count:1},
  defuse_kit:   {name:'DEFUSE KIT',        type:'defuse_kit', defuseTime:5, price:400, count:1},
  grapple:      {name:'GRAPPLE HOOK',      type:'grapple',    range:70, price:2500, count:1},
  military_bag: {name:'MILITARY BAG (20 SLOTS)', type:'military_bag', price:5000, count:1, capacity:20},
  // ⭐ Rocket ammo crate — buyable sa shop (mura para spam-friendly)
  rocket_ammo:  {name:'ROCKET AMMO ×2',    type:'rocket_ammo', rockets:2, maxReserve:10, price:100, count:1}
};

export const VOICE_KEYS = [
  ['first_blood','FIRST BLOOD'],['ks_2','DOUBLE KILL'],['ks_3','TRIPLE KILL'],
  ['ks_4','QUADRA KILL'],['ks_5','PENTA KILL'],['ks_6','MONSTER KILL'],['ks_7','GODLIKE'],
  ['savage','SAVAGE'],['enemy_down','ENEMY DOWN'],['enemy_neutralized','ENEMY NEUTRALIZED'],
  ['fire_in_the_hole','FIRE IN THE HOLE'],['smoke_out','SMOKE OUT'],['flashbang_out','FLASHBANG OUT']
];