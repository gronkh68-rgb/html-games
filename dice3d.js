/* Echte Würfelphysik: Wurf per Maus/Finger, das Ergebnis kommt aus der Physik (cannon-es).
   Ablauf für alle Spiele gleich:
     1. Wer würfelt, zieht den Würfel (View.drag) und lässt los -> Wurfdaten (Position, Geschwindigkeit, Drehung).
     2. Die Instanz, die das Ergebnis bestimmt (Host/Einzelspiel), rechnet D.simulate(params) -> { v:[Werte], track }.
     3. Alle Geräte spielen dieselbe Bahn mit View.play(track) ab, deshalb sehen alle denselben Wurf.
   Benötigt three.js (r128) und cannon-es; beides wird bei Bedarf nachgeladen.

   const view = Dice3D.view(containerEl);          // Überlagerung über dem Container
   const p = await view.drag(2);                   // 2 Würfel zum Werfen ziehen -> Wurfdaten (oder view.auto(2) für einen Zufallswurf)
   const r = await Dice3D.simulate(p);             // { v:[3,5], track }
   await view.play(r.track);                       // Würfel rollen lassen und liegen lassen                              */
(function () {
  var D = window.Dice3D = {};
  var CANNON_URL = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var C = null, loadP = null;
  var HALF = 0.5, TX = 5.4, TZ = 3.3, G = -42, DT = 1 / 60, EVERY = 2;      // Würfelkante 1, Tablett 10,8 x 6,6
  var FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], FACE_V = [3, 4, 1, 6, 2, 5];   // Reihenfolge der BoxGeometry-Seiten
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); }; document.head.appendChild(s); }); }
  D.ready = function () {
    if (loadP) return loadP;
    loadP = Promise.all([window.THREE ? 0 : load(THREE_URL), import(CANNON_URL).then(function (m) { C = m; })]);
    return loadP;
  };
  D.setCannon = function (m) { C = m; };          // für Tests ohne Netz
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  function randQ() { var u = Math.random(), v = Math.random(), w = Math.random(); return [Math.sqrt(1 - u) * Math.sin(2 * Math.PI * v), Math.sqrt(1 - u) * Math.cos(2 * Math.PI * v), Math.sqrt(u) * Math.sin(2 * Math.PI * w), Math.sqrt(u) * Math.cos(2 * Math.PI * w)]; }
  function topFace(q) {         // Welche Seite zeigt nach oben? -> {v, d (Ausrichtung 0..1)}
    var x = q[0], y = q[1], z = q[2], w = q[3], best = -2, bv = 1;
    for (var i = 0; i < 6; i++) {
      var n = FACE_N[i], tx = n[0], ty = n[1], tz = n[2];
      // y-Komponente von q * n
      var cx = y * tz - z * ty, cy = z * tx - x * tz;                                    // q.xyz x n (x und y)
      var cy2 = z * cx - x * (x * ty - y * tx);                                          // y von q.xyz x (q.xyz x n)
      var ry = ty + 2 * (w * cy + cy2);
      if (ry > best) { best = ry; bv = FACE_V[i]; }
    }
    return { v: bv, d: best };
  }
  D.topFace = topFace;

  // ---------- Wurfdaten ----------
  // params: { dice: [ { p:[x,y,z], q:[x,y,z,w], v:[x,y,z], w:[x,y,z] } ] }
  D.autoParams = function (n) {
    var d = [];
    for (var i = 0; i < n; i++) {
      var ang = rnd(-.5, .5), sp = rnd(12, 24), x = -TX + 1.2, z = rnd(-1.6, 1.6) + i * 1.3 - (n - 1) * .65;
      d.push({ p: [x, 1.8, z], q: randQ(), v: [Math.cos(ang) * sp, rnd(-2, 2), Math.sin(ang) * sp], w: [rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)] });
    }
    return { dice: d };
  };
  D.clean = function (p, n) {       // Eingaben von Mitspielern prüfen und begrenzen
    if (!p || !Array.isArray(p.dice) || p.dice.length !== n) return null;
    var fin = function (a, k) { return Array.isArray(a) && a.length === k && a.every(function (x) { return typeof x === 'number' && isFinite(x); }); };
    var cl = function (x, m) { return Math.max(-m, Math.min(m, x)); };
    var out = [];
    for (var i = 0; i < n; i++) {
      var d = p.dice[i]; if (!d || !fin(d.p, 3) || !fin(d.q, 4) || !fin(d.v, 3) || !fin(d.w, 3)) return null;
      var ql = Math.hypot(d.q[0], d.q[1], d.q[2], d.q[3]) || 1;
      out.push({ p: [cl(d.p[0], TX - .6), cl(d.p[1], 3), cl(d.p[2], TZ - .6)], q: d.q.map(function (x) { return x / ql; }), v: [cl(d.v[0], 45), cl(d.v[1], 15), cl(d.v[2], 45)], w: [cl(d.w[0], 60), cl(d.w[1], 60), cl(d.w[2], 60)] });
    }
    return { dice: out };
  };

  // ---------- Simulation ----------
  D.simulate = async function (params) {
    await D.ready();
    var n = params.dice.length, world = new C.World({ gravity: new C.Vec3(0, G, 0) });
    world.allowSleep = false; world.solver.iterations = 24;
    var mDie = new C.Material('die'), mFloor = new C.Material('floor');
    world.addContactMaterial(new C.ContactMaterial(mDie, mFloor, { friction: .32, restitution: .32 }));
    world.addContactMaterial(new C.ContactMaterial(mDie, mDie, { friction: .25, restitution: .35 }));
    function wall(hx, hy, hz, x, y, z) { var b = new C.Body({ mass: 0, material: mFloor }); b.addShape(new C.Box(new C.Vec3(hx, hy, hz))); b.position.set(x, y, z); world.addBody(b); }
    wall(TX + 2, .5, TZ + 2, 0, -.5, 0);                 // Boden (Oberkante y=0)
    wall(.5, 5, TZ + 2, TX + .5, 5, 0); wall(.5, 5, TZ + 2, -TX - .5, 5, 0); wall(TX + 2, 5, .5, 0, 5, TZ + .5); wall(TX + 2, 5, .5, 0, 5, -TZ - .5); wall(TX + 2, .5, TZ + 2, 0, 10.5, 0);   // Wände und Decke
    var bodies = params.dice.map(function (d) {
      var b = new C.Body({ mass: 1, material: mDie, linearDamping: .06, angularDamping: .10 });
      b.addShape(new C.Box(new C.Vec3(HALF, HALF, HALF)));
      b.position.set(d.p[0], d.p[1], d.p[2]); b.quaternion.set(d.q[0], d.q[1], d.q[2], d.q[3]);
      b.velocity.set(d.v[0], d.v[1], d.v[2]); b.angularVelocity.set(d.w[0], d.w[1], d.w[2]);
      world.addBody(b); return b;
    });
    var frames = [], step = 0, calm = 0, rerolls = 0, maxSteps = 60 * 14, res = null;
    function rec() { var f = []; bodies.forEach(function (b) { f.push(+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2), +b.quaternion.x.toFixed(3), +b.quaternion.y.toFixed(3), +b.quaternion.z.toFixed(3), +b.quaternion.w.toFixed(3)); }); frames.push(f); }
    rec();
    while (step < maxSteps) {
      world.step(DT); step++;
      if (step % EVERY === 0) rec();
      var still = bodies.every(function (b) { return b.velocity.length() < .12 && b.angularVelocity.length() < .25 && b.position.y < HALF + .06; });
      calm = still ? calm + 1 : 0;
      if (calm > 24) {
        var tf = bodies.map(function (b) { return topFace([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]); });
        if (tf.every(function (t) { return t.d > .985; })) { res = tf.map(function (t) { return t.v; }); break; }
        // Schräg liegen geblieben (Würfel lehnt an Wand oder anderem Würfel): wie am echten Tisch neu anstoßen
        if (rerolls++ < 3) { bodies.forEach(function (b, i) { if (tf[i].d <= .985) { b.velocity.set(rnd(-2, 2), 7, rnd(-2, 2)); b.angularVelocity.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); } }); calm = 0; }
        else { res = tf.map(function (t) { return t.v; }); break; }
      }
    }
    if (!res) res = bodies.map(function (b) { return topFace([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]).v; });
    // Endlage ein letztes Mal exakt festhalten
    rec(); rec();
    return { v: res, track: { n: n, hz: 60 / EVERY, f: frames } };
  };

  // ---------- Darstellung ----------
  function faceTex(v, cyber, size) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size; var x = cv.getContext('2d');
    var P = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.28, .28], [.5, .5], [.72, .72]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]], 6: [[.28, .25], [.72, .25], [.28, .5], [.72, .5], [.28, .75], [.72, .75]] };
    if (cyber) { x.fillStyle = '#0b1424'; x.fillRect(0, 0, size, size); x.strokeStyle = '#00f0ff'; x.lineWidth = size * .04; x.strokeRect(size * .03, size * .03, size * .94, size * .94); }
    else { var g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#ece3c8'); x.fillStyle = g; x.fillRect(0, 0, size, size); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = size * .03; x.strokeRect(size * .015, size * .015, size * .97, size * .97); }
    P[v].forEach(function (p) { x.beginPath(); x.arc(p[0] * size, p[1] * size, size * (v === 1 ? .12 : .085), 0, 7); if (cyber) { x.fillStyle = '#fcee09'; x.shadowColor = '#fcee09'; x.shadowBlur = size * .05; } else { x.fillStyle = v === 1 ? '#c62828' : '#16161c'; } x.fill(); x.shadowBlur = 0; });
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  D.view = function (container) {
    var V = { dice: [], busy: false }, T = null;
    var cs = getComputedStyle(container); if (cs.position === 'static') container.style.position = 'relative';
    var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:60;touch-action:none';
    var hint = document.createElement('div'); hint.style.cssText = 'position:absolute;left:50%;bottom:6%;transform:translateX(-50%);z-index:61;pointer-events:none;background:rgba(10,14,30,.88);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:12px;padding:8px 14px;font:700 14px system-ui,sans-serif;text-align:center;display:none;max-width:92%';
    container.appendChild(cv); container.appendChild(hint);
    var renderer, scene, cam, ray, plane, tray, shadowPlane, lastStyle = '', mats = null, geo = null, raf = 0, hideT = 0;
    function cyber() { return document.documentElement.getAttribute('data-style') === 'cyber'; }
    function build() {
      if (renderer) return;
      renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); renderer.setClearColor(0, 0); renderer.shadowMap.enabled = true;
      scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, 1, .1, 100); ray = new THREE.Raycaster(); plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6);
      scene.add(new THREE.AmbientLight(0xffffff, .72));
      var dl = new THREE.DirectionalLight(0xffffff, .75); dl.position.set(-4, 14, 6); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024);
      var sc = dl.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 40; scene.add(dl);
      shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.ShadowMaterial({ opacity: .38 })); shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
      var shp = new THREE.Shape(), r = .5, w = TX, h = TZ; shp.moveTo(-w + r, -h); shp.lineTo(w - r, -h); shp.quadraticCurveTo(w, -h, w, -h + r); shp.lineTo(w, h - r); shp.quadraticCurveTo(w, h, w - r, h); shp.lineTo(-w + r, h); shp.quadraticCurveTo(-w, h, -w, h - r); shp.lineTo(-w, -h + r); shp.quadraticCurveTo(-w, -h, -w + r, -h);
      tray = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false })); tray.rotation.x = -Math.PI / 2; tray.position.y = .005; tray.visible = false; scene.add(tray);
      geo = new THREE.BoxGeometry(1, 1, 1);
      resize();
    }
    function mk() {
      var cy = cyber(), key = cy ? 'c' : 's';
      if (mats && mats.key === key) return mats;
      mats = { key: key, list: FACE_V.map(function (v) { return new THREE.MeshStandardMaterial({ map: faceTex(v, cy, 128), roughness: cy ? .35 : .55, metalness: cy ? .3 : 0 }); }) };
      V.dice.forEach(function (d) { d.mesh.material = mats.list; });
      return mats;
    }
    function resize() {
      if (!renderer) return;
      var w = container.clientWidth || 400, h = container.clientHeight || 300; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
      cam.aspect = w / h; var vf = cam.fov * Math.PI / 180, needH = (TZ + 1.4) * 2, needW = (TX + 1.4) * 2;
      var dist = Math.max(needH / (2 * Math.tan(vf / 2)), needW / (2 * Math.tan(vf / 2) * cam.aspect));
      cam.position.set(0, dist * .93, dist * .37); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(container);
    function ensure(n) {
      while (V.dice.length < n) { var m = new THREE.Mesh(geo, mk().list); m.castShadow = true; scene.add(m); V.dice.push({ mesh: m }); }
      V.dice.forEach(function (d, i) { d.mesh.visible = i < n; });
    }
    function loop() { raf = 0; if (renderer) { renderer.render(scene, cam); } if (V._anim) raf = requestAnimationFrame(loop); }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    V.show = function (on) { cv.style.display = on ? '' : 'none'; };
    V.hide = function () { clearTimeout(hideT); V._anim = 0; hint.style.display = 'none'; if (renderer) { tray.visible = false; V.dice.forEach(function (d) { d.mesh.visible = false; }); renderer.render(scene, cam); } };
    V.hint = function (t) { hint.textContent = t || ''; hint.style.display = t ? '' : 'none'; };
    function setDie(d, p, q) { d.mesh.position.set(p[0], p[1], p[2]); d.mesh.quaternion.set(q[0], q[1], q[2], q[3]); }
    // Würfel ziehen und werfen -> Wurfdaten. opts.hint = Text. Mit V.cancel() abbrechbar.
    V.drag = function (n, opts) {
      opts = opts || {};
      return D.ready().then(function () {
        build(); mk(); clearTimeout(hideT); ensure(n); tray.visible = true; V.busy = true; V._anim = 1; resize();
        var held = null, hist = [], q0 = V.dice.map(function () { return randQ(); }), spin = V.dice.map(function () { return [rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)]; }), pos = V.dice.map(function (_, i) { return [-TX + 1.2, .5, (i - (n - 1) / 2) * 1.5]; }), tmp = new THREE.Vector3(), t0 = performance.now(), last = t0;
        V.dice.slice(0, n).forEach(function (d, i) { setDie(d, pos[i], q0[i]); });
        V.hint(opts.hint || (window.SITE ? SITE.T('Würfel mit der Maus ziehen und loslassen zum Werfen', 'Drag the dice and release to throw') : 'Drag to throw'));
        container.style.cursor = 'grab'; container.style.touchAction = 'none';
        function pt(e) { var r = cv.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); return ray.ray.intersectPlane(plane, tmp) ? [tmp.x, tmp.z] : null; }
        function tick(now) {
          var dt = Math.min(.05, (now - last) / 1000); last = now;
          V.dice.slice(0, n).forEach(function (d, i) {
            var s = held ? 1 : .35, ax = new THREE.Vector3(spin[i][0], spin[i][1], spin[i][2]), a = ax.length() * dt * s;
            if (a > 0) { var dq = new THREE.Quaternion().setFromAxisAngle(ax.normalize(), a); var cq = new THREE.Quaternion(q0[i][0], q0[i][1], q0[i][2], q0[i][3]).premultiply(dq); q0[i] = [cq.x, cq.y, cq.z, cq.w]; }
            var py = held ? 1.6 : .5 + .12 * Math.abs(Math.sin((now - t0) / 500));
            d.mesh.position.set(pos[i][0], py, pos[i][2]); d.mesh.quaternion.set(q0[i][0], q0[i][1], q0[i][2], q0[i][3]);
          });
          if (V._tick) requestAnimationFrame(tick);
        }
        V._tick = 1; requestAnimationFrame(tick); kick();
        return new Promise(function (res, rej) {
          function down(e) {
            var p = pt(e); if (!p) return;
            var hit = V.dice.slice(0, n).some(function (d) { return ray.ray.distanceToPoint(d.mesh.position) < 1.15; });      // nur ein Griff direkt auf den Würfel startet den Wurf, der Rest des Bretts bleibt bedienbar
            if (!hit) return;
            held = { id: e.pointerId }; hist = [{ t: e.timeStamp, x: p[0], z: p[1] }]; try { container.setPointerCapture(e.pointerId); } catch (er) {} container.style.cursor = 'grabbing'; e.preventDefault(); e.stopPropagation(); move(e);
          }
          function move(e) {
            if (!held) return; var p = pt(e); if (!p) return;
            var cx = Math.max(-TX + .8, Math.min(TX - .8, p[0])), cz = Math.max(-TZ + .8, Math.min(TZ - .8, p[1]));
            hist.push({ t: e.timeStamp, x: cx, z: cz }); while (hist.length > 2 && e.timeStamp - hist[0].t > 160) hist.shift();
            for (var i = 0; i < n; i++) pos[i] = [cx, .5, cz + (i - (n - 1) / 2) * 1.25];
            if (e.cancelable) e.preventDefault(); e.stopPropagation();
          }
          function up(e) {
            if (!held) return; held = null; container.style.cursor = ''; e.stopPropagation(); try { container.releasePointerCapture(e.pointerId); } catch (er) {}
            var a = hist[0], b = hist[hist.length - 1], dtm = Math.max(.03, (b.t - a.t) / 1000), vx = (b.x - a.x) / dtm, vz = (b.z - a.z) / dtm, sp = Math.hypot(vx, vz);
            if (sp > 46) { vx *= 46 / sp; vz *= 46 / sp; sp = 46; }
            cleanup();
            var dice = [];
            for (var i = 0; i < n; i++) {
              // Drehung: Rollen in Wurfrichtung plus zufälliges Taumeln aus der Hand
              var w = [vz * 1.1 + rnd(-9, 9) + spin[i][0] * 1.5, rnd(-8, 8) + spin[i][1] * 1.5, -vx * 1.1 + rnd(-9, 9) + spin[i][2] * 1.5];
              dice.push({ p: [pos[i][0], 1.6, pos[i][2]], q: q0[i].slice(), v: [vx * (1 + i * .02), rnd(-2, 0), vz], w: w });
            }
            res({ dice: dice });
          }
          function cleanup() { container.removeEventListener('pointerdown', down, true); container.removeEventListener('pointermove', move, true); container.removeEventListener('pointerup', up, true); container.removeEventListener('pointercancel', up, true); container.style.cursor = ''; container.style.touchAction = ''; V._tick = 0; V.hint(''); V._cleanup = null; }
          V._cleanup = function () { cleanup(); rej(new Error('cancel')); };
          container.addEventListener('pointerdown', down, true); container.addEventListener('pointermove', move, true); container.addEventListener('pointerup', up, true); container.addEventListener('pointercancel', up, true);
        });
      });
    };
    V.cancel = function () { if (V._cleanup) V._cleanup(); V.busy = false; V.hide(); };
    // Gerechnete Bahn abspielen. Rückgabe: Promise (Würfel liegen)
    V.play = function (track, opts) {
      opts = opts || {};
      return D.ready().then(function () {
        build(); mk(); clearTimeout(hideT); if (V._cleanup) { try { V._cleanup(); } catch (e) {} }
        V._tick = 0; V.busy = true; V.hint(''); ensure(track.n); tray.visible = true; resize(); V._anim = 1; kick();
        var frames = track.f, hz = track.hz, n = track.n, t0 = performance.now(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
        return new Promise(function (res) {
          var done = false;
          function fin() { if (done) return; done = true; V._anim = 1; setFrame(frames.length - 1, 0); kick(); if (opts.sound) opts.sound('end'); hideT = setTimeout(function () { V.busy = false; V.hide(); }, opts.hold == null ? 1600 : opts.hold); res(); }
          function setFrame(i, u) {
            var a = frames[i], b = frames[Math.min(frames.length - 1, i + 1)];
            for (var k = 0; k < n; k++) {
              var o = k * 7, d = V.dice[k];
              d.mesh.position.set(a[o] + (b[o] - a[o]) * u, a[o + 1] + (b[o + 1] - a[o + 1]) * u, a[o + 2] + (b[o + 2] - a[o + 2]) * u);
              q1.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]); q2.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]); d.mesh.quaternion.copy(q1).slerp(q2, u);
            }
          }
          var prevY = null;
          function step() {
            if (done) return;
            var el = (performance.now() - t0) / 1000 * hz, i = Math.floor(el);
            if (i >= frames.length - 1) { fin(); requestAnimationFrame(function () {}); return; }
            setFrame(i, el - i);
            if (opts.sound) { var y = frames[i][1]; if (prevY != null && prevY > .62 && y <= .62) opts.sound('hit'); prevY = y; }
            requestAnimationFrame(step);
          }
          step();
          // Notbremse für Hintergrund-Tabs: Das Spiel darf nicht hängen
          setTimeout(fin, frames.length / hz * 1000 + 1500);
        });
      });
    };
    V.destroy = function () { V.cancel(); if (ro) ro.disconnect(); cv.remove(); hint.remove(); };
    return V;
  };
})();
