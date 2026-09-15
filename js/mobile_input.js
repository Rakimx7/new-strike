// =========================================================
// MOBILE TOUCH CONTROLS
// Left joystick · Right look · Action buttons
// =========================================================
import { S } from './state.js';
import { beep } from './utils.js';

let _keys = null;
let _initialized = false;




// =========================================================
// Mobile detection — smart auto + manual override
// =========================================================
function shouldUseMobileControls(){
  // 1. Manual override (via settings)
  try {
    const override = localStorage.getItem('newstrike_mobile_mode');
    if(override === 'on')  return true;
    if(override === 'off') return false;
  } catch(e){}

  // 2. Force via URL param (for testing)
  if(new URLSearchParams(location.search).has('mobile')) return true;
  if(new URLSearchParams(location.search).has('desktop')) return false;

  // 3. User agent detection
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if(mobileUA) return true;

  // 4. Coarse pointer (touch-only device)
  if(window.matchMedia){
    if(window.matchMedia('(pointer: coarse)').matches) return true;
    if(window.matchMedia('(hover: none)').matches) return true;
  }

  // ⭐ 5. DevTools mobile emulation detection
  // When you toggle device toolbar in DevTools, screen becomes narrow
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 600;
  const hasTouchEvents = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const touchPoints = navigator.maxTouchPoints || 0;
  if(isSmallScreen && (hasTouchEvents || touchPoints > 0)) return true;

  // ⭐ 6. Very small screen → assume mobile (sa mobile it's usually <500px width)
  if(isSmallScreen) return true;

  return false;
}








// ═══════════════════════════════════════════════════════════
// PUBLIC: initMobileControls(keysRef)
//  - keysRef = reference sa main.js `keys` object
// ═══════════════════════════════════════════════════════════
export function initMobileControls(keysRef){
  if(_initialized) return false;
  _initialized = true;

  const enabled = shouldUseMobileControls();
  if(!enabled) return false;

  _keys = keysRef;
  document.body.classList.add('is-mobile');

  const controls = document.getElementById('mobileControls');
  if(!controls) return false;
  controls.style.display = 'block';

  // Prevent accidental scroll/zoom
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('gesturechange', e => e.preventDefault());
  document.addEventListener('gestureend', e => e.preventDefault());

  setupLeftJoystick();
  setupLookZone();
  setupButtons();
  setupWeaponBarTouch();
  setupEquipHudTouch();

  console.log('[MobileInput] Touch controls active');
  showIOSHint();
  initTapToPlay();       // ⭐ Show Tap to Play prompt
  return true;
}







// ═══════════════════════════════════════════════════════════
// LEFT JOYSTICK — Movement
// ═══════════════════════════════════════════════════════════
function setupLeftJoystick(){
  const base = document.getElementById('mJoystick');
  const knob = document.getElementById('mJoystickKnob');
  if(!base || !knob) return;

  let activeId = null;
  let cx = 0, cy = 0;
  const maxDist = 45;      // max knob travel (px)
  const deadZone = 0.22;   // normalized dead zone

  base.addEventListener('touchstart', e => {
    e.preventDefault();
    if(activeId !== null) return;
    const t = e.changedTouches[0];
    activeId = t.identifier;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    updateKnob(t.clientX, t.clientY);
  }, { passive: false });

  base.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier === activeId) updateKnob(t.clientX, t.clientY);
    }
  }, { passive: false });

  const end = e => {
    for(const t of e.changedTouches){
      if(t.identifier === activeId){
        activeId = null;
        knob.style.transform = 'translate(-50%,-50%)';
        _keys['KeyW'] = false;
        _keys['KeyA'] = false;
        _keys['KeyS'] = false;
        _keys['KeyD'] = false;
      }
    }
  };
  base.addEventListener('touchend', end);
  base.addEventListener('touchcancel', end);

  function updateKnob(px, py){
    let dx = px - cx;
    let dy = py - cy;
    const len = Math.hypot(dx, dy);
    if(len > maxDist){
      dx = dx / len * maxDist;
      dy = dy / len * maxDist;
    }
    knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';

    const nx = dx / maxDist;
    const ny = dy / maxDist;
    _keys['KeyW'] = ny < -deadZone;
    _keys['KeyS'] = ny >  deadZone;
    _keys['KeyA'] = nx < -deadZone;
    _keys['KeyD'] = nx >  deadZone;

    // Sprint when full push
    _keys['ShiftLeft'] = Math.hypot(nx, ny) > 0.85;
  }
}

