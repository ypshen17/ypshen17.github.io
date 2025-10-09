(() => {
  const fallback = {
    setPaperTexture: () => {},
    setBrushTexture: (url) => {
      const brush = document.getElementById('introBrush');
      if (brush) {
        brush.style.backgroundImage = `url('${url}')`;
        brush.style.backgroundSize = 'cover';
      }
    },
    showShelf: () => {},
    transitionTo: () => {},
    revealPlant: () => {},
    plantSeed: () => {},
    splash: () => {},
    setMotion: () => {},
    introComplete: () => {},
  };

  function publishReady(detail) {
    document.dispatchEvent(new CustomEvent('funwith:ready', { detail }));
  }

  const stageHost = document.getElementById('fxStage');
  if (!stageHost) {
    publishReady(fallback);
    return;
  }

  ensurePixi()
    .then(() => run())
    .catch((err) => {
      console.error('PIXI garden error', err);
      publishReady(fallback);
    });

  let pixiPromise = null;

  function ensurePixi() {
    if (window.PIXI) return Promise.resolve(window.PIXI);
    if (pixiPromise) return pixiPromise;
    const url = window.__GARDEN__?.pixi || 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.1.5/pixi.min.js';
    pixiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.onload = () => {
        if (window.PIXI) {
          resolve(window.PIXI);
        } else {
          reject(new Error('PIXI loaded without global namespace'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PIXI.js'));
      document.head.appendChild(script);
    });
    return pixiPromise;
  }

  async function run() {
    const PIXI = window.PIXI;
    if (!PIXI) throw new Error('PIXI unavailable after load');
    const motion = { on: true };
    const app = new PIXI.Application();
    await app.init({ backgroundAlpha: 0, resizeTo: window, antialias: true });
    stageHost.appendChild(app.canvas);

    const root = new PIXI.Container();
    app.stage.addChild(root);

    const paperLayer = new PIXI.Sprite(PIXI.Texture.WHITE);
    paperLayer.anchor.set(0.5);
    paperLayer.tint = 0xFBF8F1;
    root.addChild(paperLayer);

    const washLayer = new PIXI.Sprite(PIXI.Texture.WHITE);
    washLayer.anchor.set(0.5);
    washLayer.alpha = 0;
    washLayer.tint = 0xCEE0F2;
    root.addChild(washLayer);

    const shelfLayer = new PIXI.Container();
    root.addChild(shelfLayer);
    const shelfA = createShelfSprite();
    const shelfB = createShelfSprite();
    shelfLayer.addChild(shelfA, shelfB);

    const revealLayer = new PIXI.Container();
    root.addChild(revealLayer);
    let revealSprite = null;
    let maskSprite = null;

    const dustLayer = new PIXI.Container();
    root.addChild(dustLayer);
    const dustParticles = generateDust(dustLayer, 26);

    const seedLayer = new PIXI.Container();
    root.addChild(seedLayer);

    const splashLayer = new PIXI.Container();
    root.addChild(splashLayer);

    const introBrushLayer = new PIXI.Container();
    root.addChild(introBrushLayer);
    let introBrush = null;

    layout();
    window.addEventListener('resize', layout);

    app.ticker.add((ticker) => {
      swayShelf(shelfA, 0.8);
      swayShelf(shelfB, -0.5);
      animateDust(dustParticles, ticker.deltaMS / 1000, motion.on);
      if (maskSprite) {
        maskSprite.scale.x += (maskSprite.targetScale - maskSprite.scale.x) * 0.05;
        maskSprite.scale.y = maskSprite.scale.x;
        if (Math.abs(maskSprite.scale.x - maskSprite.targetScale) < 0.02) {
          maskSprite.scale.set(maskSprite.targetScale);
          maskSprite = null;
        }
      }
    });

    publishReady({
      setPaperTexture,
      setBrushTexture,
      showShelf,
      transitionTo,
      revealPlant,
      plantSeed,
      splash,
      setMotion,
      introComplete,
    });

    function layout() {
      const { width, height } = app.renderer.screen;
      paperLayer.position.set(width / 2, height / 2);
      washLayer.position.set(width / 2, height / 2);
      scaleToCover(paperLayer, width, height, 1.05);
      scaleToCover(washLayer, width, height, 1.18);
      shelfA.position.set(width / 2, height * 0.23);
      shelfB.position.set(width / 2, height * 0.23);
      if (revealSprite) {
        revealSprite.position.set(width / 2, height * 0.6);
        if (maskSprite) {
          maskSprite.position.set(revealSprite.x, revealSprite.y - revealSprite.height * 0.42);
        }
      }
      introBrushLayer.position.set(width / 2, height * 0.25);
    }

    async function setPaperTexture(url) {
      try {
        const texture = await PIXI.Assets.load(url);
        paperLayer.texture = texture;
        layout();
      } catch (err) {
        console.warn('Paper texture failed', err);
      }
    }

    async function setBrushTexture(url) {
      try {
        const texture = await PIXI.Assets.load(url);
        if (!introBrush) {
          introBrush = new PIXI.Sprite(texture);
          introBrush.anchor.set(0.5);
          introBrush.alpha = 0;
          introBrushLayer.addChild(introBrush);
        } else {
          introBrush.texture = texture;
        }
        introBrush.scale.set(0.72);
      } catch (err) {
        console.warn('Brush texture failed', err);
      }
      const domBrush = document.getElementById('introBrush');
      if (domBrush) {
        domBrush.style.backgroundImage = `url('${url}')`;
        domBrush.style.backgroundSize = 'cover';
      }
    }

    async function showShelf(which = 'A') {
      if (which === 'A' && !shelfA.texture.__loaded) await loadShelfTexture(shelfA, 'shelf_a.png');
      if (which === 'B' && !shelfB.texture.__loaded) await loadShelfTexture(shelfB, 'shelf_b.png');
      fadeSprite(which === 'A' ? shelfA : shelfB, 1);
      fadeSprite(which === 'A' ? shelfB : shelfA, 0);
    }

    function transitionTo(scene) {
      blendWash(scene === 'focus' ? 0.18 : 0);
    }

    async function revealPlant(url) {
      try {
        if (maskSprite) {
          revealLayer.removeChild(maskSprite);
          maskSprite.destroy();
          maskSprite = null;
        }
        const texture = await PIXI.Assets.load(url);
        if (!revealSprite) {
          revealSprite = new PIXI.Sprite(texture);
          revealSprite.anchor.set(0.5, 1);
          revealLayer.addChild(revealSprite);
        } else {
          revealSprite.texture = texture;
        }
        layout();
        revealSprite.alpha = 1;
        const maskGraphics = new PIXI.Graphics();
        maskGraphics.beginFill(0xffffff).drawCircle(0, 0, 20).endFill();
        const maskTexture = app.renderer.generateTexture(maskGraphics);
        maskSprite = new PIXI.Sprite(maskTexture);
        maskSprite.anchor.set(0.5);
        maskSprite.scale.set(0.2);
        maskSprite.targetScale = Math.max(app.renderer.screen.width, app.renderer.screen.height) / 160;
        maskSprite.position.set(revealSprite.x, revealSprite.y - revealSprite.height * 0.45);
        revealLayer.addChild(maskSprite);
        revealSprite.mask = maskSprite;
      } catch (err) {
        console.warn('Reveal failed', err);
      }
    }

    function plantSeed() {
      const seed = new PIXI.Graphics();
      seed.beginFill(0xC86A3C, 0.92).drawCircle(0, 0, 6).endFill();
      seed.position.set(app.renderer.screen.width / 2, app.renderer.screen.height * 0.22);
      seedLayer.addChild(seed);
      let life = 1.6;
      app.ticker.add(function tick(delta) {
        life -= delta / 60;
        seed.y += 240 * (delta / 60);
        seed.alpha = Math.max(0, life / 1.6);
        seed.scale.set(1 + Math.sin((1.6 - life) * Math.PI) * 0.18);
        if (life <= 0 || seed.y > app.renderer.screen.height * 0.62) {
          seedLayer.removeChild(seed);
          seed.destroy();
          app.ticker.remove(tick);
        }
      });
    }

    function splash(clientX, clientY) {
      const point = app.stage.toLocal(new PIXI.Point(clientX, clientY));
      for (let i = 0; i < 5; i++) {
        const drop = new PIXI.Graphics();
        drop.beginFill(0x8FB5D6, 0.7).drawCircle(0, 0, 3).endFill();
        drop.position.set(point.x + (Math.random() - 0.5) * 30, point.y - Math.random() * 20);
        splashLayer.addChild(drop);
        let life = 1.2;
        const vx = (Math.random() - 0.5) * 50;
        const vy = 20 + Math.random() * 20;
        app.ticker.add(function drip(delta) {
          life -= delta / 60;
          drop.x += vx * (delta / 60);
          drop.y += vy * (delta / 60);
          drop.alpha = Math.max(0, life / 1.2);
          if (life <= 0) {
            splashLayer.removeChild(drop);
            drop.destroy();
            app.ticker.remove(drip);
          }
        });
      }
    }

    function setMotion(on) {
      motion.on = on;
    }

    function introComplete() {
      if (!introBrush) return;
      const startY = introBrush.position.y;
      let phase = 0;
      app.ticker.add(function swing(delta) {
        phase += delta / 60;
        introBrush.alpha = Math.min(1, introBrush.alpha + 0.05);
        introBrush.y = startY + Math.sin(phase * 2) * (motion.on ? 8 : 2);
        if (introBrush.alpha >= 1) {
          app.ticker.remove(swing);
          fadeOutBrush();
        }
      });
    }

    function fadeOutBrush() {
      let life = 2.4;
      app.ticker.add(function fade(delta) {
        life -= delta / 60;
        if (!introBrush) return;
        introBrush.alpha = Math.max(0, life / 2.4);
        if (life <= 0) {
          introBrush.alpha = 0;
          app.ticker.remove(fade);
        }
      });
    }

    function blendWash(targetAlpha) {
      app.ticker.add(function fade(delta) {
        const diff = targetAlpha - washLayer.alpha;
        washLayer.alpha += diff * 0.08 * (delta / 60);
        if (Math.abs(diff) < 0.01) {
          washLayer.alpha = targetAlpha;
          app.ticker.remove(fade);
        }
      });
    }

    async function loadShelfTexture(sprite, filename) {
      try {
        const base = window.__GARDEN__?.assets || '';
        const url = `${base}/garden/art/shelf/${filename}`;
        const texture = await PIXI.Assets.load(url);
        sprite.texture = texture;
        sprite.texture.__loaded = true;
        layout();
      } catch (err) {
        console.warn('Shelf texture missing', err);
      }
    }

    function fadeSprite(sprite, target) {
      app.ticker.add(function fade(delta) {
        sprite.alpha += (target - sprite.alpha) * 0.1 * (delta / 60);
        if (Math.abs(sprite.alpha - target) < 0.01) {
          sprite.alpha = target;
          app.ticker.remove(fade);
        }
      });
    }

    function createShelfSprite() {
      const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      sprite.anchor.set(0.5, 0.15);
      sprite.alpha = 0;
      return sprite;
    }

    function swayShelf(sprite, amount) {
      if (!motion.on) return;
      sprite.y += Math.sin(performance.now() * 0.00025 * amount) * 0.12;
    }

    function generateDust(layer, count) {
      const particles = [];
      for (let i = 0; i < count; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(0xffffff, 0.16).drawCircle(0, 0, Math.random() * 2 + 1).endFill();
        resetDust(particle, true);
        layer.addChild(particle);
        particles.push(particle);
      }
      return particles;
    }

    function animateDust(particles, delta, motionOn) {
      particles.forEach((p) => {
        p.y -= (12 + p.speed) * delta * (motionOn ? 1 : 0);
        p.x += Math.sin(performance.now() * 0.001 + p.seed) * 0.08;
        if (p.y < -20 || p.x < -20 || p.x > app.renderer.screen.width + 20) {
          resetDust(p, false);
        }
      });
    }

    function resetDust(particle, initial) {
      const { width, height } = app.renderer.screen;
      particle.x = Math.random() * width;
      particle.y = initial ? Math.random() * height : height + Math.random() * 30;
      particle.speed = Math.random() * 12;
      particle.seed = Math.random() * 1000;
    }

    function scaleToCover(sprite, width, height, multiplier = 1) {
      const tex = sprite.texture;
      if (!tex?.width || !tex?.height) return;
      const scale = Math.max(width / tex.width, height / tex.height) * multiplier;
      sprite.scale.set(scale);
    }
  }
})();
