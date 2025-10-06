(() => {
  const CFG = window.__GARDEN__ || {};
  const ASSETS = CFG.assets || '';
  const BASE = CFG.baseurl || '';
  const BUILD = CFG.build || `${Date.now()}`;

  // Elements
  const el = (id) => document.getElementById(id);
  const pre = el('preloader'), washFill = el('washFill');
  const sceneShelf = el('sceneShelf'), sceneFocus = el('sceneFocus'), sceneMy = el('sceneMy');
  const paper = el('paper'), shelfA = el('shelfA'), shelfB = el('shelfB');
  const potsWrap = el('pots'), focusArt = el('focusArt'), stickerBody = el('stickerBody'), myPots = el('myPots');

  // State
  let PLANTS = [], current = null, garden = [], motionOn = true, soundOn = true;

  // Helpers
  async function fetchText(url, {retries=1}={}) {
    for (let i=0;i<=retries;i++){
      try { const r = await fetch(url, { cache:'no-store' }); if(!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text(); }
      catch(e){ if (i===retries) throw e; await new Promise(d=>setTimeout(d,250)); }
    }
  }
  async function fetchJSON(url, opts){ const t=await fetchText(url, opts); if(!t||!t.trim()) throw new Error('Empty'); return JSON.parse(t); }
  function showScene(name){ sceneShelf.setAttribute('aria-hidden', name!=='shelf'); sceneFocus.setAttribute('aria-hidden', name!=='focus'); sceneMy.setAttribute('aria-hidden', name!=='my'); }
  function loadImage(src){ return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }
  async function preloadList(list,onp){ let n=0; for(const u of list){ try{ await loadImage(u);}catch{} n++; onp&&onp(n/list.length); } }

  // Preloader
  async function runPreloader(){
    const purl = `${BASE}/assets/garden/preload.json?v=${BUILD}`;
    let manifest = { critical:{images:[],thumbs:[]}, eager:{images:[]} };
    try { manifest = await fetchJSON(purl); } catch {}
    const paperBg = manifest.critical.images?.find(u=>/paper_bg\.(jpg|jpeg)$/i.test(u));
    if (paperBg) paper.style.backgroundImage = `url('${paperBg}')`;
    const shelfAUrl = manifest.critical.images?.find(u=>/shelf_a\.png$/i.test(u));
    const shelfBUrl = (manifest.eager.images||[]).find(u=>/shelf_b\.png$/i.test(u));
    if (shelfAUrl) shelfA.src = shelfAUrl; if (shelfBUrl) shelfB.src = shelfBUrl;

    const critical = [...(manifest.critical.images||[]), ...(manifest.critical.thumbs||[])];
    if (critical.length) await preloadList(critical, p => washFill.style.width = `${Math.round(p*100)}%`);

    pre.style.display='none';
    showScene('shelf');
    if (window.FUNWITH?.showShelf) FUNWITH.showShelf('A');

    // Eager (non-blocking)
    const eager = [...(manifest.eager.images||[])]; preloadList(eager);
  }

  // Data
  async function loadPlants(){
    const url = `${BASE}/assets/garden/plants.json?v=${BUILD}`;
    try { PLANTS = await fetchJSON(url); }
    catch { document.querySelector('.idle').textContent = 'Loading data… (refresh if it takes long)'; PLANTS = []; }
  }

  // Render
  function renderShelf(){
    potsWrap.innerHTML = '';
    PLANTS.forEach(p=>{
      const b = document.createElement('button');
      b.className='pot-card'; b.dataset.id=p.id;
      b.innerHTML = `
        <img class="pot" src="${p.art.pot}" alt="">
        <img class="thumb" src="${p.art.thumb}" alt="${p.name_en}">
        <div class="label">${p.name_zh} · ${p.name_en}</div>`;
      b.addEventListener('click', ()=> openFocus(p));
      potsWrap.appendChild(b);
    });
  }
  function openFocus(p){
    current=p;
    focusArt.src = p.art.plant; focusArt.alt=p.name_en;
    setSticker('sowing');
    showScene('focus');
    if (window.FUNWITH?.revealPlant) FUNWITH.revealPlant(p.art.plant);
  }
  function setSticker(tab){
    if (!current) return;
    const map={sowing:current.copy.sowing, care:current.copy.care, pests:current.copy.pests};
    stickerBody.textContent = map[tab] || '';
  }

  // My Garden
  function saveGarden(){ localStorage.setItem('garden_v1', JSON.stringify(garden)); }
  function loadGarden(){ try{ garden=JSON.parse(localStorage.getItem('garden_v1')||'[]'); }catch{ garden=[]; } }
  function addToGarden(id){ if(!garden.includes(id)) garden.push(id); saveGarden(); renderMyGarden(); }
  function renderMyGarden(){
    myPots.innerHTML='';
    garden.forEach(id=>{
      const p=PLANTS.find(x=>x.id===id); if(!p) return;
      const w=document.createElement('div'); w.className='my-pot';
      w.innerHTML=`
        <button class="mute" aria-label="Mute/Unmute" data-id="${id}">♫</button>
        <img class="pot" src="${p.art.pot}" alt="">
        <img class="thumb" src="${p.art.thumb}" alt="${p.name_en}">
        <div class="label">${p.name_zh} · ${p.name_en}</div>`;
      w.querySelector('.mute').addEventListener('click',(e)=>{ e.currentTarget.classList.toggle('off'); e.currentTarget.textContent=e.currentTarget.classList.contains('off')?'×':'♫'; });
      myPots.appendChild(w);
    });
  }

  // UI wires
  function wire(){
    el('backBtn').addEventListener('click', ()=> showScene('shelf'));
    el('plantBtn').addEventListener('click', ()=> { if (!current) return; addToGarden(current.id); showScene('my'); if (window.FUNWITH?.showShelf) FUNWITH.showShelf('B'); });
    el('tabSowing').addEventListener('click', ()=> setSticker('sowing'));
    el('tabCare').addEventListener('click', ()=> setSticker('care'));
    el('tabPests').addEventListener('click', ()=> setSticker('pests'));

    const audioToggle = el('audioToggle'), motionToggle = el('motionToggle');
    audioToggle.addEventListener('click', ()=>{
      soundOn = !soundOn;
      audioToggle.setAttribute('aria-pressed', String(soundOn));
      audioToggle.textContent = `Sound: ${soundOn?'on':'off'}`;
      // (audio engine hook later)
    });
    motionToggle.addEventListener('click', ()=>{
      motionOn = !motionOn;
      motionToggle.setAttribute('aria-pressed', String(motionOn));
      motionToggle.textContent = `Motion: ${motionOn?'on':'off'}`;
      document.querySelectorAll('.pot-card, .my-pot').forEach(n=> n.style.animation = motionOn ? '' : 'none');
    });
  }

  // Boot
  (async function(){
    try {
      paper.style.background = '#FBF8F1';
      wire(); loadGarden();
      await runPreloader();
      await loadPlants();
      renderShelf(); if (garden.length) renderMyGarden();
    } catch(e){
      console.error('Boot error', e);
      pre.style.display='none'; showScene('shelf');
      document.querySelector('.idle').textContent = 'Something went wrong loading data. Try refresh.';
    }
  })();
})();
