/* 3D-Ansicht für Farbchaos. Bekommt dieselbe Sicht V wie die 2D-Ansicht.
   FC3D.load() -> Promise   FC3D.init(hostEl, api)   FC3D.update(V, inp, instant)   FC3D.setActive(bool)
   api: { CARDS, COLN, sym(card), cyber(), sfx(name), onCard(id), onDraw() }                               */
(function () {
  var CW = 2.4, CH = 3.6, MAXV = 14, HEXR = 1.1547;
  var F = window.FC3D = { ready: false };
  var host, api, r, scene, camera, controls, world, env = [], cards = {}, labels = {}, tw = [], fx = [], texCache = {}, geo = null, geoStyle = '';
  var shGeo, shTex, ray, mouse, lastV = null, lastInp = null, hoverId = null, down = null, active = false, rain = null, room = null, lastT = 0, lastR = 0, camD = 40;
  var dirRing = null, colDisc = null, colRing = null, glows = {}, backMat = null, curStyle = '';
  var HEX = ['#e53935', '#f9a825', '#2e9a4a', '#1e6fd0'], NEON = ['#ff2a55', '#fcee09', '#2dff7a', '#00b4ff'];
  var DECK = { x: -4.6, z: 0 }, DISC = { x: 3.4, z: 0 };

  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
  F.load = function () {
    if (window.THREE && THREE.OrbitControls) return Promise.resolve();
    return ['build/three.min.js', 'examples/js/controls/OrbitControls.js'].reduce(function (pr, u) {
      return pr.then(function () {
        if (u.indexOf('OrbitControls') < 0 && window.THREE) return;
        return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = CDN + u; s.onload = res; s.onerror = function () { rej(new Error(u)); }; document.head.appendChild(s); });
      });
    }, Promise.resolve());
  };
  function cyber() { return api.cyber(); }

  // ---------- Form und Texturen ----------
  function shapeFor(cy) {
    var s = new THREE.Shape(), w = CW / 2, h = CH / 2;
    if (cy) {
      var k = .25 * CH;
      s.moveTo(0, h); s.lineTo(w, h - k); s.lineTo(w, -h + k); s.lineTo(0, -h); s.lineTo(-w, -h + k); s.lineTo(-w, h - k); s.closePath();
    } else {
      var q = .26;
      s.moveTo(-w + q, -h); s.lineTo(w - q, -h); s.quadraticCurveTo(w, -h, w, -h + q); s.lineTo(w, h - q); s.quadraticCurveTo(w, h, w - q, h);
      s.lineTo(-w + q, h); s.quadraticCurveTo(-w, h, -w, h - q); s.lineTo(-w, -h + q); s.quadraticCurveTo(-w, -h, -w + q, -h);
    }
    return s;
  }
  function makeGeo(cy) {
    var g = new THREE.ShapeGeometry(shapeFor(cy), 6), p = g.attributes.position, uv = g.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + CW / 2) / CW, (p.getY(i) + CH / 2) / CH);
    uv.needsUpdate = true; return g;
  }
  function hexPath(x, w, h, k) { x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w, k); x.lineTo(w, h - k); x.lineTo(w / 2, h); x.lineTo(0, h - k); x.lineTo(0, k); x.closePath(); }
  function drawCard(c, back, cy) {
    var W = 256, H = cy ? Math.round(256 * HEXR) : 384, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var x = cv.getContext('2d');
    var wild = !back && c.col === 4, col = back ? (cy ? '#00f0ff' : '#15171c') : (wild ? '#222' : (cy ? NEON[c.col] : HEX[c.col]));
    var s = back ? '✦' : api.sym(c), small = s.length > 1;
    function wildFill(a) { var g = x.createLinearGradient(0, 0, W, H); ['#e53935', '#f9a825', '#2e9a4a', '#1e6fd0'].forEach(function (cc, i) { g.addColorStop(i / 3, cc); }); return g; }
    if (cy) {
      x.fillStyle = '#04070d'; x.fillRect(0, 0, W, H);
      hexPath(x, W, H, .25 * H); x.save(); x.clip();
      var bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b1424'); bg.addColorStop(1, '#04070d'); x.fillStyle = bg; x.fillRect(0, 0, W, H); x.restore();
      x.lineWidth = 16; x.strokeStyle = wild ? wildFill() : col; x.shadowColor = wild ? '#fff' : col; x.shadowBlur = 14; hexPath(x, W, H, .25 * H); x.stroke(); x.shadowBlur = 0;
    } else {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
      x.fillStyle = back ? '#15171c' : (wild ? '#222' : col); x.fillRect(14, 14, W - 28, H - 28);
      x.save(); x.translate(W / 2, H / 2); x.rotate(-.45); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, 92, 142, 0, 0, 6.3); x.fill();
      if (wild) { [0, 1, 2, 3].forEach(function (i) { x.fillStyle = HEX[i]; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 90, i * Math.PI / 2, (i + 1) * Math.PI / 2); x.fill(); }); }
      if (back) { x.fillStyle = '#e53935'; x.beginPath(); x.ellipse(0, 0, 92, 142, 0, 0, 6.3); x.fill(); }
      x.restore();
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    var big = (cy ? (small ? 78 : 118) : (small ? 96 : 150)) + 'px system-ui,sans-serif', tc = cy ? (wild ? '#fff' : col) : (wild ? '#fff' : (back ? '#fff' : col));
    x.font = 'bold ' + big;
    if (!cy && wild) { x.lineWidth = 10; x.strokeStyle = '#000'; x.strokeText(s, W / 2, H / 2 + 6); }
    if (cy) { x.shadowColor = wild ? '#00f0ff' : col; x.shadowBlur = 16; }
    x.fillStyle = tc; x.fillText(s, W / 2, H / 2 + 6); x.shadowBlur = 0;
    if (!back) {
      x.font = 'bold 40px system-ui,sans-serif'; x.fillStyle = cy ? (wild ? '#fff' : col) : '#fff';
      var cx0 = cy ? 62 : 44, cy0 = cy ? 84 : (small ? 62 : 56);
      x.font = 'bold ' + (cy ? 32 : 40) + 'px system-ui,sans-serif'; x.fillText(s, cx0, cy0); x.save(); x.translate(W, H); x.rotate(Math.PI); x.fillText(s, cx0, cy0); x.restore();
    }
    if (!back && c.spin && api.spinMode()) { x.font = (cy ? 44 : 56) + 'px system-ui,sans-serif'; x.fillStyle = '#fff'; x.fillText('🌀', W / 2, H - (cy ? 56 : 70)); }
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  function tex(c, back) {
    var key = (cyber() ? 'c' : 'k') + (back ? 'b' : c.id) + (!back && c.spin && api.spinMode() ? 's' : '');
    return texCache[key] || (texCache[key] = drawCard(c, back, cyber()));
  }

  // ---------- Aufbau ----------
  F.init = function (hostEl, apiObj) {
    if (F.ready) return;
    host = hostEl; api = apiObj;
    r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.appendChild(r.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, .1, 500);
    controls = new THREE.OrbitControls(camera, r.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minPolarAngle = .2; controls.maxPolarAngle = 1.25;
    controls.minAzimuthAngle = -.9; controls.maxAzimuthAngle = .9;
    world = new THREE.Group(); scene.add(world);
    var sc = document.createElement('canvas'); sc.width = sc.height = 64; var sx = sc.getContext('2d'), g = sx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.65)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = g; sx.fillRect(0, 0, 64, 64);
    shTex = new THREE.CanvasTexture(sc); shGeo = new THREE.PlaneGeometry(CW * 1.4, CH * 1.25); CH = cyber() ? CW * HEXR : 3.6;
    ray = new THREE.Raycaster(); mouse = new THREE.Vector2();
    buildEnv(); styleCheck();
    new MutationObserver(function () { buildEnv(); styleCheck(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'] });
    var el = r.domElement;
    el.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', function (e) {
      if (!down) return; var d = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (d > 6) return; var h = pickAt(e); if (!h) return; if (h === 'draw') api.onDraw(); else api.onCard(h);
    });
    el.addEventListener('pointermove', function (e) {
      if (down) return; var h = pickAt(e), mine = lastInp && lastInp.mode === 'turn';
      el.style.cursor = h && mine ? 'pointer' : 'grab';
      var hv = mine && typeof h === 'number' ? h : null;
      if (hv !== hoverId) { hoverId = hv; if (lastV) F.update(lastV, lastInp); }
    });
    addEventListener('resize', function () { if (active) F.resize(); });
    if (window.ResizeObserver) new ResizeObserver(function () { if (active) F.resize(); }).observe(host);
    requestAnimationFrame(function loop(now) { requestAnimationFrame(loop); if (active) tick(now); });
    setInterval(function () { var n = performance.now(); if (active && n - lastR > 400) tick(n); else runTw(n); }, 100);
    F.ready = true; F.resize();
  };
  F.setActive = function (a) { active = !!a; if (a) F.resize(); };
  F.resize = function () {
    var w = host.clientWidth || 600, h = host.clientHeight || 400;
    r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    var t = Math.tan(20 * Math.PI / 180), dh = 20.5 / (t * camera.aspect), dv = 17.5 / t;
    camD = Math.max(dh, dv) * 1.04; var el = 62 * Math.PI / 180;
    camera.position.set(0, camD * Math.sin(el), 1.2 + camD * Math.cos(el)); controls.target.set(0, 0, 1.2);
    controls.minDistance = camD * .5; controls.maxDistance = camD * 1.3; controls.update();
  };
  function styleCheck() {   // Kartenform hängt vom Stil ab: bei Wechsel alle Karten neu aufbauen
    var s = cyber() ? 'c' : 'k';
    if (s === curStyle) return; curStyle = s; CH = cyber() ? CW * HEXR : 3.6; shGeo = new THREE.PlaneGeometry(CW * 1.4, CH * 1.25); geo = makeGeo(cyber());
    Object.keys(cards).forEach(drop); backMat = null; lastKeep = null;
    if (lastV && F.ready) F.update(lastV, lastInp, true);
  }
  var lastKeep = null;

  function buildEnv() {
    env.forEach(function (o) { scene.remove(o); }); env = []; room = null; rain = null;
    var cy = cyber(), add = function (o) { scene.add(o); env.push(o); return o; };
    if (cy) {
      scene.fog = new THREE.FogExp2(0x05060b, .008); r.setClearColor(0x05060b);
      add(new THREE.AmbientLight(0x9aa8d0, 1));
      var lamp = new THREE.PointLight(0x00f0ff, .8, 90); lamp.position.set(0, 18, 2); add(lamp);
      var felt = new THREE.Mesh(new THREE.CircleGeometry(17.5, 64), new THREE.MeshStandardMaterial({ color: 0x07121c, roughness: .4, metalness: .5, emissive: 0x03101a }));
      felt.rotation.x = -Math.PI / 2; add(felt);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(17.6, .22, 8, 90), new THREE.MeshBasicMaterial({ color: 0x00f0ff })); rim.rotation.x = Math.PI / 2; rim.position.y = .05; add(rim);
      var grid = new THREE.GridHelper(300, 150, 0x00f0ff, 0x0b3f4a); grid.position.y = -2; grid.material.transparent = true; grid.material.opacity = .35; add(grid);
      var fl = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: 0x04050a })); fl.rotation.x = -Math.PI / 2; fl.position.y = -2.05; add(fl);
      if (window.Room3D) { rain = Room3D.rain(THREE, { count: 700, radius: 50, top: 28, bottom: -2 }); add(rain.obj); }
    } else {
      scene.fog = new THREE.Fog(0x1c2733, 80, 190); r.setClearColor(0x1c2733);
      if (window.Room3D) { room = Room3D.livingRoom(THREE, { half: 60, tableTopY: -.06, table: { shape: 'round', size: 36 } }); add(room.group); } else add(new THREE.AmbientLight(0xffe6c8, 1));
      var cloth = new THREE.Mesh(new THREE.CircleGeometry(18, 64), new THREE.MeshStandardMaterial({ color: 0x1d5f8f, roughness: .95 }));
      cloth.rotation.x = -Math.PI / 2; cloth.position.y = .02; add(cloth);
    }
    // Richtungsring und Farbscheibe (immer vorhanden, werden pro Sicht angepasst)
    if (colDisc) { world.remove(colDisc); world.remove(colRing); world.remove(dirRing); }
    colDisc = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35, depthWrite: false })); colDisc.rotation.x = -Math.PI / 2; colDisc.position.set(DISC.x, .03, DISC.z); world.add(colDisc);
    colRing = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.75, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, side: THREE.DoubleSide })); colRing.rotation.x = -Math.PI / 2; colRing.position.set(DISC.x, .04, DISC.z); world.add(colRing);
    dirRing = new THREE.Group(); dirRing.position.set(0, .05, 0);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2, tri = new THREE.Mesh(new THREE.CircleGeometry(.55, 3), new THREE.MeshBasicMaterial({ color: cy ? 0x00f0ff : 0xffffff, transparent: true, opacity: .5 }));
      tri.rotation.x = -Math.PI / 2; tri.rotation.z = -a - Math.PI / 2 + 0; tri.position.set(Math.cos(a) * 8.2, 0, Math.sin(a) * 8.2); dirRing.add(tri);
    }
    world.add(dirRing);
  }

  // ---------- Karten ----------
  function mk(key, t) {
    var cy = cyber(), c = t.id != null ? api.CARDS[t.id] : null, g = new THREE.Group();
    g.rotation.order = 'YXZ';
    if (!backMat) backMat = new THREE.MeshBasicMaterial({ map: tex(null, true), side: THREE.FrontSide });
    var front = new THREE.Mesh(geo, c ? new THREE.MeshBasicMaterial({ map: tex(c, false), side: THREE.FrontSide }) : backMat);
    front.position.z = .02;
    var back = new THREE.Mesh(geo, backMat); back.rotation.y = Math.PI; back.position.z = -.02;
    g.add(front); g.add(back); g.userData.id = c ? c.id : null; g.userData.key = key;
    front.userData.top = back.userData.top = g;
    world.add(g);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.18, CH * 1.1), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, depthWrite: false }));
    glow.position.z = -.05; g.add(glow);
    var sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: .5, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; world.add(sh);
    return cards[key] = { mesh: g, front: front, back: back, glow: glow, sh: sh, tg: null, key: key };
  }
  function drop(key) { var o = cards[key]; if (!o) return; world.remove(o.mesh); world.remove(o.sh); tw = tw.filter(function (w) { return w.o !== o; }); delete cards[key]; }
  function clearAll() { Object.keys(cards).forEach(drop); tw = []; }
  function near(a, b) { return Math.abs(a.x - b.x) < .01 && Math.abs(a.y - b.y) < .01 && Math.abs(a.z - b.z) < .01 && Math.abs(a.rx - b.rx) < .01 && Math.abs(a.ry - b.ry) < .01 && Math.abs(a.s - b.s) < .01; }
  function move(o, t, delay, instant) {
    var m = o.mesh;
    if (o.tg && near(o.tg, t)) return;
    o.tg = t; tw = tw.filter(function (w) { return w.o !== o; });
    if (instant) { m.position.set(t.x, t.y, t.z); m.rotation.set(t.rx, t.ry, 0); m.scale.setScalar(t.s); return; }
    var p0 = m.position.clone(), p1 = new THREE.Vector3(t.x, t.y, t.z), dist = p0.distanceTo(p1), far = dist >= 2.4;
    tw.push({ o: o, t0: performance.now() + (delay || 0), dur: far ? 430 + Math.min(420, dist * 20) : 170, p0: p0, p1: p1, rx0: m.rotation.x, rx1: t.rx, ry0: m.rotation.y, ry1: t.ry,
      s0: m.scale.x, s1: t.s, arc: far ? Math.min(3.8, .9 + dist * .1) : 0, snd: far ? t.snd : null, spin: (t.x > p0.x ? 1 : -1) * .35, far: far });
  }
  function runTw(now) {
    for (var i = tw.length - 1; i >= 0; i--) {
      var w = tw[i], k = Math.max(0, Math.min(1, (now - w.t0) / w.dur)), e = k * k * (3 - 2 * k), m = w.o.mesh, up = Math.sin(k * Math.PI);
      m.position.lerpVectors(w.p0, w.p1, e); m.position.y += up * w.arc;
      m.rotation.set(w.rx0 + (w.rx1 - w.rx0) * e, w.ry0 + (w.ry1 - w.ry0) * e + (w.far ? up * w.spin : 0), w.far ? up * w.spin * .6 : 0);
      m.scale.setScalar((w.s0 + (w.s1 - w.s0) * e) * (1 + (w.far ? .14 : 0) * up));
      if (k >= 1) { tw.splice(i, 1); if (w.snd) { api.sfx(w.snd); ring(w.p1.x, w.p1.z, w.snd === 'lay' ? 0xffffff : 0xffd23f); } }
    }
  }
  function ring(x, z, color) {
    var m = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 36), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .08, z); world.add(m); fx.push({ m: m, t0: performance.now() });
  }

  // ---------- Namensschilder und Markierung "dran" ----------
  function label(key, text, sub, hot, x, z) {
    var o = labels[key];
    if (!o) {
      var cv = document.createElement('canvas'); cv.width = 360; cv.height = 112;
      var t = new THREE.CanvasTexture(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
      sp.scale.set(8, 2.5, 1); sp.renderOrder = 10; world.add(sp); o = labels[key] = { sp: sp, cv: cv, tex: t, sig: '' };
    }
    o.sp.position.set(x, .8, z);
    var sig = [text, sub, hot, cyber()].join('|'); if (o.sig === sig) return; o.sig = sig;
    var c = o.cv.getContext('2d'), cy = cyber(); c.clearRect(0, 0, 360, 112);
    c.fillStyle = hot ? (cy ? 'rgba(252,238,9,.97)' : 'rgba(255,196,40,.97)') : (cy ? 'rgba(8,11,20,.88)' : 'rgba(10,20,40,.82)');
    c.beginPath(); if (c.roundRect) c.roundRect(4, 4, 352, 104, cy ? 4 : 18); else c.rect(4, 4, 352, 104); c.fill();
    c.lineWidth = 5; c.strokeStyle = hot ? '#fff' : (cy ? '#00f0ff' : '#9cc4ff'); c.stroke();
    c.textAlign = 'center'; c.fillStyle = hot ? '#1b1200' : '#fff'; c.font = 'bold 38px system-ui,sans-serif'; c.fillText((hot ? '▶ ' : '') + text, 180, 50);
    c.fillStyle = hot ? '#3a2a00' : '#ffd86b'; c.font = '28px system-ui,sans-serif'; c.fillText(sub, 180, 90);
    o.tex.needsUpdate = true;
  }
  function glowFor(key, x, z, yaw, hot) {
    var g = glows[key];
    if (!g) { g = glows[key] = new THREE.Mesh(new THREE.PlaneGeometry(13, 5.4), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, depthWrite: false })); g.rotation.x = -Math.PI / 2; g.rotation.order = 'YXZ'; world.add(g); }
    g.position.set(x, .06, z); g.rotation.y = yaw; g.userData.hot = hot;
  }

  // ---------- Plätze ----------
  function oppSlots(n) {
    if (n === 2) return [{ x: 0, z: -10.6, yaw: 0 }];
    if (n === 3) return [{ x: -9.5, z: -8, yaw: .5 }, { x: 9.5, z: -8, yaw: -.5 }];
    return [{ x: -13.5, z: 0, yaw: -Math.PI / 2 }, { x: 0, z: -10.6, yaw: 0 }, { x: 13.5, z: 0, yaw: Math.PI / 2 }];
  }

  F.update = function (V, inp, instant) {
    if (!F.ready || !V) return;
    var C = api.CARDS, nr = !lastV || lastV.round !== V.round || lastV.me !== V.me;
    if (nr) clearAll();
    lastV = V; lastInp = inp;
    var want = {}, order = [], i, j;
    function W(k, t) { want[k] = t; order.push(k); return t; }
    var mine = inp && inp.mode === 'turn';
    // Stapel
    var dn = Math.min(V.deckN, MAXV);
    for (j = 0; j < dn; j++) W('d' + j, { x: DECK.x, y: .1 + j * .05, z: DECK.z, rx: Math.PI / 2, ry: 0, s: 1.05, anon: 1 });
    // Ablage
    V.top.forEach(function (id, k) { var yaw = ((id * 37 % 25) - 12) * Math.PI / 180; W('c' + id, { id: id, x: DISC.x + ((id * 13 % 7) - 3) * .12, y: .12 + k * .05, z: DISC.z + ((id * 29 % 7) - 3) * .12, rx: -Math.PI / 2, ry: yaw, s: 1.25, snd: 'lay' }); });
    // Gegner
    var slots = oppSlots(V.n), opps = [];
    for (i = 1; i < V.n; i++) opps.push((V.me + i) % V.n);
    opps.forEach(function (seat, oi) {
      var sl = slots[oi], cnt = Math.min(V.counts[seat], MAXV), sp = Math.min(1.1, 11 / Math.max(1, cnt)), tx = Math.cos(sl.yaw), tz = -Math.sin(sl.yaw);
      for (j = 0; j < cnt; j++) {
        var off = (j - (cnt - 1) / 2) * sp;
        var dl = Math.hypot(sl.x, sl.z) || 1, arc = off * off * .035;   // Fächer: Mitte vorgewölbt, Karten leicht gedreht
        W('o' + seat + '_' + j, { x: sl.x + tx * off - sl.x / dl * arc, y: .1 + j * .012, z: sl.z + tz * off - sl.z / dl * arc, rx: Math.PI / 2, ry: sl.yaw + off * .07, s: .85, anon: 1, seat: seat });
      }
      glowFor('g' + seat, sl.x, sl.z, sl.yaw, V.cur === seat);
      var ol=Math.hypot(sl.x,sl.z)||1; label('l' + seat, V.names[seat], V.scores[seat] + ' P · ' + V.counts[seat] + ' Karten', V.cur === seat, sl.x + sl.x/ol*3.8, sl.z + sl.z/ol*3.8);
    });
    // eigene Hand
    var hn = V.hand.length, hsp = Math.min(2.5, 27 / Math.max(1, hn));
    V.hand.forEach(function (id, k) {
      var ok = !mine || inp.can.indexOf(id) >= 0, hv = hoverId === id && mine && ok, off = (k - (hn - 1) / 2) * hsp;
      W('c' + id, { id: id, x: off, y: CH * 1.18 / 2 * Math.sin(.78) + .45 + k * .012 + (mine && ok ? .5 : 0) + (hv ? 1.1 : 0), z: 10.4 + off * off * .004 - (hv ? .8 : 0), rx: -Math.PI / 2 + .78 - (hv ? .12 : 0), ry: 0, s: 1.18, snd: null, dim: mine && !ok, glow: mine && ok ? 1 : 0, hand: 1 });
    });
    glowFor('gme', 0, 10.4, 0, V.cur === V.me);
    label('lme', V.names[V.me], V.scores[V.me] + ' P · ' + V.counts[V.me] + ' Karten', V.cur === V.me, 0, 14.6);

    // entfernen / neu / bewegen
    var removed = {};
    Object.keys(cards).forEach(function (k) {
      if (want[k]) return;
      if (k[0] === 'o') { var s = k.split('_')[0].slice(1); (removed[s] = removed[s] || []).push(cards[k].mesh.position.clone()); }
      drop(k);
    });
    var deckTop = { x: DECK.x, y: .1 + dn * .05 + .25, z: DECK.z }, spawn = 0;
    order.forEach(function (k) {
      var t = want[k], o = cards[k];
      if (!o) {
        o = mk(k, t); var from;
        if (t.anon) from = k[0] === 'd' ? t : (nr ? deckTop : { x: t.x, y: t.y + 1, z: t.z });
        else {
          var src = V.src[t.id] || 'deck', q = src.indexOf('hand') === 0 ? +src.slice(4) : -1;
          if (q >= 0 && q !== V.me) { var rl = removed[q]; from = (rl && rl.pop()) || { x: (oppSlots(V.n)[Math.max(0, opps.indexOf(q))] || { x: 0 }).x, y: 1, z: (oppSlots(V.n)[Math.max(0, opps.indexOf(q))] || { z: -10 }).z }; }
          else from = deckTop;
        }
        o.mesh.position.set(from.x, from.y, from.z); o.mesh.rotation.set(Math.PI / 2, 0, 0); o.mesh.scale.setScalar(t.s);
        o.delay = nr ? spawn++ * 55 : 0;
        if (k[0] === 'd' && !nr) o.tg = { x: t.x, y: t.y, z: t.z, rx: t.rx, ry: t.ry, s: t.s };
      }
      o.glowOn = !!t.glow; o.dim = !!t.dim;
      var dl = o.delay || 0; o.delay = 0;   // Startverzögerung gilt nur für den ersten Flug nach dem Austeilen
      move(o, t, dl, instant && !nr);
    });
    // Farbe und Richtung
    var col = cyber() ? NEON[V.color] : HEX[V.color];
    colDisc.material.color.set(col); colRing.material.color.set(col);
    dirRing.userData.dir = V.dir;
    window.__fc3dState = { n: order.length };
  };

  // ---------- Auswahl ----------
  function pickAt(e) {
    if (!lastV) return null;
    var rc = r.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    var list = [];
    lastV.hand.forEach(function (id) { var o = cards['c' + id]; if (o) { list.push(o.front); } });
    var topKey = 'd' + (Math.min(lastV.deckN, MAXV) - 1), tk = cards[topKey];
    if (tk) { list.push(tk.front); list.push(tk.back); }   // verdeckte Karte liegt mit der Rückseite nach oben
    world.updateMatrixWorld(true);
    var hits = ray.intersectObjects(list, false), hit = hits[0];
    if (!hit) return null;
    if (lastInp && lastInp.mode === 'turn') {   // bei überlappenden Karten die spielbare unter dem Zeiger bevorzugen
      var bd = 1e9;   // unter den spielbaren Karten am Zeiger die mit dem nächsten Mittelpunkt nehmen
      for (var q = 0; q < hits.length; q++) {
        var g = hits[q].object.userData.top, gi = g.userData.id;
        if (gi != null && lastInp.can.indexOf(gi) >= 0) { var dd = Math.abs(hits[q].point.x - g.position.x); if (dd < bd) { bd = dd; hit = hits[q]; } }
      }
    }
    var g = hit.object.userData.top; return g.userData.id != null ? g.userData.id : 'draw';
  }
  F.dump = function (id) { var o = cards['c' + id]; if (!o) return null; var m = o.mesh; return { x: +m.position.x.toFixed(2), y: +m.position.y.toFixed(2), z: +m.position.z.toFixed(2), rx: +m.rotation.x.toFixed(2), ry: +m.rotation.y.toFixed(2), rz: +m.rotation.z.toFixed(2), s: +m.scale.x.toFixed(2), tg: o.tg && { x: o.tg.x, y: o.tg.y, z: o.tg.z, rx: +o.tg.rx.toFixed(2) } }; };
  F.pick = function (cx, cy) { return pickAt({ clientX: cx, clientY: cy }); };
  F.screenOf = function (id) {
    var o = cards['c' + id]; if (!o) return null;
    var v = new THREE.Vector3(); o.mesh.getWorldPosition(v); v.project(camera);
    var rc = r.domElement.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height, inside: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
  };
  F.screenOfDeck = function () {
    var o = cards['d' + (Math.min(lastV.deckN, MAXV) - 1)]; if (!o) return null;
    var v = new THREE.Vector3(); o.mesh.getWorldPosition(v); v.project(camera);
    var rc = r.domElement.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height };
  };
  F.project = function (x, y, z) {
    var v = new THREE.Vector3(x, y, z).project(camera), rc = r.domElement.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rc.width, y: (1 - v.y) / 2 * rc.height, w: rc.width, h: rc.height };
  };

  // ---------- Bild ----------
  function tick(now) {
    var t = now / 1000, dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now;
    runTw(performance.now());
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i], k = (performance.now() - f.t0) / 450;
      if (k >= 1) { world.remove(f.m); fx.splice(i, 1); continue; }
      f.m.scale.setScalar(1 + k * 2.6); f.m.material.opacity = .7 * (1 - k);
    }
    var pulse = .3 + .25 * Math.sin(t * 6);
    Object.keys(cards).forEach(function (k) {
      var o = cards[k], m = o.mesh;
      o.glow.material.opacity = o.glowOn ? pulse : 0;
      var fm = o.front.material; if (fm.color) fm.color.setScalar(o.dim ? .38 : 1);
      var h = Math.max(0, m.position.y - .1);
      o.sh.position.set(m.position.x + h * .1, .03, m.position.z + h * .2);
      o.sh.rotation.z = -m.rotation.y; o.sh.scale.setScalar(m.scale.x * (1 + h * .03)); o.sh.material.opacity = Math.max(.1, .5 - h * .05);
    });
    Object.keys(glows).forEach(function (k) { var g = glows[k]; g.material.opacity = g.userData.hot ? .22 + .2 * Math.sin(t * 5) : 0; });
    if (lastV) dirRing.rotation.y += -(lastV.dir || 1) * dt * .5;
    if (colRing) colRing.material.opacity = .7 + .3 * Math.sin(t * 4);
    if (rain) rain.update(dt);
    if (room) room.update(t);
    controls.update(); r.render(scene, camera); lastR = performance.now();
  }
  F.tick = tick;
})();
