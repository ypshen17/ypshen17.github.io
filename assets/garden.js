/* Fun with Flowers — garden logic (keeps global site untouched) */
(function(){
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const grid = qs('#ff-grid');
  const panel = qs('#ff-panel');
  const panelImg = qs('#ff-panel-img');
  const panelTitle = qs('#ff-panel-title');
  const panelLatin = qs('#ff-panel-latin');
  const tabSowing = qs('#ff-tab-sowing');
  const tabCare = qs('#ff-tab-care');
  const tabPests = qs('#ff-tab-pests');
  const btnPlant = qs('#ff-plant');
  const btnWater = qs('#ff-water');
  const btnClose = qs('#ff-panel-close');
  const dockList = qs('#ff-dock-list');
  const soundToggle = qs('#ff-sound-toggle');
  const ambientToggle = qs('#ff-ambient-toggle');


  const dataEl = document.getElementById('ff-plants');
  let DATA_PLANTS = [];
  try {
    if (dataEl) DATA_PLANTS = JSON.parse(dataEl.textContent || '[]');
  } catch (_) { DATA_PLANTS = []; }

  const PLANTS = (Array.isArray(DATA_PLANTS) && DATA_PLANTS.length)
    ? DATA_PLANTS
    : [ /* ...fallback plants (same array you already have)... */ ];


  const LS = {
    garden: 'ff_my_garden',
    growth: id => `ff_growth_${id}`,
    mute: id => `ff_mute_${id}`,
    vol: id => `ff_vol_${id}`
  };
  function loadGarden(){ try {return JSON.parse(localStorage.getItem(LS.garden)||'[]');} catch(e){return []} }
  function saveGarden(list){ localStorage.setItem(LS.garden, JSON.stringify(list)); }
  function getStage(id){ return Math.max(1, Math.min(4, parseInt(localStorage.getItem(LS.growth(id))||'1',10))); }
  function setStage(id, s){ localStorage.setItem(LS.growth(id), String(Math.max(1, Math.min(4, s)))); }
  function getMute(id){ return localStorage.getItem(LS.mute(id))==='1'; }
  function setMute(id,v){ localStorage.setItem(LS.mute(id), v?'1':'0'); }
  function getVol(id){ const v = parseFloat(localStorage.getItem(LS.vol(id))); return isNaN(v)?0.8:v; }
  function setVol(id, v){ localStorage.setItem(LS.vol(id), String(v)); }

  let ACTIVE_PLANT = null;
  let GARDEN = loadGarden();

  function renderGrid(){
    grid.innerHTML = '';
    PLANTS.forEach(p=>{
      const s = getStage(p.id);
      const card = document.createElement('article');
      card.className = 'ff-card';
      card.innerHTML = `
        <div class="ff-pot"><img src="${p.stages[s-1]?.img||''}" alt="${p.name} 第${s}阶段"></div>
        <div class="ff-title">
          <h4>${p.name}</h4>
          <span class="ff-stage">Stage ${s}/4</span>
        </div>
        <div class="ff-muted" style="font-size:12px">${p.latin||''}</div>
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="ff-btn" data-act="open" data-id="${p.id}">详情</button>
          <button class="ff-btn ff-primary" data-act="add" data-id="${p.id}">加入花园</button>
        </div>`;
      grid.appendChild(card);
    });
  }

  function openPanel(id){
    const p = PLANTS.find(x=>x.id===id); if(!p) return;
    ACTIVE_PLANT = id;
    const s = getStage(id);
    panelImg.src = p.stages[s-1]?.img || '';
    panelImg.alt = `${p.name} 第${s}阶段`;
    panelTitle.textContent = p.name;
    panelLatin.textContent = p.latin||'';
    tabSowing.textContent = p.tabs?.sowing||'';
    tabCare.textContent = p.tabs?.care||'';
    tabPests.textContent = p.tabs?.pests||'';
    panel.setAttribute('aria-hidden','false');
  }
  function closePanel(){ panel.setAttribute('aria-hidden','true'); ACTIVE_PLANT=null; }

  qsa('.ff-tab').forEach(btn=>btn.addEventListener('click', ()=>{
    const key = btn.dataset.tab;
    qsa('.ff-tab').forEach(b=>b.classList.toggle('is-active', b===btn));
    qsa('.ff-tabpane').forEach(p=>p.classList.remove('is-active'));
    qs(`#ff-tab-${key}`).classList.add('is-active');
  }));
  btnClose.addEventListener('click', closePanel);
  panel.addEventListener('click', (e)=>{ if(e.target===panel) closePanel(); });

  btnWater.addEventListener('click', ()=>{
    if(!ACTIVE_PLANT) return;
    setStage(ACTIVE_PLANT, getStage(ACTIVE_PLANT)+1);
    openPanel(ACTIVE_PLANT);
    renderGrid();
  });
  btnPlant.addEventListener('click', ()=>{
    if(!ACTIVE_PLANT) return;
    if(!GARDEN.includes(ACTIVE_PLANT)){
      GARDEN.push(ACTIVE_PLANT); saveGarden(GARDEN); renderDock();
    }
  });

  grid.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if(act==='open') openPanel(id);
    if(act==='add'){ if(!GARDEN.includes(id)){ GARDEN.push(id); saveGarden(GARDEN); renderDock(); }}
  });

  function renderDock(){
    dockList.innerHTML = '';
    GARDEN.forEach(id=>{
      const p = PLANTS.find(x=>x.id===id); if(!p) return;
      const s = getStage(id);
      const item = document.createElement('div');
      item.className = 'ff-dock-item';
      item.innerHTML = `
        <img src="${p.stages[s-1]?.img||''}" alt="${p.name} 第${s}阶段">
        <div>
          <p class="ff-dock-title">${p.name} <span class="ff-muted">(Stage ${s}/4)</span></p>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="ff-btn" data-act="dock-water" data-id="${id}">💧</button>
            <label style="font-size:12px">Vol <input class="ff-slider" type="range" min="0" max="1" step="0.01" value="${getVol(id)}" data-act="dock-vol" data-id="${id}"></label>
          </div>
        </div>
        <div class="ff-dock-ctrls">
          <button class="ff-btn" data-act="dock-mute" data-id="${id}">${getMute(id)?'Unmute':'Mute'}</button>
          <button class="ff-btn" data-act="dock-remove" data-id="${id}">Remove</button>
        </div>`;
      dockList.appendChild(item);
    });
  }

  dockList.addEventListener('click', e=>{
    const btn = e.target.closest('button[data-act]');
    if(!btn) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    if(act==='dock-water'){ setStage(id, getStage(id)+1); renderDock(); renderGrid(); }
    if(act==='dock-mute'){ setMute(id, !getMute(id)); btn.textContent = getMute(id)?'Unmute':'Mute'; }
    if(act==='dock-remove'){
      if(confirm('Remove this plant from your garden?')){
        GARDEN = GARDEN.filter(x=>x!==id); saveGarden(GARDEN); renderDock(); }
    }
  });
  dockList.addEventListener('input', e=>{
    const el = e.target.closest('input[data-act="dock-vol"]');
    if(!el) return; const id = el.dataset.id; setVol(id, parseFloat(el.value||'0.8'));
  });

  // ===== Tone.js =====
  let audioReady = false, transportStarted = false;
  let ambientNoise, plantNodes = {};
  const KEYS = { C:0, Cs:1, D:2, Ds:3, E:4, F:5, Fs:6, G:7, Gs:8, A:9, As:10, B:11 };
  const SCALES = {
    major: [0,2,4,5,7,9,11],
    natural_minor: [0,2,3,5,7,8,10],
    mixolydian: [0,2,4,5,7,9,10],
    major_pentatonic: [0,2,4,7,9]
  };
  const scaleToNotes = (key, scale) => (SCALES[scale]||SCALES.major).map(semi => 60 + (KEYS[key] ?? 0) + semi);
  const instrumentFor = name => {
    switch(name){
      case 'kalimba': return new Tone.PluckSynth().toDestination();
      case 'pad': return new Tone.PolySynth(Tone.Synth, {oscillator:{type:'triangle'}, envelope:{attack:0.4,release:2}}).toDestination();
      case 'nylon': return new Tone.PolySynth(Tone.Synth, {oscillator:{type:'sine'}, envelope:{attack:0.01, release:0.8}}).toDestination();
      case 'epiano':
      default: return new Tone.PolySynth(Tone.Synth, {oscillator:{type:'sine'}, envelope:{attack:0.02, release:0.6}}).toDestination();
    }
  };

  function setupAudio(){
    if(audioReady) return;
    const masterGain = new Tone.Gain(0.9).toDestination();
    const lpf = new Tone.Filter(4000, 'lowpass').connect(masterGain);

    ambientNoise = new Tone.Noise('pink');
    const ambGain = new Tone.Gain(0.0).connect(lpf);
    ambientNoise.connect(ambGain);
    ambientToggle.disabled = false; ambientToggle.dataset.on = '0';

    plantNodes = {};
    PLANTS.forEach(p=>{
      const ins = instrumentFor(p.audio?.instrument);
      const gain = new Tone.Gain( getMute(p.id) ? 0 : getVol(p.id) ).connect(lpf);
      ins.connect(gain);
      plantNodes[p.id] = { ins, gain };
    });

    Tone.Transport.bpm.value = 76;
    Tone.Transport.scheduleRepeat((time)=>{
      PLANTS.forEach(p=>{
        if(!GARDEN.includes(p.id)) return;
        if(getMute(p.id)) return;
        const stage = getStage(p.id);
        const { ins, gain } = plantNodes[p.id];
        gain.gain.rampTo(getVol(p.id), 0.05);
        const notes = scaleToNotes(p.audio?.key||'C', p.audio?.scale||'major');
        const pat = (p.audio?.pattern||[1,3,5,8]).map(ix=>notes[Math.max(0, Math.min(notes.length-1, ix-1))]);
        const n = Math.max(1, Math.min(4, stage));
        const step = Math.floor((Tone.Transport.ticks/ Tone.Transport.PPQ) % n);
        const midi = pat[ step % pat.length ];
        const freq = Tone.Frequency(midi, 'midi');
        if(p.audio?.instrument==='pad') ins.triggerAttackRelease(freq, '2n', time);
        else ins.triggerAttackRelease(freq, '8n', time);
      });
    }, '8n');

    audioReady = true;
  }

  soundToggle.addEventListener('click', async ()=>{
    if(!audioReady) setupAudio();
    await Tone.start();
    if(!transportStarted){ Tone.Transport.start(); transportStarted=true; }
    soundToggle.textContent = 'Sound On';
  });
  ambientToggle.addEventListener('click', ()=>{
    if(!audioReady) return;
    const on = ambientToggle.dataset.on==='1';
    if(on){ ambientNoise.stop(); ambientToggle.textContent='Ambient Off'; ambientToggle.dataset.on='0'; }
    else { ambientNoise.start(); ambientToggle.textContent='Ambient On'; ambientToggle.dataset.on='1'; }
  });

  const idleTimers = {};
  function tickIdle(){
    GARDEN.forEach(id=>{
      const p = PLANTS.find(x=>x.id===id); if(!p) return;
      idleTimers[id] = (idleTimers[id]||0) + 1;
      const need = Math.max(1, parseInt(p.audio?.idle_minutes_per_stage||3,10));
      if(idleTimers[id] >= need){ idleTimers[id] = 0; setStage(id, getStage(id)+1); renderDock(); renderGrid(); }
    });
  }
  setInterval(tickIdle, 60*1000);

  renderGrid();
  renderDock();
})();