// ═══════════════════════════════════════════════════════════
// RIGHT LOOK ZONE — Camera
// ═══════════════════════════════════════════════════════════
function setupLookZone(){
  const zone = document.getElementById('mLookZone');
  if(!zone) return;

  let activeId = null;
  let lastX = 0, lastY = 0;
  const LOOK_SENS = 0.0042;

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    if(activeId !== null) return;
    const t = e.changedTouches[0];
    activeId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    for(const t of e.changedTouches){
      if(t.identifier !== activeId) continue;
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      lastX = t.clientX;
      lastY = t.clientY;

      if(S.spectatorMode){
        S.spectatorYaw -= dx * LOOK_SENS;
        S.spectatorPitch -= dy * LOOK_SENS;
        S.spectatorPitch = Math.max(-1.45, Math.min(1.45, S.spectatorPitch));
        continue;
      }

      if(S.cannonOperating && S.cannonTarget){
        const c = S.cannonTarget;
        c.yaw -= dx * LOOK_SENS;
        c.pitch -= dy * LOOK_SENS;
        c.pitch = Math.max(-0.20, Math.min(1.30, c.pitch));
        continue;
      }

      if(!S.player || !S.player.alive) continue;
      const sens = S.adsActive ? LOOK_SENS * 0.4 : LOOK_SENS;
      S.player.yaw -= dx * sens;
      S.player.pitch -= dy * sens;
      S.player.pitch = Math.max(-1.45, Math.min(1.45, S.player.pitch));
    }
  }, { passive: false });

  const end = e => {
    for(const t of e.changedTouches){
      if(t.identifier === activeId) activeId = null;
    }
  };
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);
}





function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function showIOSHint(){
  if(!isIOS() || isStandalone()) return;
  // Show once per session
  if(sessionStorage.getItem('ios_hint_shown')) return;
  sessionStorage.setItem('ios_hint_shown', '1');

  const hint = document.createElement('div');
  hint.className = 'ios-fullscreen-hint';
  hint.textContent = '💡 Add to Home Screen for fullscreen';
  document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 5000);
}


// ═══════════════════════════════════════════════════════════
// WEAPON BAR — touch handlers
// ═══════════════════════════════════════════════════════════
function setupWeaponBarTouch(){
  const bar = document.getElementById('weaponBar');
  if(!bar) return;

  const handleWeaponTap = (e) => {
    const slot = e.target.closest('.slot');
    if(!slot) return;
    e.preventDefault();
    e.stopPropagation();

    const slots = [...bar.querySelectorAll('.slot')];
    const idx = slots.indexOf(slot);
    if(idx < 0) return;

    if(S.ownedWeapons && S.ownedWeapons[idx]){
      if(window._switchWeapon) window._switchWeapon(S.ownedWeapons[idx]);
      if(navigator.vibrate) navigator.vibrate(15);
    }
  };

  bar.addEventListener('touchstart', handleWeaponTap, { passive: false });
  bar.addEventListener('click', handleWeaponTap);
}

// ⭐ Equip HUD tap-to-cycle
function setupEquipHudTouch(){
  const hud = document.getElementById('equipHud');
  if(!hud) return;

  const handleTap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if(window._cycleEquip) window._cycleEquip();
    if(navigator.vibrate) navigator.vibrate(15);
  };

  hud.addEventListener('touchstart', handleTap, { passive: false });
  hud.addEventListener('click', handleTap);
}



