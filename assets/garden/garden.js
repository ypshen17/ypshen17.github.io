(() => {
  const CFG = window.__GARDEN__ || {};
  const ASSETS = CFG.assets || '';
  const BASE = CFG.baseurl || '';
  const BUILD = CFG.build || `${Date.now()}`;

  // Elements
  const el = (id) => document.getElementById(id);
  const pre = el('preloader');
  const washFill = el('washFill');
  const sceneShelf = el('sceneShelf');
  const sceneFocus = el('sceneFocus');
  const sceneMy    = el('sceneMy');
  const paper = el('paper');
  const shelfA = el('shelfA');
  const shelfB = el('shelfB');
  const potsWrap = el('pots');
  const focusArt = el('focusArt');
  const stickerBody = el('stickerBody');
  const myPots = el('myPots');

  // State
  let PLANTS = [];
  let current = null;
  let garden = [];
  let motionOn = true;
  let soundOn  = true;

  // Audio scaffolding (simple master gain)
  const AC = ( () => {
    let ctx, master;
    function init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.2; // calm default
      master.connect(ctx.destination);
    }
    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
    function setMute(muted) { if (!master) return; master.gain.value = muted ? 0 : 0.2; }
    return { init, resume, setMute, get ctx(){return ctx}, get master(){return master} };
  })();

  // Helpers
  async function fetchText(url, {retries=1} = {}) {
    for (let i=0;i<=retries;i++) {
      try {
        const r = await fetch(url, { cache:'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.text();
      } catch (e) { if (i===retries) throw e; await new Promise(d=>setTimeout(d, 250)); }
    }
  }
  async function fetchJSON(url, opts) {
    const txt = await fetchText(url, opts);
    if (!txt || !txt.trim()) throw new Error('Empty response');
    try { return JSON.parse(txt); }
    catch { throw new Error('Invalid JSON'); }
  }
  function showScene(scene) {
    sceneShelf.setAttribute('aria-hidden', scene!=='shelf');
    sceneFocus.setAttribute('aria-hidden', scene!=='focus');
    sceneMy.setAttribute('aria-hidden',    scene!=='my');
  }
  function loadImage(src) {
    return new Promise((res, rej) => { const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
  }
  async function preloadList(urls, onprogress) {
    let done=0;
    for (const url of urls) {
      try { await loadImage(url); } catch(_) {}
      done++; onprogress && onprogress(done/urls.length);
    }
  }

  // Preloader
  async function runPreloader() {
    const purl = `${BASE}/assets/garden/preload.json?v=${BUILD}`;
    let manifest = { critical:{images:[],thumbs:[]}, eager:{images:[]} };
    try { manifest = await fetchJSON(purl, {retries:1}); }
    catch { /* fallback silently */ }

    // Paper background first to avoid flash
    const paperBg = manifest.critical.images?.find(u=>/paper_bg\./.test(u));
    if (paperBg) paper.style.backgroundImage = `url('${paperBg}')`;
    // Shelves
    const shelfAUrl = manifest.critical.images?.find(u=>/shelf_a\./.test(u));
    const shelfBUrl = manifest.eager.images?.find(u=>/shelf_b\./.test(u));
    if (shelfAUrl) shelfA.src = shelfAUrl;
    if (shelfBUrl) shelfB.src = shelfBUrl;

    // Preload critical images + thumbs with progress
    const critical = [...(manifest.critical.images||[]), ...(manifest.critical.thumbs||[])];
    await preloadList(critical, p => washFill.style.width = `${Math.floor(p*100)}%`);
    // Reveal shelf
    pre.style.display='none';
    showScene('shelf');

    // Eager (non-blocking)
    const eager = [...(manifest.eager.images||[])];
    preloadList(eager);
  }

  // Plants manifest
  async function loadPlants() {
    const url = `${BASE}/assets/garden/plants.json?v=${BUILD}`;
    try {
      PLANTS = await fetchJSON(url, {retries:1});
    } catch (e) {
      document.querySelector('.idle').textContent = 'Loading data… (refresh if it takes long)';
      PLANTS = []; // graceful
    }
  }

  // Render shelf
  function renderShelf() {
    potsWrap.innerHTML = '';
    if (!PLANTS.length) return;
    PLANTS.forEach(p => {
      const b = document.createElement('button');
      b.className='pot-card';
      b.setAttribute('data-id', p.id);
      b.innerHTML = `
        <img class="pot" src="${p.art.pot}" alt="">
        <img class="thumb" src="${p.art.thumb}" alt="${p.name_en}">
        <div class="label">${p.name_zh} · ${p.name_en}</div>
      `;
      b.addEventListener('click', () => openFocus(p));
      potsWrap.appendChild(b);
    });
  }

  // Focus
  function openFocus(p){
    current = p;
    focusArt.src = p.art.plant;
    focusArt.alt = p.name_en;
    setSticker('sowing');
    showScene('focus');
  }
  function setSticker(tab){
    if (!current) return;
    const map = {sowing: current.copy.sowing, care: current.copy.care, pests: current.copy.pests};
    stickerBody.textContent = map[tab] || '';
  }

  // My Garden
  function saveGarden(){ localStorage.setItem('garden_v1', JSON.stringify(garden)); }
  function loadGarden(){ try{ garden = JSON.parse(localStorage.getItem('garden_v1')||'[]'); }catch{ garden=[]; } }
  function addToGarden(id){ if (!garden.includes(id)) garden.push(id); saveGarden(); renderMyGarden(); }
  function renderMyGarden(){
    myPots.innerHTML='';
    garden.forEach(id => {
      const p = PLANTS.find(x=>x.id===id); if(!p) return;
      const wrap = document.createElement('div');
      wrap.className='my-pot';
      wrap.innerHTML = `
        <button class="mute" aria-label="Mute/Unmute" data-id="${id}">♫</button>
        <img class="pot" src="${p.art.pot}" alt="">
        <img class="thumb" src="${p.art.thumb}" alt="${p.name_en}">
        <div class="label">${p.name_zh} · ${p.name_en}</div>
      `;
      wrap.querySelector('.mute').addEventListener('click', (e)=>{
        // stub: toggle visual only; audio routing can be added per-plant later
        e.currentTarget.classList.toggle('off');
        e.currentTarget.textContent = e.currentTarget.classList.contains('off') ? '×' : '♫';
      });
      myPots.appendChild(wrap);
    });
  }

  // Wire UI
  function wire() {
    el('backBtn').addEventListener('click', ()=> showScene('shelf'));
    el('plantBtn').addEventListener('click', ()=> {
      if (!current) return;
      addToGarden(current.id);
      showScene('my');
    });
    el('tabSowing').addEventListener('click', ()=> setSticker('sowing'));
    el('tabCare').addEventListener('click',   ()=> setSticker('care'));
    el('tabPests').addEventListener('click',  ()=> setSticker('pests'));

    // Comfort
    const audioToggle = el('audioToggle');
    const motionToggle = el('motionToggle');
    audioToggle.addEventListener('click', ()=>{
      soundOn = !soundOn;
      audioToggle.setAttribute('aria-pressed', String(soundOn));
      audioToggle.textContent = `Sound: ${soundOn?'on':'off'}`;
      AC.init(); AC.setMute(!soundOn); AC.resume();
    });
    motionToggle.addEventListener('click', ()=>{
      motionOn = !motionOn;
      motionToggle.setAttribute('aria-pressed', String(motionOn));
      motionToggle.textContent = `Motion: ${motionOn?'on':'off'}`;
      document.querySelectorAll('.pot-card, .my-pot')
        .forEach(n => n.style.animation = motionOn ? '' : 'none');
    });
  }

  // Boot
  (async function boot(){
    try {
      // shelves src set in preloader; set paper fallback color immediately
      paper.style.background = '#FBF8F1';
      wire();
      loadGarden();
      await runPreloader();
      await loadPlants();
      renderShelf();
      if (garden.length){ renderMyGarden(); }
    } catch (e) {
      console.error('Boot error', e);
      pre.style.display='none';
      showScene('shelf');
      document.querySelector('.idle').textContent = 'Something went wrong loading data. Try refresh.';
    }
  })();
})();
