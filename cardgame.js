/* Gemeinsames Gerüst für die Kartenspiele (Poker, Blackjack): 3D-Tisch, Bedienung, Online-Anbindung.
   CG.boot({ key, title, prefix, maxSeats, minPlayers, defaultBots, create(seats, ctx) -> engine })
   engine:  run()  async Spielablauf,  view(i)  Sicht für Platz i,  (optional) stop()
   ctx:     ask(seat, spec, botFn) -> Promise<{id, amount}>,  push(),  sleep(ms),  pendingFor(i),  seatType(i)
   view:    { kind, you, seats:[null|{name,type,chips,bet,state,cards:[{r,s}|0],total,dealer,turn,win,delta}],
              community:[card], pot, dealerHand:{cards,total}|null, actions:[{id,label,min,max,step,presets}]|null,
              msg, log:[text], info, over, result }                                                       */
(function () {
  var CG = window.CG = {};
  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var LIBS = ['three@0.128.0/build/three.min.js', 'three@0.128.0/examples/js/controls/OrbitControls.js',
    'three@0.128.0/examples/js/shaders/CopyShader.js', 'three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js',
    'three@0.128.0/examples/js/postprocessing/EffectComposer.js', 'three@0.128.0/examples/js/postprocessing/MaskPass.js',
    'three@0.128.0/examples/js/postprocessing/RenderPass.js', 'three@0.128.0/examples/js/postprocessing/ShaderPass.js',
    'three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js'];
  function loadLibs() {
    if (window.THREE && THREE.UnrealBloomPass) return Promise.resolve();
    return LIBS.reduce(function (pr, u) {
      return pr.then(function () { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = CDN + u; s.onload = res; s.onerror = function () { rej(new Error(u)); }; document.head.appendChild(s); }); });
    }, Promise.resolve());
  }
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cyber = function () { return document.documentElement.getAttribute('data-style') === 'cyber'; };
  var SEAT_COL = ['#fcee09', '#00f0ff', '#ff2fa8', '#2dff7a', '#9a6bff', '#ff8a1f'];
  var SUIT = ['♠', '♥', '♦', '♣'];                  // Pik, Herz, Karo, Kreuz
  var RANK = function (r) { return r <= 10 ? String(r) : ({ 11: 'B', 12: 'D', 13: 'K', 14: 'A' })[r]; };

  /* =====================================================================================
     3D-Tisch
     ===================================================================================== */
  var TR = 15;                       // Tischradius
  var CW = 1.9, CH = 2.7;            // Kartengröße
  function Table3D(host) {
    var self = this, THREEx = window.THREE;
    this.host = host; this.cards = {}; this.chips = {}; this.labels = {}; this.tw = []; this.style = null; this.view = null; this.markers = {}; this.texCache = {}; this.matCache = {};
    var r = this.r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); host.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, .1, 400); this.camera.position.set(0, 21, 27);
    var c = this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    c.enableDamping = true; c.enablePan = false; c.minDistance = 12; c.maxDistance = 46; c.maxPolarAngle = 1.4; c.target.set(0, 0, 3);
    this.env = [];
    this.build();
    addEventListener('resize', function () { self.resize(); }); this.resize();
    requestAnimationFrame(function loop(now) { requestAnimationFrame(loop); self.tick(now); });
    setInterval(function () { self.runTw(performance.now()); }, 50);
    new MutationObserver(function () { self.build(); if (self.view) self.update(self.view, true); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'] });
  }
  var P = Table3D.prototype;
  P.resize = function () {
    var w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
    this.r.setSize(w, h, false); if (this.composer) this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  P.build = function () {                      // Umgebung je nach Stil
    var scene = this.scene, cy = cyber(), self = this;
    this.env.forEach(function (o) { scene.remove(o); }); this.env = [];
    this.room = null; this.rain = null; this.style = cy ? 'cyber' : 'classic';
    // Karten und Chips neu aufbauen (Materialien hängen vom Stil ab)
    Object.keys(this.cards).forEach(function (k) { scene.remove(self.cards[k].mesh); }); this.cards = {};
    Object.keys(this.chips).forEach(function (k) { scene.remove(self.chips[k].g); }); this.chips = {};
    Object.keys(this.labels).forEach(function (k) { scene.remove(self.labels[k].sp); }); this.labels = {};
    this.texCache = {}; this.matCache = {};
    var add = function (o) { scene.add(o); self.env.push(o); return o; };
    if (cy) {
      scene.fog = new THREE.FogExp2(0x05060b, .012); this.r.setClearColor(0x05060b);
      add(new THREE.AmbientLight(0x4a5a80, .6));
      var dl = new THREE.DirectionalLight(0xaaccff, .5); dl.position.set(8, 22, 12); add(dl);
      var lamp = new THREE.PointLight(0x00f0ff, 1.1, 90); lamp.position.set(0, 16, 2); add(lamp);
      var felt = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, .6, 64), new THREE.MeshStandardMaterial({ color: 0x080b12, roughness: .35, metalness: .6, emissive: 0x021017 })); felt.position.y = -.3; add(felt);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(TR + .3, .35, 12, 80), new THREE.MeshBasicMaterial({ color: 0x00f0ff })); rim.rotation.x = Math.PI / 2; rim.position.y = 0; add(rim);
      var ring = new THREE.Mesh(new THREE.RingGeometry(TR * .45, TR * .452, 80), new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: .45, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .02; add(ring);
      var grid = new THREE.GridHelper(300, 150, 0x00f0ff, 0x0b3f4a); grid.position.y = -2; grid.material.transparent = true; grid.material.opacity = .35; add(grid);
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ color: 0x04050a })); floor.rotation.x = -Math.PI / 2; floor.position.y = -2.05; add(floor);
      this.rain = Room3D.rain(THREE, { count: 800, radius: 50, top: 28, bottom: -2 }); add(this.rain.obj);
      try {
        if (!this.composer) { this.composer = new THREE.EffectComposer(this.r); this.composer.addPass(new THREE.RenderPass(scene, this.camera)); this.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), .3, .4, .85)); }
      } catch (e) { this.composer = null; }
    } else {
      scene.fog = new THREE.Fog(0x2a1a10, 70, 170); this.r.setClearColor(0x2a1a10);
      var felt2 = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, .6, 64), new THREE.MeshStandardMaterial({ color: 0x0f7a42, roughness: .95 })); felt2.position.y = -.3; add(felt2);
      var rim2 = new THREE.Mesh(new THREE.TorusGeometry(TR + .5, .75, 14, 80), new THREE.MeshStandardMaterial({ color: 0x5a3414, roughness: .5 })); rim2.rotation.x = Math.PI / 2; rim2.position.y = -.05; add(rim2);
      var line = new THREE.Mesh(new THREE.RingGeometry(TR * .45, TR * .455, 80), new THREE.MeshBasicMaterial({ color: 0xdfc98a, transparent: true, opacity: .5, side: THREE.DoubleSide })); line.rotation.x = -Math.PI / 2; line.position.y = .02; add(line);
      this.room = Room3D.livingRoom(THREE, { half: 70, tableTopY: -.6, table: { shape: 'round', size: TR * 2 + 3 } }); add(this.room.group);
      this.composer = null;
    }
  };

  // ---- Texturen/Materialien ----
  P.cardTex = function (c) {
    var key = (cyber() ? 'c' : 'k') + (c ? c.r + '_' + c.s : 'back');
    if (this.texCache[key]) return this.texCache[key];
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 180; var x = cv.getContext('2d'), cy = cyber();
    var red = c && (c.s === 1 || c.s === 2);
    if (!c) {
      if (cy) { x.fillStyle = '#080b14'; x.fillRect(0, 0, 128, 180); x.strokeStyle = '#00f0ff'; x.lineWidth = 3; x.strokeRect(8, 8, 112, 164); x.globalAlpha = .4; for (var i = -180; i < 140; i += 14) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 180, 180); x.stroke(); } }
      else { x.fillStyle = '#fdfbf3'; x.fillRect(0, 0, 128, 180); x.fillStyle = '#1f4a9a'; x.fillRect(8, 8, 112, 164); x.strokeStyle = '#e8d9a8'; x.lineWidth = 2; for (var j = -180; j < 140; j += 12) { x.beginPath(); x.moveTo(j, 0); x.lineTo(j + 180, 180); x.stroke(); x.beginPath(); x.moveTo(j + 180, 0); x.lineTo(j, 180); x.stroke(); } x.strokeStyle = '#fdfbf3'; x.lineWidth = 4; x.strokeRect(8, 8, 112, 164); }
    } else {
      var col = cy ? (red ? '#ff2a55' : '#7fe8ff') : (red ? '#c1272d' : '#1a1a1a');
      if (cy) { x.fillStyle = '#080b14'; x.fillRect(0, 0, 128, 180); x.strokeStyle = col; x.globalAlpha = .6; x.lineWidth = 3; x.strokeRect(6, 6, 116, 168); x.globalAlpha = 1; x.shadowColor = col; x.shadowBlur = 12; }
      else { x.fillStyle = '#fdfbf3'; x.fillRect(0, 0, 128, 180); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; x.strokeRect(2, 2, 124, 176); }
      x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = 'bold 30px Georgia,serif'; x.fillText(RANK(c.r), 22, 24); x.font = '26px "Segoe UI Symbol",Georgia,serif'; x.fillText(SUIT[c.s], 22, 52);
      x.font = '62px "Segoe UI Symbol",Georgia,serif'; x.fillText(SUIT[c.s], 64, 96);
      x.save(); x.translate(128, 180); x.rotate(Math.PI); x.font = 'bold 30px Georgia,serif'; x.fillText(RANK(c.r), 22, 24); x.font = '26px "Segoe UI Symbol",Georgia,serif'; x.fillText(SUIT[c.s], 22, 52); x.restore();
    }
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return this.texCache[key] = t;
  };
  P.cardMats = function (c) {
    var key = (cyber() ? 'c' : 'k') + (c ? c.r + '_' + c.s : 'back'), cy = cyber();
    if (this.matCache[key]) return this.matCache[key];
    var tex = this.cardTex(c);
    var m = cy ? new THREE.MeshBasicMaterial({ map: tex, color: 0x8c8c8c }) : new THREE.MeshStandardMaterial({ map: tex, roughness: .6 });
    return this.matCache[key] = m;
  };
  P.edgeMat = function () {
    var k = 'edge' + cyber();
    return this.matCache[k] || (this.matCache[k] = cyber() ? new THREE.MeshBasicMaterial({ color: 0x005f6c }) : new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: .7 }));
  };
  var CHIPD = [1000, 500, 100, 25, 5, 1];
  var CHIP_R = .72, CHIP_H = .24;
  // Chips wie am echten Tisch: Farbe nach Wert, helle Randstreifen, Wert auf der Oberseite
  P.chipMat = function (d) {
    var cy = cyber(), k = 'chip' + d + cy;
    if (this.matCache[k]) return this.matCache[k];
    var base = { 1: '#e6e6e6', 5: '#c62828', 25: '#2e8b3d', 100: '#262626', 500: '#6a3fa0', 1000: '#d4a017' }[d];
    var dark = { 1: '#bdbdbd', 5: '#8f1d1d', 25: '#1f6329', 100: '#0c0c0c', 500: '#4a2a73', 1000: '#a37a0c' }[d];
    var txt = (d === 1 || d === 1000) ? '#222' : '#fff';
    var side = document.createElement('canvas'); side.width = 256; side.height = 32; var sx = side.getContext('2d');
    sx.fillStyle = base; sx.fillRect(0, 0, 256, 32); sx.fillStyle = '#f4f4f4';
    for (var i = 0; i < 8; i++) sx.fillRect(i * 32 + 8, 0, 16, 32);
    var top = document.createElement('canvas'); top.width = top.height = 128; var tx = top.getContext('2d');
    tx.fillStyle = base; tx.fillRect(0, 0, 128, 128);
    tx.strokeStyle = '#f4f4f4'; tx.lineWidth = 7; tx.setLineDash([14, 10]); tx.beginPath(); tx.arc(64, 64, 55, 0, 6.3); tx.stroke(); tx.setLineDash([]);
    tx.fillStyle = dark; tx.beginPath(); tx.arc(64, 64, 38, 0, 6.3); tx.fill();
    tx.strokeStyle = '#f4f4f4'; tx.lineWidth = 3; tx.beginPath(); tx.arc(64, 64, 38, 0, 6.3); tx.stroke();
    tx.fillStyle = txt; tx.font = 'bold ' + (String(d).length > 2 ? 30 : 40) + 'px system-ui,sans-serif'; tx.textAlign = 'center'; tx.textBaseline = 'middle'; tx.fillText(String(d), 64, 66);
    var mk = function (cv) { var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return cy ? new THREE.MeshStandardMaterial({ map: t, roughness: .5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .12 }) : new THREE.MeshStandardMaterial({ map: t, roughness: .45 }); };
    var sm = mk(side), tm = mk(top);
    return this.matCache[k] = [sm, tm, tm];
  };
  // Chip-Stapel: Betrag in Chips umrechnen (große Werte zuerst), je Wert ein Stapel nebeneinander
  P.setChips = function (key, amount, pos, instant, denoms, maxStack) {
    var o = this.chips[key];
    if (!o) { o = this.chips[key] = { g: new THREE.Group(), amount: -1 }; this.scene.add(o.g); }
    o.g.position.copy(pos); o.keep = true;
    var sig = amount + '|' + (denoms || '');
    if (o.sig === sig) return;
    o.sig = sig; o.amount = amount;
    while (o.g.children.length) o.g.remove(o.g.children[0]);
    var left = amount, stacks = [], cap = maxStack || 14;
    (denoms || CHIPD).forEach(function (d) { var n = Math.floor(left / d); left -= n * d; if (n > 0) stacks.push({ d: d, n: Math.min(n, cap) }); });
    var self = this, geo = this.chipGeo || (this.chipGeo = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 28));
    var gap = CHIP_R * 2 + .18;
    stacks.forEach(function (s, si) {
      for (var k = 0; k < s.n; k++) {
        var ch = new THREE.Mesh(geo, self.chipMat(s.d));
        ch.position.set((si - (stacks.length - 1) / 2) * gap + Math.sin(k * 7) * .03, CHIP_H / 2 + .01 + k * (CHIP_H + .015), Math.cos(k * 5) * .03); ch.rotation.y = k * 1.3;
        o.g.add(ch);
      }
    });
  };

  // ---- Bewegung ----
  P.move = function (obj, pos, rx, ry, rz, instant, from) {
    var t = obj.userData.tg;
    if (t && Math.abs(t.x - pos.x) < .001 && Math.abs(t.y - pos.y) < .001 && Math.abs(t.z - pos.z) < .001 && Math.abs(t.rx - rx) < .001 && Math.abs(t.ry - ry) < .001) return;
    obj.userData.tg = { x: pos.x, y: pos.y, z: pos.z, rx: rx, ry: ry, rz: rz };
    if (instant) { obj.position.copy(pos); obj.rotation.set(rx, ry, rz); return; }
    if (from) obj.position.copy(from);
    var p0 = obj.position.clone(), dist = p0.distanceTo(pos);
    this.tw = this.tw.filter(function (w) { return w.obj !== obj; });
    this.tw.push({ obj: obj, t0: performance.now(), dur: 380 + Math.min(420, dist * 26), p0: p0, p1: pos.clone(), r0: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z }, r1: { x: rx, y: ry, z: rz }, arc: Math.min(3, .6 + dist * .12) });
  };
  P.runTw = function (now) {
    for (var i = this.tw.length - 1; i >= 0; i--) {
      var w = this.tw[i], k = Math.min(1, (now - w.t0) / w.dur), e = k * k * (3 - 2 * k);
      w.obj.position.lerpVectors(w.p0, w.p1, e); w.obj.position.y += Math.sin(k * Math.PI) * w.arc;
      w.obj.rotation.set(w.r0.x + (w.r1.x - w.r0.x) * e, w.r0.y + (w.r1.y - w.r0.y) * e, w.r0.z + (w.r1.z - w.r0.z) * e);
      if (k >= 1) this.tw.splice(i, 1);
    }
  };

  // ---- Layout der Plätze ----
  P.layout = function (v) {
    var ids = []; v.seats.forEach(function (s, i) { if (s) ids.push(i); });
    var m = ids.length, you = v.you >= 0 && ids.indexOf(v.you) >= 0 ? ids.indexOf(v.you) : 0, res = {};
    ids.forEach(function (id, j) {
      var rel = (j - you + m) % m;
      if (v.kind === 'poker') {
        var a = Math.PI / 2 + rel * 2 * Math.PI / m, d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), t = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
        res[id] = { dir: d, tan: t, cards: d.clone().multiplyScalar(TR * .6), bet: d.clone().multiplyScalar(TR * .36), label: d.clone().multiplyScalar(TR * .93), btn: d.clone().multiplyScalar(TR * .5).add(t.clone().multiplyScalar(3.4)), mine: id === v.you };
      } else {
        var x = ((j + .5) / m - .5) * Math.min(26, m * 6.6), z = 7.4 + x * x * .02;
        var p = new THREE.Vector3(x, 0, z);
        res[id] = { dir: new THREE.Vector3(0, 0, 1), tan: new THREE.Vector3(1, 0, 0), cards: p.clone(), bet: p.clone().add(new THREE.Vector3(0, 0, -3.8)), label: p.clone().add(new THREE.Vector3(0, 0, 3.4)), btn: p.clone(), mine: id === v.you };
      }
    });
    return res;
  };

  // ---- Karten ----
  P.cardMesh = function (key, from) {
    var c = this.cards[key];
    if (c) return c;
    var m = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, .045), [this.edgeMat(), this.edgeMat(), this.edgeMat(), this.edgeMat(), this.cardMats(0), this.cardMats(0)]);
    m.rotation.order = 'YXZ'; m.position.copy(from || new THREE.Vector3(0, 4, -4)); this.scene.add(m);
    return this.cards[key] = { mesh: m, face: undefined };
  };
  P.setCard = function (key, card, pos, tilt, scale, instant) {
    var c = this.cardMesh(key), face = card ? card.r + '_' + card.s : 'back';
    if (c.face !== face) {
      c.face = face; var mats = c.mesh.material; mats[4] = this.cardMats(card || 0); mats[5] = this.cardMats(0);
      if (!card) { mats[4] = this.cardMats(0); }
    }
    // verdeckt: Rückseite oben (Vorderseite nach unten)
    var rx = card ? -Math.PI / 2 + (tilt || 0) : Math.PI / 2;
    c.mesh.scale.setScalar(scale || 1);
    this.move(c.mesh, pos, rx, 0, 0, instant);
    c.keep = true;
  };

  // ---- Namensschilder ----
  P.setLabel = function (key, text, sub, color, pos, hot) {
    var o = this.labels[key];
    if (!o) {
      var cv = document.createElement('canvas'); cv.width = 320; cv.height = 112;
      var tex = new THREE.CanvasTexture(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
      sp.scale.set(7.2, 2.5, 1); sp.renderOrder = 10; this.scene.add(sp); o = this.labels[key] = { sp: sp, cv: cv, tex: tex, sig: '' };
    }
    o.sp.position.set(pos.x, 3.2, pos.z); o.keep = true;
    var sig = [text, sub, color, hot].join('|'); if (o.sig === sig) return; o.sig = sig;
    var x = o.cv.getContext('2d'), cy = cyber(); x.clearRect(0, 0, 320, 112);
    x.fillStyle = hot ? (cy ? 'rgba(252,238,9,.95)' : 'rgba(46,160,90,.95)') : (cy ? 'rgba(8,11,20,.88)' : 'rgba(30,20,12,.82)');
    x.beginPath(); if (x.roundRect) x.roundRect(4, 4, 312, 104, cy ? 4 : 18); else x.rect(4, 4, 312, 104); x.fill();
    x.lineWidth = 4; x.strokeStyle = color; x.stroke();
    x.textAlign = 'center'; x.fillStyle = hot && cy ? '#000' : '#ffffff'; x.font = 'bold 34px system-ui,sans-serif'; x.fillText(text, 160, 46);
    x.fillStyle = hot && cy ? '#222' : (sub && sub.charAt(0) === '+' ? '#7dff9d' : '#ffd86b'); x.font = '28px system-ui,sans-serif'; x.fillText(sub || '', 160, 86);
    o.tex.needsUpdate = true;
  };

  // ---- Zustand zeichnen ----
  P.update = function (v, instant) {
    this.view = v;
    var self = this, L = this.layout(v), ids = Object.keys(L);
    ['cards', 'chips', 'labels'].forEach(function (k) { Object.keys(self[k]).forEach(function (key) { self[k][key].keep = false; }); });
    var deck = new THREE.Vector3(0, 3, -5);
    ids.forEach(function (id) {
      var s = v.seats[id], l = L[id], cards = s.cards || [], n = cards.length;
      cards.forEach(function (card, j) {
        var pos, tilt = 0, scale = 1;
        if (v.kind === 'poker') {
          var off = (j - (n - 1) / 2) * (l.mine ? 1.6 : 1.25);
          pos = l.cards.clone().add(l.tan.clone().multiplyScalar(off)); pos.y = .05 + j * .004;
          if (l.mine) { tilt = .55; scale = 1.25; pos.y = .5; pos.add(l.dir.clone().multiplyScalar(1.6)); }
        } else {
          pos = l.cards.clone().add(new THREE.Vector3((j - (n - 1) / 2) * 1.15, .05 + j * .05, -j * .35));
        }
        self.setCard('s' + id + 'c' + j, card, pos, tilt, scale, instant);
        if (!self.cards['s' + id + 'c' + j].placed) { self.cards['s' + id + 'c' + j].placed = true; }
      });
      if (s.bet > 0) self.setChips('bet' + id, s.bet, l.bet, instant);
      if (s.chips > 0) {
        var sp = v.kind === 'poker' ? l.cards.clone().add(l.tan.clone().multiplyScalar(l.mine ? -5.6 : -4.3)) : l.cards.clone().add(new THREE.Vector3(0, 0, 3.0));
        self.setChips('stack' + id, s.chips, sp, instant, [100, 25, 5, 1], 12);
      }
      var hot = !!s.turn, color = SEAT_COL[id % SEAT_COL.length];
      var sub = s.win ? '+' + s.win : (s.delta ? (s.delta > 0 ? '+' : '') + s.delta : (s.state ? s.state : (s.total ? String(s.total) : '')));
      var lab = s.name + (l.mine ? ' (Du)' : '') + ' · ' + s.chips;
      if (!(l.mine && v.kind === 'poker')) self.setLabel('l' + id, s.name + (l.mine ? ' (Du)' : ''), (s.state && !s.win ? s.state + ' · ' : '') + (s.win ? '+' + s.win + ' · ' : (s.delta ? (s.delta > 0 ? '+' : '') + s.delta + ' · ' : '')) + s.chips + (s.total ? ' · ' + s.total : ''), color, l.label, hot);
      if (s.dealer && v.kind === 'poker') {
        var bm = self.markers.btn;
        if (!bm) { var cv = document.createElement('canvas'); cv.width = cv.height = 64; var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 30, 0, 6.3); x.fill(); x.fillStyle = '#111'; x.font = 'bold 36px system-ui'; x.textAlign = 'center'; x.fillText('D', 32, 45); var m = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .14, 24), [new THREE.MeshBasicMaterial({ color: 0xdddddd }), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }), new THREE.MeshBasicMaterial({ color: 0xdddddd })]); self.scene.add(m); bm = self.markers.btn = m; }
        bm.visible = true; self.move(bm, new THREE.Vector3(l.btn.x, .1, l.btn.z), 0, 0, 0, instant);
      }
      // Markierung unter den Karten des Spielers, der dran ist
      var mk = self.markers['turn' + id];
      if (!mk) { mk = self.markers['turn' + id] = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 40), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })); mk.rotation.x = -Math.PI / 2; self.scene.add(mk); }
      mk.visible = hot; mk.position.set(l.cards.x, .03, l.cards.z); mk.material.color.set(color);
    });
    Object.keys(this.markers).forEach(function (k) { if (k.indexOf('turn') === 0 && !L[k.slice(4)]) self.markers[k].visible = false; });
    if (this.markers.btn && !v.seats.some(function (s) { return s && s.dealer; })) this.markers.btn.visible = false;
    // Gemeinschaftskarten und Pot
    (v.community || []).forEach(function (card, k) { self.setCard('comm' + k, card, new THREE.Vector3((k - 2) * 2.3, .05, -1.2), 0, 1, instant); });
    if (v.pot > 0) self.setChips('pot', v.pot, new THREE.Vector3(0, 0, 3.4), instant);
    // Geber (Blackjack)
    if (v.dealerHand) {
      var dc = v.dealerHand.cards;
      dc.forEach(function (card, j) { self.setCard('d' + j, card, new THREE.Vector3((j - (dc.length - 1) / 2) * 1.25, .05 + j * .05, -5.6 - j * .3), 0, 1, instant); });
      self.setLabel('dealer', 'Geber', v.dealerHand.total ? String(v.dealerHand.total) : '', '#ffffff', new THREE.Vector3(0, 0, -9.6), false);
    }
    // nicht mehr gebrauchte Objekte entfernen
    ['cards', 'chips', 'labels'].forEach(function (k) {
      Object.keys(self[k]).forEach(function (key) {
        var o = self[k][key]; if (o.keep) return;
        self.scene.remove(k === 'cards' ? o.mesh : (k === 'chips' ? o.g : o.sp)); delete self[k][key];
      });
    });
  };
  P.tick = function (now) {
    var t = now / 1000, dt = Math.min(.05, (now - (this.last || now)) / 1000); this.last = now;
    this.runTw(now);
    if (this.rain) this.rain.update(dt);
    if (this.room) this.room.update(t);
    var mk = this.markers; for (var k in mk) if (k.indexOf('turn') === 0 && mk[k].visible) mk[k].material.opacity = .45 + .4 * Math.sin(t * 5);
    this.controls.update();
    if (this.composer && cyber()) this.composer.render(); else this.r.render(this.scene, this.camera);
  };

  /* =====================================================================================
     Spielgerüst: Menü, Bedienung, Host/Mitspieler
     ===================================================================================== */
  CG.boot = function (G) {
    var css = document.createElement('style');
    css.textContent =
      'html,body{height:100%;margin:0;overflow:hidden}body{user-select:none}' +
      '#cgStage{position:fixed;inset:0}#cgStage canvas{display:block;width:100%;height:100%}' +
      '.cg{position:fixed;z-index:20}.cg .panel,.cg .btn,.cg a,.cg input{pointer-events:auto}.cg{pointer-events:none}' +
      '#cgTop{left:10px;top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '#cgTop .panel{margin:0;padding:6px 12px;background:rgba(16,19,28,.8)}' +
      '#cgInfo{font-size:.9rem}' +
      '#cgMsg{left:50%;top:10px;transform:translateX(-50%);max-width:min(560px,60vw);text-align:center;padding:10px 18px;background:rgba(16,19,28,.85);font-weight:700;pointer-events:none}' +
      '#cgSide{right:10px;top:10px;width:230px;max-height:calc(100vh - 150px);overflow:auto;padding:10px 12px;margin:0;background:rgba(16,19,28,.82)}' +
      '#cgSide div{display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:.88rem;color:var(--muted)}#cgSide div.me{color:var(--text);font-weight:700}#cgSide div.turn{color:var(--accent);font-weight:800}' +
      '#cgLog{left:10px;bottom:10px;width:260px;max-height:130px;overflow:auto;font-size:.78rem;color:var(--muted);padding:8px 10px;margin:0;background:rgba(16,19,28,.75)}' +
      '#cgActions{left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:flex-end;max-width:94vw}' +
      '#cgActions .grp{display:flex;gap:6px;flex-wrap:wrap;align-items:center;background:rgba(16,19,28,.85);padding:8px 10px;border:1px solid var(--border)}' +
      '#cgActions input[type=range]{width:150px}#cgActions .val{min-width:3.6em;text-align:center;font-weight:800}' +
      '#cgMenu,#cgOver{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(5,7,20,.75);padding:12px}' +
      '#cgMenu[hidden],#cgOver[hidden]{display:none}' +
      '#cgMenu .box,#cgOver .box{width:min(440px,100%);background:var(--card);border:1px solid var(--border);padding:22px;text-align:center}' +
      '#cgMenu h1{margin:0 0 6px}#cgMenu p{color:var(--muted);margin:0 0 14px}' +
      '#cgMenu .row{display:flex;gap:8px;align-items:center;justify-content:center;margin:10px 0;flex-wrap:wrap}' +
      '#cgMenu input,#cgMenu select{font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px}' +
      '@media(max-width:760px){#cgSide{width:150px;top:64px;font-size:.8rem}#cgLog{display:none}#cgMsg{top:56px;max-width:90vw}#cgActions{bottom:8px}}';
    document.head.appendChild(css);
    document.title = G.title;
    var root = document.createElement('div'); root.id = 'cgRoot';
    root.innerHTML =
      '<div id="cgStage"></div>' +
      '<div class="cg" id="cgTop"><a class="back" href="../">← Spiele</a><button class="btn alt" id="cgLeave">Beenden</button><div class="panel" id="cgInfo"></div></div>' +
      '<div class="cg panel" id="cgMsg"></div><div class="cg panel" id="cgSide"></div><div class="cg panel" id="cgLog"></div><div class="cg" id="cgActions"></div>' +
      '<div id="cgMenu"><div class="box"><h1>' + esc(G.title) + '</h1><p id="cgSub">' + esc(G.blurb || '') + '</p>' +
      '<div class="row"><label>Dein Name</label><input id="cgName" maxlength="14" placeholder="Name"></div>' +
      '<div class="row"><label>Computer-Gegner</label><select id="cgBots"></select></div>' +
      '<div class="row"><button class="btn" id="cgLocal">Gegen Computer spielen</button></div>' +
      '<div class="row"><button class="btn alt" id="cgOnline">Online spielen</button></div>' +
      '<p id="cgLoad" style="margin-top:8px"></p><div class="row"><a class="back" href="../">← Zur Spieleauswahl</a></div></div></div>' +
      '<div id="cgOver" hidden><div class="box"><h2 id="cgOverT"></h2><p id="cgOverS"></p><div class="row"><button class="btn" id="cgAgain">Nochmal</button><button class="btn alt" id="cgBack">Zum Menü</button></div></div></div>';
    document.body.appendChild(root);
    var nb = $('cgBots'); for (var i = 1; i < G.maxSeats; i++) nb.innerHTML += '<option value="' + i + '"' + (i === G.defaultBots ? ' selected' : '') + '>' + i + '</option>';
    try { $('cgName').value = localStorage.getItem('mp-name') || ''; } catch (e) {}
    var myName = function () { var n = ($('cgName').value || '').trim().slice(0, 14) || 'Spieler'; try { localStorage.setItem('mp-name', n); } catch (e) {} return n; };

    var S = { role: 'local', you: 0, engine: null, seatTypes: [], names: [], pending: null, stopped: false, table: null, lastView: null, pushQ: false, actSig: '' };
    var CANCEL = {}, L = null;
    $('cgLocal').disabled = $('cgOnline').disabled = true; $('cgLoad').textContent = '3D wird geladen …';
    loadLibs().then(function () { S.table = new Table3D($('cgStage')); $('cgLoad').textContent = ''; $('cgLocal').disabled = $('cgOnline').disabled = false; })
      .catch(function () { $('cgLoad').textContent = '3D konnte nicht geladen werden (offline?).'; });

    // ---------- Engine-Umgebung ----------
    var ctx = {
      sleep: function (ms) { return new Promise(function (res, rej) { setTimeout(function () { S.stopped ? rej(CANCEL) : res(); }, ms); }); },
      push: function () { if (S.pushQ) return; S.pushQ = true; queueMicrotask(function () { S.pushQ = false; broadcast(); }); },
      seatType: function (i) { return S.seatTypes[i]; },
      pendingFor: function (i) { return S.pending && S.pending.seat === i ? S.pending.spec.actions : null; },
      ask: function (seat, spec, botFn) {
        return new Promise(function (resolve, reject) {
          if (S.stopped) { reject(CANCEL); return; }
          var done = false, pend = S.pending = { seat: seat, spec: spec, botFn: botFn };
          pend.finish = function (res) {
            if (done) return; done = true; clearTimeout(pend.timer);
            if (S.pending === pend) S.pending = null;
            ctx.push(); resolve(res);
          };
          ctx.push();
          var ty = S.seatTypes[seat];
          if (ty === 'cpu') setTimeout(function () { if (!S.stopped) pend.finish(botFn()); else if (!done) { done = true; reject(CANCEL); } }, 700 + Math.random() * 800);
          else pend.timer = setTimeout(function () { if (!S.stopped) pend.finish(botFn()); }, (spec.timeout || 60) * 1000);
        });
      }
    };
    function act(seat, a) {                   // Aktion eines Spielers (am Host) prüfen und weitergeben
      var pd = S.pending; if (!pd || pd.seat !== seat || !a || typeof a !== 'object') return;
      var def = pd.spec.actions.filter(function (x) { return x.id === a.id; })[0]; if (!def) return;
      var res = { id: def.id };
      if (def.min !== undefined) { var amt = Math.round(+a.amount); if (!isFinite(amt)) return; res.amount = Math.max(def.min, Math.min(def.max, amt)); }
      else if (def.amount !== undefined) res.amount = def.amount;
      pd.finish(res);
    }
    function viewFor(i) { return S.engine ? S.engine.view(i) : null; }
    function broadcast() {
      if (S.role === 'client' || !S.engine) return;
      var v = viewFor(S.you); render(v);
      if (S.role === 'host') L.seats.forEach(function (s, i) { if (s.type === 'remote' && s.conn && s.conn.open) L.sendTo(i, { t: 'v', v: viewFor(i) }); });
    }

    // ---------- Anzeige ----------
    function render(v) {
      if (!v) return; S.lastView = v;
      if (S.table) S.table.update(v);
      $('cgMsg').textContent = v.msg || ''; $('cgMsg').style.display = v.msg ? 'block' : 'none';
      $('cgInfo').textContent = v.info || '';
      $('cgSide').innerHTML = v.seats.map(function (s, i) {
        if (!s) return '';
        return '<div class="' + (i === v.you ? 'me ' : '') + (s.turn ? 'turn' : '') + '"><span>' + (s.turn ? '▶ ' : '') + esc(s.name) + (i === v.you ? ' (Du)' : '') + '</span><span>' + s.chips + (s.state ? ' · ' + esc(s.state) : '') + '</span></div>';
      }).join('');
      $('cgLog').innerHTML = (v.log || []).slice().reverse().map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('');
      renderActions(v.actions);
      if (v.over) { $('cgOverT').textContent = v.result || 'Spiel beendet'; $('cgOverS').textContent = ''; $('cgOver').hidden = false; $('cgAgain').hidden = S.role === 'client'; $('cgAgain').textContent = 'Nochmal'; }
      else $('cgOver').hidden = true;
    }
    function renderActions(actions) {
      var box = $('cgActions'), sig = JSON.stringify(actions);
      if (sig === S.actSig) return; S.actSig = sig;
      box.innerHTML = '';
      if (!actions || !actions.length) return;
      actions.forEach(function (a) {
        if (a.min !== undefined) {
          var g = document.createElement('div'); g.className = 'grp';
          var val = document.createElement('span'); val.className = 'val'; val.textContent = a.min;
          var rg = document.createElement('input'); rg.type = 'range'; rg.min = a.min; rg.max = a.max; rg.step = a.step || 1; rg.value = a.min;
          rg.oninput = function () { val.textContent = rg.value; ok.textContent = a.label + ' ' + rg.value; };
          (a.presets || []).forEach(function (p) {
            var b = document.createElement('button'); b.className = 'btn alt'; b.textContent = p.label; b.onclick = function () { rg.value = Math.max(a.min, Math.min(a.max, p.value)); rg.oninput(); }; g.appendChild(b);
          });
          var ok = document.createElement('button'); ok.className = 'btn'; ok.textContent = a.label + ' ' + a.min;
          ok.onclick = function () { send({ id: a.id, amount: +rg.value }); };
          g.appendChild(rg); g.appendChild(val); g.appendChild(ok); box.appendChild(g);
        } else {
          var b = document.createElement('button'); b.className = 'btn' + (a.alt ? ' alt' : ''); b.textContent = a.label;
          b.onclick = function () { send({ id: a.id }); }; box.appendChild(b);
        }
      });
    }
    function send(a) {                                // Eingabe des eigenen Spielers
      S.actSig = ''; $('cgActions').innerHTML = '';
      if (S.role === 'client') L.send({ t: 'act', a: a }); else act(S.you, a);
    }

    // ---------- Start/Ende ----------
    function stopEngine() { S.stopped = true; if (S.pending) { try { S.pending.finish({ id: '_stop' }); } catch (e) {} } S.pending = null; if (S.engine && S.engine.stop) S.engine.stop(); S.engine = null; }
    function launch(role, you, seats) {
      stopEngine(); S.stopped = false; S.role = role; S.you = you;
      S.seatTypes = seats.map(function (s) { return s.type === 'host' ? 'human' : s.type; });
      S.names = seats.map(function (s) { return s.name || ''; });
      S.engine = G.create(seats.map(function (s, i) { return { type: S.seatTypes[i], name: s.type === 'cpu' ? 'Bot ' + (i + 1) : (s.name || 'Spieler') }; }), ctx);
      $('cgMenu').hidden = true; $('cgOver').hidden = true; S.actSig = ''; $('cgLeave').hidden = false;
      var run = S.engine.run(); run.catch(function (e) { if (e !== CANCEL) console.error(e); });
      broadcast();
    }
    function toMenu() {
      stopEngine(); if (L && L.role !== 'local') L.leave(); S.role = 'local'; S.lastView = null;
      $('cgOver').hidden = true; $('cgMenu').hidden = false; $('cgMsg').style.display = 'none'; $('cgSide').innerHTML = ''; $('cgLog').innerHTML = ''; $('cgActions').innerHTML = ''; S.actSig = '';
      if (S.table) { S.table.view = null; S.table.update({ kind: G.kind, you: 0, seats: [], community: [], pot: 0 }, true); }
    }
    $('cgLocal').onclick = function () {
      var n = +$('cgBots').value, seats = [{ type: 'host', name: myName() }];
      for (var i = 0; i < n; i++) seats.push({ type: 'cpu' });
      launch('local', 0, seats);
    };
    $('cgLeave').onclick = function () { toMenu(); };
    $('cgBack').onclick = function () { if (S.role === 'host') { stopEngine(); L.backToLobby(); $('cgOver').hidden = true; } else toMenu(); };
    $('cgAgain').onclick = function () {
      if (S.role === 'local') { var n = S.seatTypes.length, seats = [{ type: 'host', name: S.names[0] }]; for (var i = 1; i < n; i++) seats.push({ type: 'cpu' }); launch('local', 0, seats); }
      else if (S.role === 'host') { var sl = L.seats.map(function (s) { return { type: s.type, name: s.name }; }); launch('host', S.you, sl); }
    };

    // ---------- Online ----------
    L = MP.init({
      prefix: G.prefix, title: G.title,
      seats: Array.from({ length: G.maxSeats }, function (_, i) { return { name: 'Platz ' + (i + 1), color: SEAT_COL[i % SEAT_COL.length] }; }),
      minPlayers: G.minPlayers || 2, bots: true,
      onStart: function (info) {
        if (info.role === 'host') launch('host', info.you, info.seats.map(function (s, i) { return { type: s.type, name: s.name }; }));
        else { stopEngine(); S.role = 'client'; S.you = info.you; $('cgMenu').hidden = true; $('cgOver').hidden = true; $('cgLeave').hidden = false; S.actSig = ''; $('cgMsg').textContent = 'Warte auf den Host …'; $('cgMsg').style.display = 'block'; }
      },
      onData: function (from, m) {
        if (!m) return;
        if (S.role === 'host') { if (m.t === 'act') act(from, m.a); }
        else if (m.t === 'v') render(m.v);
      },
      onSeatDrop: function (i) { S.seatTypes[i] = 'cpu'; if (S.pending && S.pending.seat === i) S.pending.finish(S.pending.botFn()); ctx.push(); },
      onBackToLobby: function () { S.role = 'local'; S.lastView = null; $('cgOver').hidden = true; S.actSig = ''; $('cgActions').innerHTML = ''; },
      onLeave: function () { toMenu(); }
    });
    $('cgOnline').onclick = function () { $('cgMenu').hidden = true; L.open(); };
    var mpClose = document.getElementById('mpClose');
    if (mpClose) mpClose.addEventListener('click', function () { if (S.role !== 'host' && S.role !== 'client') $('cgMenu').hidden = false; });
    CG.state = S; CG.ctx = ctx;
  };
})();
