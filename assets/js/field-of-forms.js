/* -------------------------------------------------
   Field of Forms · Interactive Drawing + Soundscape
   Combines p5.js brushes, generative audio, and GSAP
   ------------------------------------------------- */

const FOF_SHAPE_NAMES = ["diamond", "flower", "leaf", "star", "dot"];

let brushes = {};
let shapeImgs = {};
let currentBrush = "blue";
let hasDrawn = false;
let audioPrimed = false;

// Sound layers
let osc;
let reverb;
let ambient = [];

function preload() {
  const base = ensureTrailingSlash(window.__FOF_SHAPE_BASE__ || "/assets/shapes/");

  FOF_SHAPE_NAMES.forEach((name) => {
    shapeImgs[name] = loadImage(`${base}${name}.svg`, undefined, () => {
      // Fallback placeholder if an SVG fails to load
      const g = createGraphics(60, 60);
      g.clear();
      g.stroke("#0000bf");
      g.strokeWeight(4);
      g.noFill();
      g.circle(g.width / 2, g.height / 2, g.width * 0.6);
      shapeImgs[name] = g;
    });
  });
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("canvas-holder");
  background(255);

  setupSound();
  setupBrushes();
  setupTooltip();
  setupUI(canvas);
  setupAmbientModulation();
  runIntroAnimation();
}

function draw() {
  // Gentle trail fade to create motion
  noStroke();
  fill(255, 12);
  rect(0, 0, width, height);

  if (mouseIsPressed && (mouseX !== pmouseX || mouseY !== pmouseY)) {
    drawBrush(mouseX, mouseY, pmouseX, pmouseY);
    if (!hasDrawn) fadeOutTooltip();
    hasDrawn = true;
  } else if (osc) {
    osc.amp(0, 0.25); // smooth decay when idle
  }
}

function drawBrush(x, y, px, py) {
  const brush = brushes[currentBrush];
  if (!brush) return;

  const img = shapeImgs[random(brush.shapes)];
  const colour = random(brush.palette);
  const distance = dist(x, y, px, py);
  const size = map(distance, 0, 60, brush.minSize, brush.maxSize, true);

  push();
  translate(x, y);
  rotate(radians(random(-brush.rotation, brush.rotation)));
  if (img) {
    tint(colour);
    imageMode(CENTER);
    image(img, 0, 0, size, size);
  } else {
    fill(colour);
    noStroke();
    circle(0, 0, size);
  }
  pop();

  playReactiveTone(brush, distance);
}

function touchMoved() {
  drawBrush(mouseX, mouseY, pmouseX, pmouseY);
  if (!hasDrawn) fadeOutTooltip();
  hasDrawn = true;
  return false;
}

// --- Setup helpers -------------------------------------------------------

function setupSound() {
  const context = getAudioContext();
  if (context && context.state !== "running") {
    // Let the first interaction resume audio
    audioPrimed = false;
  } else {
    audioPrimed = true;
  }

  osc = new p5.Oscillator("sine");
  osc.amp(0);
  osc.start();

  reverb = new p5.Reverb();
  reverb.process(osc, 6, 3);

  // Layered drone
  const baseFreqs = [110, 147, 196]; // A2, D3, G3
  ambient = baseFreqs.map((freq) => {
    const layerOsc = new p5.Oscillator("sine");
    layerOsc.freq(freq + random(-6, 6));
    layerOsc.amp(0.014);
    layerOsc.start();
    reverb.process(layerOsc, 8, 4);
    return { osc: layerOsc, baseFreq: freq };
  });
}

function setupBrushes() {
  brushes = {
    blue: {
      name: "Blue Rhythm",
      shapes: ["diamond", "dot"],
      palette: ["#0000bf", "#F3E5CB", "#000000"],
      rotation: 6,
      baseFreq: 440,
      wave: "sine",
      minSize: 18,
      maxSize: 58,
    },
    botanic: {
      name: "Botanic Flow",
      shapes: ["leaf", "flower", "star", "dot"],
      palette: ["#74BBC5", "#F3E5CB", "#0000bf", "#2f2f2f"],
      rotation: 18,
      baseFreq: 330,
      wave: "triangle",
      minSize: 24,
      maxSize: 70,
    },
    echo: {
      name: "Echo Pulse",
      shapes: ["diamond", "star", "flower", "dot"],
      palette: ["#000000", "#74BBC5", "#F3E5CB", "#666666"],
      rotation: 28,
      baseFreq: 560,
      wave: "sawtooth",
      minSize: 16,
      maxSize: 48,
    },
  };

  if (brushes[currentBrush]) {
    updateOscillatorWave(brushes[currentBrush].wave);
  }
}

function setupTooltip() {
  const tip = createP("Drag to compose your field of forms.");
  tip.id("fof-tip");
  tip.addClass("fof-tip");
  const containerEl = select(".fof-container");
  if (containerEl) {
    tip.parent(containerEl);
  }
}

function setupUI(canvas) {
  const buttons = document.querySelectorAll(".fof-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const { brush, action } = event.currentTarget.dataset;

      if (brush && brushes[brush]) {
        currentBrush = brush;
        updateOscillatorWave(brushes[brush].wave);
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
  setInterval(() => {
    ambient.forEach((layer, index) => {
      if (!layer || !layer.osc) return;
      const jittered = layer.baseFreq + random(-3, 3);
      layer.osc.freq(jittered);
      layer.osc.amp(0.01 + 0.012 * sin((frameCount / 240) + index));
    });
  }, 3800);
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

// --- Interaction + audio -------------------------------------------------

function primeAudio() {
  if (audioPrimed) return;
  const context = getAudioContext();
  userStartAudio()
    .then(() => {
      audioPrimed = true;
    })
    .catch(() => {
      if (context && context.state !== "running") {
        context.resume?.().then(() => {
          audioPrimed = context.state === "running";
        });
      }
    });
}

function updateOscillatorWave(wave) {
  if (!osc) return;
  try {
    osc.setType(wave);
  } catch (err) {
    console.warn("Oscillator waveform not supported:", err);
  }
}

function playReactiveTone(brush, distance) {
  if (!osc) return;

  const fluctuation = random(-48, 48);
  const frequency = brush.baseFreq + fluctuation;
  const amplitude = map(distance, 0, 120, 0.015, 0.085, true);

  osc.freq(frequency, 0.04);
  osc.amp(amplitude, 0.04);
}

function fadeOutTooltip() {
  const tip = document.getElementById("fof-tip");
  if (!tip) return;

  tip.style.opacity = "0";
  setTimeout(() => {
    tip.remove();
  }, 1200);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  background(255);
  hasDrawn = false;
}

function ensureTrailingSlash(path) {
  return path.endsWith("/") ? path : `${path}/`;
}
