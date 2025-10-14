(() => {
  const grid = document.getElementById("tripsGrid");
  const sortSelect = document.getElementById("tripsSort");
  const chips = document.querySelectorAll(".trips-chip");
  const dataScript = document.getElementById("tripsArchiveData");
  if (!grid || !sortSelect || !dataScript) return;

  const baseUrl = (grid.dataset.baseurl || "").replace(/\/$/, "");

  let tripsData = [];
  try {
    tripsData = JSON.parse(dataScript.textContent || "[]");
  } catch (error) {
    console.warn("Unable to parse trips archive payload", error);
  }

  const state = {
    filters: new Set(),
    sort: sortSelect.value || "newest"
  };

  function parseDate(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function buildUrl(path) {
    if (!path) return "#";
    if (!baseUrl) return path;
    return `${baseUrl}${path}`;
  }

  function createCard(trip) {
    const article = document.createElement("article");
    article.className = "trips-card entering";
    article.dataset.slug = trip.slug;
    article.dataset.tags = (trip.tags || []).join(",");
    article.dataset.distance = trip.distance_km;
    article.dataset.sortShortest = trip.sort_shortest || trip.distance_km || 0;
    article.dataset.quiet = trip.quiet || false;

    const cardLink = document.createElement("a");
    cardLink.className = "trips-card-link";
    cardLink.href = buildUrl(`/trips/${trip.slug}/`);

    const cover = document.createElement("div");
    cover.className = "trips-card-cover";
    cover.innerHTML = `<span class="trips-cover-lqip" aria-hidden="true"></span>`;
    if (trip.cover) {
      const img = document.createElement("img");
      img.src = trip.cover;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => cover.classList.add("loaded"));
      cover.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "trips-card-body";
    body.innerHTML = `
      <header>
        <h2>${trip.title}</h2>
        <p class="trips-card-city">${trip.city} · ${trip.dates}</p>
      </header>
      <p class="trips-card-thesis">${trip.thesis}</p>
    `;

    const tagList = document.createElement("ul");
    tagList.className = "trips-card-tags";
    (trip.tags || []).slice(0, 3).forEach((tag) => {
      const li = document.createElement("li");
      li.textContent = tag;
      tagList.appendChild(li);
    });

    const meta = document.createElement("div");
    meta.className = "trips-card-meta";
    meta.innerHTML = `
      <span>${trip.distance_km} km</span>
      ${trip.beats && trip.beats.length ? `<span>${trip.beats[0]}</span>` : ""}
    `;

    body.appendChild(tagList);
    body.appendChild(meta);

    cardLink.appendChild(cover);
    cardLink.appendChild(body);
    article.appendChild(cardLink);
    requestAnimationFrame(() => article.classList.remove("entering"));
    return article;
  }

  function applyFilters(list) {
    if (state.filters.size === 0) return list.slice();
    return list.filter((trip) => {
      const tags = trip.tags || [];
      for (const filter of state.filters.values()) {
        if (!tags.includes(filter)) return false;
      }
      return true;
    });
  }

  function applySort(list) {
    const sorted = list.slice();
    switch (state.sort) {
      case "shortest":
        sorted.sort((a, b) => (a.sort_shortest || a.distance_km || 0) - (b.sort_shortest || b.distance_km || 0));
        break;
      case "quietest":
        sorted.sort((a, b) => (b.quiet_score || 0) - (a.quiet_score || 0));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => parseDate(b.sort_date) - parseDate(a.sort_date));
        break;
    }
    return sorted;
  }

  function render() {
    const filtered = applyFilters(tripsData);
    const sorted = applySort(filtered);

    grid.innerHTML = "";

    if (!sorted.length) {
      grid.innerHTML = `<p class="trips-empty">No trips match the selected filters yet.</p>`;
      return;
    }

    const frag = document.createDocumentFragment();
    sorted.forEach((trip) => frag.appendChild(createCard(trip)));
    grid.appendChild(frag);
  }

  function toggleFilter(filterValue, chip) {
    if (state.filters.has(filterValue)) {
      state.filters.delete(filterValue);
      chip?.classList.remove("active");
      chip?.setAttribute("aria-pressed", "false");
    } else {
      state.filters.add(filterValue);
      chip?.classList.add("active");
      chip?.setAttribute("aria-pressed", "true");
    }
    render();
  }

  function handleSortChange(event) {
    state.sort = event.target.value;
    render();
  }

  chips.forEach((chip) => {
    const filterValue = chip.dataset.filter;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => toggleFilter(filterValue, chip));
  });

  sortSelect.addEventListener("change", handleSortChange);
  render();
})();
