/* -------------------------------------------------
   Field of Forms · Interactive Drawing + Soundscape
   ------------------------------------------------- */

const FOF_SHAPES = [
  "diamond",
  "leaf",
  "flower",
  "cross",
  "dot",
  "dot-outline",
  "starburst",
  "star4",
];

let brushes = {};
let shapeImgs = {};
let currentBrush = "blue";
let hasDrawn = false;
let audioPrimed = false;
let lastBrushTime = 0;
let fadeActive = false;

// Sound system
let reverb;
let ambient = [];
let drawVoices = [];
let drawEnvelopes = [];
let drawVoiceIndex = 0;
let ambientTimer = null;
let soundOn = loadPref("fieldof_sound", true); // persistent toggle

/* -------------------- preload -------------------- */
function preload() {
  const base = ensureTrailingSlash(window.__FOF_SHAPE_BASE__ || "/assets/shapes/");

  FOF_SHAPES.forEach((name) => {
    shapeImgs[name] = loadImage(`${base}${name}.svg`, undefined, () => {
      const g = createGraphics(60, 60);
      g.clear();
      g.stroke("#0000bf");
      g.strokeWeight(3);
      g.noFill();
      g.circle(g.width / 2, g.height / 2, g.width * 0.6);
      shapeImgs[name] = g;
    });
  });
}

/* -------------------- setup ---------------------- */
function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-holder");
  background(255);

  pixelDensity(1);
  frameRate(48);

  setupSound();
  setupBrushes();
  setupTooltip();
  setupUI(canvas);
  setupAmbientModulation();
  runIntroAnimation();

  // initialize sound toggle UI
  initAudioToggle();
}

/* --------------------- draw loop ----------------- */
function draw() {
  if (!fadeActive && !mouseIsPressed) return;

  if (fadeActive) {
    const elapsed = millis() - lastBrushTime;
    if (elapsed > 90000) { // keep brush visible longer
      fadeActive = false;
    } else {
      // much softer opacity for slower decay
      const fadeAlpha = 
        elapsed < 3000 ? 15 :
        elapsed < 20000 ? 8 :
        elapsed < 80000 ? 4 :
        2; // near-invisible wash
      noStroke();
      fill(255, fadeAlpha);
      rect(0, 0, width, height);
    }
  }

  if (mouseIsPressed && (mouseX !== pmouseX || mouseY !== pmouseY)) {
    drawBrush(mouseX, mouseY, pmouseX, pmouseY);
    if (!hasDrawn) fadeOutTooltip();
    hasDrawn = true;
  }
}

function touchMoved() {
  drawBrush(mouseX, mouseY, pmouseX, pmouseY);
  if (!hasDrawn) fadeOutTooltip();
  hasDrawn = true;
  return false;
}

/* ---------------- drawing logic ------------------ */
function randomChoice(arr) {
  return arr[int(random(arr.length))];
}

function drawBrush(x, y, px, py) {
  const brush = brushes[currentBrush];
  if (!brush) return;

  const d = dist(x, y, px, py);
  lastBrushTime = millis();
  fadeActive = true;

  // More open spacing (less dense)
  const stepSpacing = map(d, 0, 60, 16, 42, true);
  if (d < stepSpacing / 2 && random() < 0.6) return;

  const seqLen = random([1, 2]);
  const shapeSequence = shuffle([...brush.shapes]).slice(0, seqLen);

  shapeSequence.forEach(() => {
    const shape = randomChoice(brush.shapes);
    const img = shapeImgs[shape];

    // avoid too frequent black
    let col;
    do {
      col = color(random(brush.palette));
    } while (brightness(col) < 20 && random() < 0.6);

    const sizeBase = map(d, 0, 60, brush.minSize, brush.maxSize, true);
    const scaleJitter = random(0.8, 1.5);
    const rotJitter = random(-brush.rotation * 1.4, brush.rotation * 1.4);
    const radial = random(-brush.maxSize * 0.25, brush.maxSize * 0.25);
    const ang = random(TWO_PI);
    const size = sizeBase * scaleJitter;

    push();
    translate(x + radial * cos(ang), y + radial * sin(ang));
    rotate(radians(rotJitter));
    imageMode(CENTER);
    const a = random(160, 245);
    if (img) {
      tint(red(col), green(col), blue(col), a);
      image(img, 0, 0, size, size);
    } else {
      noStroke();
      fill(red(col), green(col), blue(col), a);
      circle(0, 0, size);
    }
    pop();
  });

  playReactiveTone(brush, d);
}

/* -------------------- setup helpers -------------- */
function setupSound() {
  userStartAudio().then(() => audioPrimed = true).catch(() => audioPrimed = false);
  reverb = new p5.Reverb();
  reverb.drywet(0.3);

  const voiceCount = 4;
  drawVoices = [];
  drawEnvelopes = [];

  for (let i = 0; i < voiceCount; i++) {
    const osc = new p5.Oscillator("sine");
    const env = new p5.Envelope();
    env.setADSR(0.02, 0.3, 0.0, 0.25);
    env.setRange(0, 0);
    osc.amp(env);
    osc.start();
    drawVoices.push(osc);
    drawEnvelopes.push(env);
    reverb.process(osc, 4, 2);
  }

  // ambient C E G B (maj7)
  const baseFreqs = [261.63, 329.63, 392.00, 493.88];
  const waves = ["sine", "triangle", "sine", "triangle"];

  ambient = baseFreqs.map((f, i) => {
    const v = new p5.Oscillator(waves[i]);
    v.freq(f);
    v.amp(soundOn ? 0.006 : 0);
    v.start();
    reverb.process(v, 4, 2);
    return { osc: v, base: f };
  });
}

