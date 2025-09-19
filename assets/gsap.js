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
      duration: 11, // floating duration (was 17 → now 11)
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
        fontSize: "6rem",
        opacity: 1,
        duration: 1.2,
        delay: i * 0.02
      }, 0);
    });

    // fade in stage2 and nav
    tl.to(stage2, { opacity: 1, duration: 0.8 }, 0.2);
    tl.to([homeNav, ".smoke", ".pieces"], { opacity: 1, duration: 0.8 }, "-=0.2");

    // once landed, keep only 11 letters
    tl.add(() => {
      compositionContainer.innerHTML = "";
      for (let i = 0; i < WORD.length; i++) {
        const letter = scatterLetters[i];
        compositionContainer.appendChild(letter);
        letter.style.position = "relative";
        letter.style.display = "inline-block";
        gsap.set(letter, { x: 0, y: 0, clearProps: "transform" });
      }
      scatterLetters.slice(WORD.length).forEach(letter => {
        gsap.to(letter, { opacity: 0, duration: 0.8 });
      });
    });
  });
});




// ---------- PROJECT DETAIL: Right-side dots slider ----------
document.addEventListener("DOMContentLoaded", () => {
  const dotsWrap = document.querySelector(".dots-right");
  const slidesWrap = document.querySelector(".project-media"); // Assuming right half images are in .project-media
  const slides = Array.from(slidesWrap.querySelectorAll("img")); // Select the images within project media

  if (!dotsWrap || !slidesWrap) return;

  // Clear existing dots if there are any
  dotsWrap.innerHTML = "";

  // Create dots for each image
  slides.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.classList.add("dot");
    dot.dataset.index = index;
    dotsWrap.appendChild(dot);
  });

  const dots = Array.from(dotsWrap.querySelectorAll(".dot"));

  const go = (i) => {
    slides.forEach((s, idx) => s.style.display = idx === i ? "block" : "none");
    dots.forEach((d, idx) => d.classList.toggle("active", idx === i));
  };

  go(0); // Initialize first image as active

  dotsWrap.addEventListener("click", (e) => {
    const dot = e.target.closest(".dot");
    if (!dot) return;
    go(parseInt(dot.dataset.index, 10));
  });
});





// ---------- WONDERING: Floating/colliding labels + card ----------
// ---------- WONDERING: Floating labels + card ----------
document.addEventListener('DOMContentLoaded', () => {
  const worldEl = document.getElementById('wonderWorld');
  if (!worldEl) return; // not on Wondering

  // Data from page
  let data = [];
  try {
    const raw = document.getElementById('wonder-data')?.textContent || '[]';
    data = JSON.parse(raw);
  } catch (e) { data = []; }

  const dotsWrap   = document.getElementById('wonderDots');
  const dim        = document.getElementById('wonderDim');
  const card       = document.getElementById('wonderCard');
  const titleEl    = document.getElementById('wonderTitle');
  const tagsEl     = document.getElementById('wonderTags');
  const mediaEl    = document.getElementById('wonderMedia');
  const contentEl  = document.getElementById('wonderContent');
  const closeBtn   = document.getElementById('wonderClose');

  // Build right dots
  const dots = [];
  data.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'dot' + (i === 0 ? ' active' : '');
    b.setAttribute('aria-label', `Open item ${i + 1}`);
    b.dataset.index = String(i);
    dotsWrap.appendChild(b);
    dots.push(b);
  });

  const nodes = [];
  data.forEach((item, i) => {
    const el = document.createElement('button');
    el.className = 'wtag';
    el.textContent = (item.title || `Item ${i+1}`).toUpperCase();
    worldEl.appendChild(el);
    nodes.push({ el, item });
  });

  // --- floating animation ---
  const floatTimeline = gsap.timeline({ repeat: -1, yoyo: true });
  nodes.forEach(({ el }) => {
    const r = worldEl.getBoundingClientRect();
    const x = Math.random() * (r.width - 120);
    const y = Math.random() * (r.height - 160);
    el.style.transform = `translate(${x}px, ${y}px)`;

    floatTimeline.to(el, {
      x: `+=random(-80,80)`,
      y: `+=random(-60,60)`,
      rotation: `random(-8,8)`,
      duration: 6,
      ease: 'sine.inOut'
    }, 0); // all start together
  });

  let current = -1;
  let pulseTween = null; // store the pulse effect so we can kill it later

  function openCard(i) {
    current = i;
    const obj = nodes[i];
    dots.forEach((d, k) => d.classList.toggle('active', k === i));
    nodes.forEach((n, k) => n.el.classList.toggle('active', k === i));

    // freeze float
    floatTimeline.pause();

    // add pulse to selected tag
    const el = nodes[i].el;
    pulseTween = gsap.to(el, {
      scale: 1.1,
      duration: 0.6,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    // fill card
    titleEl.textContent = obj.item.title || 'Untitled';
    tagsEl.innerHTML = '';
    (obj.item.tags || []).forEach(t => {
      const s = document.createElement('span');
      s.className = 'cat-tag';
      s.textContent = `#${t}`;
      tagsEl.appendChild(s);
    });
    mediaEl.innerHTML = obj.item.cover ? `<img src="${obj.item.cover}" alt="${obj.item.title || ''}">` : '';
    contentEl.innerHTML = obj.item.html || '';

    dim.hidden = false;
    card.hidden = false;
  }

  function closeCard() {
    current = -1;
    nodes.forEach(n => n.el.classList.remove('active'));
    dim.hidden = true;
    card.hidden = true;

    // kill pulse
    if (pulseTween) {
      pulseTween.kill();
      pulseTween = null;
      nodes.forEach(n => gsap.set(n.el, { scale: 1 })); // reset scale
    }

    // resume float
    floatTimeline.resume();
  }

  // Click handlers
  nodes.forEach(({ el }, i) => el.addEventListener('click', () => openCard(i)));
  dotsWrap.addEventListener('click', (e) => {
    const b = e.target.closest('.dot'); if (!b) return;
    openCard(parseInt(b.dataset.index, 10));
  });
  dim.addEventListener('click', closeCard);
  closeBtn?.addEventListener('click', closeCard);
});



  // -----------about-------------------
document.addEventListener("DOMContentLoaded", function() {
  const dots = document.querySelectorAll(".dot");
  const slides = document.querySelectorAll(".slide");

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      // Hide all slides
      slides.forEach((slide) => slide.classList.remove("active"));
      dots.forEach((dot) => dot.classList.remove("active"));

      // Show the clicked slide
      slides[index].classList.add("active");
      dots[index].classList.add("active");
    });
  });
});
