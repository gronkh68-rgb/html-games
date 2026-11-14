/* Billard in 3D. Die Physik bleibt die eigene Kugelsimulation in index.html (schnell und auf allen Geräten gleich);
   hier wird nur gezeichnet: Tisch, rollende Kugeln (Drehung aus dem zurückgelegten Weg), Zielhilfe, Queue.
   Für Tempo: eine gemeinsame Kugelgeometrie, kleine Texturen, unechte Schatten (Scheiben), Zeichnen nur bei Bedarf. */
(function () {
  'use strict';
  var B3 = window.B3 = { ready: false };
  var TW = 200, TH = 100, R = 2.6, host, r, scene, cam, ctl, perf, balls = {}, shadows = {}, drops = [], aimLine, ghost, tgtLine, cue, handRing, ray, plane, dirty = true, view = 'iso', lastSig = '', POCK, COL, style = '';
  var feltM, railM, woodM, tableG;
  var X = function (x) { return x - TW / 2; }, Z = function (y) { return y - TH / 2; };
  function ballTex(id) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 128; var x = c.getContext('2d'), col = COL[id > 8 ? id - 8 : id];
    x.fillStyle = id > 8 || id === 0 ? '#f7f7f2' : col; x.fillRect(0, 0, 256, 128);
    if (id > 8) { x.fillStyle = col; x.fillRect(0, 36, 256, 56); }
    if (id === 0) { x.fillStyle = '#d8262c'; [40, 168].forEach(function (u) { x.beginPath(); x.arc(u, 64, 5, 0, 7); x.fill(); }); }
    else [64, 192].forEach(function (u) { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(u, 64, 17, 21, 0, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.save(); x.translate(u, 65); x.scale(.82, 1); x.fillText(id, 0, 0); x.restore(); });
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function feltTex(cy) {
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d'); x.fillStyle = cy ? '#0b3a40' : '#1c8250'; x.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 1800; i++) { x.fillStyle = 'rgba(' + (Math.random() > .5 ? '255,255,255' : '0,0,0') + ',' + (Math.random() * .05) + ')'; x.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 4); return t;
  }
  function buildTable(cy) {
    if (tableG) { scene.remove(tableG); tableG.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    tableG = new THREE.Group();
    feltM = new THREE.MeshLambertMaterial({ map: feltTex(cy) });
    railM = new THREE.MeshLambertMaterial({ color: cy ? 0x0a4a52 : 0x16693f });
    woodM = new THREE.MeshPhongMaterial({ color: cy ? 0x0a0d18 : 0x5a3418, shininess: 40, specular: 0x332211 });
    var felt = new THREE.Mesh(new THREE.PlaneGeometry(TW + 14, TH + 14), feltM); felt.rotation.x = -Math.PI / 2; tableG.add(felt);
    var line = new THREE.Mesh(new THREE.PlaneGeometry(.5, TH), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18 })); line.rotation.x = -Math.PI / 2; line.position.set(X(50), .02, 0); tableG.add(line);
    var H = 3.6, W = 5, gapC = 8.6, gapM = 5.2;
    var seg = function (x0, x1, z, horiz) {      // Bandenstück zwischen zwei Taschen
      var len = Math.abs(x1 - x0), g = new THREE.BoxGeometry(horiz ? len : W, H, horiz ? W : len), m = new THREE.Mesh(g, railM);
      if (horiz) m.position.set((x0 + x1) / 2, H / 2, z); else m.position.set(z, H / 2, (x0 + x1) / 2); tableG.add(m);
    };
    [-1, 1].forEach(function (s) {
      seg(X(0) + gapC, X(100) - gapM, s * (TH / 2 + W / 2), true); seg(X(100) + gapM, X(200) - gapC, s * (TH / 2 + W / 2), true);
      seg(Z(0) + gapC, Z(100) - gapC, s * (TW / 2 + W / 2), false);
    });
    var fr = 9, oh = 4.6;      // Holzrahmen
    [[0, TH / 2 + W + fr / 2, TW + 2 * W + 2 * fr, fr], [0, -(TH / 2 + W + fr / 2), TW + 2 * W + 2 * fr, fr]].forEach(function (b) { var m = new THREE.Mesh(new THREE.BoxGeometry(b[2], oh, b[3]), woodM); m.position.set(b[0], oh / 2, b[1]); tableG.add(m); });
    [[TW / 2 + W + fr / 2, TH + 2 * W], [-(TW / 2 + W + fr / 2), TH + 2 * W]].forEach(function (b) { var m = new THREE.Mesh(new THREE.BoxGeometry(fr, oh, b[1]), woodM); m.position.set(b[0], oh / 2, 0); tableG.add(m); });
    var pm = new THREE.MeshBasicMaterial({ color: 0x030303 });
    POCK.forEach(function (p) { var m = new THREE.Mesh(new THREE.CylinderGeometry(p[2] * 1.15, p[2] * 1.15, .2, 28), pm); m.position.set(X(p[0]) + (p[0] === 0 ? -1.2 : p[0] === 200 ? 1.2 : 0), .08, Z(p[1]) + (p[1] < 50 ? -1.6 : 1.6)); tableG.add(m);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(p[2] * 1.15, .45, 6, 28), woodM); rim.rotation.x = Math.PI / 2; rim.position.copy(m.position); rim.position.y = .2; tableG.add(rim); });
    if (cy) { var e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TW + 2 * W + 2 * fr, oh, TH + 2 * W + 2 * fr)), new THREE.LineBasicMaterial({ color: 0x00f0ff })); e.position.y = oh / 2; tableG.add(e); }
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: cy ? 0x03040a : 0x15110d })); floor.rotation.x = -Math.PI / 2; floor.position.y = -14; tableG.add(floor);
    var body = new THREE.Mesh(new THREE.BoxGeometry(TW + 2 * W + 2 * fr - 2, 13, TH + 2 * W + 2 * fr - 2), woodM); body.position.y = -6.6; tableG.add(body);
    scene.add(tableG); scene.background = new THREE.Color(cy ? 0x04060c : 0x1d1814);
  }
  B3.init = function (hostEl, o) {
    host = hostEl; POCK = o.pockets; COL = o.colors;
    r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); host.appendChild(r.domElement); r.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    perf = window.Perf3D ? Perf3D.create({ r: r, max: 2, resize: function () { B3.resize(); } }) : (r.setPixelRatio(Math.min(2, devicePixelRatio || 1)), null);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(36, 2, 1, 1500);
    scene.add(new THREE.AmbientLight(0xffffff, .62)); var dl = new THREE.DirectionalLight(0xffffff, .75); dl.position.set(-40, 220, 60); scene.add(dl);
    ctl = new THREE.OrbitControls(cam, r.domElement); ctl.enablePan = false; ctl.minDistance = 60; ctl.maxDistance = 420; ctl.maxPolarAngle = Math.PI * .47; ctl.target.set(0, 0, 0);
    ctl.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; ctl.touches = { ONE: -1, TWO: THREE.TOUCH.DOLLY_ROTATE };      // ein Finger / linke Maustaste zielt, zwei Finger / rechte Taste drehen die Kamera
    ctl.addEventListener('change', function () { dirty = true; }); r.domElement.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var geo = new THREE.SphereGeometry(R, 28, 18), sgeo = new THREE.CircleGeometry(R * 1.08, 20), sm = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false });
    for (var id = 0; id < 16; id++) {
      var m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: ballTex(id), shininess: 90, specular: 0x666666 })); m.visible = false; m.userData = { x: null, y: null }; scene.add(m); balls[id] = m;
      var s = new THREE.Mesh(sgeo, sm); s.rotation.x = -Math.PI / 2; s.visible = false; scene.add(s); shadows[id] = s;
    }
    var lm = new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 2.4, gapSize: 1.8, transparent: true, opacity: .85 });
    aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), lm); scene.add(aimLine);
    tgtLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xffd23f })); scene.add(tgtLine);
    ghost = new THREE.Mesh(new THREE.RingGeometry(R * .86, R, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, side: THREE.DoubleSide })); ghost.rotation.x = -Math.PI / 2; scene.add(ghost);
    handRing = new THREE.Mesh(new THREE.RingGeometry(R * 1.5, R * 1.75, 28), new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide })); handRing.rotation.x = -Math.PI / 2; scene.add(handRing);
    cue = new THREE.Group(); var st = new THREE.Mesh(new THREE.CylinderGeometry(.5, .95, 110, 10), new THREE.MeshPhongMaterial({ color: 0xd9b676 })); st.rotation.z = Math.PI / 2; st.position.x = -55; cue.add(st);
    var tip = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 1.6, 10), new THREE.MeshBasicMaterial({ color: 0x7fd0ff })); tip.rotation.z = Math.PI / 2; tip.position.x = -.8; cue.add(tip);
    var grip = new THREE.Mesh(new THREE.CylinderGeometry(.82, .97, 38, 10), new THREE.MeshPhongMaterial({ color: 0x2a1a10 })); grip.rotation.z = Math.PI / 2; grip.position.x = -91; cue.add(grip); scene.add(cue);
    ray = new THREE.Raycaster(); plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
    B3.ready = true; B3.setView('iso'); B3.resize();
    addEventListener('resize', B3.resize); if (window.ResizeObserver) new ResizeObserver(B3.resize).observe(host);
  };
  B3.resize = function () { if (!B3.ready) return; var w = host.clientWidth || 800, h = host.clientHeight || 400; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); fit(); dirty = true; };
  function fit() {      // Abstand so wählen, dass der ganze Tisch ins Bild passt (auch hochkant)
    if (view === 'cue') return; var t = Math.tan(cam.fov * Math.PI / 360), need = Math.max((TH / 2 + 22) / t, (TW / 2 + 22) / (t * cam.aspect));
    var dir = cam.position.clone().sub(ctl.target).normalize(); cam.position.copy(ctl.target).addScaledVector(dir, need * (view === 'top' ? 1 : 1.24));
  }
  B3.setView = function (v) {
    view = v; ctl.target.set(0, 0, 0);
    if (v === 'top') cam.position.set(0, 300, .01); else if (v === 'iso') { ctl.target.set(0, 0, 6); cam.position.set(0, 200, 150); }
    fit(); cam.lookAt(ctl.target); ctl.update(); dirty = true;
  };
  B3.view = function () { return view; };
  // Bildschirmpunkt -> Tischkoordinaten (Ebene durch die Kugelmitten)
  B3.pick = function (cx, cy) {
    var b = r.domElement.getBoundingClientRect(), v = new THREE.Vector2((cx - b.left) / b.width * 2 - 1, -((cy - b.top) / b.height) * 2 + 1), p = new THREE.Vector3();
    ray.setFromCamera(v, cam); if (!ray.ray.intersectPlane(plane, p)) return null; return [p.x + TW / 2, p.z + TH / 2];
  };
  var qd = null, ax = null;
  /* S = { balls:[{id,x,y}], cy, aim:{x,y,a,t,hit:{x,y}|null,pow,hand}|null } ; moving = Simulation läuft */
  B3.frame = function (S, now, moving) {
    if (!B3.ready) return; if (!qd) { qd = new THREE.Quaternion(); ax = new THREE.Vector3(); }
    var st = S.cy ? 'c' : 's'; if (st !== style) { style = st; buildTable(S.cy); dirty = true; }
    var seen = {}, sig = '';
    S.balls.forEach(function (o) {
      var m = balls[o.id], u = m.userData; seen[o.id] = 1;
      if (u.x !== null && m.visible) { var dx = o.x - u.x, dy = o.y - u.y, d = Math.hypot(dx, dy); if (d > 1e-4 && d < 12) { ax.set(dy / d, 0, -dx / d); qd.setFromAxisAngle(ax, d / R); m.quaternion.premultiply(qd); } }
      u.x = o.x; u.y = o.y; m.position.set(X(o.x), R, Z(o.y)); m.visible = true; m.scale.setScalar(1);
      var s = shadows[o.id]; s.visible = true; s.position.set(X(o.x) + .9, .04, Z(o.y) + .7);
      sig += o.id + ':' + o.x.toFixed(2) + ',' + o.y.toFixed(2) + ';';
    });
    for (var id = 0; id < 16; id++) if (!seen[id] && balls[id].visible && !balls[id].userData.drop) {      // versenkt: in die nächste Tasche fallen lassen
      var m2 = balls[id], u2 = m2.userData; shadows[id].visible = false;
      if (moving && u2.x !== null) { var bp = POCK[0], bd = 1e9; POCK.forEach(function (p) { var d2 = Math.hypot(p[0] - u2.x, p[1] - u2.y); if (d2 < bd) { bd = d2; bp = p; } }); u2.drop = { t0: now, x0: m2.position.x, z0: m2.position.z, x1: X(bp[0]), z1: Z(bp[1]) }; drops.push(m2); }
      else { m2.visible = false; u2.x = null; }
    }
    drops = drops.filter(function (m3) { var d = m3.userData.drop, k = Math.min(1, (now - d.t0) / 260); m3.position.set(d.x0 + (d.x1 - d.x0) * k, R - k * k * 7, d.z0 + (d.z1 - d.z0) * k); m3.scale.setScalar(1 - k * .25); dirty = true; if (k >= 1) { m3.visible = false; m3.userData.drop = null; m3.userData.x = null; return false; } return true; });
    var a = S.aim, on = !!a; aimLine.visible = ghost.visible = cue.visible = on; tgtLine.visible = on && !!a.hit; handRing.visible = on && !!a.hand;
    if (on) {
      var gx = a.x + Math.cos(a.a) * a.t, gy = a.y + Math.sin(a.a) * a.t, p = aimLine.geometry.attributes.position;
      p.setXYZ(0, X(a.x), R, Z(a.y)); p.setXYZ(1, X(gx), R, Z(gy)); p.needsUpdate = true; aimLine.computeLineDistances();
      ghost.position.set(X(gx), .2, Z(gy));
      if (a.hit) { var nx = a.hit.x - gx, ny = a.hit.y - gy, d3 = Math.hypot(nx, ny) || 1, q = tgtLine.geometry.attributes.position; q.setXYZ(0, X(a.hit.x), R, Z(a.hit.y)); q.setXYZ(1, X(a.hit.x + nx / d3 * 22), R, Z(a.hit.y + ny / d3 * 22)); q.needsUpdate = true; }
      cue.position.set(X(a.x) - Math.cos(a.a) * (R + 1.5 + a.pow * 16), R + .6, Z(a.y) - Math.sin(a.a) * (R + 1.5 + a.pow * 16)); cue.rotation.set(0, -a.a, -.07);
      handRing.position.set(X(a.x), .1, Z(a.y));
      if (view === 'cue') { var cx = Math.cos(a.a), sz = Math.sin(a.a); ctl.target.set(X(a.x) + cx * 45, 0, Z(a.y) + sz * 45); cam.position.set(X(a.x) - cx * 78, 40, Z(a.y) - sz * 78); cam.lookAt(ctl.target); }
      sig += a.x.toFixed(2) + a.y.toFixed(2) + a.a.toFixed(4) + a.pow + (a.hand ? 'h' : '') + view;
    }
    if (sig !== lastSig) { lastSig = sig; dirty = true; }
    ctl.update();
    if (dirty || moving) { dirty = false; r.render(scene, cam); if (perf && moving) perf.frame(now); }
  };
  B3.dom = function () { return r.domElement; };
})();
