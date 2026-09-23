/* ═══════════════════════════════════════════════════════════════════
   MERGVS live maquette
   A real MERGVS reconstruction (Luxembourg corner block) rendered in
   real time behind the deck. Framing is expressed in fractions of the
   frame, so a phone in portrait gets the same composition as a 4K
   desktop: the camera re-fits instead of the layout changing.
   Configured per page through window.MGV_STAGE.
   ═══════════════════════════════════════════════════════════════════ */
const CFG = window.MGV_STAGE;
const canvas = document.getElementById('stage3d');
const plate = document.getElementById('plate');
const stLeft = document.getElementById('stLeft');
const spec = document.getElementById('spec');

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)');
const FOV = 34;
const TAN = Math.tan((FOV / 2) * Math.PI / 180);   /* half-height / distance */

function bail(msg) {
  if (plate) plate.classList.add('on');
  if (stLeft) stLeft.textContent = msg || 'Architectural plate';
}

const saveData = !!(navigator.connection && navigator.connection.saveData);
let gl = null;
try {
  gl = document.createElement('canvas').getContext('webgl2') ||
       document.createElement('canvas').getContext('webgl');
} catch (e) {}

if (!CFG || !canvas) { /* page has no stage */ }
else if (reduce.matches) bail('Architectural plate');
else if (saveData) bail('Data saver · plate');
else if (!gl) bail('WebGL unavailable');
else {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    boot().catch(err => { console.warn('[mergvs] stage disabled:', err); bail('Architectural plate'); });
  };
  /* the renderer + model are ~1.6 MB, so never block first paint with them */
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
  setTimeout(start, 1800);
}

/* maquette palette: a bronze-and-graphite study model at dusk */
const MAT = {
  siva_beyaz: { c: 0xC3B7A0 }, siva_ic: { c: 0x8E887B }, tas_rustik: { c: 0x8F8778, r: .92 },
  derz: { c: 0x6E675C }, sove_bej: { c: 0xAFA086 }, saceg: { c: 0xABA290 },
  oluk: { c: 0x6A6F70, m: .55, r: .42 },
  cati_arduvaz: { c: 0x3A4044, r: .7 }, cati_duz: { c: 0x32373A }, duz_teras: { c: 0x33383B },
  cinko: { c: 0x555C60, m: .65, r: .36 }, dograma: { c: 0x23282B }, panjur: { c: 0x2B3033 },
  cam: { c: 0x0C1013, r: .12, m: .1, e: 0x24382F, ei: .55 }, kapi: { c: 0x2A2320 },
  kanopi: { c: 0x2E3335, m: .5, r: .4 }, korkuluk: { c: 0x303538, m: .5, r: .45 },
  balkon_dosem: { c: 0xA79E8D }, garaj: { c: 0x2E3335 },
  asfalt: { c: 0x0E1113 }, avlu_tas: { c: 0x1A1D1E }, kaldirim: { c: 0x202426 },
  bordur: { c: 0x262A2C }, yol_tasi: { c: 0x171A1C }, cim: { c: 0x1B221B },
  tas_istinat: { c: 0x2A2C28 }, harpusta: { c: 0x3A3C36 }, kaide: { c: 0x202320 },
  cit_metal: { c: 0x2A2E30, m: .6, r: .4 },
  cali: { c: 0x242E22 }, cali_acik: { c: 0x2B3627 }, yaprak: { c: 0x283222 },
  sus_otu: { c: 0x2E3729 }, govde: { c: 0x2A2620 }
};
const HIDE = /^(araclar__|arsa__(asfalt|yol_tasi|kaldirim|bordur|cit_metal))/;
const FLAT = /^(govde|cephe|cati|arsa)$/;

