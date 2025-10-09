(() => {
  const CFG = window.__GARDEN__ || {};
  const BASE = CFG.baseurl || '';
  const BUILD = CFG.build || `${Date.now()}`;
  const STORAGE_KEY = 'funwith_garden_v2';
  const PREF_SOUND = 'funwith_sound';
  const PREF_MOTION = 'funwith_motion';

  const els = {
    paper: document.getElementById('paper'),
    intro: document.getElementById('gardenIntro'),
    preloader: document.getElementById('preloader'),
    washFill: document.getElementById('washFill'),
    preHint: document.getElementById('preHint'),
    shelfScene: document.getElementById('sceneShelf'),
    focusScene: document.getElementById('sceneFocus'),
    myScene: document.getElementById('sceneMy'),
    exitPrompt: document.getElementById('exitPrompt'),
    shelfImgA: document.getElementById('shelfA'),
    shelfImgB: document.getElementById('shelfB'),
    pots: document.getElementById('pots'),
    focusArt: document.getElementById('focusArt'),
    focusReveal: document.getElementById('focusReveal'),
    stickerRail: document.getElementById('stickerRail'),
    stickerBody: document.getElementById('stickerBody'),
    plantBtn: document.getElementById('plantBtn'),
    backBtn: document.getElementById('backBtn'),
    myPots: document.getElementById('myPots'),
    idle: document.getElementById('shelfHint'),
    audioToggle: document.getElementById('audioToggle'),
    motionToggle: document.getElementById('motionToggle'),
    wateringCan: document.getElementById('wateringCan'),
  };

  const state = {
    plants: [],
    current: null,
    garden: loadGarden(),
    motionOn: loadPref(PREF_MOTION, true),
    soundOn: loadPref(PREF_SOUND, true),
    idleTimer: null,
    introShown: false,
    stage: null,
    growthTicker: null,
    hoverAudioTimeout: null,
  };

  const apiQueue = [];
  document.addEventListener('funwith:ready', (evt) => {
    state.stage = evt.detail;
    apiQueue.splice(0).forEach((fn) => fn(state.stage));
  });

  function withStage(fn) {
    if (state.stage) return fn(state.stage);
    apiQueue.push(fn);
  }

  const audio = createAudioEngine({
    soundOn: state.soundOn,
    motionOn: state.motionOn,
  });

  if (!state.soundOn) toggleButton(els.audioToggle, false, 'Sound');
  if (!state.motionOn) toggleButton(els.motionToggle, false, 'Motion');
  if (!state.motionOn) {
    document.documentElement.classList.add('motion-off');
    audio.setMotion(false);
    withStage((s) => s.setMotion(false));
  }

  wireBaseControls();
  boot();

  async function boot() {
    try {
      await runPreloader();
      await loadPlants();
      renderShelf();
      bindStickers();
      renderMyGarden();
      primeScene();
      startGrowthTicker();
      if (state.garden.length) {
        showScene('my');
        els.exitPrompt.classList.add('is-visible');
        withStage((s) => s.showShelf('B'));
      } else {
        showScene('shelf');
      }
      hidePreloader();
    } catch (err) {
      console.error('Garden boot error', err);
      hidePreloader(true);
      showScene('shelf');
      if (els.idle) {
        els.idle.textContent = 'Something went wrong loading the garden.';
        els.idle.classList.add('is-visible');
      }
    }
  }

  async function fetchText(url, retries = 1) {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      } catch (err) {
        if (i === retries) throw err;
        await wait(250);
      }
    }
  }

  async function fetchJSON(url, retries = 1) {
    const text = await fetchText(url, retries);
    if (!text || !text.trim()) throw new Error('Empty response');
    return JSON.parse(text);
  }

  async function runPreloader() {
    const url = `${BASE}/assets/garden/preload.json?v=${BUILD}`;
    let manifest = { critical: { images: [], thumbs: [] }, eager: { images: [] } };
    try {
      manifest = await fetchJSON(url, 2);
    } catch (err) {
      console.warn('Preload manifest missing', err);
    }

    const paperBg = manifest.critical.images.find((src) => /paper_bg\.(png|jpe?g|webp)$/i.test(src));
    if (paperBg) {
      const img = new Image();
      img.onload = () => {
        els.paper.style.backgroundImage = `url('${paperBg}')`;
        withStage((s) => s.setPaperTexture(paperBg));
      };
      img.src = paperBg;
    }

    const shelfA = manifest.critical.images.find((src) => /shelf_a\.(png|webp)$/i.test(src));
    const shelfB = manifest.eager.images.find((src) => /shelf_b\.(png|webp)$/i.test(src));
    if (shelfA) els.shelfImgA.src = shelfA;
    if (shelfB) els.shelfImgB.dataset.src = shelfB;

    const brush = manifest.critical.images.find((src) => /brush_line\.(png|webp)$/i.test(src));
    if (brush) withStage((s) => s.setBrushTexture(brush));

    const critical = [...manifest.critical.images, ...(manifest.critical.thumbs || [])];
    if (critical.length) {
      await preloadImages(critical, (p) => {
        els.washFill.style.width = `${Math.round(p * 100)}%`;
      });
    }

    const eager = manifest.eager.images || [];
    preloadImages(eager).catch(() => {});
  }

  async function preloadImages(list, onProgress) {
    let done = 0;
    const total = list.length || 1;
    for (const src of list) {
      await new Promise((resolve) => {
        const img = new Image();
        const finish = () => {
          done += 1;
          onProgress?.(done / total);
          resolve();
        };
        img.onload = finish;
        img.onerror = finish;
        img.src = src;
      });
    }
  }

  async function loadPlants() {
    const url = `${BASE}/assets/garden/plants.json?v=${BUILD}`;
    state.plants = await fetchJSON(url, 2);
  }

  function renderShelf() {
    if (!els.pots) return;
    els.pots.innerHTML = '';
    state.plants.forEach((plant, index) => {
      const btn = document.createElement('button');
      btn.className = 'pot-card';
      btn.type = 'button';
      btn.dataset.id = plant.id;
      btn.setAttribute('aria-label', plant.name);
      btn.setAttribute('role', 'listitem');
      btn.innerHTML = `
        <img class="pot" src="${plant.art.pot}" alt="">
        <img class="thumb" src="${plant.art.thumb}" alt="${plant.name}">
        <div class="label">${plant.name}</div>`;
      btn.addEventListener('click', () => openFocus(plant));
      btn.addEventListener('mouseenter', () => {
        if (!state.soundOn) return;
        state.hoverAudioTimeout = setTimeout(() => audio.preview(plant), 80);
      });
      btn.addEventListener('mouseleave', () => {
        if (state.hoverAudioTimeout) clearTimeout(state.hoverAudioTimeout);
      });
      if (index === 0) btn.tabIndex = 0;
      els.pots.appendChild(btn);
    });
  }
  function bindStickers() {
    if (!els.stickerRail) return;
    els.stickerRail.addEventListener('click', (evt) => {
      const target = evt.target.closest('.sticker');
      if (!target) return;
      setSticker(target.dataset.tab);
    });
    els.stickerRail.addEventListener('keydown', (evt) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(evt.key)) return;
      evt.preventDefault();
      const tabs = Array.from(els.stickerRail.querySelectorAll('.sticker'));
      if (!tabs.length) return;
      const currentIndex = tabs.findIndex((btn) => btn.getAttribute('aria-selected') === 'true');
      let targetIndex = currentIndex >= 0 ? currentIndex : 0;
      if (evt.key === 'ArrowRight') targetIndex = (currentIndex + 1) % tabs.length;
      if (evt.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (evt.key === 'Home') targetIndex = 0;
      if (evt.key === 'End') targetIndex = tabs.length - 1;
      const target = tabs[targetIndex];
      if (target) {
        target.focus();
        setSticker(target.dataset.tab);
      }
    });
  }

  function renderMyGarden() {
    els.myPots.innerHTML = '';
    if (!state.garden.length) return;
    state.garden.forEach((entry) => {
      const plant = getPlant(entry.id);
      if (!plant) return;
      const pot = document.createElement('div');
      pot.className = 'my-pot';
      pot.dataset.id = plant.id;
      pot.innerHTML = `
        <button class="mute${entry.muted ? ' off' : ''}" type="button" aria-pressed="${entry.muted ? 'false' : 'true'}">${entry.muted ? 'Muted' : 'Mute'}</button>
        <img class="pot" src="${plant.art.pot}" alt="">
        <img class="thumb" src="${plant.art.thumb}" alt="${plant.name}">
        <div class="label">${plant.name}</div>`;
      const muteBtn = pot.querySelector('.mute');
      muteBtn.addEventListener('click', () => toggleMute(plant.id));
      els.myPots.appendChild(pot);
    });
    lazyLoadShelfB();
  }
  function lazyLoadShelfB() {
    if (!els.shelfImgB?.dataset?.src) return;
    if (els.shelfImgB.src) return;
    els.shelfImgB.src = els.shelfImgB.dataset.src;
    delete els.shelfImgB.dataset.src;
  }

  function openFocus(plant) {
    if (!plant) return;
    resetIdle();
    state.current = plant;
    showScene('focus');
    els.focusArt.classList.remove('is-visible');
    requestAnimationFrame(() => {
      els.focusArt.src = plant.art.plant;
      els.focusArt.alt = plant.name;
      els.focusArt.onload = () => els.focusArt.classList.add('is-visible');
    });
    setSticker('sowing');
    audio.ensureContext();
    audio.focusPlant(plant);
    withStage((s) => s.revealPlant(plant.art.plant));
  }

  function setSticker(key) {
    if (!state.current) return;
    const copy = state.current.copy?.[key] || '';
    Array.from(els.stickerRail.querySelectorAll('.sticker')).forEach((btn) => {
      const active = btn.dataset.tab === key;
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    els.stickerBody.classList.remove('is-visible');
    els.stickerBody.textContent = copy;
    const activeTab = els.stickerRail.querySelector(`.sticker[data-tab="${key}"]`);
    if (activeTab) els.stickerBody.setAttribute('aria-labelledby', activeTab.id);
    requestAnimationFrame(() => els.stickerBody.classList.add('is-visible'));
  }

  function addCurrentToGarden() {
    if (!state.current) return;
    let entry = state.garden.find((p) => p.id === state.current.id);
    if (!entry) {
      entry = {
        id: state.current.id,
        stage: 0,
        lastStageChange: Date.now(),
        plantedAt: Date.now(),
        muted: false,
        vitalityBoost: 0,
      };
      state.garden.push(entry);
      audio.startPlant(state.current, entry.stage, entry.muted);
      saveGarden();
    }
    renderMyGarden();
    showScene('my');
    els.exitPrompt.classList.add('is-visible');
    animatePlantBtn();
    withStage((s) => s.plantSeed());
  }

  function toggleMute(id) {
    const entry = state.garden.find((p) => p.id === id);
    if (!entry) return;
    entry.muted = !entry.muted;
    saveGarden();
    audio.setMuted(id, entry.muted);
    renderMyGarden();
  }

  function animatePlantBtn() {
    els.plantBtn.classList.add('planting');
    setTimeout(() => els.plantBtn.classList.remove('planting'), 800);
  }

  function primeScene() {
    els.plantBtn.addEventListener('click', addCurrentToGarden);
    els.backBtn.addEventListener('click', () => showScene('shelf'));
    els.focusScene.addEventListener('transitionend', (evt) => {
      if (evt.target === els.focusScene && els.focusScene.getAttribute('aria-hidden') === 'true') {
        state.current = null;
      }
    });
    ['focusin', 'mouseenter', 'click'].forEach((eventName) => {
      els.pots?.addEventListener(eventName, resetIdle);
    });
    setupWatering();
  }

  function showScene(name) {
    const map = { shelf: els.shelfScene, focus: els.focusScene, my: els.myScene };
    Object.entries(map).forEach(([key, node]) => {
      if (!node) return;
      node.setAttribute('aria-hidden', key === name ? 'false' : 'true');
    });
    if (name === 'shelf') {
      resetIdle(true);
      audio.stopFocus();
      withStage((s) => s.showShelf('A'));
    }
    if (name === 'focus') {
      audio.ensureContext();
      withStage((s) => {
        s.transitionTo('focus');
        s.showShelf('A');
      });
    }
    if (name === 'my') {
      withStage((s) => s.showShelf('B'));
      audio.ensureContext();
      state.garden.forEach((entry) => {
        const plant = getPlant(entry.id);
        if (plant) audio.startPlant(plant, entry.stage, entry.muted);
      });
    }
  }

  function resetIdle(showSoon = false) {
    if (!els.idle) return;
    els.idle.classList.remove('is-visible');
    if (state.idleTimer) clearTimeout(state.idleTimer);
    const delay = showSoon ? 4200 : 7200;
    state.idleTimer = setTimeout(() => els.idle.classList.add('is-visible'), delay);
  }

  function hidePreloader(error = false) {
    if (!els.preloader) return;
    els.preloader.classList.add('is-hidden');
    if (!state.introShown && els.intro) {
      state.introShown = true;
      els.intro.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        els.intro?.setAttribute('aria-hidden', 'true');
        withStage((s) => s.introComplete());
      }, 2400);
    }
    if (error) {
      els.preHint.textContent = 'Refresh if the garden stays quiet.';
    }
  }

  function getPlant(id) {
    return state.plants.find((p) => p.id === id);
  }

  function setupWatering() {
    const scene = els.myScene;
    if (!scene) return;
    let watering = false;

    scene.addEventListener('pointermove', (evt) => {
      if (!state.motionOn) return;
      const bounds = scene.getBoundingClientRect();
      const nearShelf = evt.clientY < bounds.top + bounds.height * 0.35;
      if (nearShelf) {
        showWateringCan(evt.clientX, evt.clientY);
      } else if (!watering) {
        hideWateringCan();
      }
      if (watering) {
        moveWateringCan(evt.clientX, evt.clientY);
        triggerWater(evt.clientX, evt.clientY, true);
      }
    });

    scene.addEventListener('pointerleave', () => {
      watering = false;
      hideWateringCan();
    });

    scene.addEventListener('pointerdown', (evt) => {
      if (!state.garden.length) return;
      watering = true;
      showWateringCan(evt.clientX, evt.clientY);
      triggerWater(evt.clientX, evt.clientY, false);
      withStage((s) => s.splash(evt.clientX, evt.clientY));
    });

    window.addEventListener('pointerup', () => {
      watering = false;
      hideWateringCanSoon();
    });
  }

  function triggerWater(x, y, gentle) {
    const node = document.elementFromPoint(x, y);
    const pot = node?.closest?.('.my-pot');
    if (!pot) return;
    const entry = state.garden.find((p) => p.id === pot.dataset.id);
    if (!entry) return;
    entry.vitalityBoost = Date.now() + (gentle ? 6000 : 12000);
    saveGarden();
    audio.water(entry.id, gentle ? 0.6 : 1);
  }

  function showWateringCan(x, y) {
    if (!els.wateringCan) return;
    els.wateringCan.classList.add('is-visible');
    moveWateringCan(x, y);
  }

  function moveWateringCan(x, y) {
    if (!els.wateringCan) return;
    els.wateringCan.style.left = `${x}px`;
    els.wateringCan.style.top = `${y}px`;
  }

  function hideWateringCan() {
    els.wateringCan?.classList.remove('is-visible');
  }

  function hideWateringCanSoon() {
    if (!els.wateringCan) return;
    setTimeout(() => els.wateringCan.classList.remove('is-visible'), 180);
  }

  function startGrowthTicker() {
    if (state.growthTicker) clearInterval(state.growthTicker);
    state.growthTicker = setInterval(() => {
      const now = Date.now();
      let changed = false;
      state.garden.forEach((entry) => {
        const plant = getPlant(entry.id);
        if (!plant) return;
        const stages = ['seed', 'sprout', 'bloom', 'lush'];
        if (entry.stage >= stages.length - 1) return;
        const minutes = plant.growth?.idle_minutes_per_step || 10;
        const threshold = minutes * 60 * 1000;
        if (now - entry.lastStageChange >= threshold) {
          entry.stage += 1;
          entry.lastStageChange = now;
          audio.setStage(entry.id, entry.stage);
          changed = true;
        }
      });
      if (changed) saveGarden();
    }, 60000);
  }

  function wireBaseControls() {
    els.audioToggle?.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      toggleButton(els.audioToggle, state.soundOn, 'Sound');
      savePref(PREF_SOUND, state.soundOn);
      audio.setEnabled(state.soundOn);
      if (state.soundOn) {
        audio.ensureContext();
        if (state.current) audio.focusPlant(state.current);
        state.garden.forEach((entry) => {
          const plant = getPlant(entry.id);
          if (plant) audio.startPlant(plant, entry.stage, entry.muted);
        });
      }
    });

    els.motionToggle?.addEventListener('click', () => {
      state.motionOn = !state.motionOn;
      toggleButton(els.motionToggle, state.motionOn, 'Motion');
      savePref(PREF_MOTION, state.motionOn);
      document.documentElement.classList.toggle('motion-off', !state.motionOn);
      audio.setMotion(state.motionOn);
      withStage((s) => s.setMotion(state.motionOn));
    });
  }

  function toggleButton(btn, on, label) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = `${label}: ${on ? 'on' : 'off'}`;
  }

  function saveGarden() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.garden));
  }

  function loadGarden() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map((entry) => ({
        id: entry.id,
        stage: entry.stage ?? 0,
        lastStageChange: entry.lastStageChange ?? Date.now(),
        plantedAt: entry.plantedAt ?? Date.now(),
        muted: !!entry.muted,
        vitalityBoost: entry.vitalityBoost ?? 0,
      }));
    } catch (err) {
      console.warn('Failed to parse garden state', err);
      return [];
    }
  }

  function savePref(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadPref(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function createAudioEngine({ soundOn, motionOn }) {
    let ctx = null;
    let master = null;
    let scheduler = null;
    let reverbNode = null;
    let reverbGain = null;
    let bedGain = null;
    const voices = new Map();

    function ensureContext() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = soundOn ? 1 : 0;
        master.connect(ctx.destination);
        reverbNode = ctx.createConvolver();
        reverbNode.buffer = buildImpulse(ctx, 2.2, 2.8);
        reverbGain = ctx.createGain();
        reverbGain.gain.value = 0.4;
        reverbNode.connect(reverbGain);
        reverbGain.connect(master);
        bedGain = ctx.createGain();
        bedGain.gain.value = 0.18;
        bedGain.connect(master);
        startBed();
        startScheduler();
      }
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    }

    function startBed() {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 62;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(bedGain);
      lfo.start();
      osc.start();
    }

    function startScheduler() {
      if (!ctx || scheduler) return;
      const lookahead = 0.1;
      const scheduleAhead = 0.25;
      scheduler = setInterval(() => {
        const now = ctx.currentTime;
        const horizon = now + scheduleAhead;
        voices.forEach((voice) => voice.schedule(now, horizon));
      }, lookahead * 1000);
    }

    function preview(plant) {
      if (!soundOn) return;
      ensureContext();
      const key = `preview-${plant.id}`;
      let voice = voices.get(key);
      if (!voice) {
        voice = new PlantVoice(ctx, master, reverbNode, plant, motionOn);
        voices.set(key, voice);
      }
      voice.preview();
    }

    function focusPlant(plant) {
      if (!soundOn) return;
      ensureContext();
      let voice = voices.get(plant.id);
      if (!voice) {
        voice = new PlantVoice(ctx, master, reverbNode, plant, motionOn);
        voices.set(plant.id, voice);
      }
      voice.setFocus(true);
    }

    function stopFocus() {
      voices.forEach((voice) => voice.setFocus(false));
    }

    function startPlant(plant, stageIndex = 0, muted = false) {
      if (!soundOn) return;
      ensureContext();
      let voice = voices.get(plant.id);
      if (!voice) {
        voice = new PlantVoice(ctx, master, reverbNode, plant, motionOn);
        voices.set(plant.id, voice);
      }
      voice.setStage(stageIndex);
      voice.setMuted(muted);
      voice.start();
    }

    function setStage(id, stageIndex) {
      const voice = voices.get(id);
      voice?.setStage(stageIndex);
    }

    function setMuted(id, muted) {
      const voice = voices.get(id);
      voice?.setMuted(muted);
    }

    function water(id, intensity = 1) {
      const voice = voices.get(id);
      voice?.water(intensity);
    }

    function setEnabled(on) {
      soundOn = on;
      ensureContext();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.2);
    }

    function setMotion(on) {
      motionOn = on;
      voices.forEach((voice) => voice.setMotion(on));
    }

    return {
      ensureContext,
      preview,
      focusPlant,
      stopFocus,
      startPlant,
      setStage,
      setMuted,
      water,
      setEnabled,
      setMotion,
    };
  }

  class PlantVoice {
    constructor(ctx, master, reverbNode, plant, motionOn) {
      this.ctx = ctx;
      this.master = master;
      this.reverbNode = reverbNode;
      this.plant = plant;
      this.motionOn = motionOn;
      this.output = ctx.createGain();
      this.output.gain.value = 0;
      this.output.connect(master);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.25;
      this.reverbSend.connect(reverbNode);
      this.stage = 0;
      this.active = false;
      this.muted = false;
      this.nextNoteTime = ctx.currentTime + 0.3;
      this.beatCursor = 0;
      this.focused = false;
      this.waterBoost = 0;
      this.previewGain = ctx.createGain();
      this.previewGain.gain.value = 0;
      this.previewGain.connect(master);
      this.noiseBuffer = buildNoiseBuffer(ctx);
    }

    start() {
      if (this.active) return;
      this.active = true;
      const now = this.ctx.currentTime;
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setTargetAtTime(this.muted ? 0 : 0.9, now, 0.7);
      this.reverbSend.gain.setTargetAtTime(this.reverbAmount(), now, 0.5);
      this.nextNoteTime = now + 0.25;
    }

    setStage(stageIndex) {
      this.stage = stageIndex;
      const now = this.ctx.currentTime;
      this.reverbSend.gain.setTargetAtTime(this.reverbAmount(), now, 0.4);
    }

    setFocus(on) {
      this.focused = on;
      const now = this.ctx.currentTime;
      const target = on && !this.muted ? 1 : (this.muted ? 0 : 0.9);
      this.output.gain.setTargetAtTime(target, now, 0.35);
    }

    setMuted(muted) {
      this.muted = muted;
      const now = this.ctx.currentTime;
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setTargetAtTime(muted ? 0 : (this.focused ? 1 : 0.9), now, 0.3);
    }

    setMotion(on) {
      this.motionOn = on;
    }

    water(intensity) {
      const now = this.ctx.currentTime;
      this.waterBoost = now + 6 * intensity;
      this.reverbSend.gain.setTargetAtTime(this.reverbAmount() + 0.05 * intensity, now, 0.25);
    }

    schedule(from, to) {
      if (!this.active || this.muted) return;
      while (this.nextNoteTime < to) {
        this.playNote(this.nextNoteTime);
        this.nextNoteTime = this.computeNextTime(this.nextNoteTime);
      }
    }

    preview() {
      const now = this.ctx.currentTime + 0.05;
      const note = this.randomNote();
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note.frequency;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.previewGain);
      osc.start(now);
      osc.stop(now + 0.7);
    }

    playNote(time) {
      const voices = this.voiceCount();
      const root = this.randomNote();
      const offsets = this.buildChordOffsets(voices);
      offsets.forEach((offset) => {
        const note = this.noteFromOffset(root, offset);
        this.spawnVoice(note, time);
      });
    }

    spawnVoice(note, time) {
      const instrument = this.plant.audio?.instrument || 'sine';
      const osc = this.ctx.createOscillator();
      osc.type = this.waveForInstrument(instrument);
      osc.frequency.setValueAtTime(note.frequency, time);
      const wow = this.plant.audio?.texture?.wow ?? 0.2;
      const detune = (Math.random() - 0.5) * 12 * (this.motionOn ? wow : 0);
      osc.detune.setValueAtTime(detune, time);

      const amp = this.ctx.createGain();
      const env = this.envelopeForInstrument(instrument);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.exponentialRampToValueAtTime(env.peak, time + env.attack);
      amp.gain.setTargetAtTime(0.0001, time + env.decay, env.release);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.cutoff(), time);
      filter.Q.value = 4 * (this.plant.audio?.texture?.warmth ?? 0.4);

      osc.connect(filter);
      filter.connect(amp);
      amp.connect(this.output);
      const wet = this.ctx.createGain();
      wet.gain.setValueAtTime(this.reverbAmount(), time);
      filter.connect(wet);
      wet.connect(this.reverbSend);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.02 * (this.plant.audio?.texture?.noise ?? 0.2);
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;
      noiseSource.connect(noiseGain);
      noiseGain.connect(filter);
      noiseSource.start(time);
      noiseSource.stop(time + env.decay + 0.6);

      osc.start(time);
      osc.stop(time + env.decay + env.release * 3);
    }

    computeNextTime(lastTime) {
      const rhythm = this.plant.audio?.rhythm || {};
      const density = rhythm.density ?? 0.4;
      const tempo = 48 + density * 26;
      const beat = 60 / tempo;
      const swing = rhythm.swing ?? 0.1;
      const human = (Math.random() - 0.5) * 0.06 * (this.motionOn ? 1 : 0);
      const step = beat * (1.4 - density * 0.5);
      const swingOffset = (this.beatCursor % 2 === 0 ? -swing : swing) * 0.5 * beat;
      this.beatCursor += 1;
      return lastTime + step + swingOffset + human;
    }

    voiceCount() {
      const layers = this.plant.growth?.layers || {};
      const order = ['seed', 'sprout', 'bloom', 'lush'];
      const key = order[Math.min(this.stage, order.length - 1)];
      const settings = layers[key] || { voices: 1 };
      let voices = settings.voices || 1;
      if (this.focused) voices += 0.5;
      return Math.max(1, Math.round(voices));
    }

    reverbAmount() {
      const layers = this.plant.growth?.layers || {};
      const order = ['seed', 'sprout', 'bloom', 'lush'];
      const key = order[Math.min(this.stage, order.length - 1)];
      const settings = layers[key] || { reverb: 0.3 };
      const boost = this.waterBoost > this.ctx.currentTime ? 0.05 : 0;
      return (settings.reverb ?? 0.3) + boost;
    }

    cutoff() {
      const layers = this.plant.growth?.layers || {};
      const order = ['seed', 'sprout', 'bloom', 'lush'];
      const key = order[Math.min(this.stage, order.length - 1)];
      const settings = layers[key] || { cutoff: 1400 };
      const base = settings.cutoff ?? 1400;
      const focus = this.focused ? 220 : 0;
      const water = this.waterBoost > this.ctx.currentTime ? 260 : 0;
      return base + focus + water;
    }

    randomNote() {
      const tonic = this.frequencyFromNote(this.plant.audio?.tonic || 'C3');
      const scale = this.plant.audio?.scale || [0, 3, 5, 7, 10];
      const idx = Math.floor(Math.random() * scale.length);
      const semitone = scale[idx];
      return { semitone, frequency: tonic * Math.pow(2, semitone / 12) };
    }

    noteFromOffset(base, offset) {
      return { frequency: base.frequency * Math.pow(2, offset / 12) };
    }

    buildChordOffsets(count) {
      if (count <= 1) return [0];
      if (count === 2) return [0, 7];
      if (count === 3) return [0, 4, 7];
      return [0, 4, 7, 11];
    }

    waveForInstrument(instrument) {
      switch (instrument) {
        case 'felt-piano':
          return 'triangle';
        case 'pluck':
          return 'sawtooth';
        case 'sine-pad':
          return 'sine';
        case 'reed-chime':
          return 'square';
        default:
          return 'sine';
      }
    }

    envelopeForInstrument(instrument) {
      switch (instrument) {
        case 'felt-piano':
          return { attack: 0.12, peak: 0.75, decay: 0.9, release: 0.65 };
        case 'pluck':
          return { attack: 0.02, peak: 0.65, decay: 0.45, release: 0.35 };
        case 'sine-pad':
          return { attack: 0.4, peak: 0.5, decay: 1.6, release: 1.2 };
        case 'reed-chime':
          return { attack: 0.08, peak: 0.6, decay: 1.2, release: 0.9 };
        default:
          return { attack: 0.1, peak: 0.6, decay: 1.2, release: 0.6 };
      }
    }

    frequencyFromNote(note) {
      const map = {
        C: 0, Cs: 1, Db: 1, D: 2, Ds: 3, Eb: 3, E: 4,
        F: 5, Fs: 6, Gb: 6, G: 7, Gs: 8, Ab: 8,
        A: 9, As: 10, Bb: 10, B: 11,
      };
      const match = note.match(/^([A-G])([b#s]?)(\d)$/i);
      if (!match) return 220;
      const [, letter, accidental, octaveStr] = match;
      const key = letter.toUpperCase() + (accidental ? accidental.replace('#', 's').toLowerCase() : '');
      const semitone = map[key] ?? 0;
      const octave = parseInt(octaveStr, 10);
      const midi = semitone + (octave + 1) * 12;
      return 440 * Math.pow(2, (midi - 69) / 12);
    }
  }

  function buildImpulse(ctx, seconds = 1.5, decay = 2) {
    const rate = ctx.sampleRate;
    const length = rate * seconds;
    const buffer = ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const n = Math.random() * 2 - 1;
        data[i] = n * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function buildNoiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }
    return buffer;
  }
})();


