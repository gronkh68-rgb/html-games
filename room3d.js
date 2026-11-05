/* Gemeinsame 3D-Umgebungen:
   Room3D.livingRoom(THREE, {half, tableTopY, table:{shape:'round'|'square'|null, size}})
        -> {group, update(t)}   gemütliches Wohnzimmer (Parkett, Tapete, Kamin, Sofa, Regal, Lampe, Pflanze, Teppich)
   Room3D.rain(THREE, {count, radius, top, bottom})  -> {obj, update(dt)}   Cyber-Regen
   Room3D.rainOn()                                    -> false, wenn der Regen über den Schalter ausgeschaltet ist
   Der Tisch liegt oben bei y = tableTopY, die Gruppe wird passend skaliert (half = halbe Raumbreite). */
(function () {
  var Room3D = window.Room3D = {};
  Room3D.rainOn = function () { return document.documentElement.getAttribute('data-rain') !== 'off'; };

  function tex(THREE, w, h, draw, rx, ry) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = 4;
    return t;
  }
  function rnd(i) { var s = Math.sin(i * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); }

  Room3D.livingRoom = function (THREE, o) {
    o = o || {};
    var half = o.half || 46, k = half / 46, G = new THREE.Group();
    var B = new THREE.Group(); G.add(B);                 // Basisraum: halbe Breite 46, Tischplatte bei y = 0
    var FLOOR = -14, H = 40;
    var mat = function (color, rough, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough == null ? .8 : rough }, extra || {})); };
    var box = function (w, h, d, m, x, y, z, parent) { var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); (parent || B).add(b); return b; };

    // Boden: Parkett
    var parquet = tex(THREE, 512, 512, function (x, w, h) {
      var cols = ['#a8763f', '#9a6a36', '#b4814a', '#8f6030', '#a06f3b'];
      for (var r = 0; r < 8; r++) for (var c = 0; c < 4; c++) {
        var off = (r % 2) * 64, px = c * 128 - off;
        x.fillStyle = cols[Math.floor(rnd(r * 7 + c) * cols.length)]; x.fillRect(px, r * 64, 128, 64);
        x.strokeStyle = 'rgba(60,35,15,.45)'; x.lineWidth = 2; x.strokeRect(px, r * 64, 128, 64);
        x.strokeStyle = 'rgba(255,230,190,.08)'; for (var g = 0; g < 4; g++) { x.beginPath(); x.moveTo(px + 6, r * 64 + 10 + g * 14); x.lineTo(px + 120, r * 64 + 12 + g * 14); x.stroke(); }
      }
      x.fillStyle = '#a8763f'; x.fillRect(w - 64, 0, 64, h);
    }, 8, 8);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 / k, half * 2 / k), mat(0xffffff, .55, { map: parquet }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; B.add(floor);
    // Decke
    var ceil = new THREE.Mesh(new THREE.PlaneGeometry(92, 92), mat(0xefe3cc, 1));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = FLOOR + H; B.add(ceil);
    // Wände: Tapete mit Streifen, unten Holzvertäfelung
    var paper = tex(THREE, 256, 64, function (x, w, h) {
      x.fillStyle = '#d9c9a3'; x.fillRect(0, 0, w, h);
      for (var i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(122,140,92,.30)' : 'rgba(255,255,255,.10)'; x.fillRect(i * 32, 0, 32, h); }
    }, 10, 1);
    var wallM = mat(0xffffff, 1, { map: paper }), wood = mat(0x6b4423, .6), dark = mat(0x4a2e18, .6);
    [[0, -46, 0], [0, 46, Math.PI], [-46, 0, Math.PI / 2], [46, 0, -Math.PI / 2]].forEach(function (w) {
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(92, H), wallM); pl.position.set(w[0], FLOOR + H / 2, w[1]); pl.rotation.y = w[2]; B.add(pl);
      var wp = new THREE.Mesh(new THREE.PlaneGeometry(92, 11), wood); wp.position.set(w[0] * .997, FLOOR + 5.5, w[1] * .997); wp.rotation.y = w[2]; B.add(wp);
      var sk = new THREE.Mesh(new THREE.BoxGeometry(92, 1.3, .5), dark); sk.position.set(w[0] * .99, FLOOR + .65, w[1] * .99); sk.rotation.y = w[2]; B.add(sk);
    });

    // Teppich
    var rug = new THREE.Mesh(new THREE.CircleGeometry(33, 64), mat(0xffffff, 1, { map: tex(THREE, 256, 256, function (x, w, h) {
      var cx = w / 2, rings = ['#7a2430', '#e8d9b5', '#2e4a5a', '#e8d9b5', '#7a2430', '#c9a45a', '#7a2430'];
      for (var i = 0; i < rings.length; i++) { x.fillStyle = rings[i]; x.beginPath(); x.arc(cx, cx, cx - i * 17, 0, 6.3); x.fill(); }
    }) }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR + .06; B.add(rug);

    // Kamin an der Nordwand
    var stone = mat(0x8c8579, .95);
    box(18, 14, 4, stone, 0, FLOOR + 7, -44, B);
    box(9, 7, 2, mat(0x120a06, 1), 0, FLOOR + 4, -42.4, B);
    box(21, 1.3, 5.5, wood, 0, FLOOR + 14.4, -43.5, B);
    var fireM = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    var fire1 = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5), fireM); fire1.position.set(0, FLOOR + 3.4, -41.7); B.add(fire1);
    var fire2 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.4), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: .85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire2.position.set(0, FLOOR + 2.8, -41.6); B.add(fire2);
    var fireL = new THREE.PointLight(0xff8a3a, 1.3, 70); fireL.position.set(0, FLOOR + 5, -38); B.add(fireL);
    // Bild über dem Kamin
    box(11, 8, .6, mat(0x3a2412, .5), 0, FLOOR + 22, -45.6, B);
    var art = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 6.6), new THREE.MeshBasicMaterial({ map: tex(THREE, 192, 132, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f2c27a'); g.addColorStop(.55, '#d9805a'); g.addColorStop(1, '#3a4a6a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#2c3a52'; x.beginPath(); x.moveTo(0, h); x.lineTo(50, 70); x.lineTo(95, 100); x.lineTo(140, 55); x.lineTo(w, h); x.fill();
      x.fillStyle = '#ffe9b0'; x.beginPath(); x.arc(140, 34, 14, 0, 6.3); x.fill();
    }) }));
    art.position.set(0, FLOOR + 22, -45.25); B.add(art);

    // Fenster an der Westwand mit Abendlicht und Vorhängen
    box(.8, 17, 15, mat(0xe8dcc0, .5), -45.6, FLOOR + 22, -10, B);
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(13, 15), new THREE.MeshBasicMaterial({ map: tex(THREE, 64, 128, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a4d7a'); g.addColorStop(.6, '#e89a6a'); g.addColorStop(1, '#f6d27a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.7)'; for (var i = 0; i < 14; i++) x.fillRect(rnd(i) * w, rnd(i + 9) * h * .5, 1.5, 1.5);
    }) }));
    glass.rotation.y = Math.PI / 2; glass.position.set(-45.2, FLOOR + 22, -10); B.add(glass);
    box(.3, 15, .5, mat(0xe8dcc0, .5), -45, FLOOR + 22, -10, B);
    box(.3, .5, 13, mat(0xe8dcc0, .5), -45, FLOOR + 22, -10, B);
    var curt = mat(0x7a2f2f, 1);
    box(.9, 18, 3.4, curt, -44.8, FLOOR + 21.5, -16.4, B); box(.9, 18, 3.4, curt, -44.8, FLOOR + 21.5, -3.6, B);
    var wl = new THREE.PointLight(0xffb27a, .45, 80); wl.position.set(-38, FLOOR + 22, -10); B.add(wl);

    // Bücherregal an der Ostwand
    box(3.4, 28, 17, dark, 44, FLOOR + 14, 12, B);
    var bookCols = [0x8a2a2a, 0x2a4a7a, 0x3a6a3a, 0xc9a45a, 0x5a3a7a, 0xd9d0b8, 0x7a4a2a];
    for (var sh = 0; sh < 5; sh++) {
      box(3.6, .5, 16.6, wood, 43.9, FLOOR + 2.5 + sh * 5.4, 12, B);
      var z = 4.3;
      for (var b = 0; b < 15; b++) {
        var bw = .8 + rnd(sh * 31 + b) * .9, bh = 3 + rnd(sh * 17 + b + 3) * 1.8;
        box(2.6, bh, bw, mat(bookCols[Math.floor(rnd(sh * 5 + b + 7) * bookCols.length)], .7), 43.4, FLOOR + 2.75 + sh * 5.4 + bh / 2, z + bw / 2, B);
        z += bw + .06; if (z > 19.5) break;
      }
    }

    // Sofa an der Südwand (schaut zum Tisch)
    var sofaM = mat(0x2f5a62, .95), sofaD = mat(0x24464d, .95);
    box(26, 4, 10, sofaD, 0, FLOOR + 2, 40, B);
    box(26, 8, 3, sofaM, 0, FLOOR + 8, 44, B);
    box(3.2, 7, 10, sofaM, -14.4, FLOOR + 5.5, 40, B); box(3.2, 7, 10, sofaM, 14.4, FLOOR + 5.5, 40, B);
    [-8, 0, 8].forEach(function (cx) { box(7.4, 2, 7.6, sofaM, cx, FLOOR + 5, 40.6, B); });
    box(4, 3.4, 1.6, mat(0xc9a45a, .9), -9.5, FLOOR + 7.4, 38.5, B); box(4, 3.4, 1.6, mat(0xb85a3a, .9), 10, FLOOR + 7.4, 38.5, B);
    box(1, 7, 1, dark, -12, FLOOR + .5, 36, B); box(1, 1, 1, dark, 12, FLOOR + .5, 36, B);

    // Stehlampe (Nordwestecke)
    var lampX = -38, lampZ = -36;
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 24, 10), mat(0x2a2a2a, .4, { metalness: .6 })); pole.position.set(lampX, FLOOR + 12, lampZ); B.add(pole);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, .6, 20), mat(0x2a2a2a, .4, { metalness: .6 })); base.position.set(lampX, FLOOR + .3, lampZ); B.add(base);
    var shade = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0a8, side: THREE.DoubleSide })); shade.position.set(lampX, FLOOR + 25, lampZ); B.add(shade);
    var lampL = new THREE.PointLight(0xffd9a0, .8, 60); lampL.position.set(lampX, FLOOR + 24, lampZ); B.add(lampL);

    // Zimmerpflanze (Nordostecke)
    var px = 38, pz = -36;
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.6, 5.4, 16), mat(0xa4573a, .8)); pot.position.set(px, FLOOR + 2.7, pz); B.add(pot);
    for (var l = 0; l < 14; l++) {
      var lf = new THREE.Mesh(new THREE.SphereGeometry(2 + rnd(l) * 1.4, 10, 8), mat(0x2f6a3a + Math.floor(rnd(l + 4) * 3) * 0x101000, .85));
      lf.scale.set(1, .7, 1); lf.position.set(px + (rnd(l + 2) - .5) * 6, FLOOR + 7 + rnd(l + 5) * 8, pz + (rnd(l + 7) - .5) * 6); B.add(lf);
    }

    // Deckenlampe über dem Tisch
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 12, 6), mat(0x222222)); cord.position.set(0, FLOOR + H - 6, 0); B.add(cord);
    var cl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 4.2, 3, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9bd, side: THREE.DoubleSide })); cl.position.set(0, FLOOR + H - 13.5, 0); B.add(cl);
    var topL = new THREE.PointLight(0xffe3b8, .9, 90); topL.position.set(0, FLOOR + H - 15, 0); B.add(topL);

    // Tisch (oben bei y = 0)
    var t = o.table;
    if (t && t.shape) {
      var tm = mat(0x7a4a22, .55), ts = (t.size || 30) / k, R = ts / 2;
      if (t.shape === 'round') {
        var top = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.2, R + 1.2, 1.6, 64), tm); top.position.y = -.8; B.add(top);
        var ped = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 12.4, 20), tm); ped.position.y = -7.8; B.add(ped);
        var foot = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 32), tm); foot.position.y = FLOOR + .6; B.add(foot);
      } else {
        box(ts + 2, 1.6, ts + 2, tm, 0, -.8, 0, B);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { box(2.2, 12.4, 2.2, tm, s[0] * (R - 1.4), -7.8, s[1] * (R - 1.4), B); });
      }
    }

    // Grundlicht: warmes Raumlicht
    var amb = new THREE.AmbientLight(0xffe6c8, .75); B.add(amb);
    var hemi = new THREE.HemisphereLight(0xfff0dd, 0x6b4a2a, .35); B.add(hemi);

    G.scale.setScalar(k); G.position.y = o.tableTopY || 0;
    G.userData.env = true;
    return {
      group: G,
      update: function (time) {
        fireL.intensity = 1.2 + .35 * Math.sin(time * 9) + .25 * Math.sin(time * 15.7) + (rnd(Math.floor(time * 12)) - .5) * .3;
        fire1.scale.set(1 + .06 * Math.sin(time * 11), 1 + .12 * Math.sin(time * 7.3), 1);
        fire2.scale.set(1 + .08 * Math.sin(time * 13), 1 + .15 * Math.sin(time * 9.1), 1);
      }
    };
  };

  Room3D.rain = function (THREE, o) {
    o = o || {};
    var N = o.count || 900, R = o.radius || 60, top = o.top || 28, bottom = o.bottom == null ? -1 : o.bottom, pos = new Float32Array(N * 3), i;
    for (i = 0; i < N; i++) { var a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * R; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = bottom + Math.random() * (top - bottom); pos[i * 3 + 2] = Math.sin(a) * d; }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(g, new THREE.PointsMaterial({ color: o.color || 0x7fd8ff, size: o.size || .09, transparent: true, opacity: .55, depthWrite: false }));
    pts.userData.env = true;
    return {
      obj: pts,
      update: function (dt) {
        pts.visible = Room3D.rainOn();
        if (!pts.visible) return;
        var a = g.attributes.position;
        for (var k = 0; k < a.count; k++) { var y = a.getY(k) - dt * 9; if (y < bottom) y = top; a.setY(k, y); }
        a.needsUpdate = true;
      }
    };
  };
})();