async function boot() {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

  const lite = coarse.matches;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lite ? 1.4 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0A0C0B, 88, 380);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.5, 900);

  const key = new THREE.DirectionalLight(0xFFE3B4, 2.6);
  key.position.set(16, 58, 62);
  key.castShadow = !lite;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0007;
  key.shadow.normalBias = 0.05;
  const sc = key.shadow.camera, d = 32;
  sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 48; sc.far = 140;
  sc.updateProjectionMatrix();
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x8FB4DC, 1.15);
  rim.position.set(-54, 26, -36);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xC9A96B, 0.45);
  fill.position.set(58, 9, 14);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight(0x8399B4, 0x0B0E0C, 0.62));

  /* ── model ── */
  const meshes = [];
  const edges = new THREE.Group();
  edges.visible = false;
  scene.add(edges);
  let edgesBuilt = false;

  await new Promise((res, rej) => {
    new GLTFLoader().load(CFG.model || '/assets/3d/corner-block.glb', g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        if (HIDE.test(o.name || '')) { o.visible = false; return; }
        /* the export carries no NORMAL accessor, so derive it and shade the
           architecture flat so every plane reads as a crisp facet */
        if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        const grp = (o.name || '').split('__')[0];
        const mk = (o.name || '').split('__')[1] || '';
        const s = MAT[mk] || { c: 0x7E7A72 };
        const m = new THREE.MeshStandardMaterial({
          color: s.c,
          roughness: s.r != null ? s.r : 0.82,
          metalness: s.m != null ? s.m : 0.04,
          emissive: s.e != null ? s.e : 0x000000,
          emissiveIntensity: s.ei != null ? s.ei : 0,
          flatShading: FLAT.test(grp) && mk !== 'cam',
          envMapIntensity: 0.5
        });
        if (o.material && o.material.dispose) o.material.dispose();
        o.material = m;
        o.castShadow = !lite;
        o.receiveShadow = !lite;
        meshes.push(o);
      });
      scene.add(g.scene);
      res();
    }, undefined, rej);
  });

  if (CFG.info) {
    try {
      const i = await (await fetch(CFG.info)).json();
      const a = document.getElementById('sTri'), b = document.getElementById('sNod');
      if (a) a.textContent = i.ucgen.toLocaleString('en-GB');
      if (b) b.textContent = i.dugum;
    } catch (e) {}
  }

  /* the eight corners of what is actually visible, used to keep the subject
     optically centred whatever the camera is doing */
  const bounds = new THREE.Box3();
  function measureBounds() {
    bounds.makeEmpty();
    const b = new THREE.Box3();
    for (const o of meshes) {
      if (!o.visible) continue;
      b.setFromObject(o);
      if (!b.isEmpty()) bounds.union(b);
    }
  }
  measureBounds();
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3());
  function cornerList() {
    const lo = bounds.min, hi = bounds.max;
    let i = 0;
    for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z])
      corners[i++].set(x, y, z);
    return corners;
  }
  cornerList();
  const probe = new THREE.Vector3();
  let corrX = 0, corrY = 0, fitK = 1;

  /* ── framing ──
     fx / fy are fractions of the visible frame: fx -0.19 puts the subject
     19% of the frame width right of centre, fy -0.20 puts it 20% above. */
  const SHOTS = CFG.shots;
  const PORT = CFG.portrait || {};
  const PORT_DEF = { fx: 0, fy: -0.2, k: 1 };   /* aspect fit already handles distance */
  const VIEWS = CFG.views || null;
  const viewChapter = CFG.viewChapter != null ? CFG.viewChapter : -1;

  const cam = {
    az: SHOTS[0].az, el: SHOTS[0].el, d: SHOTS[0].d,
    tx: SHOTS[0].t[0], ty: SHOTS[0].t[1], tz: SHOTS[0].t[2],
    fx: SHOTS[0].fx, fy: SHOTS[0].fy || 0
  };
  const goal = Object.assign({}, cam);
  let opacity = SHOTS[0].o, opacityGoal = SHOTS[0].o;
  let chapter = 0, view = VIEWS ? Object.keys(VIEWS)[0] : null, drift = 0;
  let band = 0, bandTop = 0, bandBot = 0, frameTop = 0, frameBot = 1;
  let dens = window.__mgvFill ? window.__mgvFill(0) : 0;   /* 0..1 content density */
  let mx = 0, my = 0, pmx = 0, pmy = 0;
  const target = new THREE.Vector3();

  function portrait() { return innerHeight > innerWidth; }

  function aim() {
    const s = SHOTS[Math.min(chapter, SHOTS.length - 1)];
    const v = (VIEWS && chapter === viewChapter && view) ? VIEWS[view] : null;
    const p = portrait() ? Object.assign({}, PORT_DEF, PORT[chapter] || {}) : null;
    goal.az = v ? v.az : s.az;
    goal.el = v ? v.el : s.el;
    goal.d = (v ? v.d : s.d) * (p ? p.k : 1);
    goal.tx = s.t[0]; goal.ty = s.t[1]; goal.tz = s.t[2];
    goal.fx = s.fx;
    if (p) {
      goal.fx = p.fx;
      /* portrait: a light chapter leaves the maquette a band of its own at the
         top and it is framed there, whole. A dense chapter takes the frame, so
         the maquette comes back to the centre and drops to a wash rather than
         being cut into a strip along the top edge. */
      /* the deck says how much of the frame it left to the stage. The
         maquette is framed inside that band, centred in it and sized to it,
         so it is never a strip along the top edge or a shape under the text. */
      const bd = clamp(band, 0, 1);
      if (bd > 0.12) {
        /* the band is given as window fractions, and the canvas is the
           window, so the mark is simply its middle */
        goal.fy = (bandTop + bandBot) / 2 - 0.5;
        goal.d *= 1 + (0.52 - (bandBot - bandTop)) * 0.72;
        opacityGoal = s.po != null ? s.po : Math.min(1, s.o + 0.18);
      } else {
        goal.fy = (frameTop + frameBot) / 2 - 0.5;
        goal.d *= 1.1;
        opacityGoal = 0.08;
      }
    } else {
      /* wide viewport: a text-dense chapter pushes the maquette further out of
         frame and quiets it, so nothing is read over a render */
      const t = clamp((dens - 0.5) / 0.45, 0, 1);
      goal.fx = s.fx - 0.09 * t;
      /* the maquette sits in the middle of the frame it is given, on every
         chapter and in every camera view: the chrome takes a slice off the
         top and the bottom, so the middle is the deck's, not the window's */
      goal.fy = (frameTop + frameBot) / 2 - 0.5;
      opacityGoal = s.o * (1 - 0.5 * t);
    }
  }
  aim();

  window.addEventListener('mgv:chapter', e => {
    chapter = e.detail.index;
    if (e.detail.fill != null) dens = e.detail.fill;
    if (e.detail.band != null) band = e.detail.band;
    if (e.detail.top != null) bandTop = e.detail.top;
    if (e.detail.bottom != null) bandBot = e.detail.bottom;
    if (e.detail.frameTop != null) frameTop = e.detail.frameTop;
    if (e.detail.frameBot != null) frameBot = e.detail.frameBot;
    aim(); syncSpec();
  });
  window.addEventListener('pointermove', e => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });

  function syncSpec() { if (spec) spec.classList.toggle('on', chapter === 0); }

  /* ── camera chips ── */
  const chipBox = document.getElementById('chips');
  const note = document.getElementById('chipnote');
  function tellView() {
    if (!note) return;
    const l = (CFG.viewLabels || {})[view] || view || '';
    note.textContent = (CFG.noteText || 'Live · real-time camera') + (l ? ' · ' + l : '') +
      (xray && xray.getAttribute('aria-pressed') === 'true' ? ' · x-ray' : '');
  }
  if (chipBox && VIEWS) {
    chipBox.querySelectorAll('[data-view]').forEach(b => {
      b.addEventListener('click', () => {
        view = b.dataset.view;
        chipBox.querySelectorAll('[data-view]').forEach(o =>
          o.setAttribute('aria-pressed', o === b ? 'true' : 'false'));
        aim(); tellView();
      });
    });
  }

  const xray = document.getElementById('xray');
  if (xray) {
    xray.addEventListener('click', () => {
      const on = xray.getAttribute('aria-pressed') !== 'true';
      xray.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && !edgesBuilt) {
        edgesBuilt = true;
        const em = new THREE.LineBasicMaterial({ color: 0xC2A26A, transparent: true, opacity: 0.5 });
        meshes.forEach(m => {
          if (!m.visible || !m.geometry) return;
          const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 24), em);
          m.updateWorldMatrix(true, false);
          l.applyMatrix4(m.matrixWorld);
          edges.add(l);
        });
      }
      edges.visible = on;
      tellView();
      meshes.forEach(m => {
        m.material.transparent = on;
        m.material.opacity = on ? 0.10 : 1;
        m.material.depthWrite = !on;
        m.material.needsUpdate = true;
      });
    });
  }
  tellView();

  /* ── reveal ── */
  window.__mgv3d = 'ready';
  canvas.classList.add('on');
  if (plate) plate.classList.add('off');
  if (stLeft) stLeft.textContent = CFG.status || 'Real-time 3D · WebGL';
  syncSpec();

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    aim();
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  /* ── loop ── */
  const fpsEl = document.getElementById('sFps');
  let t0 = performance.now(), fAcc = 0, fN = 0, hidden = false, lastOp = '';
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });

  (function frame(now) {
    requestAnimationFrame(frame);
    if (hidden) return;
    const dt = Math.min((now - t0) / 1000, 0.05); t0 = now;

    drift += dt * 0.016;
    pmx += (mx - pmx) * 0.045;
    pmy += (my - pmy) * 0.045;

    const k = 1 - Math.pow(0.0009, dt);
    cam.az += (goal.az + drift + pmx * 0.075 - cam.az) * k;
    cam.el += (goal.el - pmy * 0.05 - cam.el) * k;
    cam.d += (goal.d - cam.d) * k;
    cam.tx += (goal.tx - cam.tx) * k;
    cam.ty += (goal.ty - cam.ty) * k;
    cam.tz += (goal.tz - cam.tz) * k;
    cam.fx += (goal.fx - cam.fx) * k;
    cam.fy += (goal.fy - cam.fy) * k;
    opacity += (opacityGoal - opacity) * k;

    /* hold the subject at the same place in the frame whatever the aspect */
    const a = camera.aspect;
    const fit = a >= 1 ? clamp(1.62 / a, 0.88, 1.9) : clamp(1.07 / a, 1.15, 2.6);
    const de = cam.d * fit * fitK;
    const halfH = de * TAN;
    const ce = Math.max(0.02, Math.min(1.25, cam.el));

    camera.position.set(
      cam.tx + de * Math.cos(ce) * Math.sin(cam.az),
      cam.ty + de * Math.sin(ce),
      cam.tz + de * Math.cos(ce) * Math.cos(cam.az)
    );
    target.set(cam.tx, cam.ty, cam.tz);
    camera.lookAt(target);
    camera.translateX((cam.fx + corrX) * halfH * a * 2);
    camera.translateY((cam.fy + corrY) * halfH * 2);

    /* measure where the subject actually landed and close the gap. The mark
       is where fx / fy say it should be, so the model reads as centred in
       its part of the frame at every camera angle, not just the default one. */
    camera.updateMatrixWorld();
    let lox = 2, hix = -2, loy = 2, hiy = -2;
    for (let i = 0; i < 8; i++) {
      probe.copy(corners[i]).project(camera);
      if (probe.x < lox) lox = probe.x;
      if (probe.x > hix) hix = probe.x;
      if (probe.y < loy) loy = probe.y;
      if (probe.y > hiy) hiy = probe.y;
    }
    if (hix > lox) {
      const gain = 1 - Math.pow(0.0008, dt);
      corrX = clamp(corrX + (((lox + hix) / 2 + 2 * cam.fx) / 2) * gain, -0.6, 0.6);
      corrY = clamp(corrY + (((loy + hiy) / 2 + 2 * cam.fy) / 2) * gain, -0.6, 0.6);

      /* and it has to fit the room it is centred in. The mark has an edge on
         either side; the nearer one sets the limit, and the camera steps back
         until the whole subject is inside it. It never steps closer than the
         shot intends. */
      const mx = -2 * cam.fx, my = -2 * cam.fy;
      const tall = innerHeight > innerWidth;
      const roomY = tall && (bandBot - bandTop) > 0.12
        ? (bandBot - bandTop) * 0.94
        : Math.max(0.12, Math.min(1 - my, 1 + my)) * 0.95;
      let over = (hiy - loy) / 2 / roomY;
      if (tall) {
        /* on a phone the band is a box and nothing may hang out of it */
        const roomX = Math.max(0.12, Math.min(1 - mx, 1 + mx)) * 0.97;
        over = Math.max(over, (hix - lox) / 2 / roomX);
      } else {
        /* on a wide screen the maquette is composed to run past the right
           edge, but never so far that the building stops reading */
        const out = Math.max(hix - 1.17, -1.17 - lox);
        if (out > 0) over = Math.max(over, (hix - lox + out * 2) / (hix - lox));
      }
      fitK += (Math.max(1, fitK * over) - fitK) * gain * 0.5;
      fitK = clamp(fitK, 1, 2.4);
    }

    const os = opacity.toFixed(3);
    if (os !== lastOp) { canvas.style.opacity = os; lastOp = os; }
    renderer.render(scene, camera);

    fAcc += dt; fN++;
    if (fAcc >= 1 && fpsEl) { fpsEl.textContent = Math.round(fN / fAcc); fAcc = 0; fN = 0; }
  })(performance.now());

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  window.__mgvStage = { THREE, renderer, scene, camera, key, meshes };
}
