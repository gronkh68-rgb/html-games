/* Helluva Tycoon: 3D-Ansicht (three.js). Ohne Bilder entstehen alle Texturen im Programm (Farben, Flammen, Hörner, Lavarisse), ganz ohne Emojis.
   Bilder: Dateien aus hoellen-tycoon/img/ (Liste in manifest.json) werden automatisch benutzt, oder per Knopf direkt im Browser geladen.
   Dateinamen: tisch, mitte, feld-0 … feld-39, figur-0 … figur-5 (png, jpg, webp).
   HT3D.init(host, api) · update(V, inp) · setActive(on) · resize() · view(p) (Würfelfeld des Spielers p) · opts                      */
(function () {
  var H = window.HT3D = { ready: false, own: {} };
  var host, api, r, scene, camera, controls, perf, active = false, lastV = null, perfLast = 0;
  var CW = 1.5, CORNER = 2.3, HALF = 9 * CW / 2 + CORNER, TOP = .3;
  var fieldG = [], fieldTop = [], tokens = [], ownBar = [], houseG = [], mortM = [], tw = [], shown = null, moveSeq = -1;
  var views = {}, camSave = null, manual = false, autoDice = false, focusP = 0, ember = null, ringMesh = null, ownTex = {};
  try { autoDice = localStorage.getItem('ht-autodice') === '1'; } catch (e) { }
  H.opts = { get auto() { return autoDice; }, get manual() { return manual; } };
  var tr = function (a) { return api.tx(a); };

  // ---------- Hilfen ----------
  function fpos(i) {
    var c = CORNER, h = HALF, k;
    if (i % 10 === 0) { var sx = (i === 0 || i === 30) ? 1 : -1, sz = (i === 0 || i === 10) ? 1 : -1; return { x: sx * (h - c / 2), z: sz * (h - c / 2), w: c, d: c, yaw: 0, corner: true }; }
    if (i < 10) return { x: h - c - (i - .5) * CW, z: h - c / 2, w: CW, d: c, yaw: 0 };
    if (i < 20) { k = i - 10; return { x: -h + c / 2, z: h - c - (k - .5) * CW, w: CW, d: c, yaw: -Math.PI / 2 }; }
    if (i < 30) { k = i - 20; return { x: -h + c + (k - .5) * CW, z: -h + c / 2, w: CW, d: c, yaw: Math.PI }; }
    k = i - 30; return { x: h - c / 2, z: -h + c + (k - .5) * CW, w: CW, d: c, yaw: Math.PI / 2 };
  }
  var cache = {};
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function tex(c) { var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
  function wrap(x, text, maxW, lh, cx, y, maxLines) {
    var words = String(text).split(/\s+/), line = '', lines = [];
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    lines.push(line);
    lines.slice(0, maxLines || 3).forEach(function (l, i) { x.fillText(l, cx, y + i * lh); });
    return lines.length;
  }
  // Text so lange verkleinern, bis er in den Kasten passt (Zeilenumbruch auch nach Bindestrichen); Rückgabe: Zeilen und Schriftgröße
  function fitText(x, text, maxW, maxH, size0, minSize, weight) {
    var tokens = String(text).match(/[^\s-]+-?|-/g) || [String(text)], size, lines, ok;
    for (size = size0; size >= minSize; size -= 1) {
      x.font = weight + ' ' + Math.round(size) + 'px system-ui,sans-serif'; lines = []; var line = '', prev = '', fits = true;
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i], cand = line ? (prev.slice(-1) === '-' ? line + tk : line + ' ' + tk) : tk;
        if (x.measureText(cand).width <= maxW) { line = cand; }
        else { if (line) lines.push(line); line = tk; if (x.measureText(tk).width > maxW) fits = false; }
        prev = tk;
      }
      if (line) lines.push(line);
      ok = fits && lines.length * size * 1.12 <= maxH; if (ok) break;
    }
    return { lines: lines, size: Math.round(size), lh: Math.round(size * 1.12) };
  }
  function drawFit(x, text, cx, y0, maxW, maxH, size0, minSize, weight, color) {
    var r = fitText(x, text, maxW, maxH, size0, minSize, weight); x.font = weight + ' ' + r.size + 'px system-ui,sans-serif'; x.fillStyle = color; x.textBaseline = 'alphabetic';
    var top = y0 + (maxH - r.lines.length * r.lh) / 2 + r.size * .86;
    r.lines.forEach(function (l, i) { x.fillText(l, cx, top + i * r.lh); });
  }
  function flames(x, w, h, col, seed) {       // Flammenzungen am unteren Rand (eigene Zeichnung)
    x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
    var n = Math.max(4, Math.round(w / 34));
    for (var i = 0; i <= n; i++) { var px = i * w / n, hh = h * (.78 + .16 * Math.sin(i * 2.3 + seed)); x.quadraticCurveTo(px - w / n * .4, hh + 10, px, hh - 18 * (i % 2 ? 1 : .4)); }
    x.lineTo(w, h); x.closePath(); x.fill();
  }
  // ---------- Feldtexturen ----------
  function fieldTexture(i) {
    var f = api.F[i], p = fpos(i), S = 128, w = Math.round(p.w * S), h = Math.round(p.d * S), c = canvas(w, h), x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a0e18'); g.addColorStop(1, '#0e050a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    // feines Raster aus Rauten
    x.strokeStyle = 'rgba(255,60,90,.06)'; x.lineWidth = 1;
    for (var k = -h; k < w + h; k += 18) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h, h); x.stroke(); x.beginPath(); x.moveTo(k + h, 0); x.lineTo(k, h); x.stroke(); }
    flames(x, w, h, 'rgba(193,18,31,.35)', i);
    x.textAlign = 'center'; x.fillStyle = '#fff';
    if (f.t === 'st') {
      var gc = api.GROUPS[f.g].c, bh = Math.round(h * .22);
      var bg = x.createLinearGradient(0, 0, 0, bh); bg.addColorStop(0, gc); bg.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = bg; x.fillRect(0, 0, w, bh);
      x.fillStyle = 'rgba(255,255,255,.25)';   // zwei kleine Hörner im Farbband
      x.beginPath(); x.moveTo(w * .3, bh); x.lineTo(w * .36, bh * .25); x.lineTo(w * .42, bh); x.fill(); x.beginPath(); x.moveTo(w * .58, bh); x.lineTo(w * .64, bh * .25); x.lineTo(w * .7, bh); x.fill();
      var ph = Math.round(w * .2);
      drawFit(x, tr(f.n), w / 2, bh + 8, w * .88, h - bh - ph - 18, w * .17, w * .07, 800, '#ffffff');
      drawFit(x, String(f.price), w / 2, h - ph - 4, w * .8, ph, w * .19, w * .1, 900, '#ffc857');
    } else {
      glyph(x, f.t, w / 2, h * (p.corner ? .36 : .27), Math.min(w, h) * (p.corner ? .2 : .17));
      var hasP = !!(f.price || f.amt), ph2 = hasP ? Math.round(w * .2) : 0, ty = h * (p.corner ? .56 : .42);
      drawFit(x, tr(f.n), w / 2, ty, w * .88, h - ty - ph2 - 12, w * (p.corner ? .13 : .16), w * .07, 800, '#ffe3ea');
      if (f.price) drawFit(x, String(f.price), w / 2, h - ph2 - 4, w * .8, ph2, w * .19, w * .1, 900, '#ffc857');
      if (f.amt) drawFit(x, '\u2212' + f.amt, w / 2, h - ph2 - 4, w * .8, ph2, w * .19, w * .1, 900, '#ff8a9a');
    }
    x.strokeStyle = 'rgba(255,120,150,.55)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
    return tex(c);
  }
  function tableTexture() {       // Obsidian mit glühenden Lavarissen
    var S = 1024, c = canvas(S, S), x = c.getContext('2d'); x.fillStyle = '#0c0509'; x.fillRect(0, 0, S, S);
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (var k = 0; k < 70; k++) {
      var px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py);
      for (var s = 0; s < 8; s++) { px += (rnd() - .5) * 150; py += (rnd() - .5) * 150; x.lineTo(px, py); }
      x.strokeStyle = 'rgba(255,' + Math.round(70 + rnd() * 80) + ',20,' + (.15 + rnd() * .35) + ')'; x.lineWidth = 1 + rnd() * 3; x.shadowColor = '#ff4a1a'; x.shadowBlur = 8; x.stroke();
    }
    var t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  var centerCv = null, centerTex = null;
  function drawCenter() {
    var S = 1024, x = centerCv.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 30, S / 2, S / 2, S * .72);
    if (H.logo) { g.addColorStop(0, '#e8432c'); g.addColorStop(.6, '#c4141f'); g.addColorStop(1, '#7d0a16'); } else { g.addColorStop(0, '#3a0d18'); g.addColorStop(1, '#0b0408'); }
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = H.logo ? 'rgba(20,4,8,.35)' : 'rgba(255,60,90,.5)'; x.lineWidth = 5;
    [490, 458].forEach(function (rad) { x.beginPath(); x.arc(S / 2, S / 2, rad, 0, 7); x.stroke(); });
    x.beginPath(); for (var k = 0; k < 6; k++) { var a = k * Math.PI / 3 - Math.PI / 2, px = S / 2 + 490 * Math.cos(a), py = S / 2 + 490 * Math.sin(a); k ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke();
    x.textAlign = 'center';
    if (H.logo) {      // das Logo liegt direkt auf dem Rot
      var lw = S * .74, lh = lw * 2100 / 2263; x.drawImage(H.logo, S / 2 - lw / 2, S * .1, lw, lh);
      x.fillStyle = '#14070a'; x.font = '900 104px system-ui,sans-serif'; x.fillText('TYCOON', S / 2, S * .1 + lh + 96);
      drawFit(x, 'Fan-Spiel, nicht kommerziell. Helluva Boss © Vivienne Medrano / SpindleHorse Toons', S / 2, S - 150, S * .74, 80, 30, 15, 600, 'rgba(255,255,255,.88)');
    } else {
      x.fillStyle = '#ff3355'; x.shadowColor = '#ff2a55'; x.shadowBlur = 24; x.font = '900 120px system-ui,sans-serif'; x.fillText('HELLUVA', S / 2, S / 2 - 10); x.fillText('TYCOON', S / 2, S / 2 + 120);
      x.shadowBlur = 0; x.font = '600 34px system-ui,sans-serif'; x.fillStyle = 'rgba(255,255,255,.55)'; x.fillText('Fan-Spiel, nicht kommerziell', S / 2, S / 2 + 190);
      x.font = '500 26px system-ui,sans-serif'; x.fillText('Helluva Boss © Vivienne Medrano / SpindleHorse Toons', S / 2, S / 2 + 240);
    }
    if (centerTex) centerTex.needsUpdate = true;
  }
  function centerTexture() { centerCv = canvas(1024, 1024); drawCenter(); centerTex = tex(centerCv); return centerTex; }
  // Einfache gezeichnete Symbole statt Emojis
  function glyph(x, t, cx, cy, s) {
    x.save(); x.translate(cx, cy); x.strokeStyle = '#ffe3ea'; x.fillStyle = '#ffe3ea'; x.lineWidth = Math.max(3, s * .13); x.lineJoin = 'round'; x.lineCap = 'round';
    if (t === 'go') { x.beginPath(); x.moveTo(-s, 0); x.lineTo(s * .3, 0); x.stroke(); x.beginPath(); x.moveTo(s * .2, -s * .6); x.lineTo(s, 0); x.lineTo(s * .2, s * .6); x.closePath(); x.fill(); }
    else if (t === 'jail') { x.strokeRect(-s * .8, -s * .8, s * 1.6, s * 1.6); for (var k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(k * s * .4, -s * .8); x.lineTo(k * s * .4, s * .8); x.stroke(); } }
    else if (t === 'gojail') { x.beginPath(); x.moveTo(0, -s); x.lineTo(s, s * .8); x.lineTo(-s, s * .8); x.closePath(); x.stroke(); x.fillRect(-s * .08, -s * .35, s * .16, s * .6); x.beginPath(); x.arc(0, s * .5, s * .09, 0, 7); x.fill(); }
    else if (t === 'free') { x.beginPath(); x.arc(0, 0, s * .8, 0, 7); x.stroke(); x.beginPath(); x.moveTo(-s * .45, s * .1); x.lineTo(s * .45, s * .1); x.moveTo(-s * .3, -s * .2); x.lineTo(s * .3, -s * .2); x.stroke(); }
    else if (t === 'fate') { x.beginPath(); for (var j = 0; j < 5; j++) { var a = -Math.PI / 2 + j * 4 * Math.PI / 5; x.lineTo(Math.cos(a) * s, Math.sin(a) * s); } x.closePath(); x.stroke(); }
    else if (t === 'pact') { x.strokeRect(-s * .7, -s * .85, s * 1.4, s * 1.7); [-.4, 0, .4].forEach(function (y) { x.beginPath(); x.moveTo(-s * .4, y * s); x.lineTo(s * .4, y * s); x.stroke(); }); }
    else if (t === 'tax') { x.beginPath(); x.arc(0, 0, s * .8, 0, 7); x.stroke(); x.beginPath(); x.moveTo(-s * .35, -s * .35); x.lineTo(s * .35, s * .35); x.moveTo(s * .35, -s * .35); x.lineTo(-s * .35, s * .35); x.stroke(); }
    else if (t === 'ferry') { x.beginPath(); x.moveTo(-s, s * .1); x.lineTo(s, s * .1); x.lineTo(s * .6, s * .7); x.lineTo(-s * .6, s * .7); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(0, s * .1); x.lineTo(0, -s * .8); x.lineTo(s * .6, -s * .1); x.closePath(); x.fill(); }
    else if (t === 'util') { x.beginPath(); x.moveTo(s * .2, -s); x.lineTo(-s * .5, s * .15); x.lineTo(0, s * .15); x.lineTo(-s * .2, s); x.lineTo(s * .5, -s * .2); x.lineTo(0, -s * .2); x.closePath(); x.fill(); }
    x.restore();
  }
  function letterTex(p) {      // Spielfigur-Beschriftung: Anfangsbuchstabe im Farbkreis
    var c = canvas(128, 128), x = c.getContext('2d'); x.fillStyle = api.COLORS[p]; x.beginPath(); x.arc(64, 64, 56, 0, 7); x.fill(); x.lineWidth = 8; x.strokeStyle = '#fff'; x.stroke();
    x.fillStyle = '#16080c'; x.font = '900 74px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(api.CHARS[p] || '?').charAt(0), 64, 70); return tex(c);
  }

  // ---------- Aufbau ----------
  H.init = function (hostEl, apiObj) {
    host = hostEl; api = apiObj;
    r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setClearColor(0x07030a); host.appendChild(r.domElement);
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x12050c, .012);
    camera = new THREE.PerspectiveCamera(42, 1, .1, 300); camera.position.set(0, 25, 22);
    controls = new THREE.OrbitControls(camera, r.domElement); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 10; controls.maxDistance = 70; controls.maxPolarAngle = 1.38;
    perf = window.Perf3D ? Perf3D.create({ r: r, resize: function () { H.resize(); } }) : null;
    scene.add(new THREE.AmbientLight(0xffb0c0, .55));
    var dl = new THREE.DirectionalLight(0xffe0d0, .8); dl.position.set(8, 30, 14); scene.add(dl);
    var p1 = new THREE.PointLight(0xff2a55, 1.1, 60); p1.position.set(0, 8, 0); scene.add(p1);
    // Tisch und Boden
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x0a0408 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -12; scene.add(floor);
    var tt = tableTexture(); tt.repeat.set(2, 2);
    var table = new THREE.Mesh(new THREE.BoxGeometry(48, 1.4, 48), new THREE.MeshStandardMaterial({ map: tt, roughness: .6, metalness: .2, emissive: 0x1a0508 })); table.position.y = -.8; scene.add(table); H.own.table = table;
    // Brettplatte und Mitte
    var plate = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + .6, .3, HALF * 2 + .6), new THREE.MeshStandardMaterial({ color: 0x1a0810, roughness: .5, metalness: .4 })); plate.position.y = -.05; scene.add(plate);
    var inner = HALF * 2 - 2 * CORNER;
    var center = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshStandardMaterial({ map: centerTexture(), roughness: .7 })); center.rotation.x = -Math.PI / 2; center.position.y = .11; scene.add(center); H.own.center = center;
    // Felder
    for (var i = 0; i < 40; i++) {
      var p = fpos(i), g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw; scene.add(g);
      var slab = new THREE.Mesh(new THREE.BoxGeometry(p.w - .04, TOP, p.d - .04), new THREE.MeshStandardMaterial({ color: 0x220a12, roughness: .6, metalness: .3 })); slab.position.y = TOP / 2 - .04; g.add(slab);
      var top = new THREE.Mesh(new THREE.PlaneGeometry(p.w - .1, p.d - .1), new THREE.MeshStandardMaterial({ map: fieldTexture(i), roughness: .55, emissive: 0x200508 })); top.rotation.x = -Math.PI / 2; top.position.y = TOP - .02; top.userData.field = i; g.add(top);
      fieldG.push(g); fieldTop.push(top);
      var bar = new THREE.Mesh(new THREE.BoxGeometry(p.w - .1, .14, .16), new THREE.MeshBasicMaterial({ color: 0xffffff })); bar.position.set(0, TOP + .04, p.d / 2 - .1); bar.visible = false; g.add(bar); ownBar.push(bar);
      var mort = new THREE.Mesh(new THREE.PlaneGeometry(p.w - .1, p.d - .1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .66 })); mort.rotation.x = -Math.PI / 2; mort.position.y = TOP + .01; mort.visible = false; g.add(mort); mortM.push(mort);
      var hg = new THREE.Group(); hg.position.set(0, TOP, -p.d / 2 + .5); g.add(hg); houseG.push(hg);
    }
    buildDecks();
    // aktives Feld
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(.5, .62, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .9, side: THREE.DoubleSide })); ringMesh.rotation.x = -Math.PI / 2; ringMesh.visible = false; scene.add(ringMesh);
    // Glut aus dem Boden
    var N = 160, pos = new Float32Array(N * 3), sp = []; for (var k = 0; k < N; k++) { pos[k * 3] = (Math.random() - .5) * 44; pos[k * 3 + 1] = Math.random() * 14; pos[k * 3 + 2] = (Math.random() - .5) * 44; sp.push(.4 + Math.random() * .8); }
    var eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ember = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xff6a2a, size: .16, transparent: true, opacity: .8, depthWrite: false })); ember.userData.sp = sp; scene.add(ember);
    // Klicken auf Felder
    var ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), down = null;
    r.domElement.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    r.domElement.addEventListener('pointerup', function (e) {
      if (!down) return; var mv = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
      if (mv > 8 || dt > 600) return;
      var b = r.domElement.getBoundingClientRect(); mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mouse, camera);
      var dl = []; Object.keys(deedG).forEach(function (k) { dl = dl.concat(deedG[k].children); });
      var h = ray.intersectObjects(fieldTop.concat(dl), false)[0]; if (h && api.onField) api.onField(h.object.userData.field);
    });
    addEventListener('resize', function () { if (active) H.resize(); });
    if (window.ResizeObserver) new ResizeObserver(function () { if (active) H.resize(); }).observe(host);
    requestAnimationFrame(function loop(now) { requestAnimationFrame(loop); if (active) { if (perf) perf.frame(now); tick(now); } });
    var li = new Image(); li.onload = function () { H.logo = li; if (centerCv) drawCenter(); }; li.src = 'img/logo.svg';
    H.ready = true; H.resize();
    H.loadFolder();
  };
  H.setActive = function (a) { active = !!a; if (a) H.resize(); };
  H.resize = function () { var w = host.clientWidth || 800, h = host.clientHeight || 600; r.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  H.camReset = function () { tw = tw.filter(function (t) { return t.key !== 'cam'; }); var p0 = camera.position.clone(), t0 = controls.target.clone(), p1 = new THREE.Vector3(0, 25, 22); tween(800, function (k) { var e = k * k * (3 - 2 * k); camera.position.lerpVectors(p0, p1, e); controls.target.lerpVectors(t0, new THREE.Vector3(0, 0, 0), e); }, 'cam'); };
  H.debug = function () { return { camera: camera, controls: controls }; };
  H.camTop = function () { var p0 = camera.position.clone(), p1 = new THREE.Vector3(0, 44, 1); tween(800, function (k) { camera.position.lerpVectors(p0, p1, k * k * (3 - 2 * k)); }, 'cam'); };

  // ---------- Tweens ----------
  function tween(dur, fn, key) { if (key) tw = tw.filter(function (t) { return t.key !== key; }); return new Promise(function (res) { tw.push({ t0: performance.now(), dur: dur, fn: fn, res: res, key: key }); }); }
  function runTw(now) { for (var i = tw.length - 1; i >= 0; i--) { var t = tw[i]; if (!t) continue; var k = Math.min(1, (now - t.t0) / t.dur); t.fn(k); if (k >= 1) { tw.splice(i, 1); t.res(); } } }
  setInterval(function () { if (!active) runTw(performance.now()); }, 100);

  // ---------- Figuren ----------
  function colorOf(p) { return api.COLORS[p]; }
  function mkToken(p) {
    var g = new THREE.Group(), col = new THREE.Color(colorOf(p));
    var m = new THREE.MeshStandardMaterial({ color: col, roughness: .35, metalness: .3, emissive: col.clone().multiplyScalar(.25) });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(.26, .3, .1, 20), m); base.position.y = .05; g.add(base);
    var body = new THREE.Mesh(new THREE.ConeGeometry(.2, .55, 20), m); body.position.y = .38; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(.17, 20, 16), m); head.position.y = .76; g.add(head);
    var hm = new THREE.MeshStandardMaterial({ color: 0x1a0508, roughness: .5 });
    [-1, 1].forEach(function (s) { var h = new THREE.Mesh(new THREE.ConeGeometry(.045, .2, 8), hm); h.position.set(s * .1, .93, 0); h.rotation.z = -s * .35; g.add(h); });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: H.own['figur-' + p] || letterTex(p), transparent: true, depthWrite: false })); sp.scale.set(.8, .8, 1); sp.position.y = 1.35; g.add(sp);
    scene.add(g); g.userData.base = base; return g;
  }
  function tokenSpot(p, i, n) { var f = fpos(i), a = (p / Math.max(1, n)) * Math.PI * 2, rad = f.corner ? .7 : .38, c = Math.cos(f.yaw), s = Math.sin(f.yaw), lx = Math.cos(a) * rad * (f.corner ? 1 : .55), lz = Math.sin(a) * rad * (f.corner ? 1 : .8); return new THREE.Vector3(f.x + lx * c + lz * s, TOP, f.z - lx * s + lz * c); }
  function hopTo(p, from, to, steps, back, jump) {
    var path = [], i = from, n = Math.abs(steps);
    if (jump) path = [to]; else for (var k = 0; k < n; k++) { i = (i + (back ? -1 : 1) + 40) % 40; path.push(i); }
    var seq = Promise.resolve(), cur = from;
    path.forEach(function (fi) {
      seq = seq.then(function () {
        var a = tokens[p].position.clone(), b = tokenSpot(p, fi, lastV ? lastV.n : 4);
        return tween(jump ? 600 : 170, function (k) { tokens[p].position.set(a.x + (b.x - a.x) * k, TOP + Math.sin(k * Math.PI) * (jump ? 1.8 : .5), a.z + (b.z - a.z) * k); }, 'tok' + p).then(function () { if (api.sfx) api.sfx('take'); });
      });
    });
    shown[p] = to; return seq;
  }

  // ---------- Häuser ----------
  var HM = null;
  function houseMats() {
    return HM || (HM = {
      body: new THREE.MeshStandardMaterial({ color: 0x35e07a, roughness: .4, emissive: 0x18a04e, emissiveIntensity: .85 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x0c7a3a, roughness: .5, emissive: 0x06431f, emissiveIntensity: .6 }),
      pal: new THREE.MeshStandardMaterial({ color: 0xff2a3c, roughness: .35, emissive: 0xb00f1c, emissiveIntensity: .8 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: .3, metalness: .6, emissive: 0x8a5a00, emissiveIntensity: .7 }),
      base: new THREE.MeshStandardMaterial({ color: 0xfff2d8, roughness: .6, emissive: 0x4a4030 }),
      edge: new THREE.LineBasicMaterial({ color: 0xffffff })
    });
  }
  function outlined(geo, mat) { var m = new THREE.Mesh(geo, mat); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), houseMats().edge)); return m; }
  function buildHouses(i, n, anim) {
    var g = houseG[i]; while (g.children.length) g.remove(g.children[0]);
    if (!n) return;
    var M = houseMats(), p = fpos(i);
    // heller Sockel im Farbband, damit sich die Gebäude vom dunklen Brett abheben
    var base = new THREE.Mesh(new THREE.BoxGeometry(p.w - .14, .05, .62), M.base); base.position.y = .025; g.add(base);
    if (n === 5) {      // Palast: roter Bau mit goldenen Türmen
      var b = outlined(new THREE.BoxGeometry(1.05, .55, .5), M.pal); b.position.y = .32; g.add(b);
      [-.42, 0, .42].forEach(function (x, k) {
        var tw2 = outlined(new THREE.BoxGeometry(.2, k === 1 ? .5 : .32, .2), M.gold); tw2.position.set(x, .6 + (k === 1 ? .25 : .16), 0); g.add(tw2);
        var c = new THREE.Mesh(new THREE.ConeGeometry(.19, .32, 4), M.pal); c.rotation.y = Math.PI / 4; c.position.set(x, .6 + (k === 1 ? .66 : .48), 0); g.add(c);
      });
    } else {
      var xs = [-.51, -.17, .17, .51];
      for (var k = 0; k < n; k++) {
        var h = outlined(new THREE.BoxGeometry(.29, .32, .36), M.body); h.position.set(xs[k], .21, 0); g.add(h);
        var ro = new THREE.Mesh(new THREE.ConeGeometry(.28, .26, 4), M.roof); ro.rotation.y = Math.PI / 4; ro.scale.z = 1.2; ro.position.set(xs[k], .5, 0); g.add(ro);
      }
    }
    if (anim) { g.scale.setScalar(.01); tween(520, function (q) { var e = q < .7 ? q / .7 * 1.25 : 1.25 - (q - .7) / .3 * .25; g.scale.setScalar(Math.max(.01, e)); g.position.y = TOP + (1 - q) * 1.2; }, 'house' + i); }
    else { g.scale.setScalar(1); g.position.y = TOP; }
  }

  // ---------- Besitzkarten auf dem Tisch (neben dem Würfelfeld jedes Spielers) ----------
  var deedG = {}, deedTexC = {};
  function deedTexture(i, mort) {
    var key = i + (mort ? 'm' : ''); if (deedTexC[key]) return deedTexC[key];
    var f = api.F[i], w = 256, h = 348, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#fff8ea'; x.fillRect(0, 0, w, h);
    var st = f.t === 'st', bh = 112; x.fillStyle = st ? api.GROUPS[f.g].c : f.t === 'ferry' ? '#1b1b22' : '#4a4f5a'; x.fillRect(0, 0, w, bh);
    x.textAlign = 'center';
    if (!st) glyph(x, f.t, w / 2, 34, 22);
    x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 5;
    drawFit(x, tr(f.n), w / 2, st ? 8 : 56, w * .9, st ? bh - 16 : bh - 60, 34, 15, 900, '#ffffff'); x.shadowBlur = 0;
    x.fillStyle = '#2a0d08'; x.fillRect(0, bh, w, 5);
    x.font = '700 24px system-ui,sans-serif'; x.textAlign = 'left';
    var rows = st ? [['Miete', f.rent[0]], ['1 Haus', f.rent[1]], ['2', f.rent[2]], ['3', f.rent[3]], ['4', f.rent[4]], ['Palast', f.rent[5]]] : f.t === 'ferry' ? [['1', 25], ['2', 50], ['3', 100], ['4', 200]] : [['1', '4 x W'], ['2', '10 x W']];
    rows.forEach(function (rw, k) { var y = bh + 40 + k * 32; x.textAlign = 'left'; x.fillText(rw[0], 18, y); x.textAlign = 'right'; x.fillText(String(rw[1]), w - 18, y); });
    x.textAlign = 'center'; x.font = '900 26px system-ui,sans-serif'; x.fillStyle = '#7a1010'; x.fillText(String(f.price), w / 2, h - 14);
    if (mort) { x.fillStyle = 'rgba(0,0,0,.62)'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff8a8a'; x.font = '900 46px system-ui,sans-serif'; x.fillText('HYP', w / 2, h / 2 + 16); }
    x.strokeStyle = '#2a0d08'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
    return (deedTexC[key] = tex(c));
  }
  var DW = 1.3, DH = 1.77, deedGeo = null;
  function deedOrigin(p) { var s = SPOTS[p % 6]; return p % 6 < 4 ? { x: (s[0] > 0 ? 1 : -1) * 11.2, z: s[1], dir: s[0] > 0 ? 1 : -1 } : { x: -2.1, z: s[1] > 0 ? 17 : -13.5, dir: 1 }; }      // Kartenplatz je Spieler rund ums Brett
  function buildDeeds(p, V) {
    var g = deedG[p]; if (!g) { g = deedG[p] = new THREE.Group(); scene.add(g); }
    var list = []; for (var i = 0; i < 40; i++) if (V.own[i] === p) list.push(i);
    var key = list.map(function (i) { return i + (V.mort[i] ? 'm' : ''); }).join(',') + (V.out[p] ? 'x' : '') + '|' + V.me + '|' + V.n;
    if (g._k === key) return; var old = g._ids || {}; g._k = key; g._ids = {};
    while (g.children.length) g.remove(g.children[0]);
    if (V.out[p]) return;
    deedGeo = deedGeo || new THREE.PlaneGeometry(DW, DH);
    // Eigene Karten liegen vorn vor dem Brett (im Standardbild sichtbar), die der anderen neben ihrem Würfelfeld
    var mine = p === V.me, slots = [], o = deedOrigin(p), k2;
    if (mine) { var xs = []; for (k2 = 0; k2 < 13; k2++) { var xx = -8.28 + k2 * 1.38; xs.push(xx); } for (k2 = 0; k2 < 40; k2++) slots.push([xs[k2 % xs.length], 10.6 + Math.floor(k2 / xs.length) * .66, Math.floor(k2 / xs.length)]); }
    else { var rowsN = Math.ceil(list.length / 4), z0 = o.z - ((rowsN - 1) * .66 + DH) / 2 + DH / 2; for (k2 = 0; k2 < 40; k2++) slots.push([o.x + o.dir * (k2 % 4) * (DW + .08), z0 + Math.floor(k2 / 4) * .66, Math.floor(k2 / 4)]); }
    list.forEach(function (fi, k) {      // Reihen überlappen: von jeder Karte bleibt der Kopf mit Farbe und Name sichtbar
      var s = slots[k], m = new THREE.Mesh(deedGeo, new THREE.MeshBasicMaterial({ map: deedTexture(fi, !!V.mort[fi]) }));
      m.rotation.x = -Math.PI / 2; m.position.set(s[0], -.08 + s[2] * .012, s[1]); m.userData.field = fi; g.add(m); g._ids[fi] = 1;
      if (!old[fi] && g._init) { var y1 = m.position.y; tween(600, function (q) { var e = 1 - Math.pow(1 - q, 3); m.position.y = y1 + (1 - e) * 5; m.rotation.z = (1 - e) * 2.2; }, 'deed' + fi); }
    });
    g._init = true;
  }

  // ---------- Aktionskarten: zwei Stapel auf dem Brett, gezogene Karte fliegt zur Kamera und dreht sich um ----------
  var decks = {}, flyCard = null, cardTok = 0, DECKC = { fate: ['#3b1466', '#4a1c80'], pact: ['#7a0d16', '#96131f'] }, CW3 = 2.0, CH3 = 2.8;
  function backTexture(kind) {
    var w = 256, h = 358, c = canvas(w, h), x = c.getContext('2d'), cs = DECKC[kind];
    x.fillStyle = cs[0]; x.fillRect(0, 0, w, h); x.strokeStyle = cs[1]; x.lineWidth = 10;
    for (var k = -h; k < w + h; k += 28) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h, h); x.stroke(); }
    x.strokeStyle = '#f3e3c4'; x.lineWidth = 6; x.strokeRect(12, 12, w - 24, h - 24);
    glyph(x, kind, w / 2, h * .4, 44);
    x.textAlign = 'center'; drawFit(x, tr(HT.DECKN[kind]), w / 2, h * .62, w * .8, 70, 30, 14, 900, '#ffe9c9');
    return tex(c);
  }
  function faceTexture(kind, cd, who) {
    var w = 512, h = 716, c = canvas(w, h), x = c.getContext('2d'), cs = DECKC[kind];
    x.fillStyle = '#fff4e0'; x.fillRect(0, 0, w, h);
    x.fillStyle = cs[1]; x.fillRect(0, 0, w, 96); x.textAlign = 'center';
    drawFit(x, tr(HT.DECKN[kind]).toUpperCase(), w / 2, 14, w * .86, 68, 46, 20, 900, '#ffffff');
    x.save(); x.translate(w / 2, 190); x.strokeStyle = cs[0]; x.fillStyle = cs[0]; x.restore();
    var gx = canvas(160, 160), g2 = gx.getContext('2d'); glyph(g2, kind, 80, 80, 54); x.globalCompositeOperation = 'source-over';
    x.fillStyle = cs[0]; x.beginPath(); x.arc(w / 2, 196, 78, 0, 7); x.fill(); x.drawImage(gx, w / 2 - 80, 116);
    drawFit(x, tr(cd.d), w / 2, 296, w * .84, 320, 46, 22, 700, '#3a1406');
    if (who) drawFit(x, who, w / 2, h - 80, w * .8, 50, 28, 16, 700, 'rgba(58,20,6,.7)');
    x.strokeStyle = '#14070a'; x.lineWidth = 12; x.strokeRect(6, 6, w - 12, h - 12);
    return tex(c);
  }
  function buildDecks() {
    [['fate', -5.3, -4.7], ['pact', 5.3, 4.7]].forEach(function (d) {
      var side = new THREE.MeshStandardMaterial({ color: 0xf3e3c4, roughness: .8 }), top = new THREE.MeshBasicMaterial({ map: backTexture(d[0]) });
      var m = new THREE.Mesh(new THREE.BoxGeometry(CW3, .36, CH3), [side, side, top, side, side, side]); m.position.set(d[1], .3, d[2]); m.rotation.y = .3; scene.add(m); decks[d[0]] = m;
    });
  }
  H.card = function (card, cd, who) {
    if (!H.ready || !decks[card.kind]) return;
    var my = ++cardTok, dk = decks[card.kind];
    if (flyCard) { scene.remove(flyCard); flyCard = null; }
    var g = flyCard = new THREE.Group(), geo = new THREE.PlaneGeometry(CW3, CH3);
    var front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: faceTexture(card.kind, cd, who), depthTest: false, transparent: true })); front.renderOrder = 50; g.add(front);
    var back = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: backTexture(card.kind), depthTest: false, transparent: true })); back.rotation.y = Math.PI; back.renderOrder = 50; g.add(back);
    // Start: verdeckt auf dem Stapel; Ziel: vor der Kamera, Vorderseite zum Betrachter (folgt der Kamera, solange sie gezeigt wird)
    var p0 = dk.position.clone(); p0.y = .52; var q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, -dk.rotation.y));
    var goal = function () { var d = new THREE.Vector3(); camera.getWorldDirection(d); return camera.position.clone().add(d.multiplyScalar(9)); };
    g.position.copy(p0); g.quaternion.copy(q0); scene.add(g);
    var lift = p0.clone(); lift.y = 3.2;
    tween(260, function (k) { g.position.lerpVectors(p0, lift, k); }, 'acard').then(function () {
      if (my !== cardTok) return;
      return tween(700, function (k) { var e = k * k * (3 - 2 * k); g.position.lerpVectors(lift, goal(), e); g.quaternion.copy(q0).slerp(camera.quaternion, e); }, 'acard');
    }).then(function () {
      if (my !== cardTok) return;
      return tween(4300, function () { g.position.copy(goal()); g.quaternion.copy(camera.quaternion); }, 'acard');
    }).then(function () {
      if (my !== cardTok) return;
      var a = g.position.clone(), qa = g.quaternion.clone();
      return tween(550, function (k) { var e = k * k; g.position.lerpVectors(a, p0, e); g.quaternion.copy(qa).slerp(q0, e); front.material.opacity = back.material.opacity = 1 - e * .6; }, 'acard');
    }).then(function () { if (my === cardTok && flyCard === g) { scene.remove(g); flyCard = null; } });
  };

  // ---------- Update ----------
  H.update = function (V, inp) {
    if (!H.ready) return; lastV = V;
    if (!shown || shown.length !== V.n) { tokens.forEach(function (t) { scene.remove(t); }); tokens = []; shown = V.pos.slice(); for (var p = 0; p < V.n; p++) { var t = mkToken(p); tokens.push(t); var s = tokenSpot(p, V.pos[p], V.n); t.position.copy(s); } moveSeq = V.move ? V.move.seq : -1; }
    // Besitz, Häuser, Hypotheken
    for (var i = 0; i < 40; i++) {
      var o = V.own[i], bar = ownBar[i];
      if (o >= 0) { bar.visible = true; bar.material.color.set(colorOf(o)); } else bar.visible = false;
      mortM[i].visible = !!V.mort[i];
      var key = V.houses[i]; if (houseG[i]._k !== key) { var first = houseG[i]._k === undefined; houseG[i]._k = key; buildHouses(i, key, !first); }
    }
    // Figuren bewegen
    var m = V.move;
    for (var q = 0; q < V.n; q++) {
      tokens[q].visible = !V.out[q];
      if (m && m.p === q && m.seq !== moveSeq && shown[q] !== V.pos[q]) { moveSeq = m.seq; var steps = m.back ? -Math.abs(m.steps) : (V.pos[q] - shown[q] + 40) % 40; hopTo(q, shown[q], V.pos[q], steps, !!m.back, !!m.jump); }
      else if (!m || m.p !== q || m.seq === moveSeq) { if (shown[q] !== V.pos[q] && !tw.some(function (t) { return t.key === 'tok' + q; })) { shown[q] = V.pos[q]; tokens[q].position.copy(tokenSpot(q, V.pos[q], V.n)); } }
    }
    if (m && m.seq !== moveSeq) moveSeq = m.seq;
    // Würfelfelder und Besitzkarten
    H.view(0).show();
    for (var v = 0; v < V.n; v++) buildDeeds(v, V);
  };
  function tick(now) {
    runTw(now);
    var t = now / 1000;
    if (lastV) {
      var cp = lastV.cur, tk = tokens[cp];
      if (tk && !lastV.out[cp]) { ringMesh.visible = true; ringMesh.position.set(tk.position.x, TOP + .02, tk.position.z); ringMesh.material.color.set(colorOf(cp)); ringMesh.scale.setScalar(1 + .12 * Math.sin(t * 5)); } else ringMesh.visible = false;
      tokens.forEach(function (g, i) { g.children[2].position.y = .76 + (i === cp ? .06 * Math.sin(t * 6) : 0); });
    }
    if (ember) { var a = ember.geometry.attributes.position, sp = ember.userData.sp; for (var k = 0; k < sp.length; k++) { var y = a.getY(k) + .02 * sp[k]; a.setY(k, y > 14 ? 0 : y); } a.needsUpdate = true; }
    controls.update(); r.render(scene, camera);
  }

  // ---------- Würfelfeld pro Spieler (neben dem Brett), Kamerafahrt ----------
  var SPOTS = [[13.6, 4.6, 0], [-13.6, 4.6, 0], [13.6, -4.6, Math.PI], [-13.6, -4.6, Math.PI], [0, 14.6, 0], [0, -14.6, Math.PI]];
  function focusTray(on, man, p) {
    if (!man) { if (on && (!autoDice || manual || camSave)) return; if (!on && manual) return; } else if (on && camSave) { controls.enabled = false; return; }
    tw = tw.filter(function (t) { return t.key !== 'cam' && t.key !== 'dicecam'; });
    var p0 = camera.position.clone(), t0 = controls.target.clone();
    if (on) {
      camSave = { pos: p0.clone(), target: t0.clone() };
      var to = { pos: new THREE.Vector3(0, 21, 10), target: new THREE.Vector3(0, 0, .8) };      // Blick von schräg oben auf die Brettmitte
      controls.enabled = false;
      tween(900, function (k) { var e = k * k * (3 - 2 * k); camera.position.lerpVectors(p0, to.pos, e); controls.target.lerpVectors(t0, to.target, e); }, 'dicecam');
    } else if (camSave) {
      var sv = camSave; camSave = null;
      tween(900, function (k) { var e = k * k * (3 - 2 * k); camera.position.lerpVectors(p0, sv.pos, e); controls.target.lerpVectors(t0, sv.target, e); if (k >= 1) controls.enabled = true; }, 'dicecam');
    } else controls.enabled = true;
  }
  H.view = function (p) {
    // Kein Tablett: Alle schnippen die Würfel auf die Brettmitte (eine gemeinsame Würfelfläche)
    if (!views[0]) views[0] = Dice3D.embed({ scene: scene, camera: camera, dom: r.domElement, stage: host, pos: [0, .13, 0], scale: .9, rotY: 0, bare: true, focus: function (on) { focusTray(on, false, 0); } });
    return views[0];
  };
  H.cancelDice = function () { manual = false; Object.keys(views).forEach(function (k) { views[k].cancel(); }); if (camSave) focusTray(false, true); };
  H.toggleAuto = function () { autoDice = !autoDice; try { localStorage.setItem('ht-autodice', autoDice ? '1' : '0'); } catch (e) { } return autoDice; };
  H.toggleManual = function (p) { if (!H.ready) return manual; if (manual) { manual = false; focusTray(false, true); } else { manual = true; focusTray(true, true, p); } return manual; };

  // ---------- Bilder ----------
  // Dateien aus hoellen-tycoon/img/ (Liste in manifest.json) oder per Knopf aus dem eigenen Rechner (bleibt im Browser)
  function applyImage(base, im) {
    var t = new THREE.Texture(im); t.needsUpdate = true; t.anisotropy = 4;
    if (base === 'tisch') { t.wrapS = t.wrapT = THREE.RepeatWrapping; H.own.table.material.map = t; H.own.table.material.needsUpdate = true; return true; }
    if (base === 'mitte') { H.own.center.material.map = t; H.own.center.material.needsUpdate = true; return true; }
    var m = base.match(/^feld-?(\d{1,2})$/); if (m && +m[1] < 40) { fieldTop[+m[1]].material.map = t; fieldTop[+m[1]].material.needsUpdate = true; return true; }
    m = base.match(/^figur-?(\d)$/); if (m) { H.own['figur-' + m[1]] = t; tokens.forEach(function (g, i) { if (i === +m[1]) g.children[g.children.length - 1].material.map = t; }); return true; }
    return false;
  }
  H.loadFolder = function () {
    fetch('img/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      (list || []).forEach(function (n) { var im = new Image(); im.onload = function () { applyImage(String(n).toLowerCase().replace(/\.[a-z0-9]+$/, ''), im); }; im.src = 'img/' + n; });
    }).catch(function () { });
  };
  H.loadOwn = function (files) {
    var done = 0, names = [];
    Array.prototype.forEach.call(files, function (f) {
      var base = f.name.toLowerCase().replace(/\.[a-z0-9]+$/, ''), im = new Image();
      im.onload = function () { if (applyImage(base, im)) names.push(base); done++; if (done === files.length && H.onOwn) H.onOwn(names); };
      im.src = URL.createObjectURL(f);
    });
  };
})();
