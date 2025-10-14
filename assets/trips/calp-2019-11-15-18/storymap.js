(() => {
  const dataEl = document.getElementById("calpStoryData");
  if (!dataEl) return;

  const config = JSON.parse(dataEl.textContent.trim());
  const steps = config.steps || [];
  const overlaysInfo = config.overlays || {};
  if (!steps.length) return;

  const shell = document.querySelector(".story-shell");
  const modeButtons = document.querySelectorAll(".story-mode-toggle button");
  const overlayButtons = document.querySelectorAll(".overlay-toggle-group button");
  const stepsContainer = document.getElementById("storySteps");
  const legendEl = document.getElementById("mapLegend");
  const legendTitle = document.getElementById("legendTitle");
  const legendItems = document.getElementById("legendItems");
  const overlayNotes = document.getElementById("overlayNotes");

  const url = new URL(window.location.href);
  const initialMode = ["research", "composition"].includes(url.searchParams.get("mode"))
    ? url.searchParams.get("mode")
    : "research";

  const state = {
    mode: initialMode,
    stepId: steps[0].id,
    overlays: new Set(),
    legendId: "suitability"
  };

  const stepsMap = new Map();
  const stepElements = new Map();

  function renderSteps() {
    steps.forEach((step) => {
      stepsMap.set(step.id, step);
      const card = document.createElement("article");
      card.className = "story-step";
      card.dataset.stepId = step.id;
      card.innerHTML = `
        <div class="story-step-top">
          <h2>${step.title}</h2>
          <div class="story-step-time">${step.time}</div>
        </div>
        <p class="story-step-copy">${step.copy[state.mode]}</p>
        <div class="story-step-meta">
          ${(step.metrics || []).map((metric) => `<span>${metric}</span>`).join("")}
        </div>
      `;
      card.addEventListener("click", () => activateStep(step.id));
      stepsContainer.appendChild(card);
      stepElements.set(step.id, card);
    });
  }

  function updateStepCopy() {
    stepElements.forEach((el, id) => {
      const step = stepsMap.get(id);
      const copyNode = el.querySelector(".story-step-copy");
      if (copyNode && step) {
        copyNode.textContent = step.copy[state.mode];
      }
    });
  }

  function updateModeToggle() {
    modeButtons.forEach((btn) => {
      const mode = btn.dataset.mode;
      if (mode === state.mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    shell.dataset.mode = state.mode;
    updateStepCopy();
    showPopupForCurrentStep();
    url.searchParams.set("mode", state.mode);
    history.replaceState({}, "", url);
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode && mode !== state.mode) {
        state.mode = mode;
        updateModeToggle();
      }
    });
  });

  const map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: steps[0].view.center,
    zoom: steps[0].view.zoom,
    pitch: steps[0].view.pitch,
    bearing: steps[0].view.bearing,
    attributionControl: false
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

  let suitabilityData;
  let fieldData;
  let acousticData;
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 16
  });

  function renderLegend() {
    const activeId = state.legendId && state.overlays.has(state.legendId)
      ? state.legendId
      : Array.from(state.overlays)[0];
    state.legendId = activeId || null;
    if (!state.legendId) {
      legendEl.style.display = "none";
      overlayNotes.textContent = "";
      return;
    }

    const overlay = overlaysInfo[state.legendId];
    if (!overlay) {
      legendEl.style.display = "none";
      overlayNotes.textContent = "";
      return;
    }

    legendTitle.textContent = overlay.title;
    legendItems.innerHTML = "";
    (overlay.legend || []).forEach((item) => {
      const row = document.createElement("div");
      row.className = "legend-item";
      row.innerHTML = `
        <span class="legend-swatch" style="background:${item.color};"></span>
        <span>${item.label}</span>
      `;
      legendItems.appendChild(row);
    });
    legendEl.style.display = "block";
    overlayNotes.textContent = overlay.note || "";
  }

  function setOverlayVisibility(id, visible) {
    const layerGroups = {
      suitability: ["suitability-fill", "suitability-outline", "suitability-highlight"],
      field: ["field-points", "field-points-highlight"],
      acoustics: ["acoustic-line", "acoustic-highlight"]
    };
    (layerGroups[id] || []).forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    });
  }

  overlayButtons.forEach((btn) => {
    const overlayId = btn.dataset.overlay;
    if (!overlayId) return;
    btn.addEventListener("click", () => {
      const isActive = state.overlays.has(overlayId);
      if (isActive) {
        state.overlays.delete(overlayId);
        btn.classList.remove("active");
        setOverlayVisibility(overlayId, false);
        if (state.legendId === overlayId) {
          state.legendId = null;
        }
      } else {
        state.overlays.add(overlayId);
        btn.classList.add("active");
        setOverlayVisibility(overlayId, true);
        state.legendId = overlayId;
      }
      renderLegend();
    });
  });

  function updateStepCardsActive() {
    stepElements.forEach((el, id) => {
      if (id === state.stepId) {
        el.classList.add("active");
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        el.classList.remove("active");
      }
    });
  }

  function updateSuitabilityHighlight(hexId) {
    if (map.getLayer("suitability-highlight")) {
      map.setFilter("suitability-highlight", hexId ? ["==", ["get", "id"], hexId] : ["==", ["get", "id"], ""]);
    }
  }

  function updateFieldHighlight(id) {
    if (map.getLayer("field-points-highlight")) {
      map.setFilter("field-points-highlight", id ? ["==", ["get", "id"], id] : ["==", ["get", "id"], ""]);
    }
  }

  function updateAcousticHighlight(id) {
    if (map.getLayer("acoustic-highlight")) {
      map.setFilter("acoustic-highlight", id ? ["==", ["get", "id"], id] : ["==", ["get", "id"], ""]);
    }
  }

  function findFeature(data, id) {
    if (!data) return null;
    return (data.features || []).find((feature) => feature.properties && feature.properties.id === id) || null;
  }

  function centroidOfPolygon(coords) {
    if (!coords || !coords.length) return null;
    const ring = coords[0];
    let x = 0;
    let y = 0;
    ring.forEach((coord) => {
      x += coord[0];
      y += coord[1];
    });
    return [x / ring.length, y / ring.length];
  }

  function midpointOfLineString(coords) {
    if (!coords || coords.length === 0) return null;
    const midIndex = Math.floor(coords.length / 2);
    return coords[midIndex];
  }

  function getStepCoordinate(step) {
    if (!step) return steps[0].view.center;
    if (step.highlight) {
      if (step.highlight.source === "field") {
        const feature = findFeature(fieldData, step.highlight.id);
        if (feature) return feature.geometry.coordinates;
      }
      if (step.highlight.source === "acoustics") {
        const feature = findFeature(acousticData, step.highlight.id);
        if (feature) return midpointOfLineString(feature.geometry.coordinates);
      }
    }
    if (step.hex) {
      const feature = findFeature(suitabilityData, step.hex);
      if (feature) return centroidOfPolygon(feature.geometry.coordinates);
    }
    return step.view.center;
  }

  function popupHtml(step) {
    const metrics = (step.metrics || []).map((metric) => `<li>${metric}</li>`).join("");
    return `
      <div class="story-popup">
        <strong>${step.title}</strong>
        <p>${step.copy[state.mode]}</p>
        ${metrics ? `<ul>${metrics}</ul>` : ""}
      </div>
    `;
  }

  function showPopupForCurrentStep() {
    const step = stepsMap.get(state.stepId);
    if (!step) return;
    const coordinate = getStepCoordinate(step);
    popup.setLngLat(coordinate).setHTML(popupHtml(step)).addTo(map);
  }

  function activateStep(stepId, { animate = true } = {}) {
    const step = stepsMap.get(stepId);
    if (!step) return;
    state.stepId = stepId;
    updateStepCardsActive();

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    map.easeTo({
      center: step.view.center,
      zoom: step.view.zoom,
      pitch: step.view.pitch,
      bearing: step.view.bearing,
      duration: animate && !prefersReducedMotion ? 1400 : 0
    });

    updateFieldHighlight(step.highlight?.source === "field" ? step.highlight.id : null);
    updateAcousticHighlight(step.highlight?.source === "acoustics" ? step.highlight.id : null);
    updateSuitabilityHighlight(step.hex || null);
    showPopupForCurrentStep();
  }

  function bindMapInteractions() {
    if (map.getLayer("field-points")) {
      map.on("mouseenter", "field-points", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "field-points", () => (map.getCanvas().style.cursor = ""));
      map.on("click", "field-points", (event) => {
        const feature = event.features && event.features[0];
        if (!feature) return;
        const step = stepsMap.get(feature.properties.id);
        if (step) {
          activateStep(step.id);
        }
      });
    }

    if (map.getLayer("acoustic-line")) {
      map.on("mouseenter", "acoustic-line", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "acoustic-line", () => (map.getCanvas().style.cursor = ""));
      map.on("click", "acoustic-line", () => {
        if (stepsMap.has("boardwalk")) {
          activateStep("boardwalk");
        }
      });
    }
  }

  async function loadSources() {
    const [suitability, field, acoustic] = await Promise.all([
      fetch("/assets/trips/calp-2019-11-15-18/suitability-hex.geojson").then((response) => response.json()),
      fetch("/assets/trips/calp-2019-11-15-18/field-measurements.geojson").then((response) => response.json()),
      fetch("/assets/trips/calp-2019-11-15-18/acoustic-line.geojson").then((response) => response.json())
    ]);

    suitabilityData = suitability;
    fieldData = field;
    acousticData = acoustic;

    map.addSource("suitability", {
      type: "geojson",
      data: suitabilityData
    });

    map.addLayer({
      id: "suitability-fill",
      type: "fill",
      source: "suitability",
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "score"],
          0.6,
          "#41b6c4",
          0.8,
          "#2c7fb8"
        ],
        "fill-opacity": 0.32
      }
    });

    map.addLayer({
      id: "suitability-outline",
      type: "line",
      source: "suitability",
      paint: {
        "line-width": 1.4,
        "line-color": "#2c7fb8",
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "suitability-highlight",
      type: "line",
      source: "suitability",
      paint: {
        "line-width": 3,
        "line-color": "#0000bf"
      },
      filter: ["==", ["get", "id"], ""]
    });

    map.addSource("field", {
      type: "geojson",
      data: fieldData
    });

    map.addLayer({
      id: "field-points",
      type: "circle",
      source: "field",
      paint: {
        "circle-radius": 6,
        "circle-color": "#0000bf",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff"
      }
    });

    map.addLayer({
      id: "field-points-highlight",
      type: "circle",
      source: "field",
      paint: {
        "circle-radius": 10,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#0000bf",
        "circle-stroke-width": 3
      },
      filter: ["==", ["get", "id"], ""]
    });

    map.addSource("acoustics", {
      type: "geojson",
      data: acousticData
    });

    map.addLayer({
      id: "acoustic-line",
      type: "line",
      source: "acoustics",
      paint: {
        "line-color": "#f4a261",
        "line-width": 4,
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "acoustic-highlight",
      type: "line",
      source: "acoustics",
      paint: {
        "line-color": "#bf5a00",
        "line-width": 6
      },
      filter: ["==", ["get", "id"], ""]
    });

    bindMapInteractions();
    ["suitability-highlight", "field-points-highlight", "acoustic-highlight"].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.moveLayer(layerId);
      }
    });
    Object.keys(overlaysInfo).forEach((overlayId) => {
      const visible = state.overlays.has(overlayId);
      setOverlayVisibility(overlayId, visible);
      if (!visible) {
        const overlayButton = Array.from(overlayButtons).find((btn) => btn.dataset.overlay === overlayId);
        overlayButton?.classList.remove("active");
      }
    });
    if (!state.overlays.has(state.legendId)) {
      state.legendId = Array.from(state.overlays)[0] || null;
    }
    renderLegend();
    activateStep(state.stepId, { animate: false });
  }

  map.on("load", () => {
    renderSteps();
    updateModeToggle();
    loadSources().catch((error) => {
      console.error("Failed to load storymap sources", error);
    });
  });
})();
  overlayButtons.forEach((btn) => {
    const overlayId = btn.dataset.overlay;
    if (!overlayId) return;
    if (btn.classList.contains("active")) {
      state.overlays.add(overlayId);
    }
  });
  if (!state.overlays.size) {
    ["suitability", "field", "acoustics"].forEach((id) => state.overlays.add(id));
  }
