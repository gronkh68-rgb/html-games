/* 3D-Ansicht für Hanafuda. Bekommt dieselbe Sicht V wie die 2D-Ansicht und bewegt die Karten mit Flug-Animationen.
   H3D.load() -> Promise   H3D.init(hostEl, api)   H3D.update(V, inp, instant)   H3D.setActive(bool)   H3D.resize()
   api: { CARDS, cyber(), sfx(name), onCard(id) }                                                                       */
(function () {
  var CW = 2.0, CH = 3.53, TH = .05, HX = -1.3, HAND_Z = 11.6, OPP_Z = -11.6;
  var DECK = { x: -15.5, z: -2.2 }, FLIP = { x: -15.5, z: 2.4 };
  var H = window.H3D = { ready: false };
  var host, api, r, scene, camera, controls, world, env = [], cards = {}, labels = {}, tw = [], fx = [], faceCache = {};
  var backMat, edgeMat, geoCard, shGeo, shTex, ray, mouse, lastV = null, lastInp = null, hoverId = null, slotMap = {}, down = null;
  var active = false, rain = null, room = null, lastT = 0, lastR = 0, camD = 40;
  var ROW = { hikari: 0, tane: 1, tanzaku: 2, kasu: 3 };
  var SLOTS = [];
  [[-2.2, 2.2], [-6.6, 6.6]].forEach(function (zs) {
    [[-5.2, -2.6, 0, 2.6], [-7.8, 5.2], [-10.4, 7.8]].forEach(function (xs) {
      zs.forEach(function (z) { xs.forEach(function (x) { SLOTS.push({ x: x, z: z }); }); });
    });
  });

  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
  H.load = function () {
    if (window.THREE && THREE.OrbitControls) return Promise.resolve();
    return ['build/three.min.js', 'examples/js/controls/OrbitControls.js'].reduce(function (pr, u) {
      return pr.then(function () {
        if (u.indexOf('OrbitControls') < 0 && window.THREE) return;
        return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = CDN + u; s.onload = res; s.onerror = function () { rej(new Error(u)); }; document.head.appendChild(s); });
      });
    }, Promise.resolve());
  };

  function cyber() { return api.cyber(); }

  // ---------- Texturen ----------
  function backTexture() {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 452; var x = cv.getContext('2d');
    x.fillStyle = '#8c1d2c'; x.fillRect(0, 0, 256, 452);
    x.fillStyle = '#6e1421'; for (var i = -452; i < 256; i += 24) { x.beginPath(); x.moveTo(i, 452); x.lineTo(i + 452, 0); x.lineTo(i + 464, 0); x.lineTo(i + 12, 452); x.fill(); }
    x.strokeStyle = '#f0d9a0'; x.lineWidth = 10; x.strokeRect(8, 8, 240, 436);
    x.beginPath(); x.arc(128, 226, 52, 0, 6.3); x.stroke();
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  function faceMat(id) {
    if (faceCache[id]) return faceCache[id];
    var c = api.CARDS[id], cv = document.createElement('canvas'); cv.width = 256; cv.height = 452; var x = cv.getContext('2d');
    x.fillStyle = '#f6efdc'; x.fillRect(0, 0, 256, 452);
    var tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    var img = new Image(); img.onload = function () { x.drawImage(img, 0, 0, 256, 452); tex.needsUpdate = true; };
    img.src = 'cards/' + (c.m + 1) + (id % 4) + '.svg';
    return faceCache[id] = new THREE.MeshStandardMaterial({ map: tex, roughness: .55, color: 0xb4b4b4 });
  }

  // ---------- Aufbau ----------
  H.init = function (hostEl, apiObj) {
    if (H.ready) return;
    host = hostEl; api = apiObj;
    r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); host.appendChild(r.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, .1, 500);
    controls = new THREE.OrbitControls(camera, r.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minPolarAngle = .2; controls.maxPolarAngle = 1.25;
    controls.minAzimuthAngle = -.8; controls.maxAzimuthAngle = .8;
    world = new THREE.Group(); world.position.x = -1.6; scene.add(world);
    geoCard = new THREE.BoxGeometry(CW, CH, TH);
    backMat = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: .6, color: 0xb4b4b4 });
    edgeMat = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: .7 });
    var sc = document.createElement('canvas'); sc.width = sc.height = 64; var sx = sc.getContext('2d'), g = sx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,.65)'); g.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = g; sx.fillRect(0, 0, 64, 64);
    shTex = new THREE.CanvasTexture(sc); shGeo = new THREE.PlaneGeometry(CW * 1.5, CH * 1.3);
    ray = new THREE.Raycaster(); mouse = new THREE.Vector2();
    buildEnv();
    new MutationObserver(function () { buildEnv(); Object.keys(labels).forEach(function (k) { labels[k].sig = ''; }); if (lastV) H.update(lastV, lastInp, true); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'] });
    var el = r.domElement;
    el.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', function (e) {
      if (!down) return; var d = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (d > 6) return; var id = pickAt(e); if (id != null) api.onCard(id);
    });
    el.addEventListener('pointermove', function (e) {
      if (down) return; var id = pickAt(e), ok = id != null && lastInp && (lastInp.mode === 'hand' || lastInp.mode === 'target');
      el.style.cursor = ok ? 'pointer' : 'grab';
      var hv = ok && lastV && lastV.hand.indexOf(id) >= 0 ? id : null;
      if (hv !== hoverId) { hoverId = hv; if (lastV) H.update(lastV, lastInp); }
    });
    addEventListener('resize', function () { if (active) H.resize(); });
    if (window.ResizeObserver) new ResizeObserver(function () { if (active) H.resize(); }).observe(host);
    var perf = window.Perf3D ? Perf3D.create({ r: r, resize: function () { F.resize(); } }) : null;
    requestAnimationFrame(function loop(now) { requestAnimationFrame(loop); if (active) { if (perf) perf.frame(now); tick(now); } });
    setInterval(function () { var n = performance.now(); if (active && n - lastR > 400) tick(n); else runTw(n); }, 100);   // läuft auch weiter, wenn der Tab im Hintergrund ist
    H.ready = true; H.resize();
  };
  H.setActive = function (a) { active = !!a; if (a) H.resize(); };
  H.resize = function () {
    var w = host.clientWidth || 600, h = host.clientHeight || 400;
    r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    var t = Math.tan(20 * Math.PI / 180), dh = 21 / (t * camera.aspect), dv = 19 / t;
    camD = Math.max(dh, dv) * 1.05; var el = 63 * Math.PI / 180;
    camera.position.set(0, camD * Math.sin(el), 1.5 + camD * Math.cos(el)); controls.target.set(0, 0, 1.5);
    controls.minDistance = camD * .5; controls.maxDistance = camD * 1.3; controls.update();
  };

  function buildEnv() {
    env.forEach(function (o) { scene.remove(o); }); env = []; room = null; rain = null;
    var cy = cyber(), add = function (o) { scene.add(o); env.push(o); return o; };
    if (cy) {
      scene.fog = new THREE.FogExp2(0x05060b, .008); r.setClearColor(0x05060b);
      add(new THREE.AmbientLight(0x7a8ab8, .95));
      var dl = new THREE.DirectionalLight(0xbbd8ff, .8); dl.position.set(8, 30, 14); add(dl);
      var lamp = new THREE.PointLight(0x00f0ff, .9, 90); lamp.position.set(0, 18, 2); add(lamp);
      var felt = new THREE.Mesh(new THREE.PlaneGeometry(40, 31), new THREE.MeshStandardMaterial({ color: 0x07121c, roughness: .4, metalness: .5, emissive: 0x03101a }));
      felt.rotation.x = -Math.PI / 2; add(felt);
      var pts = [new THREE.Vector3(-20, .04, -15.5), new THREE.Vector3(20, .04, -15.5), new THREE.Vector3(20, .04, 15.5), new THREE.Vector3(-20, .04, 15.5)];
      add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x00f0ff })));
      var grid = new THREE.GridHelper(300, 150, 0x00f0ff, 0x0b3f4a); grid.position.y = -2; grid.material.transparent = true; grid.material.opacity = .35; add(grid);
      var fl = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: 0x04050a })); fl.rotation.x = -Math.PI / 2; fl.position.y = -2.05; add(fl);
      if (window.Room3D) { rain = Room3D.rain(THREE, { count: 700, radius: 50, top: 28, bottom: -2 }); add(rain.obj); }
    } else {
      scene.fog = new THREE.Fog(0x2a1a10, 80, 190); r.setClearColor(0x2a1a10);
      if (window.Room3D) { room = Room3D.livingRoom(THREE, { half: 60, tableTopY: -.06, table: { shape: 'square', size: 44 } }); add(room.group); }
      else { add(new THREE.AmbientLight(0xffe6c8, 1)); }
      var cloth = new THREE.Mesh(new THREE.PlaneGeometry(40, 31), new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: .95 }));
      cloth.rotation.x = -Math.PI / 2; add(cloth);
    }
  }

  // ---------- Karten ----------
  function mk(key, t) {
    var anon = !!t.anon;
    var m = new THREE.Mesh(geoCard, [edgeMat, edgeMat, edgeMat, edgeMat, anon ? backMat : faceMat(t.id), backMat]);
    m.rotation.order = 'YXZ'; m.userData.id = anon ? null : t.id; world.add(m);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(CW * 1.22, CH * 1.12), new THREE.MeshBasicMaterial({ color: 0x3ee6a0, transparent: true, opacity: 0, depthWrite: false }));
    glow.position.z = -TH / 2 - .02; m.add(glow);
    var sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: .5, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; world.add(sh);
    return cards[key] = { mesh: m, glow: glow, sh: sh, tg: null, key: key };
  }
  function drop(key) { var o = cards[key]; if (!o) return; world.remove(o.mesh); world.remove(o.sh); tw = tw.filter(function (w) { return w.o !== o; }); delete cards[key]; }
  function clearAll() { Object.keys(cards).forEach(drop); tw = []; }
  function near(a, b) { return Math.abs(a.x - b.x) < .01 && Math.abs(a.y - b.y) < .01 && Math.abs(a.z - b.z) < .01 && Math.abs(a.rx - b.rx) < .01 && Math.abs(a.s - b.s) < .01; }
  function move(o, t, delay, instant) {
    var m = o.mesh;
    if (o.tg && near(o.tg, t)) return;
    o.tg = t; tw = tw.filter(function (w) { return w.o !== o; });
    if (instant) { m.position.set(t.x, t.y, t.z); m.rotation.set(t.rx, 0, 0); m.scale.setScalar(t.s); return; }
    var p0 = m.position.clone(), p1 = new THREE.Vector3(t.x, t.y, t.z), dist = p0.distanceTo(p1), far = dist >= 2.2;
    tw.push({ o: o, t0: performance.now() + (delay || 0), dur: far ? 430 + Math.min(420, dist * 22) : 170, p0: p0, p1: p1, rx0: m.rotation.x, rx1: t.rx,
      s0: m.scale.x, s1: t.s, arc: far ? Math.min(3.6, .9 + dist * .1) : 0, snd: far ? t.snd : null, spin: (t.x > p0.x ? 1 : -1) * .3, far: far });
  }
  function runTw(now) {
    for (var i = tw.length - 1; i >= 0; i--) {
      var w = tw[i], k = Math.max(0, Math.min(1, (now - w.t0) / w.dur)), e = k * k * (3 - 2 * k), m = w.o.mesh, up = Math.sin(k * Math.PI);
      m.position.lerpVectors(w.p0, w.p1, e); m.position.y += up * w.arc;
      m.rotation.set(w.rx0 + (w.rx1 - w.rx0) * e, up * w.spin * (w.far ? 1 : 0), 0);
      m.scale.setScalar((w.s0 + (w.s1 - w.s0) * e) * (1 + (w.far ? .14 : 0) * up));
      if (k >= 1) {
        tw.splice(i, 1);
        if (w.snd) { api.sfx(w.snd); ring(w.p1.x, w.p1.z, w.snd === 'take' ? 0xffd23f : 0xffffff); }
      }
    }
  }
  function ring(x, z, color) {
    var m = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 36), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, .08, z); world.add(m); fx.push({ m: m, t0: performance.now() });
  }

  // ---------- Namensschilder ----------
  function label(key, text, sub, hot, x, z) {
    var o = labels[key];
    if (!o) {
      var cv = document.createElement('canvas'); cv.width = 360; cv.height = 112;
      var tex = new THREE.CanvasTexture(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
      sp.scale.set(8.6, 2.7, 1); sp.renderOrder = 10; world.add(sp); o = labels[key] = { sp: sp, cv: cv, tex: tex, sig: '' };
    }
    o.sp.position.set(x, .6, z);
    var sig = [text, sub, hot, cyber()].join('|'); if (o.sig === sig) return; o.sig = sig;
    var c = o.cv.getContext('2d'), cy = cyber(); c.clearRect(0, 0, 360, 112);
    c.fillStyle = hot ? (cy ? 'rgba(252,238,9,.95)' : 'rgba(46,160,90,.95)') : (cy ? 'rgba(8,11,20,.88)' : 'rgba(30,20,12,.82)');
    c.beginPath(); if (c.roundRect) c.roundRect(4, 4, 352, 104, cy ? 4 : 18); else c.rect(4, 4, 352, 104); c.fill();
    c.lineWidth = 4; c.strokeStyle = hot ? '#fff' : (cy ? '#00f0ff' : '#d9c28a'); c.stroke();
    c.textAlign = 'center'; c.fillStyle = hot && cy ? '#000' : '#fff'; c.font = 'bold 36px system-ui,sans-serif'; c.fillText(text, 180, 48);
    c.fillStyle = hot && cy ? '#222' : '#ffd86b'; c.font = '28px system-ui,sans-serif'; c.fillText(sub, 180, 88);
    o.tex.needsUpdate = true;
  }

  // ---------- Zustand -> Ziele ----------
  H.update = function (V, inp, instant) {
    if (!H.ready || !V) return;
    var C = api.CARDS, nr = !lastV || lastV.round !== V.round || lastV.me !== V.me;
    if (nr) { clearAll(); slotMap = {}; }
    lastV = V; lastInp = inp;
    var want = {}, order = [], j;
    function W(k, t) { want[k] = t; order.push(k); return t; }
    var sel = inp && inp.mode === 'hand' ? inp.sel : null, cands = inp && inp.mode === 'target' ? inp.cands : null;
    var matchM = sel != null ? C[sel].m : (cands && V.flip != null ? C[V.flip].m : -1);

    for (j = 0; j < V.deckN; j++) W('d' + j, { x: DECK.x, y: .1 + j * .05, z: DECK.z, rx: Math.PI / 2, s: 1, anon: 1 });
    var on = V.oppN, osp = Math.min(1.7, 13 / Math.max(1, on));
    for (j = 0; j < on; j++) W('o' + j, { x: HX + (j - (on - 1) / 2) * osp, y: .1 + j * .01, z: OPP_Z, rx: Math.PI / 2, s: .9, anon: 1 });
    var hn = V.hand.length, hsp = Math.min(2.4, 17.5 / Math.max(1, hn));
    V.hand.forEach(function (id, i) {
      var s = sel === id, hv = hoverId === id && inp && inp.mode === 'hand';
      W('c' + id, { id: id, x: HX + (i - (hn - 1) / 2) * hsp, y: CH * 1.15 / 2 * Math.sin(.72) + .45 + i * .012 + (s ? 1.3 : hv ? .6 : 0), z: HAND_Z - (s ? 1 : hv ? .4 : 0), rx: -Math.PI / 2 + .72 - (s ? .15 : 0), s: 1.15, glow: s ? 0xffd23f : 0 });
    });
    var pair = V.pair || [], pc = pair.length ? pair[0] : null;
    Object.keys(slotMap).forEach(function (id) { if (V.table.indexOf(+id) < 0 || +id === pc) delete slotMap[id]; });
    var occ = {}; Object.keys(slotMap).forEach(function (id) { occ[slotMap[id]] = 1; });
    V.table.forEach(function (id) { if (id === pc) return; if (slotMap[id] == null) { var s = 0; while (occ[s]) s++; slotMap[id] = s; occ[s] = 1; } });
    V.table.forEach(function (id) {
      if (id === pc) {
        var sp0 = SLOTS[slotMap[pair[1]]] || { x: 0, z: 0 };
        W('c' + id, { id: id, x: sp0.x + 1.1, y: .45, z: sp0.z + 1.2, rx: -Math.PI / 2, s: 1.1, glow: 0xffd23f, snd: 'lay' }); return;
      }
      var sp = SLOTS[slotMap[id]] || SLOTS[0], g = 0;
      if (pair.indexOf(id) >= 0) g = 0xffd23f; else if ((matchM >= 0 && C[id].m === matchM) || (cands && cands.indexOf(id) >= 0)) g = 0x3ee6a0;
      W('c' + id, { id: id, x: sp.x, y: .12, z: sp.z, rx: -Math.PI / 2, s: 1.1, glow: g, snd: 'lay' });
    });
    if (V.flip != null) W('c' + V.flip, { id: V.flip, x: FLIP.x, y: .12, z: FLIP.z, rx: -Math.PI / 2, s: 1.1, snd: 'lay' });
    [0, 1].forEach(function (side) {
      var gr = [[], [], [], []]; V.caps[side].forEach(function (id) { gr[ROW[C[id].t]].push(id); });
      gr.forEach(function (g, ri) {
        var sp = Math.min(1.05, 9.6 / Math.max(1, g.length));
        g.forEach(function (id, k) { W('c' + id, { id: id, x: 9.7 + k * sp, y: .1 + k * .012, z: (side ? -1 : 1) * (6.4 + ri * 2.3), rx: -Math.PI / 2, s: .62, snd: 'take' }); });
      });
    });

    // entfernen / neu / bewegen
    var removed = { o: [], d: [] };
    Object.keys(cards).forEach(function (k) {
      if (want[k]) return;
      if (k[0] === 'o' || k[0] === 'd') removed[k[0]].push(cards[k].mesh.position.clone());
      drop(k);
    });
    var deckTop = { x: DECK.x, y: .1 + V.deckN * .05 + .2, z: DECK.z }, spawn = 0;
    order.forEach(function (k) {
      var t = want[k], o = cards[k];
      if (!o) {
        o = mk(k, t); var from;
        if (t.anon) from = k[0] === 'd' ? t : (nr ? deckTop : { x: t.x, y: t.y + 1, z: t.z });
        else {
          var src = V.src[t.id] || 'deck', opp = src.indexOf('hand') === 0 && +src.slice(4) !== V.me;
          if (opp) from = removed.o.pop() || { x: HX, y: 1, z: OPP_Z };
          else from = removed.d.pop() || deckTop;
        }
        o.mesh.position.set(from.x, from.y, from.z); o.mesh.rotation.set(Math.PI / 2, 0, 0); o.mesh.scale.setScalar(t.s);
        o.delay = nr && !t.anon ? spawn++ * 70 : (nr ? spawn++ * 70 : 0);
        if (k[0] === 'd' && !nr) o.tg = { x: t.x, y: t.y, z: t.z, rx: t.rx, s: t.s };
      }
      o.glowC = t.glow || 0;
      var dl = o.delay || 0; o.delay = 0;   // Startverzögerung gilt nur für den ersten Flug nach dem Austeilen
      move(o, t, dl, instant && !nr);
    });
    // Namensschilder
    label('me', V.names[0], V.scores[0] + ' Punkte', V.turn === 0, HX, 15.1);
    label('opp', V.names[1], V.scores[1] + ' Punkte', V.turn === 1, HX, -15.1);
  };

  // ---------- Auswahl ----------
  function pickAt(e) {
    if (!lastV) return null;
    var rc = r.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    var list = [];
    lastV.hand.concat(lastV.table).forEach(function (id) { var o = cards['c' + id]; if (o) list.push(o.mesh); });
    var hit = ray.intersectObjects(list, false)[0];
    return hit ? hit.object.userData.id : null;
  }

  // ---------- Bild ----------
  function tick(now) {
    var t = now / 1000, dt = Math.min(.05, (now - (lastT || now)) / 1000); lastT = now;
    runTw(performance.now());
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i], k = (performance.now() - f.t0) / 450;
      if (k >= 1) { world.remove(f.m); fx.splice(i, 1); continue; }
      f.m.scale.setScalar(1 + k * 2.6); f.m.material.opacity = .7 * (1 - k);
    }
    var pulse = .35 + .25 * Math.sin(t * 6);
    Object.keys(cards).forEach(function (k) {
      var o = cards[k], m = o.mesh;
      o.glow.material.opacity = o.glowC ? pulse + .2 : 0; if (o.glowC) o.glow.material.color.setHex(o.glowC);
      var h = Math.max(0, m.position.y - .1);
      o.sh.position.set(m.position.x + h * .12, .03, m.position.z + h * .22);
      o.sh.scale.setScalar(m.scale.x * (1 + h * .03)); o.sh.material.opacity = Math.max(.12, .5 - h * .05);
    });
    if (rain) rain.update(dt);
    if (room) room.update(t);
    controls.update(); r.render(scene, camera); lastR = performance.now();
  }
  H.tick = tick;
  H.project = function (x, y, z) {   // Weltpunkt (Tischkoordinaten) -> Pixel im Canvas, zum Testen
    var v = new THREE.Vector3(x - 1.6, y, z).project(camera), rc = r.domElement.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rc.width, y: (1 - v.y) / 2 * rc.height, w: rc.width, h: rc.height };
  };
  // Bildschirmposition (Pixel im Canvas) einer Karte, zum Testen
  H.screenOf = function (id) {
    var o = cards['c' + id]; if (!o) return null;
    var v = new THREE.Vector3(); o.mesh.getWorldPosition(v); v.project(camera);
    var rc = r.domElement.getBoundingClientRect();
    return { x: rc.left + (v.x + 1) / 2 * rc.width, y: rc.top + (1 - v.y) / 2 * rc.height, inside: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
  };
})();
