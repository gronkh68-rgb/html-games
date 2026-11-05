/* Rummikub 3D-Tisch: zweite Ansicht auf denselben Spielzustand (state) wie die 2D-Oberfläche.
   Schlicht gehalten: ein großer Tisch, pro Spieler ein einfaches Brett, in einer Ecke der Haufen.
   Zwei Looks: "classic" (Filz, Holz, Elfenbein) und "cyber" (Neon). */
(function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var LIBS = ['three@0.128.0/build/three.min.js', 'three@0.128.0/examples/js/controls/OrbitControls.js',
    'three@0.128.0/examples/js/shaders/CopyShader.js', 'three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',
    'three@0.128.0/examples/js/postprocessing/EffectComposer.js', 'three@0.128.0/examples/js/postprocessing/MaskPass.js',
    'three@0.128.0/examples/js/postprocessing/RenderPass.js', 'three@0.128.0/examples/js/postprocessing/ShaderPass.js',
    'three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js'];
  function loadRoom() {
    if (window.Room3D) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = '../room3d.js'; s.onload = res; s.onerror = function () { rej(new Error('room3d.js')); }; document.head.appendChild(s);
    });
  }
  function loadLibs() {
    if (window.THREE && THREE.UnrealBloomPass) return loadRoom();
    return LIBS.reduce(function (pr, u) {
      return pr.then(function () {
        return new Promise(function (res, rej) {
          var s = document.createElement('script'); s.src = CDN + u; s.onload = res;
          s.onerror = function () { rej(new Error(u)); }; document.head.appendChild(s);
        });
      });
    }, Promise.resolve()).then(loadRoom);
  }

  var TW = 1.1, TH = 1.45, TT = .42, P = 1.2;        // Steinbreite, -höhe, -dicke, Abstand von Stein zu Stein
  var RACKW = 9.9, RACKD = 14;                       // halbe Brettbreite, Abstand der Bretter vom Tischmittelpunkt
  var FELT = 37;                                     // Kantenlänge des Tisches
  var PLAYX = 9.6, PLAYZ0 = -9.2, ROWH = 2.3;        // Legefeld: halbe Breite, erste Reihe, Reihenabstand
  var HEAP = { x: 15.8, z: -15.8 };                  // Haufen in der Tischecke
  var SEAT_PHI = [0, -Math.PI / 2, Math.PI, Math.PI / 2];      // Süd, West, Nord, Ost
  var SEATS = { 1: [0], 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };
  var NUMCOL = {
    classic: { red: '#c1272d', blue: '#1f4aa8', yellow: '#e0900a', black: '#1b1b1b' },
    cyber: { red: '#ff2a55', blue: '#2e9bff', yellow: '#fcee09', black: '#c06bff' }
  };

  var R3D = window.R3D = { on: false, style: 'classic', ready: false, hover: null };
  try { R3D.style = localStorage.getItem('rk3d-style') === 'cyber' ? 'cyber' : 'classic'; } catch (e) {}

  var T = null, meshes = {}, backs = {}, tweens = [], mats = [], slots = [], pad = null, heap = [];
  var rackKey = '', staticGroup = null, rackGroup = null, pickables = [], texCache = {}, matCache = {}, tileGeo = null, press = null;

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
  function selId() { return state.selectedForMove && state.selectedForMove.tile ? state.selectedForMove.tile.id : null; }

  /* ---------- Steine: abgerundet, mit aufgelegter Ziffernfläche ---------- */
  function makeTileGeo() {
    var bev = .07, r = .2, w = TW - bev * 2, h = TH - bev * 2, s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    var g = new THREE.ExtrudeGeometry(s, { depth: TT - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 7 });
    g.center(); return g;
  }
  function faceTex(tile) {
    var st = R3D.style, key = st + '|' + (tile.isJoker ? 'J' : tile.color + tile.number);
    if (texCache[key]) return texCache[key];
    var c = document.createElement('canvas'); c.width = 256; c.height = 320;
    var x = c.getContext('2d'), col = tile.isJoker ? null : NUMCOL[st][tile.color];
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (st === 'classic') {
      x.strokeStyle = 'rgba(130,100,50,.28)'; x.lineWidth = 5; x.strokeRect(14, 14, 228, 292);
      if (tile.isJoker) {
        var jg = x.createLinearGradient(40, 60, 216, 260); jg.addColorStop(0, '#c1272d'); jg.addColorStop(.5, '#e0900a'); jg.addColorStop(1, '#1f4aa8');
        x.fillStyle = jg; x.font = '900 190px Georgia,serif'; x.fillText('★', 128, 150);
        x.fillStyle = '#6b4a2a'; x.font = 'bold 30px Georgia,serif'; x.fillText('JOKER', 128, 264);
      } else {
        x.fillStyle = col; x.font = 'bold ' + (tile.number > 9 ? 150 : 190) + 'px Georgia,serif'; x.fillText(String(tile.number), 128, 140);
        x.lineWidth = 12; x.strokeStyle = col; x.beginPath(); x.arc(128, 258, 20, 0, 6.3); x.stroke();
      }
    } else {
      var neon = col || '#00f0ff';
      x.fillStyle = '#080b14'; x.fillRect(0, 0, 256, 320);
      x.strokeStyle = neon; x.globalAlpha = .6; x.lineWidth = 5; x.strokeRect(16, 16, 224, 288); x.globalAlpha = 1;
      x.shadowColor = neon; x.shadowBlur = 14; x.fillStyle = neon;
      if (tile.isJoker) { x.font = '900 190px "Segoe UI",sans-serif'; x.fillStyle = '#00f0ff'; x.fillText('★', 128, 150); x.shadowColor = '#ff2fa8'; x.fillText('★', 128, 150); }
      else { x.font = '900 ' + (tile.number > 9 ? 140 : 180) + 'px Orbitron,"Segoe UI",sans-serif'; x.fillText(String(tile.number), 128, 144); x.fillText(String(tile.number), 128, 144); }
      x.shadowBlur = 0; x.globalAlpha = .8; x.fillRect(88, 262, 80, 8); x.globalAlpha = 1;
    }
    var tex = new THREE.CanvasTexture(c); tex.anisotropy = 8;
    return texCache[key] = tex;
  }
  function bodyMat() {
    var k = 'body' + R3D.style;
    if (matCache[k]) return matCache[k];
    return matCache[k] = cyber() ? new THREE.MeshStandardMaterial({ color: 0x0b0f1a, roughness: .28, metalness: .75, emissive: 0x00424c, emissiveIntensity: .3 })
      : new THREE.MeshStandardMaterial({ color: 0xf0e4c4, roughness: .32, metalness: 0 });
  }
  function faceMat(tile) {
    var key = 'f' + R3D.style + (tile.isJoker ? 'J' : tile.color + tile.number);
    if (matCache[key]) return matCache[key];
    var tex = faceTex(tile);
    return matCache[key] = cyber() ? new THREE.MeshBasicMaterial({ map: tex, color: 0x969696, polygonOffset: true, polygonOffsetFactor: -2 })
      : new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .4, polygonOffset: true, polygonOffsetFactor: -2 });
  }
  function makeTile(tile) {
    var body = new THREE.Mesh(tileGeo, bodyMat()); body.rotation.order = 'YXZ';
    var face = new THREE.Mesh(new THREE.PlaneGeometry(TW * .92, TH * .92), faceMat(tile)); face.position.z = TT / 2 + .004; body.add(face);
    face.raycast = function () {};
    var outline = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0xffd23a, side: THREE.BackSide }));
    outline.scale.set(1.1, 1.08, 1.25); outline.visible = false; outline.raycast = function () {}; body.add(outline);
    body.userData = { kind: 'tile', id: tile.id };
    return { g: body, outline: outline, tile: tile, style: R3D.style };
  }
  function makeBack() {
    var m = new THREE.Mesh(tileGeo, bodyMat()); m.rotation.order = 'YXZ'; m.userData = { kind: 'back' }; return m;
  }

  /* ---------- Szene ---------- */
  function initThree() {
    var wrap = $('rk3dStage');
    var r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); wrap.appendChild(r.domElement);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, 1, .1, 600);
    var controls = new THREE.OrbitControls(camera, r.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 55; controls.maxPolarAngle = 1.45;
    tileGeo = makeTileGeo();
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
    disposeGroup(staticGroup); disposeGroup(rackGroup); rackGroup = null; rackKey = '';
    var scene = T.scene, G = new THREE.Group(); staticGroup = G; scene.add(G);
    for (var i = scene.children.length - 1; i >= 0; i--) { var o = scene.children[i]; if (o.userData && o.userData.env) scene.remove(o); }
    var bg = cyber() ? 0x05060b : 0x1d120a;
    scene.fog = cyber() ? new THREE.FogExp2(bg, .008) : new THREE.Fog(0x2a1a10, 90, 220); T.r.setClearColor(bg);
    T.rain = null; T.room = null;
    var amb = new THREE.AmbientLight(cyber() ? 0x4a5a80 : 0xffeed2, cyber() ? .6 : .1); amb.userData.env = true; scene.add(amb);
    var dl = new THREE.DirectionalLight(cyber() ? 0xaaccff : 0xfff1d6, cyber() ? .5 : .85); dl.position.set(8, 22, 12); dl.userData.env = true; scene.add(dl);
    var lamp = new THREE.PointLight(cyber() ? 0x00f0ff : 0xffe0b0, cyber() ? 1.1 : 0, 80); lamp.position.set(0, 18, 2); lamp.userData.env = true; scene.add(lamp);
    var felt = new THREE.Mesh(new THREE.BoxGeometry(FELT, .5, FELT), new THREE.MeshStandardMaterial(cyber()
      ? { color: 0x080b12, roughness: .35, metalness: .6, emissive: 0x021017 } : { color: 0x0f7a42, roughness: .95 }));
    felt.position.y = -.25; G.add(felt);
    if (cyber()) {
      var grid = new THREE.GridHelper(FELT, FELT, 0x00f0ff, 0x0b4a56); grid.position.y = .01; grid.material.transparent = true; grid.material.opacity = .4; G.add(grid);
      var fe = new THREE.LineSegments(new THREE.EdgesGeometry(felt.geometry), new THREE.LineBasicMaterial({ color: 0x00f0ff })); fe.position.copy(felt.position); G.add(fe);
      try {
        if (!T.composer) {
          T.composer = new THREE.EffectComposer(T.r); T.composer.addPass(new THREE.RenderPass(scene, T.camera));
          T.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), .28, .4, .85));
        }
      } catch (err) { T.composer = null; }
      if (window.Room3D) { T.rain = Room3D.rain(THREE, { count: 700, radius: 36, top: 26, bottom: -.5 }); scene.add(T.rain.obj); }
    } else {
      T.composer = null;
      var wood = new THREE.MeshStandardMaterial({ color: 0x6b3f1d, roughness: .6 });
      [[0, -FELT / 2 - .3, FELT + 1.2, .6], [0, FELT / 2 + .3, FELT + 1.2, .6], [-FELT / 2 - .3, 0, .6, FELT], [FELT / 2 + .3, 0, .6, FELT]].forEach(function (b) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(b[2], .7, b[3]), wood); m.position.set(b[0], -.1, b[1]); G.add(m);
      });
      if (window.Room3D) { T.room = Room3D.livingRoom(THREE, { half: 90, tableTopY: -.5, table: { shape: 'square', size: FELT } }); scene.add(T.room.group); }
    }
    if (cyber() || !window.Room3D) {
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: cyber() ? 0x04050a : 0x241509 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; G.add(floor);
    }
    resize();
  }

  var ROW = [{ y: .55, v: .4 }, { y: 1.3, v: -1.35 }, { y: 2.05, v: -3.1 }];
  function buildRacks(n, rows) {
    var key = n + R3D.style + rows; if (key === rackKey) return; rackKey = key;
    disposeGroup(rackGroup); rackGroup = new THREE.Group(); T.scene.add(rackGroup);
    var seats = SEATS[n] || SEATS[4];
    var wood = cyber() ? new THREE.MeshStandardMaterial({ color: 0x0c1019, roughness: .4, metalness: .6 }) : new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: .5 });
    var trim = new THREE.LineBasicMaterial({ color: 0x00f0ff });
    seats.forEach(function (seat, k) {
      for (var r = 0; r < rows; r++) {       // pro Reihe eine einfache Leiste, jede Reihe etwas höher
        var h = ROW[r].y, w = RACKW * 2 + 1.4;
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5), wood), p = toWorld(seat, 0, h / 2, RACKD + ROW[r].v);
        m.position.copy(p); m.rotation.y = SEAT_PHI[seat]; rackGroup.add(m);
        if (cyber()) { var e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), trim); e.position.copy(p); e.rotation.y = SEAT_PHI[seat]; rackGroup.add(e); }
        if (k === 0) m.userData = { kind: 'rack' };
      }
    });
  }

  /* ---------- Bewegung ---------- */
  function setTarget(obj, pos, rx, ry, rz, instant, from) {
    var t = obj.userData.tg;
    if (t && Math.abs(t.x - pos.x) < .001 && Math.abs(t.y - pos.y) < .001 && Math.abs(t.z - pos.z) < .001 && Math.abs(t.rx - rx) < .001 && Math.abs(t.ry - ry) < .001) return;
    obj.userData.tg = { x: pos.x, y: pos.y, z: pos.z, rx: rx, ry: ry, rz: rz };
    if (instant || obj.userData.drag) { obj.position.copy(pos); obj.rotation.set(rx, ry, rz); return; }
    if (from) obj.position.copy(from);
    var p0 = obj.position.clone(), r0 = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
    var dist = p0.distanceTo(pos), arc = Math.min(2.6, .6 + dist * .13);
    tweens = tweens.filter(function (w) { return w.obj !== obj; });
    tweens.push({ obj: obj, t0: performance.now(), dur: 360 + Math.min(420, dist * 28), p0: p0, p1: pos.clone(), r0: r0, r1: { x: rx, y: ry, z: rz }, arc: arc });
  }
  function runTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var w = tweens[i], k = Math.min(1, (now - w.t0) / w.dur);
      if (w.obj.userData.drag) { tweens.splice(i, 1); continue; }
      var q = Math.min(1, k / .85), e = q * q * (3 - 2 * q);           // sanftes Ankommen
      var bounce = k > .85 ? Math.sin((k - .85) / .15 * Math.PI) * .07 : 0;     // kleines Aufsetzen
      w.obj.position.lerpVectors(w.p0, w.p1, e); w.obj.position.y += Math.sin(q * Math.PI) * w.arc + bounce;
      w.obj.rotation.set(w.r0.x + (w.r1.x - w.r0.x) * e, w.r0.y + (w.r1.y - w.r0.y) * e, w.r0.z + (w.r1.z - w.r0.z) * e);
      if (k >= 1) tweens.splice(i, 1);
    }
  }

  /* ---------- Anordnung ---------- */
  var LEAN = .2;
  function rackLayout(items) {      // items: true = Stein, false = Trennstrich
    var res = [], u = -RACKW + .1, row = 0;
    items.forEach(function (isTile) {
      var w = isTile ? P : .5;
      if (u + w > RACKW + .05) { row++; u = -RACKW + .1; }
      if (isTile) res.push({ u: u + P / 2, row: Math.min(row, 2) });
      u += w;
    });
    return res;
  }
  function rackPos(seat, slot) {
    var r = ROW[slot.row];
    return toWorld(seat, slot.u, r.y + TH / 2 * Math.cos(LEAN) + .03, RACKD + r.v);
  }
  function tableLayout() {
    var x = -PLAYX, z = PLAYZ0, res = [];
    state.table.forEach(function (g, gi) {
      var w = g.length * P;
      if (x + w > PLAYX + .05 && x > -PLAYX) { x = -PLAYX; z += ROWH; }
      res.push({ gi: gi, x0: x, z: z, len: g.length }); x += w + 1.0;
    });
    if (x + 2.6 > PLAYX + .05) { x = -PLAYX; z += ROWH; }
    return { groups: res, pad: { x: x, z: z } };
  }
  function ensureMat(i) {
    if (mats[i]) return mats[i];
    var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; T.scene.add(m); mats[i] = m; return m;
  }
  function slotTex() {
    var k = 'slot' + R3D.style; if (texCache[k]) return texCache[k];
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    x.fillStyle = cyber() ? '#00f0ff' : '#ffffff'; x.beginPath(); x.arc(32, 32, 28, 0, 6.3); x.fill();
    x.fillStyle = cyber() ? '#05060b' : '#0f7a42'; x.fillRect(28, 14, 8, 36); x.fillRect(14, 28, 36, 8);
    return texCache[k] = new THREE.CanvasTexture(c);
  }
  function padTex() {
    var k = 'pad' + R3D.style; if (texCache[k]) return texCache[k];
    var c = document.createElement('canvas'); c.width = 256; c.height = 160; var x = c.getContext('2d');
    var col = cyber() ? '#00f0ff' : '#fde68a';
    x.strokeStyle = col; x.lineWidth = 6; x.setLineDash([16, 10]); x.strokeRect(8, 8, 240, 144); x.setLineDash([]);
    x.fillStyle = col; x.fillRect(120, 24, 16, 56); x.fillRect(100, 44, 56, 16);
    x.textAlign = 'center'; x.font = 'bold 30px system-ui,sans-serif'; x.fillText('NEUE GRUPPE', 128, 124);
    return texCache[k] = new THREE.CanvasTexture(c);
  }
  function ensureSlot(i) {
    if (slots[i]) return slots[i];
    var m = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, map: slotTex() }));
    m.rotation.x = -Math.PI / 2; T.scene.add(m); slots[i] = m; return m;
  }

  /* ---------- Zustand -> Szene ---------- */
  R3D.sync = function () {
    if (!R3D.on || !T) return;
    if (!(state.screen === 'game' || state.screen === 'ended')) { R3D.close(true); return; }
    var n = state.players.length, my = state.myIndex;
    var maxHand = 0; state.hands.forEach(function (h) { var c = (h || []).filter(function (t) { return !t.separator; }).length; if (c > maxHand) maxHand = c; });
    buildRacks(n, maxHand > 32 ? 3 : 2);
    var wanted = {}; pickables = [];
    var heapPos = new THREE.Vector3(HEAP.x, .6, HEAP.z);
    var turn = myTurn(), sel = selId();

    var hand = state.hands[my] || [];
    var sl = rackLayout(hand.map(function (t) { return !t.separator; })), si = 0;
    hand.forEach(function (t, idx) {
      if (t.separator) return;
      place(t, rackPos(0, sl[si++]), -LEAN, 0, 0, { type: 'hand', index: idx }, heapPos);
      wanted[t.id] = true;
    });
    var lay = tableLayout();
    var slotN = 0;
    lay.groups.forEach(function (gl) {
      var g = state.table[gl.gi], valid = isValidGroup(g);
      g.forEach(function (t, ti) {
        place(t, new THREE.Vector3(gl.x0 + ti * P + P / 2, TT / 2, gl.z), -Math.PI / 2, 0, 0, { type: 'table', groupIndex: gl.gi, tileIndex: ti }, null);
        wanted[t.id] = true;
      });
      var m = ensureMat(gl.gi);
      m.visible = true; m.scale.set(gl.len * P + .4, TH + .35, 1); m.position.set(gl.x0 + gl.len * P / 2, .03, gl.z);
      m.material.color.set(cyber() ? (valid ? 0x00f0ff : 0xff2a55) : (valid ? 0x9fe8b4 : 0xe86060));
      m.material.blending = cyber() ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.userData = { kind: 'mat', gi: gl.gi, valid: valid, x0: gl.x0, len: gl.len }; pickables.push(m);
      if (turn && sel !== null) {                         // Einfügemarken zwischen und neben den Steinen
        for (var k = 0; k <= gl.len; k++) {
          var s = ensureSlot(slotN++); s.visible = true; s.position.set(gl.x0 + k * P, .06, gl.z + TH / 2 + .55);
          s.userData = { kind: 'slot', gi: gl.gi, pos: k }; s.material.map = slotTex(); pickables.push(s);
        }
      }
    });
    for (var si2 = slotN; si2 < slots.length; si2++) if (slots[si2]) slots[si2].visible = false;
    for (var mi = lay.groups.length; mi < mats.length; mi++) if (mats[mi]) mats[mi].visible = false;
    if (!pad) { pad = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.userData = { kind: 'pad' }; T.scene.add(pad); }
    pad.material.map = padTex(); pad.material.needsUpdate = true;
    pad.visible = turn; pad.position.set(lay.pad.x + 1.3, .04, lay.pad.z);
    if (turn) pickables.push(pad);

    for (var id in meshes) if (!wanted[id]) { T.scene.remove(meshes[id].g); delete meshes[id]; }
    for (var id2 in meshes) {
      var e = meshes[id2], isSel = String(sel) === id2, recent = state.playedTileIds.indexOf(+id2) >= 0 || state.drawnTileId === +id2;
      e.outline.visible = isSel || recent;
      e.outline.material.color.set(isSel ? (cyber() ? 0x00f0ff : 0xffffff) : 0xffd23a);
      e.g.userData.movable = turn;
      pickables.push(e.g);
    }
    state.players.forEach(function (name, i) {
      if (i === my) return;
      var cnt = (state.hands[i] || []).filter(function (t) { return !t.separator; }).length, key = 'p' + i, seat = seatOf(i);
      var arr = backs[key] = backs[key] || [];
      var lay2 = rackLayout(Array(cnt).fill(true));
      while (arr.length < cnt) { var b = makeBack(); T.scene.add(b); arr.push(b); b.position.copy(heapPos); }
      while (arr.length > cnt) T.scene.remove(arr.pop());
      arr.forEach(function (b, k) { setTarget(b, rackPos(seat, lay2[k]), -LEAN, SEAT_PHI[seat], 0); });
    });
    var pc = Math.min(state.pool.length, 80);
    while (heap.length < pc) { var hb = makeBack(); T.scene.add(hb); heap.push(hb); hb.position.set(HEAP.x, 9, HEAP.z); }
    while (heap.length > pc) T.scene.remove(heap.pop());
    heap.forEach(function (b, i) {
      var N = Math.max(pc, 1), a = rnd(i) * 6.283, r = Math.sqrt(rnd(i + 500)) * 2.6 * (1 - i / N * .35), layer = Math.floor(i / 14);
      setTarget(b, new THREE.Vector3(HEAP.x + Math.cos(a) * r, TT / 2 + layer * (TT + .02), HEAP.z + Math.sin(a) * r), Math.PI / 2, rnd(i + 900) * 6.283, 0, false);
      b.userData.kind = 'heap'; pickables.push(b);
    });
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
      e.g.position.copy(start); e.g.rotation.set(from ? Math.PI / 2 : rx, 0, 0); e.g.userData.tg = null;
    }
    e.g.userData.source = source; e.g.userData.tile = tile;
    var lift = selId() === tile.id ? .7 : 0;
    setTarget(e.g, new THREE.Vector3(pos.x, pos.y + lift, pos.z), rx, ry, rz);
  }

  /* ---------- Eingabe ---------- */
  function pickAt(cx, cy, ignore) {
    var b = T.r.domElement.getBoundingClientRect();
    T.mouse.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    T.camera.updateMatrixWorld(); T.scene.updateMatrixWorld();
    T.ray.setFromCamera(T.mouse, T.camera);
    var list = pickables.filter(function (o) { return o !== ignore && o.visible !== false; });
    var hits = T.ray.intersectObjects(list, false);
    for (var i = 0; i < hits.length; i++) if (hits[i].object.userData.kind === 'slot') return hits[i];   // Einfügemarken haben Vorrang
    return hits.length ? hits[0] : null;
  }
  function floorPoint(cx, cy, y) {
    var b = T.r.domElement.getBoundingClientRect();
    T.mouse.set(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1);
    T.camera.updateMatrixWorld(); T.ray.setFromCamera(T.mouse, T.camera);
    var p = new THREE.Vector3();
    return T.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }
  function setupInput() {
    var el = T.r.domElement;
    el.addEventListener('pointerdown', function (e) {
      var h = pickAt(e.clientX, e.clientY);
      press = { x: e.clientX, y: e.clientY, t: performance.now(), hit: h, drag: false };
      if (h && h.object.userData.kind === 'tile' && h.object.userData.movable) T.controls.enabled = false;
    });
    el.addEventListener('pointermove', function (e) {
      var sel = state.selectedForMove && myTurn();
      if (!press || !press.drag) {
        var h = pickAt(e.clientX, e.clientY, press && press.obj), u = h && h.object.userData;
        R3D.hover = sel && u && (u.kind === 'mat' || u.kind === 'slot' || u.kind === 'pad' || u.kind === 'tile') ? h.object : null;
        if (!press) el.style.cursor = u && ((u.kind === 'tile' && u.movable) || u.kind === 'heap' || u.kind === 'mat' || u.kind === 'pad' || u.kind === 'rack' || u.kind === 'slot') ? 'pointer' : 'grab';
      }
      if (!press) return;
      var u0 = press.hit && press.hit.object.userData;
      if (!press.drag && u0 && u0.kind === 'tile' && u0.movable && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) {
        press.drag = true; press.obj = press.hit.object; press.obj.userData.drag = true; press.obj.userData.tg = null;
        state.selectedForMove = { tile: u0.tile, source: u0.source };
        render();                                    // Einfügemarken einblenden
      }
      if (press.drag) {
        var p = floorPoint(e.clientX, e.clientY, 2.2);
        if (p) { press.obj.position.lerp(p, .6); press.obj.rotation.set(-Math.PI / 2, 0, 0); }
        var h2 = pickAt(e.clientX, e.clientY, press.obj), uu = h2 && h2.object.userData;
        R3D.hover = uu && (uu.kind === 'mat' || uu.kind === 'slot' || uu.kind === 'pad' || (uu.kind === 'tile' && uu.source && uu.source.type === 'table')) ? h2.object : null;
      }
    });
    function finish(e) {
      if (!press) return;
      var pr = press; press = null; T.controls.enabled = true; R3D.hover = null;
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
    if (u.kind === 'slot') { handleTouchDropZone(u.gi, u.pos); return true; }
    if (u.kind === 'mat' || (u.kind === 'tile' && u.source && u.source.type === 'table')) {
      var gi = u.kind === 'mat' ? u.gi : u.source.groupIndex;
      handleTargetTap({ type: 'table', groupIndex: gi }); return true;      // Gruppe: wird wie in 2D automatisch einsortiert
    }
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
    if (name === 'top') camTo(new THREE.Vector3(0, 40, 4), new THREE.Vector3(0, 0, 0));
    else camTo(new THREE.Vector3(0, 19, 25), new THREE.Vector3(0, 0, 5));
  };

  /* ---------- Renderschleife ---------- */
  function tick(now) {
    requestAnimationFrame(tick);
    if (!R3D.on || !T) return;
    var t = now / 1000, dt = Math.min(.05, (now - (tick.last || now)) / 1000); tick.last = now;
    runTweens(now);
    if (T.rain) T.rain.update(dt);
    if (T.room) T.room.update(t);
    for (var id in meshes) {
      var e = meshes[id];
      if (e.outline.visible) { var s = 1.08 + .03 * Math.sin(t * 6); e.outline.scale.set(1.1 + .03 * Math.sin(t * 6), s, 1.25); }
    }
    var sel = state.selectedForMove && myTurn(), hv = R3D.hover;
    mats.forEach(function (m) {
      if (!m || !m.visible) return;
      var base = cyber() ? (m.userData.valid ? .12 : .22) : .2;
      m.material.opacity = base + (sel ? .08 + .05 * Math.sin(t * 6) : 0) + (hv === m ? .35 : 0);
    });
    slots.forEach(function (s) { if (s && s.visible) { var h = hv === s; s.scale.setScalar(h ? 1.5 : 1 + .08 * Math.sin(t * 6 + s.position.x)); s.material.opacity = h ? 1 : .75; } });
    if (pad && pad.visible) pad.material.opacity = (sel ? .7 + .3 * Math.sin(t * 6) : .4) + (hv === pad ? .3 : 0);
    T.controls.update();
    if (T.composer && cyber()) T.composer.render(); else T.r.render(T.scene, T.camera);
  }

  /* ---------- HUD ---------- */
  function ensureDom() {
    if ($('rk3d')) return;
    var css = document.createElement('style');
    css.textContent =
      '#rk3d{position:fixed;inset:0;z-index:60;background:#1d120a;font-family:system-ui,sans-serif;color:#fde68a;touch-action:none}' +
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
    $('rk3dAct').style.display = turn ? 'flex' : 'none';
    $('rk3dDraw').textContent = state.pool.length === 0 ? 'Passen' : 'Ziehen';
    $('rk3dDraw').disabled = !!state.hasPlayedThisTurn; $('rk3dEnd').disabled = !state.hasPlayedThisTurn; $('rk3dUndo').disabled = !state.hasPlayedThisTurn;
    $('rk3dSort').style.display = state.screen === 'game' ? 'flex' : 'none';
  }

  /* ---------- Öffnen / Schließen ---------- */
  R3D.setStyle = function (s) {
    R3D.style = s; try { localStorage.setItem('rk3d-style', s); } catch (e) {}
    if (!T) return;
    for (var id in meshes) T.scene.remove(meshes[id].g); meshes = {};
    for (var k in backs) backs[k].forEach(function (b) { T.scene.remove(b); }); backs = {};
    heap.forEach(function (b) { T.scene.remove(b); }); heap = [];
    mats.forEach(function (m) { if (m) T.scene.remove(m); }); mats = [];
    slots.forEach(function (m) { if (m) T.scene.remove(m); }); slots = [];
    if (pad) { T.scene.remove(pad); pad = null; }
    tweens = []; buildStatic(); R3D.sync(); updateHud();
  };
  R3D.open = function () {
    if (!(state.screen === 'game' || state.screen === 'ended')) return;
    ensureDom();
    $('rk3d').hidden = false; document.body.classList.add('rk3d-on');
    var go = function () {
      if (!T) initThree();
      if (!R3D.ready) { R3D.ready = true; buildStatic(); T.camera.position.set(0, 21, 26); T.controls.target.set(0, 0, 4); }
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
  R3D.debug = function () { return { T: T, meshes: meshes, heap: heap, pad: pad, mats: mats, slots: slots, press: press, pickables: pickables, pick: pickAt }; };

  var origRender = window.render;
  window.render = function () { var r = origRender.apply(this, arguments); if (R3D.on) { try { R3D.sync(); } catch (e) { console.error(e); } } return r; };
})();
