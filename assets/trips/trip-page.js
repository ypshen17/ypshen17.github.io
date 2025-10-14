(() => {
  const root = document.querySelector(".trip-page");
  if (!root) return;

  const dataset = root.dataset;
  const slug = dataset.tripSlug || "trip";
  const modeButtons = root.querySelectorAll(".mode-btn");
  const modeCopies = root.querySelectorAll("[data-mode-copy]");
  const modeIntro = root.querySelector(".trip-mode-intro");
  const placesContainer = document.getElementById("tripPlaces");
  const scoreContainer = document.getElementById("tripScoreLanes");
  const galleryContainer = document.getElementById("trip3dGallery");
  const planTimeline = document.getElementById("tripPlanTimeline");
  const mapNotes = root.querySelectorAll("#trip-map [data-mode-copy]");
  const viewer = document.getElementById("trip3dViewer");
  const evidenceInline = document.getElementById("tripEvidenceInline");
  const evidenceDrawer = document.getElementById("tripEvidenceDrawer");
  const evidenceBody = document.getElementById("tripEvidenceBody");
  const evidenceOpeners = root.querySelectorAll(".trip-evidence-open");
  const evidenceClose = evidenceDrawer.querySelector(".trip-evidence-close");
  const evidenceBackdrop = evidenceDrawer.querySelector(".trip-evidence-backdrop");

  const state = {
    mode: "research",
    places: [],
    photos: [],
    score: null,
    plan: null,
    actual: null,
    evidence: []
  };

  const url = new URL(window.location.href);
  const urlMode = url.searchParams.get("mode");
  const storedMode = (() => {
    try {
      return localStorage.getItem(`trip-mode-${slug}`);
    } catch (err) {
      return null;
    }
  })();

  const initialMode = ["research", "composition"].includes(urlMode)
    ? urlMode
    : ["research", "composition"].includes(storedMode)
      ? storedMode
      : (dataset.modeDefault || "research");

  function setMode(nextMode, { updateHistory = true } = {}) {
    state.mode = nextMode;
    root.setAttribute("data-mode", nextMode);

    modeButtons.forEach((btn) => {
      const isActive = btn.dataset.mode === nextMode;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (modeIntro) {
      let liveRegion = modeIntro.querySelector("[data-trip-mode-live]");
      if (!liveRegion) {
        liveRegion = document.createElement("span");
        liveRegion.dataset.tripModeLive = "true";
        liveRegion.className = "sr-only";
        liveRegion.setAttribute("role", "status");
        liveRegion.setAttribute("aria-live", "polite");
        modeIntro.appendChild(liveRegion);
      }
      liveRegion.textContent = `Mode set to ${nextMode}`;
    }

    modeCopies.forEach((node) => {
      const target = node.getAttribute("data-mode-copy");
      const isMatch = target === nextMode;
      node.hidden = !isMatch;
      node.setAttribute("aria-hidden", isMatch ? "false" : "true");
    });

    mapNotes.forEach((node) => {
      const target = node.getAttribute("data-mode-copy");
      const isMatch = target === nextMode;
      node.hidden = !isMatch;
      node.setAttribute("aria-hidden", isMatch ? "false" : "true");
    });

    renderPlaceCards(state.places, state.photos, { reRender: true });
    try {
      localStorage.setItem(`trip-mode-${slug}`, nextMode);
    } catch (err) {
      // ignore storage errors in private mode
    }

    if (updateHistory) {
      url.searchParams.set("mode", nextMode);
      history.replaceState({}, "", url.toString());
    }
  }

  function timeToMinutes(value) {
    if (!value) return 0;
    const [h, m] = value.split(":").map((n) => parseInt(n, 10));
    return h * 60 + (m || 0);
  }

  function minutesToLabel(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function renderPlanComparison(plan = [], actual = []) {
    if (!planTimeline) return;
    if ((!plan || plan.length === 0) && (!actual || actual.length === 0)) {
      planTimeline.innerHTML = `<p class="trip-timeline-empty">Planned versus observed comparison pending.</p>`;
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "trip-timeline-wrap";

    const datasets = [
      { label: "Planned", items: plan || [], className: "planned" },
      { label: "Observed", items: actual || [], className: "observed" }
    ];

    datasets.forEach(({ label, items, className }) => {
      const row = document.createElement("div");
      row.className = `trip-timeline-row ${className}`;

      const title = document.createElement("span");
      title.className = "trip-timeline-label";
      title.textContent = label;
      row.appendChild(title);

      const track = document.createElement("div");
      track.className = "trip-timeline-track";

      items.forEach((item) => {
        const start = timeToMinutes(item.t);
        const width = Math.max((item.dur || 0), 5);
        const node = document.createElement("div");
        node.className = `trip-timeline-block cat-${item.category || "generic"}`;
        node.style.setProperty("--start", start);
        node.style.setProperty("--duration", width);
        node.innerHTML = `
          <strong>${item.title}</strong>
          <span>${item.t} · ${item.dur} min</span>
        `;
        track.appendChild(node);
      });

      row.appendChild(track);
      wrap.appendChild(row);
    });

    planTimeline.innerHTML = "";
    planTimeline.appendChild(wrap);
  }

  function renderScoreLanes(scoreData, places) {
    if (!scoreContainer || !scoreData) return;
    const categories = [
      { key: "food", label: "Food" },
      { key: "movement", label: "Movement" },
      { key: "light", label: "Light" },
      { key: "rest", label: "Rest" }
    ];

    scoreContainer.innerHTML = "";

    categories.forEach(({ key, label }) => {
      const lane = document.createElement("section");
      lane.className = "trip-score-lane";
      lane.setAttribute("role", "group");
      lane.dataset.lane = key;
      lane.innerHTML = `<h3>${label}</h3>`;

      const list = document.createElement("div");
      list.className = "trip-score-items";

      (scoreData[key] || []).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "trip-score-item";
        button.innerHTML = `
          <span class="trip-score-time">${item.t}</span>
          <span class="trip-score-title">${item.name || item.type || item.mode || item.place}</span>
          <span class="trip-score-meta">${item.dur ? `${item.dur} min` : ""}</span>
        `;

        const relatedPlace = places.find((place) => {
          if (!item.place) return false;
          return place.name.toLowerCase().includes(item.place.toLowerCase());
        });

        if (relatedPlace) {
          button.dataset.placeId = relatedPlace.id;
          button.dataset.photoId = relatedPlace.photo_id || "";
          button.addEventListener("click", () => {
            scrollToPlace(relatedPlace.id);
            if (relatedPlace.photo_id) {
              focusPhoto(relatedPlace.photo_id, { updateQuery: true });
            }
          });
        } else {
          button.disabled = true;
        }

        list.appendChild(button);
      });

      lane.appendChild(list);
      scoreContainer.appendChild(lane);
    });
  }

  function scrollToPlace(placeId) {
    const card = placesContainer?.querySelector(`[data-place-id="${placeId}"]`);
    if (!card) return;

    card.classList.add("is-highlighted");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => card.classList.remove("is-highlighted"), 1600);
  }

  function renderPlaceCards(places, photos, { reRender = false } = {}) {
    if (!placesContainer) return;
    if (!reRender) {
      placesContainer.innerHTML = "";
    }

    if (reRender) {
      placesContainer.querySelectorAll("[data-mode-panel]").forEach((panel) => {
        const show = panel.getAttribute("data-mode-panel") === state.mode;
        panel.hidden = !show;
        panel.setAttribute("aria-hidden", show ? "false" : "true");
      });
      return;
    }

    places.forEach((place) => {
      const card = document.createElement("article");
      card.className = "trip-place-card";
      card.dataset.placeId = place.id;
      card.dataset.photoId = place.photo_id || "";

      const photo = photos.find((ph) => ph.id === place.photo_id);

      card.innerHTML = `
        <div class="trip-place-media">
          ${photo ? `<img src="${photo.src}" alt="" loading="lazy">` : ""}
        </div>
        <div class="trip-place-body">
          <div class="trip-place-head">
            <h3>${place.name}</h3>
            <span class="trip-place-tag">${place.tag || ""}</span>
          </div>
          <p class="trip-place-window"><strong>Best window:</strong> ${place.best_window || "—"}</p>
          <p class="trip-place-access"><strong>Access:</strong> ${place.access || "—"}</p>
          <div class="trip-place-panel" data-mode-panel="research"></div>
          <div class="trip-place-panel" data-mode-panel="composition"></div>
          <div class="trip-place-footer">
            <button type="button" class="trip-place-focus" ${photo ? "" : "disabled"}>
              ${photo ? "Open 3D view" : "Photo pending"}
            </button>
          </div>
        </div>
      `;

      const researchPanel = card.querySelector('[data-mode-panel="research"]');
      if (researchPanel) {
        if (place.research) {
          researchPanel.innerHTML = `
            <p class="trip-place-claim">${place.research.claim || ""}</p>
            <p class="trip-place-evidence"><strong>Evidence:</strong> ${place.research.evidence || ""}</p>
            <p class="trip-place-method"><strong>Method:</strong> ${place.research.method || ""}</p>
            <span class="trip-place-status">${place.research.status || ""}</span>
          `;
        } else {
          researchPanel.innerHTML = `<p>No research copy yet.</p>`;
        }
      }

      const compPanel = card.querySelector('[data-mode-panel="composition"]');
      if (compPanel) {
        const comp = place.composition || {};
        compPanel.innerHTML = `
          <p class="trip-place-staging">${comp.staging || "Composition staging forthcoming."}</p>
          <ul class="trip-place-composition-meta">
            <li><strong>Approach:</strong> ${comp.approach || place.approach || "—"}</li>
            <li><strong>Stay:</strong> ${place.stay_min ? `${place.stay_min} min` : "—"}</li>
            <li><strong>Exit:</strong> ${comp.exit || place.exit_cue || "—"}</li>
            <li><strong>Taste pair:</strong> ${comp.taste_pair || place.taste_pair || "—"}</li>
            <li><strong>Sound note:</strong> ${comp.sound_note || place.sound || "—"}</li>
          </ul>
        `;
      }

      const focusBtn = card.querySelector(".trip-place-focus");
      focusBtn?.addEventListener("click", () => {
        if (place.photo_id) {
          focusPhoto(place.photo_id, { updateQuery: true });
        }
      });

      placesContainer.appendChild(card);
    });

    renderPlaceCards(places, photos, { reRender: true });
  }

  function focusPhoto(photoId, { updateQuery = false } = {}) {
    if (!viewer) return;
    const photo = state.photos.find((item) => item.id === photoId);
    if (!photo) return;

    viewer.dataset.photoId = photoId;

    const image = viewer.querySelector(".trip-3d-image");
    const timeNode = viewer.querySelector('[data-3d-field="time"]');
    const statusNode = viewer.querySelector('[data-3d-field="status"]');
    const tagNode = viewer.querySelector('[data-3d-field="tag"]');

    if (image) {
      image.style.backgroundImage = `url(${photo.src})`;
    }
    if (timeNode) timeNode.textContent = photo.time || "—";
    if (statusNode) statusNode.textContent = photo.status || "—";
    if (tagNode) tagNode.textContent = photo.tag || "—";

    galleryContainer?.querySelectorAll(".trip-3d-thumb").forEach((thumb) => {
      thumb.classList.toggle("active", thumb.dataset.photoId === photoId);
    });

    const relatedPlace = state.places.find((place) => place.photo_id === photoId);
    if (relatedPlace) {
      scrollToPlace(relatedPlace.id);
    }

    if (updateQuery) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("photo", photoId);
      history.replaceState({}, "", nextUrl.toString());
    }
  }

  function renderGallery(photos) {
    if (!galleryContainer) return;
    galleryContainer.innerHTML = "";

    photos.forEach((photo) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "trip-3d-thumb";
      button.dataset.photoId = photo.id;
      button.innerHTML = `
        <span class="trip-3d-thumb-image" style="background-image:url('${photo.src}')"></span>
        <span class="trip-3d-thumb-meta">
          <strong>${photo.time || "Unknown time"}</strong>
          <em>${photo.tag || ""}</em>
        </span>
      `;
      button.addEventListener("click", () => focusPhoto(photo.id, { updateQuery: true }));
      galleryContainer.appendChild(button);
    });
  }

  function renderEvidence(evidence) {
    if (!evidenceInline || !evidenceBody) return;

    evidenceInline.innerHTML = "";
    evidenceBody.innerHTML = "";

    evidence.forEach((item) => {
      const inlineCard = document.createElement("article");
      inlineCard.className = "trip-evidence-card";
      inlineCard.innerHTML = `
        <h3>${item.title}</h3>
        <p><strong>Provenance:</strong> ${item.provenance || "—"}</p>
        <p><strong>Captured:</strong> ${item.captured ? new Date(item.captured).toLocaleString() : "—"}</p>
        <a href="${item.url}" target="_blank" rel="noopener">Open ${item.type || "item"}</a>
      `;
      evidenceInline.appendChild(inlineCard);

      const drawerItem = document.createElement("article");
      drawerItem.className = "trip-evidence-drawer-item";
      drawerItem.innerHTML = `
        <header>
          <h3>${item.title}</h3>
          <span class="trip-evidence-type">${item.type || ""}</span>
        </header>
        <p class="trip-evidence-provenance"><strong>Provenance:</strong> ${item.provenance || "—"}</p>
        <p class="trip-evidence-captured"><strong>Captured:</strong> ${item.captured ? new Date(item.captured).toLocaleString() : "—"}</p>
        <div class="trip-evidence-mode" data-mode-copy="research">${item.modes?.research || ""}</div>
        <div class="trip-evidence-mode" data-mode-copy="composition">${item.modes?.composition || ""}</div>
        <a href="${item.url}" target="_blank" rel="noopener">Open ${item.type || "item"}</a>
      `;
      evidenceBody.appendChild(drawerItem);
    });
  }

  function parseEvidenceJSON() {
    const script = document.getElementById("tripEvidenceData");
    if (!script) return [];
    try {
      return JSON.parse(script.textContent || "[]");
    } catch (err) {
      console.warn("Failed to parse evidence JSON", err);
      return [];
    }
  }

  function openEvidenceDrawer() {
    evidenceDrawer?.setAttribute("aria-hidden", "false");
    evidenceDrawer?.classList.add("is-open");
    const focusTarget = evidenceDrawer?.querySelector(".trip-evidence-close");
    focusTarget?.focus();
  }

  function closeEvidenceDrawer() {
    evidenceDrawer?.setAttribute("aria-hidden", "true");
    evidenceDrawer?.classList.remove("is-open");
    evidenceOpeners[0]?.focus();
  }

  function initEvidence() {
    state.evidence = parseEvidenceJSON();
    renderEvidence(state.evidence);

    evidenceOpeners.forEach((btn) => btn.addEventListener("click", openEvidenceDrawer));
    evidenceClose?.addEventListener("click", closeEvidenceDrawer);
    evidenceBackdrop?.addEventListener("click", closeEvidenceDrawer);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && evidenceDrawer?.classList.contains("is-open")) {
        closeEvidenceDrawer();
      }
    });
  }

  function initDropZone() {
    const dropZone = root.querySelector(".trip-drop-zone");
    if (!dropZone) return;
    const fileInput = dropZone.querySelector("input[type='file']");
    const image = viewer?.querySelector(".trip-3d-image");
    const timeNode = viewer?.querySelector('[data-3d-field="time"]');
    const statusNode = viewer?.querySelector('[data-3d-field="status"]');
    const tagNode = viewer?.querySelector('[data-3d-field="tag"]');

    function showPreview(file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (image) {
          image.style.backgroundImage = `url(${event.target?.result || ""})`;
        }
        timeNode && (timeNode.textContent = "Manual upload");
        statusNode && (statusNode.textContent = "manual");
        tagNode && (tagNode.textContent = file.name);
      };
      reader.readAsDataURL(file);
    }

    function handleFiles(files) {
      if (!files || files.length === 0) return;
      showPreview(files[0]);
    }

    dropZone.addEventListener("click", () => fileInput?.click());
    dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fileInput?.click();
      }
    });
    fileInput?.addEventListener("change", (event) => handleFiles(event.target.files));

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("is-dragging");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      const files = event.dataTransfer?.files;
      handleFiles(files);
    });
  }

  function initTOC() {
    const tocLinks = document.querySelectorAll(".trip-toc a");
    const sections = document.querySelectorAll(".trip-section");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            tocLinks.forEach((link) => {
              const match = link.getAttribute("href") === `#${id}`;
              link.classList.toggle("current", match);
              if (match) {
                link.setAttribute("aria-current", "true");
              } else {
                link.removeAttribute("aria-current");
              }
            });
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0.25 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  function bootstrap() {
    const dataPromises = [
      dataset.photos ? fetch(dataset.photos).then((res) => res.json()) : Promise.resolve([]),
      dataset.places ? fetch(dataset.places).then((res) => res.json()) : Promise.resolve([]),
      dataset.score ? fetch(dataset.score).then((res) => res.json()) : Promise.resolve(null)
    ];

    if (dataset.plan) {
      dataPromises.push(fetch(dataset.plan).then((res) => res.json()).catch(() => []));
    } else {
      dataPromises.push(Promise.resolve([]));
    }

    if (dataset.actual) {
      dataPromises.push(fetch(dataset.actual).then((res) => res.json()).catch(() => []));
    } else {
      dataPromises.push(Promise.resolve([]));
    }

    Promise.all(dataPromises)
      .then(([photos, places, score, plan, actual]) => {
        state.photos = photos || [];
        state.places = places || [];
        state.score = score || {};
        state.plan = plan || [];
        state.actual = actual || [];

        renderGallery(state.photos);
        renderPlaceCards(state.places, state.photos);
        renderScoreLanes(state.score, state.places);
        renderPlanComparison(state.plan, state.actual);

        const photoParam = url.searchParams.get("photo");
        if (photoParam) {
          focusPhoto(photoParam);
        } else if (state.photos[0]) {
          focusPhoto(state.photos[0].id);
        }
      })
      .catch((error) => {
        console.error("Failed to load trip payloads", error);
      });
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMode = btn.dataset.mode;
      if (nextMode && nextMode !== state.mode) {
        setMode(nextMode);
      }
    });
  });

  initEvidence();
  initDropZone();
  initTOC();
  bootstrap();
  setMode(initialMode, { updateHistory: false });
})();
