/* Tetris in 3D: das Spielfeld als Schacht mit echten Würfeln. Logik bleibt in index.html, hier wird nur gezeichnet.
   T3.init(host) -> baut Szene; T3.render(S) pro Frame, S = { board, cur, ghostY, clearing, particles, cols, rows, cell, colors, cyber, fx, shake, over } */
(function () {
  'use strict';
  var T3 = window.T3 = { ready: false };
  var host, r, scene, camera, cubes = [], ghostLines = [], wellG, pts, ptsPos, lastKey = '', w = 0, h = 0, camX = 5, mats = {}, edgeMat = {}, ambient, key;
  var COLS = 10, ROWS = 20;
  var boxGeo, edgeGeo;
  function px(c) { return c + .5; }
  function py(row) { return ROWS - row - .5; }
  function mk(type, cyber, color) {
    var k = type + (cyber ? 'c' : 's'); if (mats[k]) return mats[k];
    var col = new THREE.Color(color);
    mats[k] = cyber
      ? new THREE.MeshStandardMaterial({ color: 0x05060b, emissive: col, emissiveIntensity: .55, roughness: .4, metalness: .6 })
      : new THREE.MeshStandardMaterial({ color: col, roughness: .35, metalness: .1 });
    edgeMat[k] = new THREE.LineBasicMaterial({ color: cyber ? col : new THREE.Color(color).multiplyScalar(.55) });
    return mats[k];
  }
  T3.init = function (hostEl) {
    host = hostEl;
    r = new THREE.WebGLRenderer({ antialias: true, alpha: false }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(r.domElement); r.domElement.style.cssText = 'display:block;width:100%;height:100%';
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(38, 1, .1, 200);
    ambient = new THREE.AmbientLight(0xffffff, .55); scene.add(ambient);
    key = new THREE.DirectionalLight(0xffffff, .8); key.position.set(-6, 24, 18); scene.add(key);
    boxGeo = new THREE.BoxGeometry(.94, .94, .94); edgeGeo = new THREE.EdgesGeometry(boxGeo);
    for (var i = 0; i < COLS * ROWS + 8; i++) { var m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x05060b })); m.visible = false; var e = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffffff })); m.add(e); m.userData.e = e; scene.add(m); cubes.push(m); }
    for (i = 0; i < 4; i++) { var g = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 })); g.visible = false; scene.add(g); ghostLines.push(g); }
    var N = 160; ptsPos = new Float32Array(N * 3);
    var pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(ptsPos, 3));
    pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .28, color: 0xffffff, transparent: true, opacity: .9, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
    T3.ready = true; T3.resize();
  };
  function buildWell(cyber) {
    if (wellG) { scene.remove(wellG); wellG.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); }
    wellG = new THREE.Group();
    var line = new THREE.LineBasicMaterial({ color: cyber ? 0x00f0ff : 0x6a7391, transparent: true, opacity: cyber ? .35 : .5 });
    var a = [], x, y;
    for (x = 0; x <= COLS; x++) a.push(x, 0, -.5, x, ROWS, -.5);
    for (y = 0; y <= ROWS; y++) a.push(0, y, -.5, COLS, y, -.5);
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); wellG.add(new THREE.LineSegments(g, line));
    var back = new THREE.Mesh(new THREE.PlaneGeometry(COLS, ROWS), new THREE.MeshBasicMaterial({ color: cyber ? 0x05060b : 0x0f1424 })); back.position.set(COLS / 2, ROWS / 2, -.52); wellG.add(back);
    var wallM = new THREE.MeshStandardMaterial({ color: cyber ? 0x0a1020 : 0x232a42, roughness: .6, metalness: .3, transparent: true, opacity: cyber ? .55 : .85 });
    [-.25, COLS + .25].forEach(function (xx) { var m = new THREE.Mesh(new THREE.BoxGeometry(.5, ROWS + .5, 1.4), wallM); m.position.set(xx, ROWS / 2 - .25, 0); wellG.add(m); if (cyber) { var e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x00f0ff })); e.position.copy(m.position); wellG.add(e); } });
    var fl = new THREE.Mesh(new THREE.BoxGeometry(COLS + 1, .5, 1.4), wallM); fl.position.set(COLS / 2, -.25, 0); wellG.add(fl);
    if (cyber) { var fe = new THREE.LineSegments(new THREE.EdgesGeometry(fl.geometry), new THREE.LineBasicMaterial({ color: 0x00f0ff })); fe.position.copy(fl.position); wellG.add(fe); }
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: cyber ? 0x020308 : 0x0a0d18 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.6; wellG.add(ground);
    scene.add(wellG);
    scene.background = new THREE.Color(cyber ? 0x03040a : 0x080b14);
    ambient.intensity = cyber ? .35 : .6; key.intensity = cyber ? .5 : .9;
  }
  T3.resize = function () {
    if (!T3.ready) return; w = host.clientWidth || 600; h = host.clientHeight || 600;
    r.setSize(w, h, false); camera.aspect = w / h;
    var t = Math.tan(camera.fov * Math.PI / 360), dh = 12.5 / t, dw = (COLS / 2 + 3) / (t * camera.aspect);
    T3.dist = Math.max(dh, dw); camera.updateProjectionMatrix();
  };
  T3.render = function (S) {
    if (!T3.ready) return; var cy = !!S.cyber;
    if (lastKey !== (cy ? 'c' : 's')) { lastKey = cy ? 'c' : 's'; buildWell(cy); }
    var n = 0, i, rr, cc;
    var rows = S.clearing ? S.clearing.rows : null, kk = S.clearing ? Math.min(1, S.clearing.t / .28) : 0;
    function put(type, x, y, z, sc, flash) {
      var m = cubes[n++], col = new THREE.Color(S.colors[type]); m.visible = true;
      if (cy) { m.material.color.setHex(0x05060b); m.material.emissive.copy(col); m.material.emissiveIntensity = .55 + flash * 1.6; m.material.metalness = .6; m.material.roughness = .4; m.userData.e.material.color.copy(col); }
      else { m.material.color.copy(col); m.material.emissive.setScalar(flash * .7); m.material.emissiveIntensity = 1; m.material.metalness = .1; m.material.roughness = .35; m.userData.e.material.color.copy(col).multiplyScalar(.55); }
      m.position.set(x, y, z); m.scale.setScalar(sc);
    }
    if (S.board) for (rr = 0; rr < ROWS; rr++) for (cc = 0; cc < COLS; cc++) {
      var t = S.board[rr][cc]; if (!t) continue;
      var clr = rows && rows.indexOf(rr) >= 0;
      put(t, px(cc), py(rr), clr ? kk * 1.2 : 0, clr ? 1 - kk * .85 : 1, clr ? 1 - kk : 0);
    }
    if (S.cur) {
      var gy = S.ghostY, gi = 0;
      S.cur.m.forEach(function (row, r2) { row.forEach(function (v, c2) { if (!v) return; if (S.cur.y + r2 >= 0) put(S.cur.t, px(S.cur.x + c2), py(S.cur.y + r2), 0, 1, .15); if (gy + r2 >= 0 && gi < 4) { var g = ghostLines[gi++]; g.visible = true; g.material.color.set(S.colors[S.cur.t]); g.position.set(px(S.cur.x + c2), py(gy + r2), 0); g.scale.setScalar(.92); } }); });
      for (; gi < 4; gi++) ghostLines[gi].visible = false;
    } else ghostLines.forEach(function (g) { g.visible = false; });
    for (; n < cubes.length; n++) cubes[n].visible = false;
    var P = S.particles || [], N = ptsPos.length / 3;
    for (i = 0; i < N; i++) { var p = P[i]; if (p) { ptsPos[i * 3] = p.x / S.cell; ptsPos[i * 3 + 1] = ROWS - p.y / S.cell; ptsPos[i * 3 + 2] = .6 + (i % 5) * .15; } else { ptsPos[i * 3] = 0; ptsPos[i * 3 + 1] = -50; ptsPos[i * 3 + 2] = 0; } }
    pts.geometry.attributes.position.needsUpdate = true;
    // Kamera folgt dem Stein leicht (Parallaxe), Schütteln bei Tetris
    var tx = S.cur ? S.cur.x + 1.5 : 5; camX += (tx - camX) * .06; var px0 = 5 + (camX - 5) * .35;
    var sh = S.shake > 0 && S.fx ? S.shake : 0;
    camera.position.set(px0 + (sh ? (Math.random() - .5) * sh * 1.4 : 0), 11.5 + 4 + (sh ? (Math.random() - .5) * sh : 0), T3.dist);
    camera.lookAt(5 + (px0 - 5) * .2, 9.2, 0);
    r.render(scene, camera);
  };
})();
