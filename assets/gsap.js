(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (typeof window.gsap === "undefined") return;
  const { gsap } = window;

  document.addEventListener("DOMContentLoaded", () => {
  const scatterContainer = document.getElementById("scatter");
  const nameCenter = document.getElementById("name-center");
  const stage2 = document.getElementById("stage2");
  const homeNav = document.getElementById("home-nav");
  const compositionContainer = document.getElementById("composition-container");
  const nameFixed = document.getElementById("name-fixed");

  if (!scatterContainer || !nameCenter || !compositionContainer || !nameFixed) return;

  const WORD = "COMPOSITION";

  const waitForFonts = () =>
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .catch(() => Promise.resolve());

  const debounce = (fn, ms = 120) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // create 3× scattered letters
  const scatterLetters = [];
  for (let i = 0; i < 3; i++) {
    for (const ch of WORD) {
      const span = document.createElement("span");
      span.textContent = ch;
      scatterContainer.appendChild(span);
      scatterLetters.push(span);
    }
  }

  // random non-overlapping positions
  const usedPositions = [];
  const margin = 120;
  function generateNonOverlappingPosition(radius = margin) {
    let x, y, tries = 0;
    do {
      x = Math.random() * window.innerWidth;
      y = Math.random() * window.innerHeight;
      tries++;
    } while (
      usedPositions.some(pos => Math.hypot(pos.x - x, pos.y - y) < radius) &&
      tries < 100
    );
    usedPositions.push({ x, y });
    return { x, y };
  }

  // scatter animation
  scatterLetters.forEach((letter) => {
    const { x, y } = generateNonOverlappingPosition();
    gsap.set(letter, {
      x,
      y,
      opacity: 0.25,
      fontSize: "6rem",
    });
    gsap.to(letter, {
      duration: 9, // floating duration (was 17, now 11)
      x: x + (Math.random() * 60 - 30),
      y: y + (Math.random() * 60 - 30),
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  });

  // align composition container with YIPENG SHEN
  function alignStage2() {
    const nameBox = nameFixed.getBoundingClientRect();
    const compWidth = compositionContainer.offsetWidth;
    const compLeft = nameBox.right - compWidth;
    const compTop = window.innerHeight / 2 - 9 * 16;

    compositionContainer.style.left = compLeft + "px";
    compositionContainer.style.top = compTop + "px";
    compositionContainer.style.right = "auto";
    compositionContainer.style.transform = "none";

    homeNav.style.left = nameBox.left + "px";
    homeNav.style.top = "calc(50% + 1.5rem)";
    homeNav.style.transform = "none";
  }

  const alignStage2Debounced = debounce(() => {
    if (stage2.style.display === "block") alignStage2();
  }, 120);
  window.addEventListener("resize", alignStage2Debounced);

  // ---- transition ----
  nameCenter.addEventListener("click", async () => {
    gsap.killTweensOf(scatterLetters);

    stage2.style.display = "block";
    compositionContainer.innerHTML = "";

    // create hidden reference word for measuring
    for (const ch of WORD) {
      const slot = document.createElement("span");
      slot.className = "slot";
      slot.textContent = ch;
      compositionContainer.appendChild(slot);
    }

    await waitForFonts();
    if (document.readyState !== "complete") {
      await new Promise(r => window.addEventListener("load", r, { once: true }));
    }

    alignStage2();

    const slots = Array.from(compositionContainer.querySelectorAll(".slot"));

    const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });

    // animate ALL 33 scattered letters into slots
    scatterLetters.forEach((scatter, i) => {
      const slotIndex = i % WORD.length;
      const targetBox = slots[slotIndex].getBoundingClientRect();
      const scatterBox = scatter.getBoundingClientRect();

      // centers
      const targetX = targetBox.left + targetBox.width / 2;
      const targetY = targetBox.top + targetBox.height / 2;
      const currentX = scatterBox.left + scatterBox.width / 2;
      const currentY = scatterBox.top + scatterBox.height / 2;

      // delta (viewport-based movement)
      const dx = targetX - currentX;
      const dy = targetY - currentY;

      tl.to(scatter, {
        x: "+=" + dx,
        y: "+=" + dy,
        opacity: 1,
        duration: 1.2,
        delay: i * 0.02
      }, 0);
    });

    // once landed, pin one set of letters into the final container
    tl.add(() => {
      const primaryLetters = scatterLetters.slice(0, WORD.length);
      const extras = scatterLetters.slice(WORD.length);

      // preserve visual position when reparenting into composition container
      slots.forEach((slot, index) => {
        const letter = primaryLetters[index];
        if (!letter) return;

        const beforeRect = letter.getBoundingClientRect();
        slot.replaceWith(letter);
        letter.style.position = "relative";
        letter.style.display = "inline-block";

        const afterRect = letter.getBoundingClientRect();
        const offsetX = beforeRect.left - afterRect.left;
        const offsetY = beforeRect.top - afterRect.top;

        gsap.set(letter, { x: offsetX, y: offsetY, opacity: 1 });
        requestAnimationFrame(() => {
          gsap.set(letter, { x: 0, y: 0, clearProps: "transform" });
        });
      });

      // fade the duplicate letters away where they land
      extras.forEach(letter => {
        gsap.to(letter, {
          opacity: 0,
          duration: 0.6,
          onComplete: () => letter.remove()
        });
      });

      // realign once the letters are anchored in their final container
      alignStage2();
    });

    // fade in stage2 and nav after the letters assemble
    tl.to(stage2, { opacity: 1, duration: 0.8 }, "+=0.1");
    tl.to([homeNav, ".smoke", ".pieces"], { opacity: 1, duration: 0.8 }, "<");
  });
});










// ---------- WONDERING: Floating labels + card with collision avoidance + filters ----------
document.addEventListener('DOMContentLoaded', () => {
  const worldEl = document.getElementById('wonderWorld');
  if (!worldEl) return;

  const dim       = document.getElementById('wonderDim');
  const card      = document.getElementById('wonderCard');
  const titleEl   = document.getElementById('wonderTitle');
  const tagsEl    = document.getElementById('wonderTags');
  const mediaEl   = document.getElementById('wonderMedia');
  const contentEl = document.getElementById('wonderContent');
  const closeBtn  = document.getElementById('wonderClose');
  const prevBtn   = document.getElementById('wonderPrev');
  const nextBtn   = document.getElementById('wonderNext');

  const nodes = [];
  let wonders = [];
  let originalData = [];

  setLoading(true);
  initWonderData();

  async function initWonderData() {
    try {
      const dataset = await loadWonderData();
      wonders = Array.isArray(dataset) ? dataset : [];
      originalData = wonders.slice();
      if (wonders.length) {
        spawnNodes(wonders);
      } else {
        worldEl.innerHTML = '<p class="wonder-empty">Nothing to show yet.</p>';
      }
    } catch (err) {
      console.error('Wondering data failed to load', err);
      worldEl.innerHTML = '<p class="wonder-error">Unable to load wonders right now.</p>';
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    if (isLoading) {
      worldEl.dataset.state = 'loading';
      worldEl.innerHTML = '<p class="wonder-loading">Loading wonders...</p>';
    } else if (worldEl.dataset.state === 'loading') {
      delete worldEl.dataset.state;
    }
  }

  async function loadWonderData() {
    const inline = document.getElementById('wonder-data');
    if (inline) {
      try { return JSON.parse(inline.textContent || '[]'); }
      catch (err) { console.warn('Inline wonder data invalid', err); }
    }

    const url = window.__WONDER_DATA_URL__ || '/assets/wondering-data.json';
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function spawnNodes(dataset) {
    worldEl.innerHTML = "";
    nodes.length = 0;

    const usedPositions = [];
    dataset.forEach((item, i) => {
      const el = document.createElement('button');
      el.className = 'wtag';
      el.style.position = 'absolute';
      el.textContent = (item.short || item.title || `Untitled`).toUpperCase();
      worldEl.appendChild(el);
      nodes.push({ el, item });

      const { x, y } = generateNonOverlappingPosition(usedPositions, 200);
      usedPositions.push({ x, y });

      gsap.set(el, { x, y, opacity: 0.7 });

      gsap.to(el, {
        x: x + gsap.utils.random(-100, 100),
        y: y + gsap.utils.random(-80, 80),
        rotation: gsap.utils.random(-6, 6),
        duration: gsap.utils.random(8, 14),
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });

      el.addEventListener('click', () => openCard(i));
    });
  }

  function generateNonOverlappingPosition(existing, radius = 200) {
    let x, y, tries = 0;
    const r = worldEl.getBoundingClientRect();
    do {
      x = 40 + Math.random() * (r.width - 200);
      y = 40 + Math.random() * (r.height - 120);
      tries++;
    } while (
      existing.some(pos => Math.hypot(pos.x - x, pos.y - y) < radius) &&
      tries < 300
    );
    return { x, y };
  }

  function resolveCollisions() {
    const padding = 10;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const aBox = nodes[i].el.getBoundingClientRect();
        const bBox = nodes[j].el.getBoundingClientRect();

        if (!(aBox.right < bBox.left || aBox.left > bBox.right ||
              aBox.bottom < bBox.top || aBox.top > bBox.bottom)) {
          const dx = (aBox.left + aBox.width/2) - (bBox.left + bBox.width/2);
          const dy = (aBox.top + aBox.height/2) - (bBox.top + bBox.height/2);
          const dist = Math.max(Math.hypot(dx, dy), 1);
          const overlap = (Math.min(aBox.width, bBox.width) / 2) + padding - dist /*/2*/;

          if (overlap > 0) {
            const moveX = (dx / dist) * overlap;
            const moveY = (dy / dist) * overlap;
            gsap.to(nodes[i].el, { x: `+=${moveX/4}`, y: `+=${moveY/4}`, duration: 0.3 });/*/2*/
            gsap.to(nodes[j].el, { x: `-=${moveX/4}`, y: `-=${moveY/4}`, duration: 0.3 });/*/2*/
          }
        }
      }
    }
  }
  setInterval(resolveCollisions, 1000);

  // --- Card system ---
  let current = -1;
  let pulseTween = null;

  function openCard(i) {
    if (i < 0) i = nodes.length - 1;
    if (i >= nodes.length) i = 0;
    current = i;

    nodes.forEach((n, k) => n.el.classList.toggle('active', k === i));

    gsap.globalTimeline.pause();
    if (pulseTween) pulseTween.kill();

    const el = nodes[i].el;
    pulseTween = gsap.to(el, {
      scale: 1.1,
      opacity: 1,
      duration: 0.8,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    const obj = nodes[i].item;
    if (prevBtn) {
      if (nodes.length > 1) {
        const prevIdx = (i - 1 + nodes.length) % nodes.length;
        const prevTitle = nodes[prevIdx].item.short || nodes[prevIdx].item.title || 'Previous';
        prevBtn.disabled = false;
        prevBtn.textContent = '\u2190 ' + prevTitle;
        prevBtn.setAttribute('aria-label', 'Previous wonder: ' + prevTitle);
      } else {
        prevBtn.disabled = true;
        prevBtn.textContent = '\u2190 Previous';
        prevBtn.setAttribute('aria-label', 'Previous wonder');
      }
    }
    if (nextBtn) {
      if (nodes.length > 1) {
        const nextIdx = (i + 1) % nodes.length;
        const nextTitle = nodes[nextIdx].item.short || nodes[nextIdx].item.title || 'Next';
        nextBtn.disabled = false;
        nextBtn.textContent = nextTitle + ' \u2192';
        nextBtn.setAttribute('aria-label', 'Next wonder: ' + nextTitle);
      } else {
        nextBtn.disabled = true;
        nextBtn.textContent = 'Next \u2192';
        nextBtn.setAttribute('aria-label', 'Next wonder');
      }
    }

    titleEl.textContent = obj.title || 'Untitled';
    tagsEl.innerHTML = '';
    (obj.tags || []).forEach(t => {
      const s = document.createElement('span');
      s.className = 'cat-tag';
      s.textContent = `#${t}`;
      tagsEl.appendChild(s);
    });
    mediaEl.innerHTML = obj.cover ? `<img src="${obj.cover}" alt="">` : '';
    contentEl.innerHTML = obj.html || '';

    // guidance links
    if(obj.guidance && obj.guidance.length){
      const guide = document.createElement('div');
      guide.className = 'wonder-guide';
      guide.innerHTML = '<h4>Guidance</h4><ul>' + obj.guidance.map(line=>{
        // convert [Text](url) → <a href="url" target="_blank">Text</a>
        const m = line.match(/^\s*"?\[([^\]]+)\]\((https?:\/\/[^\)]+)\)"?\s*$/);
        if(m){
          return `<li><a href="${m[2]}" target="_blank" rel="noopener">${m[1]}</a></li>`;
        }
        // fallback: plain text
        return `<li>${line}</li>`;
      }).join('') + '</ul>';
      contentEl.appendChild(guide);
    }

    dim.hidden = false;
    card.hidden = false;
  }

  function closeCard() {
    current = -1;
    nodes.forEach(n => n.el.classList.remove('active'));
    dim.hidden = true;
    card.hidden = true;

    if (pulseTween) {
      pulseTween.kill();
      pulseTween = null;
      nodes.forEach(n => gsap.set(n.el, { scale: 1, opacity: 0.7 }));
    }

    gsap.globalTimeline.resume();
  }

  dim.addEventListener('click', closeCard);
  closeBtn?.addEventListener('click', closeCard);
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (current !== -1 && !prevBtn.disabled) openCard(current - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (current !== -1 && !nextBtn.disabled) openCard(current + 1);
    });
  }

  // ---- Category filter ----
  const catBar = document.getElementById('wonder-categories');
  if (catBar) {
    const buttons = catBar.querySelectorAll('.cat');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!originalData.length) return;
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        if (filter === 'all') {
      spawnNodes(originalData);
        } else {
          spawnNodes(originalData.filter(item => item.category === filter));
        }
      });
    });
  }

  // Initial nodes render after data load completes.
});



//Golden Snitch
const snitch = document.getElementById("wonderSnitch");
const form = document.getElementById("snitchForm");
const closeBtn = document.getElementById("closeSnitch");
const copyBtn = document.getElementById("copyWonder");
const feedback = document.getElementById("snitchFeedback");
const input = document.getElementById("wonderInput");

if (snitch && form) {
  snitch.addEventListener("click", () => {
    form.classList.remove("hidden");
    feedback.classList.add("hidden");
  });

  closeBtn.addEventListener("click", () => {
    form.classList.add("hidden");
    input.value = "";
    feedback.classList.add("hidden");
  });

  copyBtn.addEventListener("click", async () => {
    const message = input.value.trim();
    if (!message) return;

    const res = await fetch("https://submit.yipengshen.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, email: "" })
    });

    if (res.ok) {
      feedback.textContent = "Your wonder has been caught.";
      feedback.classList.remove("hidden");
      input.value = "";
    } else {
      feedback.textContent = "Oops! Something went wrong.";
      feedback.classList.remove("hidden");
    }
  });
}

})();















