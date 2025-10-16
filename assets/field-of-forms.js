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

// Sound
let reverb;
let ambient = []; // drone voices
let drawVoices = [];
let drawEnvelopes = [];
let drawVoiceIndex = 0;
let ambientTimer = null;

/* -------------------- preload -------------------- */
function preload() {
  const base = ensureTrailingSlash(
    window.__FOF_SHAPE_BASE__ || "/assets/shapes/"
  );

  FOF_SHAPES.forEach((name) => {
    // allow hyphen key (dot-outline)
    shapeImgs[name] = loadImage(`${base}${name}.svg`, undefined, () => {
      // fallback placeholder if load fails
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

  setupSound();               // ambient drone + reverb
  setupBrushes();             // 3 brush families
  setupTooltip();             // center helper
  setupUI(canvas);            // buttons + audio priming
  setupAmbientModulation();   // slow drift
  runIntroAnimation();        // GSAP entry
}

/* --------------------- draw loop ----------------- */
function draw() {
  if (!fadeActive && !mouseIsPressed) {
    return;
  }

  if (fadeActive) {
    const elapsed = millis() - lastBrushTime;
    if (elapsed > 6000) {
      fadeActive = false;
    } else {
      const fadeAlpha = elapsed < 200 ? 36 : elapsed < 2000 ? 18 : 6;
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

// tiny helper
function randomChoice(arr) {
  return arr[int(random(arr.length))];
}

function drawBrush(x, y, px, py) {
  const brush = brushes[currentBrush];
  if (!brush) return;

  const d = dist(x, y, px, py);
  lastBrushTime = millis();
  fadeActive = true;

  // choose up to two shapes per step for layered texture
  const seqLen = random([1, 2]);
  const shapeSequence = shuffle([...brush.shapes]).slice(0, seqLen);

  shapeSequence.forEach(() => {
    const shape = randomChoice(brush.shapes);
    const img = shapeImgs[shape];
    const col = color(random(brush.palette));          // random colour per form
    const sizeBase = map(d, 0, 60, brush.minSize, brush.maxSize, true);

    const scaleJitter = random(0.7, 1.4);              // random scale
    const rotJitter = random(-brush.rotation * 1.3, brush.rotation * 1.3);
    const radial = random(-brush.maxSize * 0.15, brush.maxSize * 0.15);
    const ang = random(TWO_PI);

    const size = sizeBase * scaleJitter;

    push();
    translate(x + radial * cos(ang), y + radial * sin(ang));
    rotate(radians(rotJitter));
    imageMode(CENTER);

    // vary alpha for nice overlaps
    const a = random(180, 255);

    if (img) {
      // tint() expects RGBA
      tint(col.levels[0], col.levels[1], col.levels[2], a);
      image(img, 0, 0, size, size);
    } else {
      noStroke();
      fill(red(col), green(col), blue(col), a);
      circle(0, 0, size);
    }
    pop();
  });

  // harmonized tone for the gesture
  playReactiveTone(brush, d);
}

/* -------------------- setup helpers -------------- */

function setupSound() {
  userStartAudio()
    .then(() => {
      audioPrimed = true;
    })
    .catch(() => {
      audioPrimed = false;
    }); // will fully resume on first interaction

  reverb = new p5.Reverb();
  reverb.drywet(0.3);

  const voiceCount = 4;
  drawVoices = [];
  drawEnvelopes = [];
  drawVoiceIndex = 0;

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

  // Ambient drone: C4–E4–G4–B4 (Cmaj7), warm & safe
  const baseFreqs = [261.63, 329.63, 392.0, 493.88];
  const waves = ["sine", "triangle", "sine", "triangle"];

  ambient = baseFreqs.map((f, i) => {
    const v = new p5.Oscillator(waves[i]);
    v.freq(f);
    v.amp(0.006);        // very soft
    v.start();
    reverb.process(v, 4, 2); // mild space
    return { osc: v, base: f };
  });
}

function setupBrushes() {
  // NOTE: uses the exact filenames you provided
  brushes = {
    blue: {
      name: "Blue Rhythm",
      shapes: ["diamond", "dot-outline", "dot"],
      palette: ["#0000bf", "#F3E5CB", "#000000"],
      rotation: 6,
      baseFreq: 440,           // used as center for reactive tone colouring
      wave: "sine",
      minSize: 18,
      maxSize: 58,
    },
    botanic: {
      name: "Botanic Flow",
      shapes: ["leaf", "flower", "starburst", "dot"],
      palette: ["#74BBC5", "#F3E5CB", "#0000bf", "#2f2f2f"],
      rotation: 18,
      baseFreq: 330,
      wave: "triangle",
      minSize: 24,
      maxSize: 70,
    },
    echo: {
      name: "Echo Pulse",
      shapes: ["cross", "star4", "dot"],
      palette: ["#000000", "#74BBC5", "#F3E5CB", "#666666"],
      rotation: 28,
      baseFreq: 560,
      wave: "sawtooth",
      minSize: 16,
      maxSize: 48,
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

      if (brush && brushes[brush]) {
        currentBrush = brush;
      }

      if (action === "clear") {
        background(255);
      } else if (action === "save") {
        saveCanvas("field-of-forms", "png");
      }

      primeAudio();
    });
  });

  canvas.mousePressed(primeAudio);
  canvas.touchStarted(primeAudio);
}

function setupAmbientModulation() {
  // Smooth, tiny motion (no horror!)
  if (ambientTimer) clearInterval(ambientTimer);
  ambientTimer = setInterval(() => {
    ambient.forEach((layer, i) => {
      const drift = layer.base + sin(frameCount / 400 + i * 0.7) * 1.5; // ±1.5Hz
      layer.osc.freq(drift);
      layer.osc.amp(0.005 + 0.003 * sin(frameCount / 360 + i));
    });
  }, 3000);
}

function runIntroAnimation() {
  if (!window.gsap) return;

  const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 1.4 } });
  tl.from(".fof-ui h1", { opacity: 0, y: 32, duration: 1.6 })
    .from(".fof-ui p", { opacity: 0, y: 24, duration: 1.1 }, "-=1.0")
    .from(".fof-btn", { opacity: 0, y: 12, stagger: 0.12, duration: 0.5 }, "-=0.6");

  gsap.to(".fof-ui h1", {
    opacity: 0.85,
    duration: 2.6,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  });
}

/* ---------------- audio helpers ------------------ */

function primeAudio() {
  if (audioPrimed) return;
  userStartAudio()
    .then(() => (audioPrimed = true))
    .catch(() => {
      const ctx = getAudioContext();
      ctx?.resume?.().then(() => {
        audioPrimed = ctx && ctx.state === "running";
      });
    });
}

// harmonized brush note in Cmaj7 with envelope + reverb
function playReactiveTone(brush, distance) {
  if (!drawVoices.length) return;

  const pitchSet = [
    261.63, 329.63, 392.0, 493.88, // C4 E4 G4 B4
    523.25, 659.25, 784.0, 987.77  // C5 E5 G5 B5
  ];

  const freq = random(pitchSet) + random(-3, 3); // tiny warmth
  const ampMax = map(distance, 0, 120, 0.02, 0.06, true);

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
