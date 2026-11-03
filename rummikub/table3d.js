/* Rummikub 3D-Tisch: zweite Ansicht auf denselben Spielzustand (state) wie die 2D-Oberfläche.
   Jeder Spieler hat sein Brett (Aufsteller), in der Mitte liegt das Legefeld, in einer Ecke der Haufen.
   Zwei Looks: "classic" (wie das 2D-Spiel: Filz, Holz, Elfenbein) und "cyber" (Neon). */
(function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var LIBS = ['three@0.128.0/build/three.min.js', 'three@0.128.0/examples/js/controls/OrbitControls.js',
    'three@0.128.0/examples/js/shaders/CopyShader.js', 'three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',
    'three@0.128.0/examples/js/postprocessing/EffectComposer.js', 'three@0.128.0/examples/js/postprocessing/MaskPass.js',
    'three@0.128.0/examples/js/postprocessing/RenderPass.js', 'three@0.128.0/examples/js/postprocessing/ShaderPass.js',
    'three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js'];
  function loadLibs() {
    if (window.THREE && THREE.UnrealBloomPass) return Promise.resolve();
    return LIBS.reduce(function (pr, u) {
      return pr.then(function () {
        return new Promise(function (res, rej) {
          var s = document.createElement('script'); s.src = CDN + u; s.onload = res;
          s.onerror = function () { rej(new Error(u)); }; document.head.appendChild(s);
        });
      });
    }, Promise.resolve());
  }

  var TW = .9, TH = 1.2, TT = .34;                  // Steinbreite, -höhe, -dicke
  var RACKD = 11.8, RACKW = 8.6;                    // Abstand der Bretter vom Tischmittelpunkt, halbe Brettbreite
  var HEAP = { x: 12.2, z: -12.2 };                 // Haufen in der Tischecke
  var SEAT_PHI = [0, -Math.PI / 2, Math.PI, Math.PI / 2];      // Süd, West, Nord, Ost
  var SEATS = { 1: [0], 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
  var NUMCOL = {
    classic: { red: '#c1272d', blue: '#1f4aa8', yellow: '#e0900a', black: '#1b1b1b' },
    cyber: { red: '#ff2a55', blue: '#2e9bff', yellow: '#fcee09', black: '#c06bff' }
  };

  var R3D = window.R3D = { on: false, style: 'classic', ready: false };
  try { R3D.style = localStorage.getItem('rk3d-style') === 'cyber' ? 'cyber' : 'classic'; } catch (e) {}

  var T = null;      // three-Objekte
  var meshes = {};   // tile.id -> {g, body, outline}
  var backs = {};    // 'p1', 'heap' ... -> Array von Rückseiten
  var tweens = [];
  var mats = [];     // Legematten
  var pad = null, heap = [], rackKeys = '', staticGroup = null, rackGroup = null, pickables = [];
  var texCache = {}, matCache = {};

  /* ---------- Hilfen ---------- */
  function $(id) { return document.getElementById(id); }
  function toWorld(seat, u, y, v) {
    var f = SEAT_PHI[seat], c = Math.cos(f), s = Math.sin(f);
    return new THREE.Vector3(u * c + v * s, y, -u * s + v * c);
  }
  function seatOf(i) {
    var n = state.players.length, rel = (i - state.myIndex + n) % n;
    return (SEATS[n] || SEATS[4])[rel];
  }
  function myTurn() { return state.currentPlayer === state.myIndex && !state.aiThinking && state.screen === 'game' && state.winner === null; }
  function rnd(i) { var s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function cyber() { return R3D.style === 'cyber'; }

  /* ---------- Texturen und Materialien ---------- */
  function roundRect(x, X, Y, w, h, r) {
    x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
    x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
  }
  function faceTex(tile) {
    var st = R3D.style, key = st + '|' + (tile.isJoker ? 'J' : tile.color + tile.number);
    if (texCache[key]) return texCache[key];
    var c = document.createElement('canvas'); c.width = 128; c.height = 160;
    var x = c.getContext('2d'), col = tile.isJoker ? null : NUMCOL[st][tile.color];
    if (st === 'classic') {
      var g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#f8f1da'); g.addColorStop(1, '#e4d9ba');
      x.fillStyle = g; roundRect(x, 0, 0, 128, 160, 14); x.fill();
      x.strokeStyle = 'rgba(120,90,40,.35)'; x.lineWidth = 3; roundRect(x, 6, 6, 116, 148, 10); x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (tile.isJoker) {
        var jg = x.createLinearGradient(0, 30, 128, 130); jg.addColorStop(0, '#c1272d'); jg.addColorStop(.5, '#e0900a'); jg.addColorStop(1, '#1f4aa8');
        x.fillStyle = jg; x.font = '900 100px Georgia,serif'; x.fillText('★', 64, 82);
      } else {
        x.fillStyle = col; x.font = 'bold ' + (tile.number > 9 ? 78 : 96) + 'px Georgia,serif'; x.fillText(String(tile.number), 64, 76);
        x.lineWidth = 7; x.strokeStyle = col; x.beginPath(); x.arc(64, 132, 10, 0, 6.3); x.stroke();
      }
    } else {
      x.fillStyle = '#080b14'; roundRect(x, 0, 0, 128, 160, 8); x.fill();
      var neon = col || '#00f0ff';
      x.strokeStyle = neon; x.globalAlpha = .55; x.lineWidth = 3; roundRect(x, 7, 7, 114, 146, 5); x.stroke(); x.globalAlpha = 1;
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = neon; x.shadowBlur = 18; x.fillStyle = neon;
      if (tile.isJoker) { x.font = '900 100px "Segoe UI",sans-serif'; x.fillStyle = '#00f0ff'; x.fillText('★', 64, 82); x.shadowColor = '#ff2fa8'; x.fillText('★', 64, 82); }
      else { x.font = '900 ' + (tile.number > 9 ? 74 : 92) + 'px Orbitron,"Segoe UI",sans-serif'; x.fillText(String(tile.number), 64, 78); x.fillText(String(tile.number), 64, 78); }
      x.shadowBlur = 0; x.fillStyle = neon; x.globalAlpha = .7; x.fillRect(44, 134, 40, 4); x.globalAlpha = 1;
    }
    var tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    return texCache[key] = tex;
  }
  function backTex() {
    var st = R3D.style, key = st + '|back';
    if (texCache[key]) return texCache[key];
    var c = document.createElement('canvas'); c.width = 64; c.height = 80; var x = c.getContext('2d');
    if (st === 'classic') { x.fillStyle = '#ecdfbf'; x.fillRect(0, 0, 64, 80); x.strokeStyle = 'rgba(120,90,40,.25)'; x.lineWidth = 2; x.strokeRect(5, 5, 54, 70); }
    else { x.fillStyle = '#080b14'; x.fillRect(0, 0, 64, 80); x.strokeStyle = 'rgba(0,240,255,.5)'; x.lineWidth = 2; x.strokeRect(4, 4, 56, 72); x.beginPath(); x.moveTo(4, 4); x.lineTo(60, 76); x.moveTo(60, 4); x.lineTo(4, 76); x.globalAlpha = .25; x.stroke(); }
    return texCache[key] = new THREE.CanvasTexture(c);
  }
  function edgeMat() {
    var k = 'edge' + R3D.style;
    if (matCache[k]) return matCache[k];
    return matCache[k] = cyber() ? new THREE.MeshStandardMaterial({ color: 0x0a0d16, emissive: 0x00a8bb, emissiveIntensity: .8, roughness: .4 })
      : new THREE.MeshStandardMaterial({ color: 0xe9dec0, roughness: .55 });
  }
  function faceMat(tile) {
    var key = 'f' + R3D.style + (tile.isJoker ? 'J' : tile.color + tile.number);
    if (matCache[key]) return matCache[key];
    var tex = faceTex(tile);
    return matCache[key] = cyber() ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .9, roughness: .4 })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: .5 });
  }
  function backMat() {
    var k = 'back' + R3D.style;
    if (matCache[k]) return matCache[k];
    var t = backTex();
    return matCache[k] = cyber() ? new THREE.MeshStandardMaterial({ map: t, emissive: 0x0a3a44, roughness: .5 }) : new THREE.MeshStandardMaterial({ map: t, roughness: .55 });
  }

  /* ---------- Szene ---------- */
  var tileGeo;
  function initThree() {
    var wrap = $('rk3dStage');
    var r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); wrap.appendChild(r.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 600);
    var controls = new THREE.OrbitControls(camera, r.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 48; controls.maxPolarAngle = 1.45;
    tileGeo = new THREE.BoxGeometry(TW, TH, TT);
    T = { r: r, scene: scene, camera: camera, controls: controls, composer: null, ray: new THREE.Raycaster(), mouse: new THREE.Vector2() };
    setupInput();
    addEventListener('resize', resize);
    requestAnimationFrame(tick);
    setInterval(function () { runTweens(performance.now()); }, 50);
  }
  function resize() {
    if (!T) return;
    var w = innerWidth, h = innerHeight;
    T.r.setSize(w, h, false); if (T.composer) T.composer.setSize(w, h);
    T.camera.aspect = w / h; T.camera.updateProjectionMatrix();
  }
  function disposeGroup(g) { if (g && g.parent) g.parent.remove(g); }

  function buildStatic() {
    disposeGroup(staticGroup); disposeGroup(rackGroup); rackGroup = null; rackKeys = '';
    var scene = T.scene, st = R3D.style, G = new THREE.Group(); staticGroup = G; scene.add(G);
    for (var i = scene.children.length - 1; i >= 0; i--) { var o = scene.children[i]; if (o.userData && o.userData.env) scene.remove(o); }
    scene.fog = cyber() ? new THREE.FogExp2(0x05060b, .012) : new THREE.FogExp2(0x1a0f08, .012);
    T.r.setClearColor(cyber() ? 0x05060b : 0x1a0f08);
    var amb = new THREE.AmbientLight(cyber() ? 0x3a4a70 : 0xffe9c8, cyber() ? .55 : .75); amb.userData.env = true; scene.add(amb);
    var dl = new THREE.DirectionalLight(cyber() ? 0xaaccff : 0xfff1d6, cyber() ? .45 : .9); dl.position.set(6, 18, 10); dl.userData.env = true; scene.add(dl);
    var lamp = new THREE.PointLight(cyber() ? 0x00f0ff : 0xffd9a0, cyber() ? 1.2 : .8, 60); lamp.position.set(0, 14, 0); lamp.userData.env = true; scene.add(lamp);
    // Tisch
    var felt = new THREE.Mesh(new THREE.BoxGeometry(31, .5, 31), new THREE.MeshStandardMaterial(cyber()
      ? { color: 0x080b12, roughness: .35, metalness: .6, emissive: 0x021017 } : { color: 0x0d6b3a, roughness: .95 }));
    felt.position.y = -.25; G.add(felt);
    if (cyber()) {
      var grid = new THREE.GridHelper(31, 31, 0x00f0ff, 0x0b4a56); grid.position.y = .01; grid.material.transparent = true; grid.material.opacity = .45; G.add(grid);
      var fe = new THREE.LineSegments(new THREE.EdgesGeometry(felt.geometry), new THREE.LineBasicMaterial({ color: 0x00f0ff })); fe.position.copy(felt.position); G.add(fe);
    } else {
      var wood = new THREE.MeshStandardMaterial({ color: 0x6b3f1d, roughness: .6 });
      [[0, -15.9, 33, .9], [0, 15.9, 33, .9], [-15.9, 0, .9, 33], [15.9, 0, .9, 33]].forEach(function (b) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(b[2], .9, b[3]), wood); m.position.set(b[0], -.05, b[1]); G.add(m);
      });
    }
    // Boden / Umgebung
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: cyber() ? 0x04050a : 0x2a1a0e, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.2; G.add(floor);
    if (cyber()) {
      var fg = new THREE.GridHelper(400, 200, 0x00f0ff, 0x0b3f4a); fg.position.y = -2.15; fg.material.transparent = true; fg.material.opacity = .35; G.add(fg);
      var bm = new THREE.MeshStandardMaterial({ color: 0x0a0e1c, roughness: .8, metalness: .3, emissive: 0x03050c }), cols = [0x00f0ff, 0xff2fa8, 0xfcee09, 0x9a6bff];
      for (var n = 0; n < 90; n++) {
        var a = Math.random() * 6.283, d = 70 + Math.random() * 60, w = 4 + Math.random() * 8, h = 16 + Math.pow(Math.random(), 2) * 80;
        var geo = new THREE.BoxGeometry(w, h, w), m = new THREE.Mesh(geo, bm); m.position.set(Math.cos(a) * d, h / 2 - 2.2, Math.sin(a) * d); G.add(m);
        var e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: cols[n % 4], transparent: true, opacity: .8 })); e.position.copy(m.position); G.add(e);
      }
      try {
        if (!T.composer) {
          T.composer = new THREE.EffectComposer(T.r); T.composer.addPass(new THREE.RenderPass(scene, T.camera));
          T.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), .5, .45, .55));
        }
      } catch (err) { T.composer = null; }
    } else {
      T.composer = null;
      // Wände angedeutet: dunkle Vertäfelung weit hinten
      var wallM = new THREE.MeshStandardMaterial({ color: 0x24150b, roughness: 1 });
      [[0, -60, 0], [0, 60, 0], [-60, 0, Math.PI / 2], [60, 0, Math.PI / 2]].forEach(function (w) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(130, 40), wallM); m.position.set(w[0], 16, w[1]); m.rotation.y = w[2]; G.add(m);
      });
    }
    resize();
  }

  function buildRacks(n) {
    var key = n + R3D.style; if (key === rackKeys) return; rackKeys = key;
    disposeGroup(rackGroup); rackGroup = new THREE.Group(); T.scene.add(rackGroup);
    var seats = SEATS[n] || SEATS[4];
    var wood = cyber() ? new THREE.MeshStandardMaterial({ color: 0x0c1019, roughness: .4, metalness: .6 }) : new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: .55 });
    var trim = new THREE.LineBasicMaterial({ color: 0x00f0ff });
    seats.forEach(function (seat, k) {
      function box(w, h, d, u, y, v, kind) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood), p = toWorld(seat, u, y, RACKD + v);
        m.position.copy(p); m.rotation.y = SEAT_PHI[seat]; rackGroup.add(m);
        if (cyber()) { var e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), trim); e.position.copy(p); e.rotation.y = SEAT_PHI[seat]; rackGroup.add(e); }
        if (kind) { m.userData = { kind: kind, seat: seat }; m.userData.rack = true; }
        return m;
      }
      var mine = k === 0;
      var s0 = box(RACKW * 2 + 1, .4, 1.5, 0, .3, .55, mine ? 'rack' : null);
      box(RACKW * 2 + 1, .4, .16, 0, .62, 1.33, mine ? 'rack' : null);
      var s1 = box(RACKW * 2 + 1, .4, 1.5, 0, 1.4, -1.1, mine ? 'rack' : null);
      box(RACKW * 2 + 1, .35, .16, 0, 1.78, -.38, mine ? 'rack' : null);
      var s2 = box(RACKW * 2 + 1, .4, 1.5, 0, 2.5, -2.75, mine ? 'rack' : null);
      box(RACKW * 2 + 1, .35, .16, 0, 2.88, -2.03, mine ? 'rack' : null);
      box(RACKW * 2 + 1, 1.5, .3, 0, .75, -3.55, null);
      [-1, 1].forEach(function (sd) { box(.3, 3.2, 5.3, sd * (RACKW + .65), 1.4, -1.45, null); });
    });
  }

  /* ---------- Steine ---------- */
  function makeTile(tile) {
    var mats6 = [edgeMat(), edgeMat(), edgeMat(), edgeMat(), faceMat(tile), backMat()];
    var body = new THREE.Mesh(tileGeo, mats6); body.rotation.order = 'YXZ';
    var outline = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.BackSide }));
    outline.scale.set(1.12, 1.1, 1.3); outline.visible = false; outline.raycast = function () {};
    body.add(outline);
    body.userData = { kind: 'tile', id: tile.id };
    return { g: body, outline: outline, tile: tile, style: R3D.style, last: null };
  }
  function makeBack() {
    var m = new THREE.Mesh(tileGeo, backMat()); m.rotation.order = 'YXZ'; m.userData = { kind: 'back' }; return m;
  }
  function setTarget(obj, pos, rx, ry, rz, instant, from) {
    var t = obj.userData.tg;
    if (t && Math.abs(t.x - pos.x) < .001 && Math.abs(t.y - pos.y) < .001 && Math.abs(t.z - pos.z) < .001 && Math.abs(t.rx - rx) < .001 && Math.abs(t.ry - ry) < .001) return;
    obj.userData.tg = { x: pos.x, y: pos.y, z: pos.z, rx: rx, ry: ry, rz: rz };
    if (instant || obj.userData.drag) { obj.position.copy(pos); obj.rotation.set(rx, ry, rz); return; }
    var p0 = from || obj.position.clone(), r0 = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
    if (from) { obj.position.copy(from); }
    var dist = p0.distanceTo(pos), arc = Math.min(2.2, .5 + dist * .12);
    tweens = tweens.filter(function (w) { return w.obj !== obj; });
    tweens.push({ obj: obj, t0: performance.now(), dur: 330 + Math.min(350, dist * 25), p0: p0, p1: pos.clone(), r0: r0, r1: { x: rx, y: ry, z: rz }, arc: arc });
  }
  function runTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var w = tweens[i], k = Math.min(1, (now - w.t0) / w.dur), e = k * k * (3 - 2 * k);
      if (w.obj.userData.drag) { tweens.splice(i, 1); continue; }
      w.obj.position.lerpVectors(w.p0, w.p1, e); w.obj.position.y += Math.sin(k * Math.PI) * w.arc;
      w.obj.rotation.set(w.r0.x + (w.r1.x - w.r0.x) * e, w.r0.y + (w.r1.y - w.r0.y) * e, w.r0.z + (w.r1.z - w.r0.z) * e);
      if (k >= 1) tweens.splice(i, 1);
    }
  }

  var LEAN = .2;
  function rackLayout(items) {      // items: true = Stein, false = Trennstrich
    var res = [], u = -RACKW, shelf = 0;
    items.forEach(function (isTile) {
      var w = isTile ? 1.02 : .5;
      if (u + w > RACKW + .05) { shelf++; u = -RACKW; }
      if (isTile) res.push({ u: u + .51, shelf: Math.min(shelf, 2) });
      u += w;
    });
    return res;
  }
  var SHELF = [{ y: .5, v: .55 }, { y: 1.6, v: -1.1 }, { y: 2.7, v: -2.75 }];
  function rackPos(seat, slot) {
    var sh = SHELF[slot.shelf];
    return toWorld(seat, slot.u, sh.y + TH / 2 * Math.cos(LEAN) + .02, RACKD + sh.v);
  }
  function tableLayout() {
    var x = -8.5, z = -4.8, res = [];
    state.table.forEach(function (g, gi) {
      var w = g.length * 1.02;
      if (x + w > 8.6 && x > -8.5) { x = -8.5; z += 1.95; }
      res.push({ gi: gi, x0: x, z: z, len: g.length }); x += w + .9;
    });
    if (x + 1.6 > 8.6) { x = -8.5; z += 1.95; }
    return { groups: res, pad: { x: x, z: z } };
  }

  function ensureMat(i) {
    if (mats[i]) return mats[i];
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: cyber() ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.rotation.x = -Math.PI / 2; m.position.y = .03; T.scene.add(m); mats[i] = m; return m;
  }
  function padTex() {
    var k = 'pad' + R3D.style; if (texCache[k]) return texCache[k];
    var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
    x.strokeStyle = cyber() ? '#00f0ff' : '#fde68a'; x.lineWidth = 6; x.setLineDash([14, 10]); x.strokeRect(10, 10, 108, 108); x.setLineDash([]);
    x.fillStyle = x.strokeStyle; x.fillRect(58, 30, 12, 68); x.fillRect(30, 58, 68, 12);
    return texCache[k] = new THREE.CanvasTexture(c);
  }

  /* ---------- Synchronisieren: Zustand -> Szene ---------- */
  R3D.sync = function () {
    if (!R3D.on || !T) return;
    if (!(state.screen === 'game' || state.screen === 'ended')) { R3D.close(true); return; }
    var n = state.players.length, my = state.myIndex, now = performance.now();
    buildRacks(n);
    var wanted = {}; pickables = [];
    var heapPos = new THREE.Vector3(HEAP.x, .6, HEAP.z);
    var turn = myTurn(), sel = state.selectedForMove && state.selectedForMove.tile ? state.selectedForMove.tile.id : null;

    // eigenes Brett
    var hand = state.hands[my] || [];
    var slots = rackLayout(hand.map(function (t) { return !t.separator; })), si = 0;
    hand.forEach(function (t, idx) {
      if (t.separator) return;
      var slot = slots[si++], pos = rackPos(0, slot);
      place(t, pos, -LEAN, 0, 0, { type: 'hand', index: idx }, heapPos);
      wanted[t.id] = true;
    });
    // Tisch
    var lay = tableLayout();
    lay.groups.forEach(function (gl) {
      var g = state.table[gl.gi], valid = isValidGroup(g);
      g.forEach(function (t, ti) {
        place(t, new THREE.Vector3(gl.x0 + ti * 1.02 + .51, TT / 2, gl.z), -Math.PI / 2, 0, 0, { type: 'table', groupIndex: gl.gi, tileIndex: ti }, null);
        wanted[t.id] = true;
      });
      var m = ensureMat(gl.gi);
      m.visible = true; m.scale.set(gl.len * 1.02 + .3, 1.55, 1); m.position.set(gl.x0 + gl.len * 1.02 / 2, .03, gl.z);
      m.material.color.set(cyber() ? (valid ? 0x00f0ff : 0xff2a55) : (valid ? 0x8fe0a8 : 0xe86060)); m.material.opacity = cyber() ? (valid ? .12 : .22) : .2;
      m.userData = { kind: 'mat', gi: gl.gi }; pickables.push(m);
    });
    for (var mi = lay.groups.length; mi < mats.length; mi++) if (mats[mi]) mats[mi].visible = false;
    // "+ Neu"-Feld
    if (!pad) { pad = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.55), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.userData = { kind: 'pad' }; T.scene.add(pad); }
    pad.material.map = padTex(); pad.material.needsUpdate = true;
    pad.visible = turn; pad.position.set(lay.pad.x + .75, .04, lay.pad.z);
    if (turn) pickables.push(pad);
    // alte Steine entfernen
    for (var id in meshes) if (!wanted[id]) { T.scene.remove(meshes[id].g); delete meshes[id]; }
    for (var id2 in meshes) {
      var e = meshes[id2], isSel = String(sel) === id2, recent = state.playedTileIds.indexOf(+id2) >= 0 || state.drawnTileId === +id2;
      e.sel = isSel;
      e.outline.visible = isSel || recent;
      e.outline.material.color.set(isSel ? (cyber() ? 0x00f0ff : 0xffffff) : 0xffd23a);
      e.g.userData.movable = turn;
      pickables.push(e.g);
    }
    // Gegner-Bretter (Rückseiten)
    state.players.forEach(function (name, i) {
      if (i === my) return;
      var cnt = (state.hands[i] || []).filter(function (t) { return !t.separator; }).length, key = 'p' + i, seat = seatOf(i);
      var arr = backs[key] = backs[key] || [];
      var sl = rackLayout(Array(cnt).fill(true));
      while (arr.length < cnt) { var b = makeBack(); T.scene.add(b); arr.push(b); b.position.copy(heapPos); }
      while (arr.length > cnt) T.scene.remove(arr.pop());
      arr.forEach(function (b, k) { setTarget(b, rackPos(seat, sl[k]), -LEAN, SEAT_PHI[seat], 0); });
    });
    // Haufen
    var pc = Math.min(state.pool.length, 80);
    while (heap.length < pc) { var hb = makeBack(); hb.userData.kind = 'heap'; T.scene.add(hb); heap.push(hb); hb.position.set(HEAP.x, 8, HEAP.z); }
    while (heap.length > pc) T.scene.remove(heap.pop());
    heap.forEach(function (b, i) {
      var N = Math.max(pc, 1), a = rnd(i) * 6.283, r = Math.sqrt(rnd(i + 500)) * 2.5 * (1 - i / N * .35), layer = Math.floor(i / 14);
      setTarget(b, new THREE.Vector3(HEAP.x + Math.cos(a) * r, TT / 2 + layer * (TT + .02), HEAP.z + Math.sin(a) * r), Math.PI / 2, rnd(i + 900) * 6.283, 0, false);
      b.userData.kind = 'heap'; pickables.push(b);
    });
    // eigene Rack-Flächen
    if (rackGroup) rackGroup.children.forEach(function (c) { if (c.userData && c.userData.kind === 'rack') pickables.push(c); });
    updateHud();
  };
  function place(tile, pos, rx, ry, rz, source, from) {
    var e = meshes[tile.id];
    if (e && (e.tile.isJoker !== tile.isJoker || e.tile.number !== tile.number || e.tile.color !== tile.color)) { T.scene.remove(e.g); delete meshes[tile.id]; e = null; }
    if (!e || e.style !== R3D.style) {
      if (e) T.scene.remove(e.g);
      e = meshes[tile.id] = makeTile(tile); T.scene.add(e.g);
      var start = from ? from.clone() : pos.clone().add(new THREE.Vector3(0, 5, 0));
      e.g.position.copy(start); e.g.rotation.set(from ? Math.PI / 2 : rx, 0, 0);
      e.g.userData.tg = null;
    }
    e.g.userData.source = source; e.g.userData.tile = tile;
    var lift = (state.selectedForMove && state.selectedForMove.tile && state.selectedForMove.tile.id === tile.id) ? .55 : 0;
    setTarget(e.g, new THREE.Vector3(pos.x, pos.y + lift, pos.z), rx, ry, rz);
  }

  /* ---------- Eingabe ---------- */
  var press = null;
  function pickAt(cx, cy, ignore) {
    var b = T.r.domElement.getBoundingClientRect();
    T.mouse.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    T.camera.updateMatrixWorld(); T.scene.updateMatrixWorld();
    T.ray.setFromCamera(T.mouse, T.camera);
    var list = pickables.filter(function (o) { return o !== ignore && o.visible !== false; });
    var hits = T.ray.intersectObjects(list, false);
    return hits.length ? hits[0] : null;
  }
  function setupInput() {
    var el = T.r.domElement;
    el.addEventListener('pointerdown', function (e) {
      var h = pickAt(e.clientX, e.clientY);
      press = { x: e.clientX, y: e.clientY, t: performance.now(), hit: h, drag: false };
      if (h && h.object.userData.kind === 'tile' && h.object.userData.movable) T.controls.enabled = false;
    });
    el.addEventListener('pointermove', function (e) {
      if (!press) {
        var h = pickAt(e.clientX, e.clientY), u = h && h.object.userData;
        el.style.cursor = u && (u.kind === 'tile' && u.movable || u.kind === 'heap' || u.kind === 'mat' || u.kind === 'pad' || u.kind === 'rack') ? 'pointer' : 'grab';
        return;
      }
      var u0 = press.hit && press.hit.object.userData;
      if (!press.drag && u0 && u0.kind === 'tile' && u0.movable && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) {
        press.drag = true; press.obj = press.hit.object;
        press.obj.userData.drag = true;
        state.selectedForMove = { tile: u0.tile, source: u0.source };
        press.obj.userData.tg = null;
      }
      if (press.drag) {
        var b = el.getBoundingClientRect();
        T.mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        T.camera.updateMatrixWorld();
        T.ray.setFromCamera(T.mouse, T.camera);
        var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6), p = new THREE.Vector3();
        if (T.ray.ray.intersectPlane(plane, p)) { press.obj.position.copy(p); press.obj.rotation.set(-Math.PI / 2, 0, 0); }
      }
    });
    function finish(e) {
      if (!press) return;
      var pr = press; press = null; T.controls.enabled = true;
      if (pr.obj) pr.obj.userData.drag = false;
      var moved = Math.hypot(e.clientX - pr.x, e.clientY - pr.y);
      if (pr.drag) {
        var h = pickAt(e.clientX, e.clientY, pr.obj);
        if (h && dropOn(h.object.userData)) return;
        state.selectedForMove = null; render(); return;
      }
      if (moved > 8 || performance.now() - pr.t > 700) return;
      onTap(pr.hit ? pr.hit.object.userData : null);
    }
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', function () { if (press && press.obj) press.obj.userData.drag = false; press = null; T.controls.enabled = true; });
  }
  function dropOn(u) {            // Auswahl ist gesetzt; true, wenn ein Ziel getroffen wurde
    if (!u || !state.selectedForMove) return false;
    if (u.kind === 'mat') { handleTargetTap({ type: 'table', groupIndex: u.gi }); return true; }
    if (u.kind === 'tile' && u.source && u.source.type === 'table') { handleTargetTap({ type: 'table', groupIndex: u.source.groupIndex }); return true; }
    if (u.kind === 'pad') { handleTargetTap({ type: 'newGroup' }); return true; }
    if (u.kind === 'rack' || (u.kind === 'tile' && u.source && u.source.type === 'hand')) { handleHandAreaTap(); return true; }
    return false;
  }
  function onTap(u) {
    if (!u) { if (state.selectedForMove) { state.selectedForMove = null; render(); } return; }
    if (u.kind === 'heap') { if (myTurn() && !state.hasPlayedThisTurn) drawTile(); else if (myTurn()) showMessage('Du hast schon gelegt'); return; }
    if (!myTurn()) return;
    var sel = state.selectedForMove;
    if (u.kind === 'tile') {
      if (!u.movable) return;
      if (sel && sel.tile.id !== u.id) {
        if (u.source.type === 'table') { dropOn(u); return; }
        if (sel.source.type === 'table') { handleTargetTap({ type: 'hand' }); return; }
      }
      handleTileTap(u.tile, u.source); return;
    }
    if (sel) dropOn(u);
  }

  /* ---------- Kamera ---------- */
  function camTo(pos, target) {
    var c = T.camera, f = c.position.clone(), tg = T.controls.target.clone();
    var t0 = performance.now(), id = setInterval(function () {
      var k = Math.min(1, (performance.now() - t0) / 900), e = k * k * (3 - 2 * k);
      c.position.lerpVectors(f, pos, e); T.controls.target.lerpVectors(tg, target, e); if (k >= 1) clearInterval(id);
    }, 16);
  }
  R3D.view = function (name) {
    if (!T) return;
    if (name === 'top') camTo(new THREE.Vector3(0, 32, 5), new THREE.Vector3(0, 0, 0));
    else camTo(new THREE.Vector3(0, 16, 19), new THREE.Vector3(0, 0, 3));
  };

  /* ---------- Renderschleife ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    if (!R3D.on || !T) return;
    var t = now / 1000;
    runTweens(now);
    for (var id in meshes) {
      var e = meshes[id];
      if (e.outline.visible) { var s = 1.1 + .03 * Math.sin(t * 6); e.outline.scale.set(1.1 + .03 * Math.sin(t * 6), s, 1.3); }
    }
    var sel = state.selectedForMove && myTurn();
    mats.forEach(function (m) { if (m && m.visible) { var base = cyber() ? (m.material.color.getHex() === 0x00f0ff ? .12 : .22) : .2; m.material.opacity = base + (sel ? .14 + .1 * Math.sin(t * 6) : 0); } });
    if (pad && pad.visible) pad.material.opacity = sel ? .7 + .3 * Math.sin(t * 6) : .35;
    T.controls.update();
    if (T.composer && cyber()) T.composer.render(); else T.r.render(T.scene, T.camera);
  }

  /* ---------- HUD ---------- */
  function ensureDom() {
    if ($('rk3d')) return;
    var css = document.createElement('style');
    css.textContent =
      '#rk3d{position:fixed;inset:0;z-index:60;background:#1a0f08;font-family:system-ui,sans-serif;color:#fde68a;touch-action:none}' +
      '#rk3d.cyber{background:#05060b;color:#e8f9ff;font-family:"Share Tech Mono",ui-monospace,monospace}' +
      '#rk3dStage,#rk3dStage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
      '#rk3d .bar{position:absolute;display:flex;gap:6px;flex-wrap:wrap;align-items:center;z-index:2}' +
      '#rk3d button{font:700 .85rem inherit;font-family:inherit;border:0;border-radius:.6rem;padding:.55rem .9rem;cursor:pointer;background:#92400e;color:#fff7e0;box-shadow:0 2px 6px rgba(0,0,0,.4)}' +
      '#rk3d button:disabled{opacity:.4;cursor:default}' +
      '#rk3d .go{background:#059669}#rk3d .draw{background:#b45309}#rk3d .undo{background:#6b7280}' +
      '#rk3d.cyber button{border-radius:0;background:#0b0e16;color:#e8f9ff;border:1px solid #3a3d18;text-transform:uppercase;letter-spacing:.1em;font-size:.75rem;' +
      'clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}' +
      '#rk3d.cyber button:hover:not(:disabled){color:#fcee09;border-color:#fcee09}' +
      '#rk3d.cyber .go{background:#fcee09;color:#000}#rk3d.cyber .draw{background:#00f0ff;color:#000}' +
      '#rk3dTurn{left:50%;top:10px;transform:translateX(-50%);padding:.55rem 1.2rem;border-radius:2rem;background:#059669;color:#fff;font-weight:800;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.5)}' +
      '#rk3dTurn.wait{background:#4b5563}#rk3dTurn.ai{background:#7c3aed}' +
      '#rk3d.cyber #rk3dTurn{border-radius:0;background:#fcee09;color:#000;font-family:Orbitron,"Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase;font-size:.9rem;' +
      'clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}' +
      '#rk3d.cyber #rk3dTurn.wait{background:#1a1e2c;color:#9aa0c3}#rk3d.cyber #rk3dTurn.ai{background:#ff2fa8;color:#000}' +
      '#rk3dMsg{left:50%;top:58px;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;padding:.4rem .9rem;border-radius:.6rem;font-size:.85rem;display:none}' +
      '#rk3dPlayers{left:10px;top:54px;flex-direction:column;align-items:flex-start;font-size:.8rem}' +
      '#rk3dPlayers div{padding:.2rem .6rem;border-radius:1rem;background:rgba(0,0,0,.45)}#rk3dPlayers div.act{background:#059669;color:#fff;font-weight:700}' +
      '#rk3d.cyber #rk3dPlayers div{border-radius:0;border-left:3px solid #3a3d18}#rk3d.cyber #rk3dPlayers div.act{background:#fcee09;color:#000;border-left-color:#fcee09}' +
      '#rk3dTop{left:10px;top:10px}#rk3dTopR{right:10px;top:10px}#rk3dAct{left:50%;bottom:12px;transform:translateX(-50%)}#rk3dSort{right:10px;bottom:12px}' +
      'body.rk3d-on #styleSwitch{display:none!important}' +
      '@media(max-width:700px){#rk3dPlayers{display:none}#rk3d button{padding:.45rem .6rem;font-size:.72rem}#rk3dTurn{top:48px;font-size:.8rem}#rk3dMsg{top:92px}#rk3dSort{bottom:58px;right:6px}}';
    document.head.appendChild(css);
    var d = document.createElement('div'); d.id = 'rk3d'; d.hidden = true;
    d.innerHTML =
      '<div id="rk3dStage"></div>' +
      '<div class="bar" id="rk3dTop"><button id="rk3dBack">← 2D</button><button id="rk3dView1">Mein Brett</button><button id="rk3dView2">Tisch</button></div>' +
      '<div class="bar" id="rk3dTopR"><span id="rk3dPool" style="background:rgba(0,0,0,.5);padding:.35rem .7rem;border-radius:1rem;font-weight:700"></span><button id="rk3dStyle"></button></div>' +
      '<div id="rk3dTurn" class="bar"></div><div id="rk3dMsg" class="bar"></div><div class="bar" id="rk3dPlayers"></div>' +
      '<div class="bar" id="rk3dAct"><button class="draw" id="rk3dDraw"></button><button class="go" id="rk3dEnd">Fertig</button><button class="undo" id="rk3dUndo">↩</button></div>' +
      '<div class="bar" id="rk3dSort"><button id="rk3dS1" title="Nach Zahl (Sets)">Zahl</button><button id="rk3dS2" title="Nach Farbe (Runs)">Farbe</button><button id="rk3dS3" title="Trennstriche">│</button></div>';
    document.body.appendChild(d);
    $('rk3dBack').onclick = function () { R3D.close(); };
    $('rk3dView1').onclick = function () { R3D.view('rack'); };
    $('rk3dView2').onclick = function () { R3D.view('top'); };
    $('rk3dStyle').onclick = function () { R3D.setStyle(cyber() ? 'classic' : 'cyber'); };
    $('rk3dDraw').onclick = function () { drawTile(); };
    $('rk3dEnd').onclick = function () { endTurn(); };
    $('rk3dUndo').onclick = function () { undoTurn(); };
    $('rk3dS1').onclick = function () { sortMyHand('number'); };
    $('rk3dS2').onclick = function () { sortMyHand('color'); };
    $('rk3dS3').onclick = function () { toggleSeparators(); };
  }
  function updateHud() {
    var d = $('rk3d'); if (!d) return;
    d.className = cyber() ? 'cyber' : '';
    $('rk3dStyle').textContent = cyber() ? 'Stil: Cyber' : 'Stil: Klassik';
    var turn = myTurn(), name = state.players[state.currentPlayer] || '';
    var tEl = $('rk3dTurn');
    tEl.className = 'bar' + (state.aiThinking ? ' ai' : (!turn ? ' wait' : ''));
    tEl.textContent = state.aiThinking ? name + ' denkt …' : turn ? 'DEIN ZUG!' + (!state.initialMeldMade[state.myIndex] ? ' (30+ Punkte)' : '') : name + ' …';
    var m = $('rk3dMsg'); m.style.display = state.message ? 'block' : 'none'; m.textContent = state.message || '';
    $('rk3dPool').textContent = 'Haufen: ' + state.pool.length;
    $('rk3dPlayers').innerHTML = state.players.map(function (p, i) {
      return '<div class="' + (i === state.currentPlayer ? 'act' : '') + '">' + String(p).replace(/[<>&]/g, '') + ' (' + (state.hands[i] || []).filter(function (t) { return !t.separator; }).length + ')</div>';
    }).join('');
    var act = $('rk3dAct'); act.style.display = turn ? 'flex' : 'none';
    $('rk3dDraw').textContent = state.pool.length === 0 ? 'Passen' : 'Ziehen';
    $('rk3dDraw').disabled = !!state.hasPlayedThisTurn; $('rk3dEnd').disabled = !state.hasPlayedThisTurn; $('rk3dUndo').disabled = !state.hasPlayedThisTurn;
    $('rk3dSort').style.display = turn || state.screen === 'game' ? 'flex' : 'none';
  }

  /* ---------- Öffnen / Schließen ---------- */
  R3D.setStyle = function (s) {
    R3D.style = s; try { localStorage.setItem('rk3d-style', s); } catch (e) {}
    if (!T) return;
    for (var id in meshes) T.scene.remove(meshes[id].g); meshes = {};
    for (var k in backs) backs[k].forEach(function (b) { T.scene.remove(b); }); backs = {};
    heap.forEach(function (b) { T.scene.remove(b); }); heap = [];
    mats.forEach(function (m) { if (m) T.scene.remove(m); }); mats = [];
    if (pad) { T.scene.remove(pad); pad = null; }
    tweens = []; buildStatic(); R3D.sync(); updateHud();
  };
  R3D.open = function () {
    if (!(state.screen === 'game' || state.screen === 'ended')) return;
    ensureDom();
    $('rk3d').hidden = false; document.body.classList.add('rk3d-on');
    var go = function () {
      if (!T) { initThree(); }
      if (!R3D.ready) { R3D.ready = true; buildStatic(); T.camera.position.set(0, 20, 21); T.controls.target.set(0, 0, 1.5); }
      R3D.on = true; resize(); R3D.sync(); updateHud();
    };
    if (window.THREE && THREE.UnrealBloomPass) go();
    else {
      var m = $('rk3dMsg'); m.style.display = 'block'; m.textContent = '3D wird geladen …';
      loadLibs().then(go).catch(function () { m.textContent = '3D konnte nicht geladen werden (offline?)'; setTimeout(function () { R3D.close(); }, 2500); });
    }
  };
  R3D.close = function () {
    R3D.on = false; var d = $('rk3d'); if (d) d.hidden = true; document.body.classList.remove('rk3d-on');
  };

  R3D.debug = function () { return { T: T, meshes: meshes, heap: heap, pad: pad, mats: mats, press: press, pickables: pickables, pick: pickAt }; };

  // render() so erweitern, dass die 3D-Ansicht mitläuft
  var origRender = window.render;
  window.render = function () { var r = origRender.apply(this, arguments); if (R3D.on) { try { R3D.sync(); } catch (e) { console.error(e); } } return r; };
})();
