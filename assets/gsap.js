document.addEventListener("DOMContentLoaded", () => {
  const scatterContainer = document.getElementById("scatter");
  const nameCenter = document.getElementById("name-center");
  const stage1 = document.getElementById("stage1");
  const stage2 = document.getElementById("stage2");
  const homeNav = document.getElementById("home-nav");
  const compositionContainer = document.getElementById("composition-container");
  const nameFixed = document.getElementById("name-fixed");

  if (!scatterContainer || !nameCenter || !compositionContainer || !nameFixed) return;

  const WORD = "COMPOSITION";
  const scatterLetters = [];

  // ---------- Helpers ----------
  const waitForFonts = () =>
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
      .catch(() => Promise.resolve());

  const debounce = (fn, ms = 120) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  // ---------- Build 3× COMPOSITION ----------
  for (let i = 0; i < 3; i++) {
    for (const ch of WORD) {
      const span = document.createElement("span");
      span.textContent = ch;
      scatterContainer.appendChild(span);
      scatterLetters.push(span);
    }
  }

  // ---------- Non-overlapping initial scatter ----------
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

  // ---------- Stage 1: floating scatter ----------
  scatterLetters.forEach((letter) => {
    const { x, y } = generateNonOverlappingPosition();
    letter.style.left = x;
    letter.style.top = y;

    gsap.set(letter, {
      x: x,
      y: y,
      opacity: 0.25,
      fontSize: "7.2rem",
    });

    gsap.to(letter, {
      duration: 40,
      x: x + (Math.random() * 60 - 30),
      y: y + (Math.random() * 60 - 30),
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  });

  // ---------- Align target position layout ----------
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

  // ---------- Click to transition: scatter → compose ----------
  nameCenter.addEventListener("click", async () => {
    gsap.killTweensOf(scatterLetters);

    stage2.style.display = "block";
    compositionContainer.innerHTML = "";

    for (const ch of WORD) {
      const span = document.createElement("span");
      span.textContent = ch;
      compositionContainer.appendChild(span);
    }

    await waitForFonts();
    if (document.readyState !== "complete") {
      await new Promise(r => window.addEventListener("load", r, { once: true }));
    }

    alignStage2();

    const finalLetters = [...compositionContainer.querySelectorAll("span")];
    const nameBox = nameFixed.getBoundingClientRect();
    const compWidth = WORD.length * 60;
    const baseX = nameBox.right - compWidth;
    const baseY = window.innerHeight / 2 - 9 * 16;

    finalLetters.forEach((_, i) => {
      const letter = scatterLetters[i];
      const currentX = parseFloat(letter.style.left || "0");
      const currentY = parseFloat(letter.style.top || "0");

      gsap.to(letter, {
        x: baseX + i * 60 - currentX,
        y: baseY - currentY,
        fontSize: "7.2rem",
        opacity: 0.25,
        duration: 1.5,
        ease: "power3.inOut",
        delay: i * 0.05
      });
    });

    // Fade out the remaining letters
    scatterLetters.slice(11).forEach(letter => {
      gsap.to(letter, {
        opacity: 0,
        y: "+=40",
        scale: 0.9,
        duration: 1.5,
        ease: "sine.inOut",
        delay: 0.3
      });
    });

    // Fade in stage 2 and nav
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