function setupBrushes() {
  brushes = {
    blue: {
      name: "Blue Rhythm",
      shapes: ["diamond", "dot-outline", "dot"],
      palette: ["#0000bf", "#F3E5CB", "#000000"],
      rotation: 6,
      baseFreq: 440,
      wave: "sine",
      minSize: 20,
      maxSize: 60,
    },
    botanic: {
      name: "Botanic Flow",
      shapes: ["leaf", "flower", "starburst", "dot"],
      palette: ["#74BBC5", "#F3E5CB", "#0000bf", "#2f2f2f"],
      rotation: 18,
      baseFreq: 330,
      wave: "triangle",
      minSize: 26,
      maxSize: 74,
    },
    echo: {
      name: "Echo Pulse",
      shapes: ["cross", "star4", "dot"],
      palette: ["#666666", "#74BBC5", "#F3E5CB", "#0000bf"],
      rotation: 28,
      baseFreq: 560,
      wave: "sawtooth",
      minSize: 18,
      maxSize: 52,
    },
  };
}

function setupTooltip() {
  const tip = createP("Drag to compose your Field of Forms.");
  tip.id("fof-tip");
  tip.addClass("fof-tip");
  const containerEl = select(".fof-container");
  if (containerEl) tip.parent(containerEl);
}

function setupUI(canvas) {
  const buttons = document.querySelectorAll(".fof-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const { brush, action } = event.currentTarget.dataset;
      if (brush && brushes[brush]) currentBrush = brush;
      if (action === "clear") background(255);
      if (action === "save") saveCanvas("field-of-forms", "png");
      primeAudio();
    });
  });
  canvas.mousePressed(primeAudio);
  canvas.touchStarted(primeAudio);
}

function setupAmbientModulation() {
  if (ambientTimer) clearInterval(ambientTimer);
  ambientTimer = setInterval(() => {
    ambient.forEach((layer, i) => {
      const drift = layer.base + sin(frameCount / 500 + i * 0.9) * 1.2;
      layer.osc.freq(drift);
      layer.osc.amp(soundOn ? 0.005 + 0.003 * sin(frameCount / 420 + i) : 0, 0.3);
    });
  }, 3000);
}

function runIntroAnimation() {
  if (!window.gsap) return;
  const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 1.4 } });
  tl.from(".fof-ui h1", { opacity: 0, y: 32, duration: 1.6 })
    .from(".fof-ui p", { opacity: 0, y: 24, duration: 1.1 }, "-=1.0")
    .from(".fof-btn", { opacity: 0, y: 12, stagger: 0.12, duration: 0.5 }, "-=0.6");
  gsap.to(".fof-ui h1", { opacity: 0.85, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" });
}

/* ---------------- audio helpers ------------------ */
function primeAudio() {
  if (audioPrimed) return;
  userStartAudio()
    .then(() => audioPrimed = true)
    .catch(() => getAudioContext()?.resume?.());
}

// Restrict to C E G B tones
function playReactiveTone(brush, distance) {
  if (!soundOn || !drawVoices.length) return;
  const pitchSet = [
    261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 784.00, 987.77 // C E G B
  ];
  const freq = random(pitchSet) + random(-4, 4);
  const ampMax = map(distance, 0, 120, 0.025, 0.08, true);
  const osc = drawVoices[drawVoiceIndex];
  const env = drawEnvelopes[drawVoiceIndex];
  drawVoiceIndex = (drawVoiceIndex + 1) % drawVoices.length;
  osc.setType(brush.wave);
  osc.freq(freq);
  env.setRange(ampMax, 0);
  env.play(osc, 0, 0.02);
}

/* ---------------- utilities ---------------------- */
function fadeOutTooltip() {
  const tip = document.getElementById("fof-tip");
  if (!tip) return;
  tip.style.opacity = "0";
  setTimeout(() => tip.remove(), 1200);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
  hasDrawn = false;
  fadeActive = false;
}

function ensureTrailingSlash(p) {
  return p.endsWith("/") ? p : `${p}/`;
}

/* ---------------- Sound toggle ------------------- */
function initAudioToggle() {
  const btn = document.getElementById("audioToggle");
  if (!btn) return;
  btn.setAttribute("aria-pressed", String(soundOn));
  btn.textContent = `Sound: ${soundOn ? "on" : "off"}`;

  btn.addEventListener("click", () => {
    soundOn = !soundOn;
    savePref("fieldof_sound", soundOn);
    btn.setAttribute("aria-pressed", String(soundOn));
    btn.textContent = `Sound: ${soundOn ? "on" : "off"}`;
    const ctx = getAudioContext();
    if (soundOn) {
      ctx.resume().catch(() => {});
      masterVolume(1, 0.3);
    } else {
      masterVolume(0, 0.3);
    }
  });
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