// ═══════════════════════════════════════════════════════════
// ACTION BUTTONS
// ═══════════════════════════════════════════════════════════
function setupButtons(){
  // Helper: attach press/release to a button
  function bindHold(id, onDown, onUp){
    const el = document.getElementById(id);
    if(!el) return;
    let activeId = null;
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      if(activeId !== null) return;
      activeId = e.changedTouches[0].identifier;
      el.classList.add('active');
      if(onDown) onDown();
    }, { passive: false });
    const end = e => {
      for(const t of e.changedTouches){
        if(t.identifier === activeId){
          activeId = null;
          el.classList.remove('active');
          if(onUp) onUp();
        }
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  function bindTap(id, onTap){
    bindHold(id, onTap, null);
  }

  // ⭐ FIRE — hold to auto-fire, tap to single-shot
  bindHold('mFire',
    () => {
      S.mobile.fireHeld = true;
      if(window._shoot) window._shoot();
    },
    () => { S.mobile.fireHeld = false; }
  );

  // ⭐ AIM (ADS) — hold to aim
  bindHold('mAim',
    () => { S.mobile.adsHeld = true; },
    () => { S.mobile.adsHeld = false; }
  );

  // RELOAD
  bindTap('mReload', () => { if(window._startReload) window._startReload(); });

  // CROUCH — toggle
  bindTap('mCrouch', () => {
    if(S.player) S.player.crouching = !S.player.crouching;
  });

  // JUMP — momentary
  bindHold('mJump',
    () => { _keys['Space'] = true; },
    () => { _keys['Space'] = false; }
  );

  // SWITCH WEAPON — cycle
  bindTap('mSwitch', () => {
    if(!S.ownedWeapons || S.ownedWeapons.length < 2) return;
    let i = S.ownedWeapons.indexOf(S.currentWeaponKey);
    i = (i + 1) % S.ownedWeapons.length;
    if(window._switchWeapon) window._switchWeapon(S.ownedWeapons[i]);
  });

  // USE (F) — hold for S&D plant/defuse, tap for equipment
  bindHold('mUse',
    () => {
      _keys['KeyF'] = true;
      // Sa ibang modes, direct gamitin ang equipment (hindi nag-trigger ng keyboard)
      if(S.gameMode !== 'sd' && window._useEquip){
        window._useEquip();
      }
    },
    () => { _keys['KeyF'] = false; }
  );

  // INTERACT (E)
  bindTap('mInteract', () => {
    if(window._handleInteractKey) window._handleInteractKey();
  });

    // GRAB / DROP WEAPON (G)
  bindTap('mGrab', () => {
    if(window._grabOrDropWeapon) window._grabOrDropWeapon();
  });

    // PAUSE — toggle mobile pause overlay
  bindTap('mPause', () => {
    if(window._mobileTogglePause) window._mobileTogglePause();
  });

    // FULLSCREEN — toggle fullscreen mode
  bindTap('mFullscreen', async () => {
    if(isFullscreen()){
      exitFullscreen();
    } else {
      await goFullscreen();
    }
  });


  // SHOP (B)
  bindTap('mShop', () => {
    if(window._openShop) window._openShop();
  });
}



// ═══════════════════════════════════════════════════════════
// LAYOUT EDITOR — drag buttons to reposition
// ═══════════════════════════════════════════════════════════
const EDITABLE_IDS = [
  'mJoystick', 'mFire', 'mAim', 'mReload', 'mJump',
  'mCrouch', 'mSwitch', 'mUse', 'mInteract', 'mShop', 'mGrab', 'mPause', 'mFullscreen'
];

let _editMode = false;
let _dragState = null;
let _originalLayout = null;   // for cancel restore

// ─── Save / Load ───
function loadLayout(){
  try {
    const raw = localStorage.getItem('newstrike_mobile_layout');
    return raw ? JSON.parse(raw) : {};
  } catch(e){ return {}; }
}
function saveLayout(layout){
  try { localStorage.setItem('newstrike_mobile_layout', JSON.stringify(layout)); } catch(e){}
}
function clearLayout(){
  try { localStorage.removeItem('newstrike_mobile_layout'); } catch(e){}
}

// ─── Apply saved positions ───
export function applyMobileLayout(){
  const layout = loadLayout();
  for(const id of EDITABLE_IDS){
    const el = document.getElementById(id);
    if(!el) continue;
    const entry = layout[id];
    if(entry && typeof entry.x === 'number' && typeof entry.y === 'number'){
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = entry.x + '%';
      el.style.top  = entry.y + '%';
    } else {
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
    }
    // ⭐ Apply per-button opacity
    if(entry && typeof entry.opacity === 'number' && entry.opacity < 1){
      el.style.opacity = String(entry.opacity);
    } else {
      el.style.opacity = '';
    }
  }
}
window._applyMobileLayout = applyMobileLayout;

// ─── Enter / Exit Edit Mode ───
function enterEditMode(){
  if(_editMode) return;
  _editMode = true;
  window._mobileEditMode = true;   // ⭐ flag for animate() loop

  const mc = document.getElementById('mobileControls');
  const bar = document.getElementById('mEditBar');
  if(mc) mc.classList.add('editing');
  if(bar) bar.style.display = 'flex';

  // Snapshot current layout for CANCEL
  _originalLayout = JSON.parse(JSON.stringify(loadLayout()));

  // Apply saved layout first (para lahat visible)
  applyMobileLayout();
  if(mc) mc.style.display = 'block';
}

function exitEditMode(saved){
  if(!_editMode) return;
  _editMode = false;
  window._mobileEditMode = false;   // ⭐ clear flag
  _dragState = null;

  const mc = document.getElementById('mobileControls');
  const bar = document.getElementById('mEditBar');
  if(mc) mc.classList.remove('editing');
  if(bar) bar.style.display = 'none';

  if(saved){
    // Save current positions (they've been written during drag)
    // Just in case, re-apply to normalize
    applyMobileLayout();
    if(window._showMsg) window._showMsg('LAYOUT SAVED', 1200);
  } else {
    // Cancel — restore snapshot
    if(_originalLayout) saveLayout(_originalLayout);
    applyMobileLayout();
    if(window._showMsg) window._showMsg('LAYOUT CANCELLED', 1200);
  }
  _originalLayout = null;

  // Re-evaluate visibility (hide if not playing)
  if(mc){
    const anyPanel = false; // simplistic
    const shouldShow = (S.gameState === 'playing' && S.player && S.player.alive);
    mc.style.display = shouldShow ? 'block' : 'none';
  }
}

// ─── Drag handlers ───
function initDragHandlers(){
  const mc = document.getElementById('mobileControls');
  if(!mc) return;

  mc.addEventListener('touchstart', handleDragStart, { passive: false });
  mc.addEventListener('touchmove',  handleDragMove,  { passive: false });
  mc.addEventListener('touchend',   handleDragEnd);
  mc.addEventListener('touchcancel',handleDragEnd);

  // Mouse support (desktop testing)
  mc.addEventListener('mousedown',  handleDragStart);
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup',   handleDragEnd);
}

function getEventPos(e){
  if(e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if(e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function handleDragStart(e){
  if(!_editMode) return;
  const target = e.target.closest('[data-edit-id], #mJoystick, .mbtn');
  if(!target || !mc_contains(target)) return;

  const id = target.id;
  if(!EDITABLE_IDS.includes(id)) return;

  const rect = target.getBoundingClientRect();
  const pos = getEventPos(e);

  _dragState = {
    el: target,
    id,
    offsetX: pos.x - rect.left,
    offsetY: pos.y - rect.top,
    startLeft: rect.left,
    startTop: rect.top,
    moved: false
  };
  target.classList.add('dragging');
  if(e.cancelable) e.preventDefault();
}

function handleDragMove(e){
  if(!_dragState) return;
  const pos = getEventPos(e);

  const newLeftPx = pos.x - _dragState.offsetX;
  const newTopPx  = pos.y - _dragState.offsetY;

  const xPct = (newLeftPx / window.innerWidth)  * 100;
  const yPct = (newTopPx  / window.innerHeight) * 100;

  // Clamp to viewport
  const clampedX = Math.max(0, Math.min(95, xPct));
  const clampedY = Math.max(0, Math.min(95, yPct));

  _dragState.el.style.right  = 'auto';
  _dragState.el.style.bottom = 'auto';
  _dragState.el.style.left   = clampedX + '%';
  _dragState.el.style.top    = clampedY + '%';

  _dragState.moved = true;
  if(e.cancelable) e.preventDefault();
}

const OPACITY_CYCLE = [1.0, 0.75, 0.5, 0.3];

function handleDragEnd(e){
  if(!_dragState) return;
  const st = _dragState;
  st.el.classList.remove('dragging');

  // ⭐ Detect tap (small movement) vs drag
  const moved = st.moved;
  if(moved){
    const layout = loadLayout();
    if(!layout[st.id]) layout[st.id] = {};
    layout[st.id].x = parseFloat(st.el.style.left);
    layout[st.id].y = parseFloat(st.el.style.top);
    saveLayout(layout);
  } else {
    // ⭐ TAP during edit → cycle opacity
    cycleButtonOpacity(st.id, st.el);
  }

  _dragState = null;
}

function cycleButtonOpacity(id, el){
  const layout = loadLayout();
  if(!layout[id]) layout[id] = {};
  const cur = typeof layout[id].opacity === 'number' ? layout[id].opacity : 1.0;
  let idx = OPACITY_CYCLE.indexOf(cur);
  if(idx < 0) idx = 0;
  const next = OPACITY_CYCLE[(idx + 1) % OPACITY_CYCLE.length];
  layout[id].opacity = next;
  saveLayout(layout);
  el.style.opacity = String(next);
  if(window._showMsg) window._showMsg('OPACITY: ' + Math.round(next * 100) + '%', 600);
  if(navigator.vibrate) navigator.vibrate(20);
}

function mc_contains(el){
  const mc = document.getElementById('mobileControls');
  return mc && mc.contains(el);
}

// ─── Wire up edit buttons ───
export function initLayoutEditor(){
  initDragHandlers();
  applyMobileLayout();

  const editBtn = document.getElementById('editLayoutBtn');
  const saveBtn = document.getElementById('mEditSave');
  const resetBtn = document.getElementById('mEditReset');
  const cancelBtn = document.getElementById('mEditCancel');

  if(editBtn){
    editBtn.addEventListener('click', () => {
      // Close menu so we can see controls
      const menu = document.getElementById('menu');
      if(menu) menu.style.display = 'none';

      // Force show controls for editing
      const mc = document.getElementById('mobileControls');
      if(mc) mc.style.display = 'block';
      if(document.body.classList.contains('is-mobile') === false){
        // Not in mobile mode but they want to edit → add class temporarily
        document.body.classList.add('is-mobile');
        document.body.classList.add('_editing_for_real');
      }

      enterEditMode();
    });
  }

  if(saveBtn){
    saveBtn.addEventListener('click', () => {
      exitEditMode(true);
      // Return to menu
      if(document.body.classList.contains('_editing_for_real')){
        document.body.classList.remove('is-mobile');
        document.body.classList.remove('_editing_for_real');
      }
      const menu = document.getElementById('menu');
      if(menu) menu.style.display = 'flex';
    });
  }

  if(cancelBtn){
    cancelBtn.addEventListener('click', () => {
      exitEditMode(false);
      if(document.body.classList.contains('_editing_for_real')){
        document.body.classList.remove('is-mobile');
        document.body.classList.remove('_editing_for_real');
      }
      const menu = document.getElementById('menu');
      if(menu) menu.style.display = 'flex';
    });
  }

  if(resetBtn){
    resetBtn.addEventListener('click', () => {
      clearLayout();
      for(const id of EDITABLE_IDS){
        const el = document.getElementById(id);
        if(!el) continue;
        el.style.left = '';
        el.style.top  = '';
        el.style.right = '';
        el.style.bottom = '';
      }
      if(window._showMsg) window._showMsg('LAYOUT RESET', 1200);
    });
  }
}


// ═══════════════════════════════════════════════════════════
// TAP TO PLAY — Fullscreen gate
// ═══════════════════════════════════════════════════════════
export function showTapToPlay(){
  const ttp = document.getElementById('tapToPlay');
  if(!ttp) return;
  ttp.style.display = 'flex';
}
export function hideTapToPlay(){
  const ttp = document.getElementById('tapToPlay');
  if(!ttp) return;
  ttp.style.display = 'none';
}

function checkOrientation(){
  const rw = document.getElementById('rotateWarning');
  if(!rw) return;
  const isPortrait = window.innerHeight > window.innerWidth;
  if(isPortrait){
    rw.style.display = 'flex';
  } else {
    rw.style.display = 'none';
  }
}

export function initTapToPlay(){
  const ttp = document.getElementById('tapToPlay');
  if(!ttp) return;

  // ⭐ More robust mobile detection
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 900;
  const hasMobileUA = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isMobile = isTouch || isSmallScreen || hasMobileUA;

  if(!isMobile) return;

  // ⭐ Force is-mobile class
  document.body.classList.add('is-mobile');

  // Show only on mobile
  if(!document.body.classList.contains('is-mobile')) return;

  // Show the prompt
  ttp.style.display = 'flex';
  checkOrientation();

  // Listen for orientation changes
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 200));

  // On tap → fullscreen + hide
  const handleTap = async () => {
    ttp.style.display = 'none';
    try { await goFullscreen(); } catch(e){}
    // Small delay to allow fullscreen
    setTimeout(checkOrientation, 300);
  };

  ttp.addEventListener('click', handleTap);
  ttp.addEventListener('touchstart', handleTap, { passive: true });
}






// ═══════════════════════════════════════════════════════════
// FULLSCREEN + ORIENTATION
// ═══════════════════════════════════════════════════════════
export async function goFullscreen(){
  const el = document.documentElement;

  // ⭐ Request fullscreen with multiple fallbacks
  try {
    if(el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else if(el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    } else if(el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
    } else if(el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }
  } catch(e){
    console.warn('[Fullscreen] request failed:', e);
  }

  // ⭐ Try orientation lock with delay (some browsers need wait)
  setTimeout(async () => {
    try {
      if(screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
        console.log('[Orientation] Locked to landscape');
      } else {
        console.log('[Orientation] Lock API not supported');
      }
    } catch(e){
      console.warn('[Orientation] Lock failed:', e);
    }
  }, 250);

  // iOS fallback: scroll to hide address bar
  setTimeout(() => {
    window.scrollTo(0, 1);
  }, 150);
}

export function exitFullscreen(){
  try {
    if(document.exitFullscreen) document.exitFullscreen();
    else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if(document.mozCancelFullScreen) document.mozCancelFullScreen();
  } catch(e){}
}

export function isFullscreen(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}