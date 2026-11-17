/* Hüttenduell in 3D: Holztisch bei Kerzenlicht mit echten Karten, Waage und Gegnerporträt.
   Die Spiellogik bleibt in index.html/engine.js, hier wird nur gezeichnet.
   V3.init(host, { onSlot(row, lane) }) · V3.sync({ G, tg, sac, opp }) · V3.fx(ev) · V3.show(on) · V3.resize() */
(function () {
  'use strict';
  var V3 = window.V3 = { ready: false, on: false };
  var host, r, scene, camera, raf = 0, last = 0, cards = {}, dying = [], slots = [], pick = [], hov = null, beam, pans, teeth = [], portrait, flame = [], lights = [], texCache = {}, texN = 0, ray, mouse, opts, sd = null, shake = 0, wob = 0, tgt = [], w = 0, h = 0, portraitKey = '', tm = 0, leatherM, postM, mode = 'board', mapG = null, mapNodes = [], mapPawn = null, mapPlane = null, mapCb = null, mapDim = { w: 7.4, h: 6 }, mapCam = { d: 8, f: 0 }, pawnT = null, mapHov = null;
  var CW = 1, CH = 1.45, GX = 1.28, Z = { oq: -2.5, ob: -1.0, pb: .85 };
  function cvs(wd, ht) { var c = document.createElement('canvas'); c.width = wd; c.height = ht; return c; }
  function tex(c) { var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
  function rr(g, x, y, wd, ht, rad) { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + wd, y, x + wd, y + ht, rad); g.arcTo(x + wd, y + ht, x, y + ht, rad); g.arcTo(x, y + ht, x, y, rad); g.arcTo(x, y, x + wd, y, rad); g.closePath(); }
  // Kartenbild
  function face(c, opp) {
    var k = [c.id, c.atk, c.hp, c.max, c.lives, opp ? 1 : 0, c.up ? 1 : 0].join('|'); if (texCache[k]) return texCache[k];
    var cv = cvs(256, 372), g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 256, 372);
    gr.addColorStop(0, opp ? '#cdbb92' : '#d8c7a0'); gr.addColorStop(1, opp ? '#a8946a' : '#b9a577'); g.fillStyle = gr; rr(g, 0, 0, 256, 372, 18); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#4a3820'; g.stroke();
    g.fillStyle = '#2a2014'; g.font = 'bold 27px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.n, 128, 28, 170);
    var ag = g.createRadialGradient(128, 160, 10, 128, 160, 100); ag.addColorStop(0, '#efe3c4'); ag.addColorStop(1, '#c9b68a'); g.fillStyle = ag; rr(g, 26, 60, 204, 176, 10); g.fill(); g.lineWidth = 3; g.strokeStyle = '#6a5636'; g.stroke();
    g.filter = 'sepia(.7) contrast(1.1) saturate(.8)'; g.font = '120px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.fillText(c.art, 128, 152); g.filter = 'none';
    var cost = ''; for (var i = 0; i < (c.cost.b || 0); i++) cost += '🩸'; if (c.cost.o) cost += (cost ? ' ' : '') + '🦴' + (c.cost.o > 1 ? '×' + c.cost.o : '');
    if (cost) { g.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.textAlign = 'right'; g.fillText(cost, 238, 74); g.textAlign = 'center'; }
    g.font = '900 64px Georgia, serif'; g.textAlign = 'left'; g.fillStyle = '#2a2014'; g.fillText(c.atk, 18, 326);
    g.textAlign = 'right'; g.fillStyle = c.hp < c.max ? '#b5261f' : '#2a2014'; g.fillText(c.hp, 240, 326);
    var sg = c.sig.map(function (s) { return HD.SIG[s][1]; }).join('') + (c.lives > 1 ? '×' + c.lives : '');
    g.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.textAlign = 'center'; g.fillStyle = '#2a2014'; g.fillText(sg, 128, 332);
    if (texN++ > 260) { texCache = {}; texN = 0; }
    return (texCache[k] = tex(cv));
  }
  var backTex = null;
  function wood() {
    var cv = cvs(512, 512), g = cv.getContext('2d'); g.fillStyle = '#4a2e18'; g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 90; i++) { g.strokeStyle = 'rgba(' + (20 + Math.random() * 40 | 0) + ',10,0,' + (.08 + Math.random() * .18) + ')'; g.lineWidth = 1 + Math.random() * 3; var y = Math.random() * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + Math.random() * 14 - 7, 340, y + Math.random() * 14 - 7, 512, y); g.stroke(); }
    var t = tex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
  }
  // Felder: eingelassene, verzierte Rahmen (Spieler golden, Gegner blutrot, Warteschlange grau)
  function slotTex(kind) {
    var col = kind === 'p' ? '#c9a24e' : kind === 'o' ? '#b5523a' : '#8a8478', cv = cvs(160, 232), g = cv.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 232); gr.addColorStop(0, '#2a190b'); gr.addColorStop(1, '#130a04');
    g.fillStyle = gr; rr(g, 6, 6, 148, 220, 14); g.fill();
    var ig = g.createRadialGradient(80, 116, 10, 80, 116, 130); ig.addColorStop(0, 'rgba(0,0,0,.05)'); ig.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = ig; rr(g, 16, 16, 128, 200, 9); g.fill();
    g.lineWidth = 6; g.strokeStyle = col; rr(g, 6, 6, 148, 220, 14); g.stroke();
    g.globalAlpha = .55; g.lineWidth = 2; rr(g, 15, 15, 130, 202, 9); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 3;
    [[18, 18, 1, 1], [142, 18, -1, 1], [18, 214, 1, -1], [142, 214, -1, -1]].forEach(function (c) { g.beginPath(); g.moveTo(c[0], c[1] + 20 * c[3]); g.lineTo(c[0], c[1]); g.lineTo(c[0] + 20 * c[2], c[1]); g.stroke(); g.save(); g.translate(c[0] + 9 * c[2], c[1] + 9 * c[3]); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore(); });
    g.globalAlpha = .22; g.translate(80, 116);
    if (kind === 'p') { g.beginPath(); g.ellipse(0, 10, 17, 14, 0, 0, 7); g.fill(); [[-22, -12], [-8, -24], [8, -24], [22, -12]].forEach(function (p) { g.beginPath(); g.ellipse(p[0], p[1], 6, 8, 0, 0, 7); g.fill(); }); }
    else if (kind === 'o') { g.beginPath(); g.moveTo(0, -26); g.lineTo(18, 0); g.lineTo(0, 26); g.lineTo(-18, 0); g.closePath(); g.lineWidth = 5; g.stroke(); }
    else { for (var k = -1; k <= 1; k++) { g.beginPath(); g.arc(k * 18, 0, 5, 0, 7); g.fill(); } }
    return tex(cv);
  }
  function leather() {
    var cv = cvs(512, 420), g = cv.getContext('2d'), gr = g.createRadialGradient(256, 210, 40, 256, 210, 300); gr.addColorStop(0, '#2f1d12'); gr.addColorStop(1, '#170d07'); g.fillStyle = gr; rr(g, 0, 0, 512, 420, 26); g.fill();
    for (var i = 0; i < 1800; i++) { g.fillStyle = 'rgba(' + (Math.random() < .5 ? '0,0,0' : '255,220,170') + ',' + (Math.random() * .05) + ')'; g.fillRect(Math.random() * 512, Math.random() * 420, 2, 2); }
    g.strokeStyle = '#7a5530'; g.lineWidth = 4; rr(g, 10, 10, 492, 400, 22); g.stroke(); g.setLineDash([10, 8]); g.strokeStyle = '#a07a45'; g.lineWidth = 2; rr(g, 20, 20, 472, 380, 16); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(160,122,69,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 210); g.lineTo(476, 210); g.stroke();      // Mittellinie
    return tex(cv);
  }
  function emojiTex(e) { var cv = cvs(256, 256), g = cv.getContext('2d'); var gr = g.createRadialGradient(128, 128, 20, 128, 128, 126); gr.addColorStop(0, 'rgba(255,190,110,.5)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.font = '130px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 128, 140); return tex(cv); }

  V3.init = function (hostEl, o) {
    host = hostEl; opts = o || {};
    r = new THREE.WebGLRenderer({ antialias: true, alpha: false }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(r.domElement); r.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:manipulation';
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0705); scene.fog = new THREE.Fog(0x0b0705, 9, 20);
    camera = new THREE.PerspectiveCamera(42, 1, .1, 60);
    scene.add(new THREE.AmbientLight(0x6a5040, .85));
    var key = new THREE.PointLight(0xffa860, 1.15, 16, 1.6); key.position.set(0, 4.2, .6); scene.add(key); lights.push(key);
    var tbl = new THREE.Mesh(new THREE.PlaneGeometry(15, 10), new THREE.MeshStandardMaterial({ map: wood(), roughness: .75 })); tbl.rotation.x = -Math.PI / 2; scene.add(tbl);
    // Kerzen
    [-3.3, 3.3].forEach(function (x) {
      var cd = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .7, 14), new THREE.MeshStandardMaterial({ color: 0xe9ddc0, roughness: .8 })); cd.position.set(x, .35, -3.4); scene.add(cd);
      var f = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffc060 })); f.scale.set(.8, 1.5, .8); f.position.set(x, .86, -3.4); scene.add(f); flame.push(f);
      var pl = new THREE.PointLight(0xff9a40, .55, 9, 1.8); pl.position.set(x, 1.1, -3.3); scene.add(pl); lights.push(pl);
    });
    // Plätze
    var stx = { p: slotTex('p'), o: slotTex('o'), q: slotTex('q') }, pg = new THREE.PlaneGeometry(CW, CH);
    leatherM = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 6.6), new THREE.MeshStandardMaterial({ map: leather(), roughness: .9, transparent: true })); leatherM.rotation.x = -Math.PI / 2; leatherM.position.set(0, .004, -.95); scene.add(leatherM);
    ['oq', 'ob', 'pb'].forEach(function (row) {
      for (var l = 0; l < 4; l++) {
        var m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: stx[row === 'pb' ? 'p' : row === 'ob' ? 'o' : 'q'], transparent: true, opacity: row === 'oq' ? .6 : .95 })); m.rotation.x = -Math.PI / 2;
        var sc = row === 'oq' ? .62 : 1; m.scale.set(sc, sc, 1); m.position.set((l - 1.5) * GX, .012, Z[row]); m.userData = { slot: 1, row: row, l: l }; scene.add(m); slots.push(m); pick.push(m);
      }
    });
    // Waage
    beam = new THREE.Group(); beam.position.set(-3.9, .6, -.2); beam.scale.set(.6, .6, .6); scene.add(beam);
    var wm = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: .6, metalness: .2 });
    var post = postM = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, .95, 10), wm); post.position.set(-3.9, .3, -.2); post.scale.set(.6, .6, .6); scene.add(post);
    var bar = new THREE.Mesh(new THREE.BoxGeometry(.14, .1, 3.2), wm); beam.add(bar);
    pans = [-1.6, 1.6].map(function (z) { var p = new THREE.Mesh(new THREE.CylinderGeometry(.5, .4, .08, 18), wm); p.position.set(0, -.3, z); beam.add(p); return p; });
    // Gegnerporträt
    portrait = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); portrait.position.set(0, 1.5, -4.2); portrait.rotation.x = -.35; scene.add(portrait);
    ray = new THREE.Raycaster(); mouse = new THREE.Vector2();
    var dom = r.domElement;
    dom.addEventListener('pointermove', function (e) { if (mode === 'map') { var n = mapHit(e); mapHov = n ? n.userData.key : null; dom.style.cursor = n && n.userData.state === 'reach' ? 'pointer' : 'default'; if (opts.onHover) opts.onHover(n ? n.userData.key : null); return; } var s = hit(e); hov = s ? s.userData.row + s.userData.l : null; dom.style.cursor = s && s.userData.row === 'pb' ? 'pointer' : 'default'; });
    dom.addEventListener('click', function (e) { if (mode === 'map') { var n = mapHit(e); if (n && n.userData.state === 'reach' && mapCb) mapCb(n.userData.key); return; } var s = hit(e); if (s && opts.onSlot) opts.onSlot(s.userData.row, s.userData.l); });
    V3.ready = true; V3.resize();
  };
  function hit(e) {
    var b = r.domElement.getBoundingClientRect(); mouse.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    var list = pick.slice(); Object.keys(cards).forEach(function (k) { list.push(cards[k]); });
    var i = ray.intersectObjects(list, false)[0]; if (!i) return null; var o = i.object; return o.userData.slot ? o : (o.userData.at ? { userData: o.userData.at } : null);
  }
  // Nebel an den Kamera-Abstand koppeln (im Hochformat steht die Kamera weit weg und alles wäre sonst schwarz)
  function placeMapCam() { var d = mapCam.d, f = mapCam.f; camera.position.set(0, d * .8, f + d * .6); camera.lookAt(0, 0, f - d * .12); }
  function fogFit() { var d = camera.position.length(); scene.fog.near = d * 1.0; scene.fog.far = d * 2.4; }
  V3.resize = function () {
    if (!V3.ready) return; w = host.clientWidth || 600; h = host.clientHeight || 400; r.setSize(w, h, false); camera.aspect = w / h;
    var a = w / h;
    if (mode === 'map') { mapCam.d = Math.max(5.4, ((mapCam.vw || 5.9) / 2) / (Math.tan(21 * Math.PI / 180) * a)); placeMapCam(); fogFit(); camera.updateProjectionMatrix(); V3.draw(); return; }
    var d = Math.max(9.6, (8.4 / 2) / (Math.tan(21 * Math.PI / 180) * a));
    var dir = new THREE.Vector3(0, .78, .62).normalize(); camera.position.copy(dir.multiplyScalar(d)).add(new THREE.Vector3(0, 0, -1.2)); camera.lookAt(0, .3, -1.3); fogFit(); camera.updateProjectionMatrix(); V3.draw();
  };
  function slotPos(row, l) { return { x: (l - 1.5) * GX, z: Z[row], s: row === 'oq' ? .62 : 1 }; }
  var cardGeo = null, edgeMat = null;
  function mkCard(c, opp) {
    if (!cardGeo) { cardGeo = new THREE.BoxGeometry(CW, .045, CH); edgeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: .9 }); }
    var top = new THREE.MeshStandardMaterial({ map: face(c, opp), roughness: .8, transparent: true });
    var m = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, top, edgeMat, edgeMat, edgeMat]); m.userData = { uid: c.uid, key: '', at: null }; scene.add(m); return m;
  }
  // Spielstand übernehmen: S = { G, tg, sac, opp }
  V3.sync = function (S) {
    if (!V3.ready) return; sd = S; var G = S.G, seen = {}, i;
    ['p'].forEach(function () { });
    var put = function (c, row, l, opp) {
      if (!c) return; seen[c.uid] = 1; var m = cards[c.uid], p = slotPos(row, l), fresh = false;
      if (!m) { m = cards[c.uid] = mkCard(c, opp); m.position.set(p.x, 1.1, row === 'pb' ? 3.4 : Z[row] - 1.2); fresh = true; m.scale.set(p.s, 1, p.s); }
      var key = [c.atk, c.hp, c.sub ? 1 : 0, c.lives].join('|');
      if (m.userData.key !== key) { m.material[2].map = face(c, opp); m.material[2].needsUpdate = true; m.userData.key = key; }
      m.material[2].opacity = c.sub ? .5 : 1; m.userData.at = { row: row, l: l, s: opp ? 1 : 0 }; m.userData.tx = p.x; m.userData.tz = p.z; m.userData.ts = p.s; m.userData.ty = .03;
      var sac = !opp && S.sac && S.sac.indexOf(l) >= 0 && row === 'pb'; m.material[2].color.setRGB(sac ? 1 : 1, sac ? .45 : 1, sac ? .45 : 1);
      m.userData.row = row; m.userData.l = l;
    };
    for (i = 0; i < 4; i++) { put(G.p[1].queue[i], 'oq', i, true); put(G.p[1].board[i], 'ob', i, true); put(G.p[0].board[i], 'pb', i, false); }
    Object.keys(cards).forEach(function (k) { if (!seen[k]) { var m = cards[k]; delete cards[k]; m.userData.die = 1; dying.push(m); } });
    // Waage
    var d = HD.diff(G); beam.userData.tilt = Math.max(-1, Math.min(1, d / G.win)) * .32;
    teeth.forEach(function (t) { scene.remove(t); }); teeth = [];
    var tm = new THREE.MeshStandardMaterial({ color: 0xf2ecd8, roughness: .5 });
    [[G.p[0].dmg, 1.6], [G.p[1].dmg, -1.6]].forEach(function (a) { for (var n = 0; n < Math.min(8, a[0]); n++) { var t = new THREE.Mesh(new THREE.BoxGeometry(.14, .18, .1), tm); t.position.set(((n % 4) - 1.5) * .17, -.17 + Math.floor(n / 4) * .2, a[1] + ((n % 2) ? .06 : -.06)); t.userData.pan = a[1] > 0 ? 0 : 1; beam.add(t); teeth.push(t); } });
    teeth = teeth.slice();
    tgt = S.tg || [];
    if (S.opp && portraitKey !== S.opp.icon) { portraitKey = S.opp.icon; portrait.material.map = emojiTex(S.opp.icon); portrait.material.needsUpdate = true; }
    V3.draw();
  };
  // Effekte: ev = { k:'atk'|'hit'|'scale'|'die'|'play', s, l }
  V3.fx = function (ev) {
    if (!V3.ready) return; var row = ev.s === 0 ? 'pb' : 'ob', m = null;
    Object.keys(cards).forEach(function (k) { var c = cards[k]; if (c.userData.row === row && c.userData.l === ev.l) m = c; });
    if (ev.k === 'atk' && m) m.userData.kick = { t: 0, d: ev.s === 0 ? -1 : 1, type: 'lunge' };
    else if (ev.k === 'hit' && m) { m.userData.kick = { t: 0, d: 0, type: 'shake' }; shake = .25; }
    else if (ev.k === 'scale') wob = 1;
    V3.draw();
  };
  // ---------- Kartenansicht (Kampagne): Pixel-Karte auf dem Tisch, Figur und Marken ----------
  function mapHit(e) {
    var b = r.domElement.getBoundingClientRect(); mouse.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    var i = ray.intersectObjects(mapNodes, false)[0]; return i ? i.object : null;
  }
  V3.attach = function (el) { host = el; el.appendChild(r.domElement); V3.resize(); };
  V3.setMode = function (m) {
    mode = m; var b = m === 'board';
    slots.forEach(function (s) { s.visible = b; }); beam.visible = b; postM.visible = b; portrait.visible = b; leatherM.visible = b;
    Object.keys(cards).forEach(function (k) { cards[k].visible = b; }); dying.forEach(function (d) { d.visible = b; });
    if (mapG) mapG.visible = !b; V3.resize();
  };
  function pxTex(c) { var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.anisotropy = 4; return t; }
  // M = { canvas, nodes:[{key,x,y,icon,state:'reach'|'done'|'lock'|'cur'}], pawn:{x,y}, onNode }
  V3.mapSet = function (M) {
    mapCb = M.onNode; var asp = M.canvas.width / M.canvas.height; mapDim = { w: M.sheetW || 7.4, h: (M.sheetW || 7.4) / asp }; mapCam.vw = M.viewW || mapDim.w * .8;
    if (!mapG) { mapG = new THREE.Group(); scene.add(mapG); }
    while (mapG.children.length) { var o = mapG.children.pop(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); } }
    mapNodes = []; mapPawn = null;
    var sheet = new THREE.Mesh(new THREE.BoxGeometry(mapDim.w, .05, mapDim.h), [0, 1, 2, 3, 4, 5].map(function (i) { return i === 2 ? new THREE.MeshStandardMaterial({ map: pxTex(M.canvas), roughness: .95 }) : new THREE.MeshStandardMaterial({ color: 0xcdb98c, roughness: .95 }); }));
    sheet.position.y = .03; mapG.add(sheet); mapPlane = sheet;
    var wm = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: .7 });
    M.nodes.forEach(function (n) {
      var tt = pxTex(n.icon), top = new THREE.MeshStandardMaterial({ map: tt, roughness: .6, emissive: n.state === 'reach' ? 0x553311 : 0x000000 }), dim = n.state === 'done' || n.state === 'lock';
      if (dim) top.color.setRGB(.45, .45, .45);
      var m = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, .16, 20), [wm, top, wm]);
      m.position.set((n.x - .5) * mapDim.w, .13, (n.y - .5) * mapDim.h); m.userData = { key: n.key, state: n.state, base: .13 }; mapG.add(m); mapNodes.push(m);
    });
    mapPawn = new THREE.Group();
    var body = new THREE.Mesh(new THREE.ConeGeometry(.17, .5, 12), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: .6 })); body.position.y = .25;
    var head = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf0d9b5 })); head.position.y = .56;
    var hat = new THREE.Mesh(new THREE.ConeGeometry(.15, .18, 10), new THREE.MeshStandardMaterial({ color: 0x7a1d1d })); hat.position.y = .72;
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .02, 14), new THREE.MeshStandardMaterial({ color: 0x4a1010 })); brim.position.y = .64;
    mapPawn.add(body, head, hat, brim);
    var px = (M.pawn.x - .5) * mapDim.w, pz = (M.pawn.y - .5) * mapDim.h;
    if (pawnT && pawnT.cur) { mapPawn.position.set(pawnT.cur.x, .2, pawnT.cur.z); pawnT = { cur: pawnT.cur, from: { x: pawnT.cur.x, z: pawnT.cur.z }, to: { x: px, z: pz }, t: 0 }; if (Math.hypot(px - pawnT.from.x, pz - pawnT.from.z) < .01) pawnT.t = 1; }
    else { mapPawn.position.set(px, .2, pz); pawnT = { cur: { x: px, z: pz }, from: { x: px, z: pz }, to: { x: px, z: pz }, t: 1 }; }
    mapG.add(mapPawn); mapG.visible = mode === 'map';
    var lim0 = Math.max(0, mapDim.h / 2 - 1.4); if (pawnT.t >= 1 || mapCam.first === undefined) { mapCam.f = Math.max(-lim0, Math.min(lim0, pz - .4)); mapCam.first = 1; }
    V3.resize();
  };
  V3.mapAnim = function (dt, t) {
    if (!mapG || mode !== 'map') return;
    mapNodes.forEach(function (m) { var u = m.userData, hv = mapHov === u.key; m.position.y = u.base + (u.state === 'reach' ? (.05 + Math.sin(t * 4 + m.position.x) * .04 + (hv ? .08 : 0)) : 0); var sc = hv && u.state === 'reach' ? 1.18 : 1; m.scale.x += (sc - m.scale.x) * .2; m.scale.z = m.scale.x; });
    if (mapPawn) { var lim = Math.max(0, mapDim.h / 2 - 1.4), tz = Math.max(-lim, Math.min(lim, mapPawn.position.z - .4)); mapCam.f += (tz - mapCam.f) * Math.min(1, dt * 3); placeMapCam(); }
    if (pawnT && mapPawn) { pawnT.t = Math.min(1, pawnT.t + dt * 1.6); var k = pawnT.t, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; pawnT.cur.x = pawnT.from.x + (pawnT.to.x - pawnT.from.x) * e; pawnT.cur.z = pawnT.from.z + (pawnT.to.z - pawnT.from.z) * e; mapPawn.position.set(pawnT.cur.x, .22 + Math.sin(k * Math.PI) * .45 + .12, pawnT.cur.z); }
  };
  V3.screenMap = function (nx, ny) { var v = new THREE.Vector3((nx - .5) * mapDim.w, .2, (ny - .5) * mapDim.h).project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };
  // Bildschirmposition (Pixel im Host) eines Platzes – für Tests und Hinweise
  V3.screen = function (row, l) { var p = slotPos(row, l), v = new THREE.Vector3(p.x, 0, p.z).project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };
  V3.show = function (on) { V3.on = on; host.style.display = on ? 'block' : 'none'; if (on) { V3.resize(); V3.draw(); } else { cancelAnimationFrame(raf); clearTimeout(tm); raf = 0; } };
  V3.draw = function () { if (!V3.on) return; if (raf === 1) { clearTimeout(tm); raf = 0; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  function loop(now) {
    raf = 0; if (!V3.on) return; var dt = Math.min(.05, (now - last) / 1000); last = now; var busy = false, k = Math.min(1, dt * 11), t = now / 1000, i;
    if (mode === 'map') { V3.mapAnim(dt, t); busy = true; }
    Object.keys(cards).forEach(function (id) {
      var m = cards[id], u = m.userData, ex = 0, ez = 0, ey = 0;
      if (u.kick) { u.kick.t += dt; var p = u.kick.t / .35; if (p >= 1) u.kick = null; else if (u.kick.type === 'lunge') { ez = Math.sin(p * Math.PI) * .55 * u.kick.d; ey = Math.sin(p * Math.PI) * .25; } else ex = Math.sin(p * 40) * .06 * (1 - p); busy = true; }
      var dx = u.tx + ex - m.position.x, dz = u.tz + ez - m.position.z, dy = u.ty + ey - m.position.y;
      m.position.x += dx * k; m.position.z += dz * k; m.position.y += dy * k; var ds = u.ts - m.scale.x; m.scale.x += ds * k; m.scale.z = m.scale.x;
      if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) + Math.abs(ds) > .004) busy = true;
    });
    for (i = dying.length - 1; i >= 0; i--) { var d = dying[i]; d.scale.x -= dt * 4; d.scale.z = d.scale.x; d.position.y += dt * 1.2; if (d.scale.x <= .05) { scene.remove(d); d.material[2].dispose(); dying.splice(i, 1); } else busy = true; }
    if (beam) { var tl = beam.userData.tilt || 0, w2 = wob > 0 ? Math.sin(t * 22) * .05 * wob : 0; wob = Math.max(0, wob - dt * 1.4); beam.rotation.x += (-tl + w2 - beam.rotation.x) * Math.min(1, dt * 6); if (Math.abs(-tl - beam.rotation.x) > .004 || wob > 0) busy = true; }
    // Platzmarkierung
    slots.forEach(function (s) { var on = s.userData.row === 'pb' && tgt.indexOf(s.userData.l) >= 0; s.material.color.setRGB(on ? .5 + .5 * Math.sin(t * 6) : 1, on ? 1 : 1, on ? 1 : 1); s.material.opacity = on ? 1 : (s.userData.row === 'oq' ? .6 : .95); if (on) busy = true; });
    // Kerzenflackern (leicht, unabhängig vom restlichen Geschehen)
    lights.forEach(function (l, j) { l.intensity = (j ? .55 : 1.15) * (.93 + Math.sin(t * 9 + j * 2) * .05 + Math.sin(t * 23 + j) * .02); });
    flame.forEach(function (f, j) { f.scale.y = 1.4 + Math.sin(t * 11 + j) * .25; });
    if (shake > 0) { shake -= dt; camera.position.x = Math.sin(t * 90) * .05 * shake * 4; busy = true; } else if (camera.position.x !== 0) camera.position.x = 0;
    r.render(scene, camera);
    // Bei Bewegung volle Bildrate, sonst nur für das Kerzenflackern etwa 12 Bilder pro Sekunde (spart Akku)
    if (busy) raf = requestAnimationFrame(loop); else { raf = 1; tm = setTimeout(function () { raf = requestAnimationFrame(loop); }, 85); }
  }
})();
