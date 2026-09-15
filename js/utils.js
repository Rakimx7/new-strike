let actx = null;
export function audioInit(){ if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); }
export function beep(freq, dur, type='square', vol=0.15){
  if(!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(); o.stop(actx.currentTime + dur);
}
export function footstep(){ beep(70+Math.random()*20, 0.05, 'triangle', 0.05); }
export function formatTime(sec){ sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec/60), s = sec%60; return m + ':' + (s<10?'0':'') + s; }
export function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }