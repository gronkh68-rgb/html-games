/* Mädn Teams: 3D-Ansicht (three.js r128, wird erst beim Einschalten geladen). Zeichnet dieselben Felder wie die 2D-Ansicht (Ring und liegende Acht), Figuren mit Hüpf-Animation,
   markiert ziehbare Figuren und Ziele und gibt Klicks an das Spiel zurück.
   MT3D.init(host, api)  api: { onPiece(p, i), onTarget(k), colorOf(p), teamColor(t) }
   MT3D.update(v, F, ptOf, opts)  v = Sicht, F = { key, pts:[{x,y,k,c}], loop:[[x,y]...], closed } (2D-Koordinaten), ptOf(p,pos,i) -> [x,y], opts = erlaubte Züge ([{q,i,to,from,cap}]) oder null
   MT3D.setActive(on) · MT3D.resize() · MT3D.camReset()                                                                                   */
(function () {
  var H = window.MT3D = { ready: false };
  var host, api, r, scene, camera, controls, active = false, built = '', group = null, pcs = {}, tgts = [], lastPos = null, lastF = null, tw = [], K = 1 / 30, cx0 = 0, cy0 = 0, bw = 10, bh = 10, pickables = [];
  var COL = { track: 0x2a3550, trackE: 0x6b7aa0, center: 0x39456a };
  var P3 = function (pt) { return new THREE.Vector3((pt[0] - cx0) * K, 0, (pt[1] - cy0) * K); };

  H.init = function (hostEl, apiObj) {
    host = hostEl; api = apiObj;
    r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setClearColor(0x07090f); host.appendChild(r.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x07090f, 60, 140);
    camera = new THREE.PerspectiveCamera(40, 1, .1, 300); camera.position.set(0, 24, 24);
    controls = new THREE.OrbitControls(camera, r.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 90; controls.maxPolarAngle = 1.4;
    scene.add(new THREE.AmbientLight(0xbfd0ff, .6));
    var dl = new THREE.DirectionalLight(0xffffff, .85); dl.position.set(8, 30, 14); scene.add(dl);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: 0x05060b })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1; scene.add(floor);
    // Klick auf Figur oder Ziel
    var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), down = null;
    r.domElement.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    r.domElement.addEventListener('pointerup', function (e) {
      if (!down) return; var mv = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (mv > 8 || dt > 700) return;
      var b = r.domElement.getBoundingClientRect(); mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mouse, camera);
      var hit = ray.intersectObjects(pickables, false)[0]; if (!hit) return;
      var u = hit.object.userData; if (u.k !== undefined) api.onTarget(u.k); else if (u.p !== undefined) api.onPiece(u.p, u.i);
    });
    addEventListener('resize', function () { if (active) H.resize(); });
    if (window.ResizeObserver) new ResizeObserver(function () { if (active) H.resize(); }).observe(host);
    requestAnimationFrame(function loop(now) { requestAnimationFrame(loop); if (active) tick(now); });
    H.ready = true; H.resize();
  };
  H.setActive = function (a) { active = !!a; if (a) H.resize(); };
  H.resize = function () {
    if (!H.ready) return; var w = host.clientWidth || 800, h = host.clientHeight || 600; r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  H.camReset = function () {
    var asp = camera.aspect || 1.6, t = Math.tan(camera.fov * Math.PI / 360), dist = Math.max((bw / 2 + 1) / (t * asp), (bh / 2 + 1) / t) * .92;
    tw = tw.filter(function (x) { return x.key !== 'cam'; });
    var p0 = camera.position.clone(), p1 = new THREE.Vector3(0, dist * .82, dist * .6), t0 = controls.target.clone();
    tween(700, function (k) { var e = k * k * (3 - 2 * k); camera.position.lerpVectors(p0, p1, e); controls.target.lerpVectors(t0, new THREE.Vector3(0, 0, 0), e); }, 'cam');
  };
  function tween(dur, fn, key) { if (key) tw = tw.filter(function (t) { return t.key !== key; }); return new Promise(function (res) { tw.push({ t0: performance.now(), dur: dur, fn: fn, res: res, key: key }); }); }
  function runTw(now) { for (var i = tw.length - 1; i >= 0; i--) { var t = tw[i]; if (!t) continue; var k = Math.min(1, (now - t.t0) / t.dur); t.fn(k); if (k >= 1) { tw.splice(i, 1); t.res(); } } }
  setInterval(function () { if (!active) runTw(performance.now()); }, 100);

  // ---------- Brett aufbauen ----------
  function build(F) {
    if (group) scene.remove(group);
    group = new THREE.Group(); scene.add(group); pcs = {}; pickables = [];
    var xs = F.pts.map(function (p) { return p.x; }), ys = F.pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    cx0 = (x0 + x1) / 2; cy0 = (y0 + y1) / 2; K = Math.min(1, 34 / Math.max(x1 - x0, y1 - y0)) ; K = Math.max(.02, K);
    bw = (x1 - x0 + 120) * K; bh = (y1 - y0 + 120) * K;
    var plate = new THREE.Mesh(new THREE.BoxGeometry(bw, .4, bh), new THREE.MeshStandardMaterial({ color: 0x0d1424, roughness: .6, metalness: .4 })); plate.position.y = -.25; group.add(plate);
    var pe = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x00cfff })); pe.position.copy(plate.position); group.add(pe);
    if (F.loop) {      // Bahn als helle Spur unter den Feldern
      var pts = F.loop.map(function (p) { var v = P3(p); v.y = .02; return v; }), curve = new THREE.CatmullRomCurve3(pts, !!F.closed);
      var tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(60, pts.length * 4), .22, 8, !!F.closed), new THREE.MeshBasicMaterial({ color: 0x24304d, transparent: true, opacity: .8 })); tube.scale.y = .3; group.add(tube);
    }
    var cg = new THREE.CylinderGeometry(.4, .44, .14, 24);
    F.pts.forEach(function (p) {
      var c = p.c ? new THREE.Color(p.c) : null, base = p.k === 'track' ? COL.track : p.k === 'center' ? COL.center : 0x1a2238;
      var mat = new THREE.MeshStandardMaterial({ color: c && p.k === 'start' ? c : (c ? c.clone().multiplyScalar(.35).add(new THREE.Color(0x0a0f1c)) : base), roughness: .45, metalness: .3, emissive: c ? c.clone().multiplyScalar(p.k === 'start' ? .25 : .12) : 0x0a1020 });
      var m = new THREE.Mesh(cg, mat); var v = P3([p.x, p.y]); m.position.set(v.x, .05, v.z); if (p.k === 'center') m.scale.set(1.25, 1, 1.25); group.add(m);
      var e = new THREE.LineSegments(new THREE.EdgesGeometry(cg, 40), new THREE.LineBasicMaterial({ color: c ? c : COL.trackE, transparent: true, opacity: c ? .95 : .55 })); e.position.copy(m.position); if (p.k === 'center') e.scale.copy(m.scale); group.add(e);
    });
    // Richtungspfeile (leuchten der Reihe nach in Laufrichtung auf)
    arrowM = [];
    var ag = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-.34, -.4), new THREE.Vector2(.42, 0), new THREE.Vector2(-.34, .4), new THREE.Vector2(-.14, 0)]));
    (F.arrows || []).forEach(function (a) {
      var m = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: new THREE.Color(a.c), transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false })), v = P3([a.x, a.y]);
      m.rotation.x = -Math.PI / 2; m.rotation.z = -a.a; m.position.set(v.x, .24, v.z); m.scale.setScalar(a.s * 1.7); m.rotation.order = 'YXZ'; group.add(m); arrowM.push({ m: m, ph: a.ph });
    });
    // Figuren
    var cone = new THREE.ConeGeometry(.27, .62, 18), head = new THREE.SphereGeometry(.17, 16, 12), hit = new THREE.CylinderGeometry(.6, .6, 1.5, 8);
    var maxP = 0, nP = 0; (F.seats || []).forEach(function (s) { nP = Math.max(nP, s.i + 1); });
    (F.pieces || []).forEach(function (s) {
      var col = new THREE.Color(s.c), g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: col, roughness: .35, metalness: .3, emissive: col.clone().multiplyScalar(.25) });
      var b = new THREE.Mesh(cone, mat); b.position.y = .45; g.add(b); var h = new THREE.Mesh(head, mat); h.position.y = .88; g.add(h);
      var tm = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 8, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.tc) })); tm.rotation.x = Math.PI / 2; tm.position.y = .2; g.add(tm);
      var ht = new THREE.Mesh(hit, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); ht.position.y = .6; ht.userData = { p: s.p, i: s.i }; g.add(ht); pickables.push(ht);
      g.scale.setScalar(1.25); group.add(g); pcs[s.p + '-' + s.i] = { g: g, mat: mat, base: col, can: false, pos: null };
    });
    H.camReset();
  }

  // ---------- Update ----------
  var rings = [], arrowM = [];
  H.update = function (v, F, ptOf, opts) {
    if (!H.ready) return;
    if (built !== F.key) { built = F.key; build(F); lastPos = null; }
    // Figuren setzen oder animieren
    var first = !lastPos; if (first) lastPos = {};
    for (var p = 0; p < v.n; p++) for (var i = 0; i < v.P; i++) {
      var id = p + '-' + i, pc = pcs[id]; if (!pc) continue; var np = v.pos[p][i], op = lastPos[id];
      if (op === undefined || pc.pos === null) { var q = P3(ptOf(p, np, i)); pc.g.position.set(q.x, .14, q.z); }
      else if (op !== np) hop(pc, p, i, op, np, ptOf);
      lastPos[id] = np; pc.pos = np;
    }
    // ziehbare Figuren und Ziele
    var can = {}; (opts || []).forEach(function (o) { can[o.q + '-' + o.i] = 1; });
    Object.keys(pcs).forEach(function (id) { pcs[id].can = !!can[id]; });
    rings.forEach(function (m) { group.remove(m); }); rings = [];
    pickables = pickables.filter(function (m) { return m.userData.k === undefined; });
    (opts || []).forEach(function (o, k) {
      var q = P3(ptOf(o.q, o.to, o.i)), m = new THREE.Mesh(new THREE.RingGeometry(.5, .66, 28), new THREE.MeshBasicMaterial({ color: o.cap ? 0xff5a5a : 0xffd23f, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(q.x, .25, q.z); m.userData = { k: k }; group.add(m); rings.push(m); pickables.push(m);
    });
  };
  function hop(pc, p, i, from, to, ptOf) {
    var path = [];
    if (from >= 0 && to > from && to - from <= 40) for (var x = from + 1; x <= to; x++) path.push(P3(ptOf(p, x, i)));
    else path.push(P3(ptOf(p, to, i)));
    var seq = Promise.resolve(), key = 'pc' + p + '-' + i, jump = path.length === 1;
    tw = tw.filter(function (t) { return t.key !== key; });
    path.forEach(function (b) {
      seq = seq.then(function () {
        var a = pc.g.position.clone(), d = jump ? 600 : 130;
        return tween(d, function (k) { pc.g.position.set(a.x + (b.x - a.x) * k, .14 + Math.sin(k * Math.PI) * (jump ? 2 : .45), a.z + (b.z - a.z) * k); }, key);
      });
    });
  }
  function tick(now) {
    runTw(now);
    var t = now / 1000;
    Object.keys(pcs).forEach(function (id) { var pc = pcs[id], pulse = .5 + .5 * Math.sin(t * 6); pc.mat.emissiveIntensity = pc.can ? .6 + .9 * pulse : .35; if (pc.can) pc.mat.emissive.copy(pc.base).lerp(new THREE.Color(0xffffff), .25 * pulse); else pc.mat.emissive.copy(pc.base).multiplyScalar(.25); });
    rings.forEach(function (m, k) { m.scale.setScalar(1 + .12 * Math.sin(t * 5 + k)); });
    arrowM.forEach(function (o) { o.m.material.opacity = .25 + .75 * Math.max(0, Math.sin(t * 3.6 - o.ph * .8)); });
    controls.update(); r.render(scene, camera);
  }
})();
