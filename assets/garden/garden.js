let mic, stage = 0, currentPlant = null;
let synth, loop1, loop2, loop3;
let plants = [];
let gardenShelf = [];

// Load plant data
fetch("{{ '/assets/garden/plants.json.html' | relative_url }}")
  .then(res => res.json())
  .then(data => {
    plants = data;
    renderGarden();
  });

// Render floating pots
function renderGarden(){
  const world = document.getElementById("gardenWorld");
  world.innerHTML = "";
  plants.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.className = "plant-pot";
    btn.innerHTML = `<img src="${p.icon}" alt="${p.title}">`;
    btn.addEventListener("click", () => openPlant(i));
    world.appendChild(btn);
  });
}

// Open plant vignette
async function openPlant(index){
  currentPlant = plants[index];
  stage = 0;
  updateStage();

  document.getElementById("plantPopup").classList.remove("hidden");
  document.getElementById("plantTitle").textContent = currentPlant.title;
  document.getElementById("plantText").textContent = currentPlant.notes.sowing;

  await startAudio(currentPlant);
  growSound(stage);
  startMic();
}

// Close popup
document.getElementById("closePlant").addEventListener("click", () => {
  document.getElementById("plantPopup").classList.add("hidden");
  if (mic) mic.stop();
  Tone.Transport.stop();
  stopAll();
});

// MIC setup
function startMic(){
  mic = new p5.AudioIn();
  mic.start();
  setInterval(checkVolume, 2000);
}
function checkVolume(){
  let vol = mic.getLevel();
  if(vol > 0.2 && stage < currentPlant.stages.length-1){
    stage++;
    updateStage();
    growSound(stage);
  }
}

// Update image
function updateStage(){
  document.getElementById("plantImage").src = currentPlant.stages[stage];
}

// Tabs
const tipsEl = document.getElementById("plantText");
document.querySelectorAll(".plant-tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".plant-tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    tipsEl.textContent = currentPlant.notes[btn.dataset.tab];
  });
});

// Instruments
function createInstrument(type){
  if(type === "piano"){
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.3, release: 2 }
    }).toDestination();
  }
  if(type === "pluck"){
    return new Tone.PluckSynth().toDestination();
  }
  if(type === "synth"){
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.1, release: 1 }
    }).toDestination();
  }
  return new Tone.Synth().toDestination();
}

async function startAudio(plant){
  await Tone.start();
  synth = createInstrument(plant.instrument);
  console.log(`${plant.title} instrument: ${plant.instrument}`);
}

// Sound growth
function growSound(stage){
  stopAll();
  const scale = currentPlant.scale;
  const jitter = () => (Math.random() * 0.3) - 0.15;

  if(stage === 0){
    loop1 = new Tone.Loop(time => {
      synth.triggerAttackRelease(scale[0], "2n", time + jitter());
    }, "2n").start(0);
    Tone.Transport.start();
  }
  if(stage === 1){
    loop2 = new Tone.Loop(time => {
      synth.triggerAttackRelease(scale, "2n", time + jitter());
    }, "2n").start(0);
  }
  if(stage === 2){
    loop3 = new Tone.Loop(time => {
      synth.triggerAttackRelease(scale[0], "8n", time + jitter());
      synth.triggerAttackRelease(scale[1], "8n", time + 0.25 + jitter());
      synth.triggerAttackRelease(scale[2], "8n", time + 0.5 + jitter());
    }, "1n").start(0);
  }
}
function stopAll(){
  if(loop1) loop1.stop();
  if(loop2) loop2.stop();
  if(loop3) loop3.stop();
}

// Shelf logic
function updateShelf(){
  const shelf = document.getElementById("gardenShelf");
  const shelfDiv = document.getElementById("shelfPlants");
  shelf.classList.remove("hidden");
  shelfDiv.innerHTML = "";

  gardenShelf.forEach(name => {
    const plant = plants.find(p => p.title === name);
    const div = document.createElement("div");
    div.className = "shelf-plant";
    div.innerHTML = `
      <img src="${plant.icon}" alt="${plant.title}">
      <small>${plant.title}</small>
      <button class="mute-btn">Mute</button>
      <button class="remove-btn">Remove</button>
    `;
    shelfDiv.appendChild(div);

    div.querySelector(".mute-btn").addEventListener("click", () => {
      if(Tone.Transport.state === "started"){
        Tone.Transport.pause();
        div.querySelector(".mute-btn").textContent = "Unmute";
      } else {
        Tone.Transport.start();
        div.querySelector(".mute-btn").textContent = "Mute";
      }
    });

    div.querySelector(".remove-btn").addEventListener("click", () => {
      gardenShelf = gardenShelf.filter(t => t !== plant.title);
      stopAll();
      updateShelf();
    });
  });
}

// Add button inside popup
const addBtn = document.createElement("button");
addBtn.textContent = "Add to My Garden";
addBtn.className = "close-btn";
document.querySelector(".popup-content").appendChild(addBtn);

addBtn.addEventListener("click", () => {
  if(!gardenShelf.includes(currentPlant.title)){
    gardenShelf.push(currentPlant.title);
    updateShelf();
  }
});
