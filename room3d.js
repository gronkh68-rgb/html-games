/* Gemeinsame 3D-Umgebungen:
   Room3D.livingRoom(THREE, {half, tableTopY, table:{shape:'round'|'square'|null, size}})
        -> {group, update(t)}   schlichte Standard-Umgebung: Boden, Holztisch, warmes Licht (bewusst ohne Möbel, damit es flüssig läuft)
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

  // Schlichte Standard-Umgebung (früher ein ganzes Wohnzimmer, das zu viel Leistung gekostet hat):
  // nur Boden, optional ein Holztisch und warmes Licht. Keine Möbel, keine Wände, keine zusätzlichen Lichtquellen.
  Room3D.livingRoom = function (THREE, o) {
    o = o || {};
    var half = o.half || 46, k = half / 46, G = new THREE.Group(), FLOOR = -14;
    var mat = function (color, rough) { return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? .8 : rough }); };
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 / k, half * 2 / k), new THREE.MeshBasicMaterial({ color: 0x3a2515 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; G.add(floor);
    var t = o.table;
    if (t && t.shape) {
      var tm = mat(0x7a4a22, .55), ts = (t.size || 30) / k, R = ts / 2;
      if (t.shape === 'round') {
        var top = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.2, R + 1.2, 1.6, 48), tm); top.position.y = -.8; G.add(top);
        var ped = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 12.4, 14), tm); ped.position.y = -7.8; G.add(ped);
        var foot = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 24), tm); foot.position.y = FLOOR + .6; G.add(foot);
      } else {
        var top2 = new THREE.Mesh(new THREE.BoxGeometry(ts + 2, 1.6, ts + 2), tm); top2.position.y = -.8; G.add(top2);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s2) {
          var leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 12.4, 2.2), tm); leg.position.set(s2[0] * (R - 1.4), -7.8, s2[1] * (R - 1.4)); G.add(leg);
        });
      }
    }
    G.add(new THREE.AmbientLight(0xffe6c8, .8));
    G.add(new THREE.HemisphereLight(0xfff0dd, 0x6b4a2a, .4));
    var dl = new THREE.DirectionalLight(0xfff1d6, .55); dl.position.set(10, 30, 14); G.add(dl);
    G.scale.setScalar(k); G.position.y = o.tableTopY || 0;
    G.userData.env = true;
    return { group: G, update: function () {} };
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
