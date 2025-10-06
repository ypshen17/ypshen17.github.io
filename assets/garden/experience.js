(() => {
  if (!window.PIXI) return console.warn('PixiJS not loaded');
  const CFG = window.__GARDEN__ || {};
  const ASSETS = CFG.assets || '';
  const mount = document.getElementById('fxStage');

  const app = new PIXI.Application({ backgroundAlpha: 0, resizeTo: window });
  mount.appendChild(app.view);

  // Paper with subtle grain
  const paperTex = PIXI.Texture.from(`${ASSETS}/garden/art/paper/paper_bg.jpg`);
  const paper = new PIXI.Sprite(paperTex); paper.anchor.set(0.5);
  app.stage.addChild(paper);
  const paperFilter = new PIXI.Filter(undefined, `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler; uniform float uTime;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p);
      float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
      vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
    void main(){ vec4 base = texture2D(uSampler, vTextureCoord);
      float n = noise(vTextureCoord*800. + vec2(uTime*0.05, 0.0));
      gl_FragColor = vec4(base.rgb * (1.0 + (n-0.5)*0.02), base.a);
    }`, { uTime: 0 });
  paper.filters = [paperFilter];

  function layout(){
    paper.x = app.renderer.width/2; paper.y = app.renderer.height/2;
    const s = Math.max(app.renderer.width / paperTex.width, app.renderer.height / paperTex.height) * 1.02;
    paper.scale.set(s); placeShelf(shelfA); placeShelf(shelfB);
    if (revealSprite) {
      revealSprite.x = app.renderer.width/2; revealSprite.y = app.renderer.height*0.58;
      if (maskSprite) { maskSprite.x = revealSprite.x; maskSprite.y = revealSprite.y - revealSprite.height*0.4; }
    }
  }
  window.addEventListener('resize', layout);

  const shelfA = PIXI.Sprite.from(`${ASSETS}/garden/art/shelf/shelf_a.png`);
  const shelfB = PIXI.Sprite.from(`${ASSETS}/garden/art/shelf/shelf_b.png`);
  [shelfA, shelfB].forEach(s=>{ s.anchor.set(0.5,0); s.alpha=0; app.stage.addChild(s); });
  function placeShelf(s){ s.x = app.renderer.width/2; s.y = app.renderer.height*0.22; }

  const revealLayer = new PIXI.Container(); app.stage.addChild(revealLayer);
  let revealSprite=null, maskSprite=null, maskGfx=null;

  function maskedReveal(url){
    revealLayer.removeChildren();
    revealSprite = PIXI.Sprite.from(url); revealSprite.anchor.set(0.5,1.0);
    revealSprite.x = app.renderer.width/2; revealSprite.y = app.renderer.height*0.58;
    revealLayer.addChild(revealSprite);

    maskGfx = new PIXI.Graphics(); maskGfx.beginFill(0xffffff).drawCircle(0,0,10).endFill();
    maskSprite = new PIXI.Sprite(app.renderer.generateTexture(maskGfx)); maskSprite.anchor.set(0.5);
    maskSprite.x = revealSprite.x; maskSprite.y = revealSprite.y - revealSprite.height*0.4; revealLayer.addChild(maskSprite);
    revealSprite.mask = maskSprite;

    let r=10, maxR=Math.max(app.renderer.width, app.renderer.height)*0.9;
    const bloom = ()=>{ r += (maxR - r)*0.12; maskGfx.clear().beginFill(0xffffff).drawCircle(0,0,r).endFill();
      maskSprite.texture = app.renderer.generateTexture(maskGfx);
      if (maxR - r < 2) app.ticker.remove(bloom);
    };
    app.ticker.add(bloom);
  }

  let t=0;
  app.ticker.add((dt)=>{ t += dt*0.004; paperFilter.uniforms.uTime += dt/60;
    const sway = Math.sin(t)*0.8; [shelfA,shelfB,revealLayer].forEach(s => s.position.y += sway*0.05);
  });

  layout();
  window.FUNWITH = {
    showShelf(which='A'){
      const target = which==='A'? shelfA : shelfB; const other = which==='A'? shelfB : shelfA;
      placeShelf(target); placeShelf(other);
      app.ticker.add(function fade(){
        target.alpha = Math.min(1, target.alpha + 0.06);
        other.alpha  = Math.max(0, other.alpha  - 0.06);
        if (Math.abs(target.alpha-1)<0.01 && other.alpha<0.01) app.ticker.remove(fade);
      });
    },
    revealPlant: maskedReveal
  };
})();
