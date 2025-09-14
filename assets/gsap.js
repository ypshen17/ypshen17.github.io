// ---------------- HOMEPAGE ----------------
document.addEventListener("DOMContentLoaded", () => {
  const scatterContainer = document.getElementById("scatter");
  const nameCenter = document.getElementById("name-center");
  const stage1 = document.getElementById("stage1");
  const stage2 = document.getElementById("stage2");
  const homeNav = document.getElementById("home-nav");
  const compositionContainer = document.getElementById("composition-container");
  const nameFixed = document.getElementById("name-fixed");

  if (!scatterContainer || !nameCenter || !compositionContainer || !nameFixed) return;

  // ---- helpers ----
  const waitForFonts = () =>
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .catch(() => Promise.resolve());

  const debounce = (fn, ms = 120) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // ---- build 3× "COMPOSITION" ----
  const WORD = "COMPOSITION";
  for (let i = 0; i < 3; i++) {
    for (const ch of WORD) {
      const span = document.createElement("span");
      span.textContent = ch;
      scatterContainer.appendChild(span);
    }
  }
  const scatterLetters = [...scatterContainer.querySelectorAll("span")];

  // ---- Stage 1: floating scatter ----
  gsap.set(scatterLetters, {
    x: () => Math.random() * window.innerWidth,
    y: () => Math.random() * window.innerHeight,
    opacity: 0.25,
    fontSize: "7.2rem"
  });

  gsap.to(scatterLetters, {
    duration: 40,
    x: () => Math.random() * window.innerWidth,
    y: () => Math.random() * window.innerHeight,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut"
  });

  // ---- alignment (called only after fonts are ready) ----
  function alignStage2() {
    const nameBox = nameFixed.getBoundingClientRect();

    // position COMPOSITION so its right edge = YIPENG SHEN right edge
    const compWidth = compositionContainer.offsetWidth;
    const compLeft = nameBox.right - compWidth;
    const compTop = window.innerHeight / 2 - 9 * 16; // ≈ 9rem above center

    compositionContainer.style.left = compLeft + "px";
    compositionContainer.style.top  = compTop + "px";
    compositionContainer.style.right = "auto";
    compositionContainer.style.transform = "none";

    // homenav left edge = YIPENG SHEN left edge
    homeNav.style.left = nameBox.left + "px";
    homeNav.style.top  = "calc(50% + 1.5rem)";
    homeNav.style.transform = "none";
  }

  const alignStage2Debounced = debounce(() => {
    // only align if stage2 is visible (after click)
    if (stage2.style.display === "block") alignStage2();
  }, 120);

  window.addEventListener("resize", alignStage2Debounced);

  // ---- click: scatter -> compose ----
  nameCenter.addEventListener("click", async () => {
    // stop floating
    gsap.killTweensOf(scatterLetters);

    // reveal Stage 2 overlay immediately (so we can measure inside it)
    stage2.style.display = "block";

    // build final word spans
    compositionContainer.innerHTML = "";
    for (const ch of WORD) {
      const s = document.createElement("span");
      s.textContent = ch;
      compositionContainer.appendChild(s);
    }
    const finalLetters = [...compositionContainer.querySelectorAll("span")];

    // wait for fonts to be fully loaded before measuring
    await waitForFonts();
    // extra safety: also wait for window load if needed
    if (document.readyState !== "complete") {
      await new Promise(r => window.addEventListener("load", r, { once: true }));
    }

    // align targets now that fonts are ready and letters exist
    alignStage2();

    // compute target boxes and animate each scattered letter to its final spot
    finalLetters.forEach((targetSpan, i) => {
      const targetBox = targetSpan.getBoundingClientRect();
      const source = scatterLetters[i]; // there are 33 scatter letters, 11 for final word; reuses by modulo if needed
      const sourceBox = source.getBoundingClientRect();

      gsap.to(source, {
        duration: 1.5,
        x: (targetBox.left - sourceBox.left) + (parseFloat(source.style.x) || 0),
        y: (targetBox.top  - sourceBox.top)  + (parseFloat(source.style.y) || 0),
        fontSize: "7.2rem",
        opacity: 0.25,
        ease: "power3.inOut",
        delay: (i % WORD.length) * 0.05
      });
    });

    // fade in the overlay & visuals
    gsap.to(stage2, { opacity: 1, duration: 1, delay: 0.5 });
    gsap.to([homeNav, ".smoke", ".pieces"], { opacity: 1, duration: 1, delay: 1.5 });
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
document.addEventListener('DOMContentLoaded', () => {
  const worldEl = document.getElementById('wonderWorld');
  if (!worldEl) return; // not on Wondering

  // Data from page
  let data = [];
  try {
    const raw = document.getElementById('wonder-data')?.textContent || '[]';
    data = JSON.parse(raw);
  } catch (e) { data = []; }

  const dotsWrap = document.getElementById('wonderDots');
  const dim = document.getElementById('wonderDim');
  const card = document.getElementById('wonderCard');
  const titleEl = document.getElementById('wonderTitle');
  const tagsEl = document.getElementById('wonderTags');
  const mediaEl = document.getElementById('wonderMedia');
  const contentEl = document.getElementById('wonderContent');
  const closeBtn = document.getElementById('wonderClose');

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

  // Physics (Matter.js) if available; else fallback to GSAP float
  const hasMatter = typeof window.Matter !== 'undefined';
  let engine, RunnerRef, bodies = [], nodes = [];
  let running = true;
  let current = -1;

  function layoutBounds() {
    const r = worldEl.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  // Create chips
  data.forEach((item, i) => {
    const el = document.createElement('button');
    el.className = 'wtag';
    el.textContent = (item.title || `Item ${i+1}`).toUpperCase();
    worldEl.appendChild(el);
    nodes.push({ el, item });
  });

  if (hasMatter) {
    const { Engine, Runner, World, Bodies, Body, Events, Composite } = Matter;
    engine = Engine.create();
    RunnerRef = Runner.create();
    Runner.run(RunnerRef, engine);

    function addWalls() {
      const { w, h } = layoutBounds();
      const walls = [
        Bodies.rectangle(w/2, -50, w+200, 100, { isStatic: true }),
        Bodies.rectangle(w/2, h+50, w+200, 100, { isStatic: true }),
        Bodies.rectangle(-50, h/2, 100, h+200, { isStatic: true }),
        Bodies.rectangle(w+50, h/2, 100, h+200, { isStatic: true }),
      ];
      World.add(engine.world, walls);
      return walls;
    }
    let walls = addWalls();

    // Make a body for each label sized to its DOM box
    nodes.forEach(({ el }, i) => {
      const { w, h } = layoutBounds();
      // first set a temporary position so we can read size
      el.style.transform = `translate(${(Math.random()*w)|0}px, ${(Math.random()*h*0.5)|0}px)`;
      const bw = Math.max(60, el.offsetWidth);
      const bh = Math.max(28, el.offsetHeight);
      const body = Bodies.rectangle(
        40 + Math.random()*(w-80),
        40 + Math.random()*(h-160),
        bw, bh,
        { restitution: 0.9, friction: 0.001, frictionAir: 0.01 }
      );
      Body.setAngularVelocity(body, (Math.random()-0.5)*0.2);
      bodies.push(body);
      World.add(engine.world, body);
    });

    // Ticker: position DOM nodes from physics bodies
    Matter.Events.on(engine, 'afterUpdate', () => {
      for (let i = 0; i < nodes.length; i++) {
        const { el } = nodes[i];
        const b = bodies[i];
        el.style.transform = `translate(${(b.position.x - el.offsetWidth/2)}px, ${(b.position.y - el.offsetHeight/2)}px) rotate(${b.angle}rad)`;
      }
    });

    // Resize: rebuild walls
    const onResize = () => {
      const world = engine.world;
      walls.forEach(w => Matter.Composite.remove(world, w));
      walls = addWalls();
    };
    window.addEventListener('resize', onResize);

  } else {
    // Fallback: gentle float (no collisions)
    nodes.forEach(({ el }) => {
      const { w, h } = layoutBounds();
      const x = Math.random() * (w - 120);
      const y = Math.random() * (h - 160);
      el.style.transform = `translate(${x}px, ${y}px)`;
      gsap.to(el, {
        x: `random(-80,80,1)`,
        y: `random(-60,60,1)`,
        rotation: `random(-8,8)`,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    });
  }

  // Open card for index i
  function openCard(i) {
    current = i;
    const obj = nodes[i];
    // dots
    dots.forEach((d, k) => d.classList.toggle('active', k === i));
    // tag highlight
    nodes.forEach((n, k) => n.el.classList.toggle('active', k === i));

    // freeze physics
    if (hasMatter && running) {
      running = false;
      Runner.stop(RunnerRef);
    } else if (!hasMatter) {
      gsap.globalTimeline.pause();
    }

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

  // Close card
  function closeCard() {
    current = -1;
    nodes.forEach(n => n.el.classList.remove('active'));
    dim.hidden = true;
    card.hidden = true;

    if (hasMatter && !running) {
      running = true;
      Runner.run(RunnerRef, engine);
    } else if (!hasMatter) {
      gsap.globalTimeline.resume();
    }
  }

  // Click handlers
  nodes.forEach(({ el }, i) => {
    el.addEventListener('click', () => openCard(i));
  });
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
