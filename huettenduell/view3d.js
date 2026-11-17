/* Hüttenduell in 3D: Holztisch bei Kerzenlicht mit echten Karten, Waage und Gegnerporträt.
   Die Spiellogik bleibt in index.html/engine.js, hier wird nur gezeichnet.
   V3.init(host, { onSlot(row, lane) }) · V3.sync({ G, tg, sac, opp }) · V3.fx(ev) · V3.show(on) · V3.resize() */
(function () {
  'use strict';
  var V3 = window.V3 = { ready: false, on: false };
  var host, r, scene, camera, raf = 0, last = 0, cards = {}, dying = [], slots = [], pick = [], hov = null, beam, pans, teeth = [], portrait, flame = [], lights = [], texCache = {}, texN = 0, ray, mouse, opts, sd = null, shake = 0, wob = 0, tgt = [], w = 0, h = 0, portraitKey = '', tm = 0;
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
  function slotTex() { var cv = cvs(128, 186), g = cv.getContext('2d'); g.strokeStyle = 'rgba(216,199,160,.55)'; g.lineWidth = 5; g.setLineDash([14, 10]); rr(g, 6, 6, 116, 174, 10); g.stroke(); g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); return tex(cv); }
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
    var st = slotTex(), pg = new THREE.PlaneGeometry(CW, CH);
    ['oq', 'ob', 'pb'].forEach(function (row) {
      for (var l = 0; l < 4; l++) {
        var m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: st, transparent: true, opacity: row === 'oq' ? .5 : .9 })); m.rotation.x = -Math.PI / 2;
        var sc = row === 'oq' ? .62 : 1; m.scale.set(sc, sc, 1); m.position.set((l - 1.5) * GX, .012, Z[row]); m.userData = { slot: 1, row: row, l: l }; scene.add(m); slots.push(m); pick.push(m);
      }
    });
    // Waage
    beam = new THREE.Group(); beam.position.set(-3.9, .6, -.2); beam.scale.set(.6, .6, .6); scene.add(beam);
    var wm = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: .6, metalness: .2 });
    var post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, .95, 10), wm); post.position.set(-3.9, .3, -.2); post.scale.set(.6, .6, .6); scene.add(post);
    var bar = new THREE.Mesh(new THREE.BoxGeometry(.14, .1, 3.2), wm); beam.add(bar);
    pans = [-1.6, 1.6].map(function (z) { var p = new THREE.Mesh(new THREE.CylinderGeometry(.5, .4, .08, 18), wm); p.position.set(0, -.3, z); beam.add(p); return p; });
    // Gegnerporträt
    portrait = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })); portrait.position.set(0, 1.5, -4.2); portrait.rotation.x = -.35; scene.add(portrait);
    ray = new THREE.Raycaster(); mouse = new THREE.Vector2();
    var dom = r.domElement;
    dom.addEventListener('pointermove', function (e) { var s = hit(e); hov = s ? s.userData.row + s.userData.l : null; dom.style.cursor = s && s.userData.row === 'pb' ? 'pointer' : 'default'; });
    dom.addEventListener('click', function (e) { var s = hit(e); if (s && opts.onSlot) opts.onSlot(s.userData.row, s.userData.l); });
    V3.ready = true; V3.resize();
  };
  function hit(e) {
    var b = r.domElement.getBoundingClientRect(); mouse.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    var list = pick.slice(); Object.keys(cards).forEach(function (k) { list.push(cards[k]); });
    var i = ray.intersectObjects(list, false)[0]; if (!i) return null; var o = i.object; return o.userData.slot ? o : (o.userData.at ? { userData: o.userData.at } : null);
  }
  V3.resize = function () {
    if (!V3.ready) return; w = host.clientWidth || 600; h = host.clientHeight || 400; r.setSize(w, h, false); camera.aspect = w / h;
    var a = w / h, d = Math.max(9.6, (8.4 / 2) / (Math.tan(21 * Math.PI / 180) * a));
    var dir = new THREE.Vector3(0, .78, .62).normalize(); camera.position.copy(dir.multiplyScalar(d)).add(new THREE.Vector3(0, 0, -1.2)); camera.lookAt(0, .3, -1.3); camera.updateProjectionMatrix(); V3.draw();
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
  // Bildschirmposition (Pixel im Host) eines Platzes – für Tests und Hinweise
  V3.screen = function (row, l) { var p = slotPos(row, l), v = new THREE.Vector3(p.x, 0, p.z).project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };
  V3.show = function (on) { V3.on = on; host.style.display = on ? 'block' : 'none'; if (on) { V3.resize(); V3.draw(); } else { cancelAnimationFrame(raf); clearTimeout(tm); raf = 0; } };
  V3.draw = function () { if (!V3.on) return; if (raf === 1) { clearTimeout(tm); raf = 0; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  function loop(now) {
    raf = 0; if (!V3.on) return; var dt = Math.min(.05, (now - last) / 1000); last = now; var busy = false, k = Math.min(1, dt * 11), t = now / 1000, i;
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
    slots.forEach(function (s) { var on = s.userData.row === 'pb' && tgt.indexOf(s.userData.l) >= 0; s.material.color.setRGB(on ? .5 + .5 * Math.sin(t * 6) : 1, on ? 1 : 1, on ? 1 : 1); s.material.opacity = on ? 1 : (s.userData.row === 'oq' ? .5 : .9); if (on) busy = true; });
    // Kerzenflackern (leicht, unabhängig vom restlichen Geschehen)
    lights.forEach(function (l, j) { l.intensity = (j ? .55 : 1.15) * (.93 + Math.sin(t * 9 + j * 2) * .05 + Math.sin(t * 23 + j) * .02); });
    flame.forEach(function (f, j) { f.scale.y = 1.4 + Math.sin(t * 11 + j) * .25; });
    if (shake > 0) { shake -= dt; camera.position.x = Math.sin(t * 90) * .05 * shake * 4; busy = true; } else if (camera.position.x !== 0) camera.position.x = 0;
    r.render(scene, camera);
    // Bei Bewegung volle Bildrate, sonst nur für das Kerzenflackern etwa 12 Bilder pro Sekunde (spart Akku)
    if (busy) raf = requestAnimationFrame(loop); else { raf = 1; tm = setTimeout(function () { raf = requestAnimationFrame(loop); }, 85); }
  }
})();
