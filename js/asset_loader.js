// =========================================================
// NEW STRIKE — Asset Loader + Quit Button Fix
// =========================================================
window.GAME_ASSETS = {
  introBg:        '/assets/images/intro-bg.jpg',
  menuBg:         '/assets/images/menu-bg.jpg',
  loading1Bg:     '/assets/images/loading-1.jpg',
  loading2Bg:     '/assets/images/loading-2.jpg',
  loading3Bg:     '/assets/images/loading-3.jpg',
  factionMerc:    '/assets/images/faction-merc.jpg',
  factionCartel:  '/assets/images/faction-cartel.jpg',
  logo:           '/assets/images/logo.jpg',
  devPic:         '/assets/images/dev.jpg'
};

function preloadAsset(url){
  return new Promise(res => {
    if(!url) return res(null);
    const img = new Image();
    img.onload = () => res(img.src);   // ⭐ return ABSOLUTE URL (browser-resolved)
    img.onerror = () => res(null);
    img.src = url;
  });
}

async function applyAssets(){
  const A = window.GAME_ASSETS;
  const R = {};
  for (const k in A) R[k] = await preloadAsset(A[k]);

  const map = {
    '--intro-bg':          R.introBg,
    '--menu-bg':           R.menuBg,
    '--loading-1':         R.loading1Bg,
    '--loading-2':         R.loading2Bg,
    '--loading-3':         R.loading3Bg,
    '--faction-merc-bg':   R.factionMerc,
    '--faction-cartel-bg': R.factionCartel
  };

  for (const [cssVar, url] of Object.entries(map)){
    if(url) document.documentElement.style.setProperty(cssVar, `url("${url}")`);
  }

  // Logo
  const logoEl = document.getElementById('introLogo');
  const logoPh = document.getElementById('introLogoPlaceholder');
  if(R.logo && logoEl && logoPh){
    logoEl.src = R.logo;
    logoEl.style.display = 'block';
    logoPh.style.display = 'none';
  }

  // Dev pic
  const devEl = document.getElementById('introDevImg');
  const devPh = document.getElementById('introDevPlaceholder');
  if(R.devPic && devEl && devPh){
    devEl.src = R.devPic;
    devEl.style.display = 'block';
    devPh.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyAssets();

  // ========== FIX: QUIT BUTTON ==========
  const quitBtn   = document.getElementById('quitBtn');
  const quitScr   = document.getElementById('quitScreen');
  const quitBack  = document.getElementById('quitBack');
  const quitClose = document.getElementById('quitClose');
  const menuEl    = document.getElementById('menu');

  if(quitBtn && quitScr){
    quitBtn.addEventListener('click', () => {
      if(menuEl) menuEl.style.display = 'none';
      quitScr.style.display = 'flex';
    });
  }
  if(quitBack){
    quitBack.addEventListener('click', () => {
      if(quitScr) quitScr.style.display = 'none';
      if(menuEl) menuEl.style.display = 'flex';
    });
  }
  if(quitClose){
    quitClose.addEventListener('click', () => {
      window.open('', '_self'); window.close();
      setTimeout(() => {
        if(quitScr) quitScr.style.display = 'none';
        if(menuEl) menuEl.style.display = 'flex';
      }, 200);
    });
  }
});