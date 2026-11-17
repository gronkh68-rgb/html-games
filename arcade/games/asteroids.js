// Asteroiden: Raumschiff drehen, Schub geben, Brocken zerschießen
(function () {
  var W = 560, H = 560, ship, rocks, shots, fx, ufo, cool, spawnInv, ufoT, banner;
  var R = { 3: 38, 2: 22, 1: 12 }, PT = { 3: 20, 2: 50, 1: 100 };
  function wrap(o) { o.x = (o.x + W) % W; o.y = (o.y + H) % H; }
  function rock(x, y, size, lvl) {
    var a = Math.random() * 6.28, v = (28 + Math.random() * 30 + lvl * 4) * (4 - size) * .6 + 20, pts = [], n = 10;
    for (var i = 0; i < n; i++) pts.push(.78 + Math.random() * .4);
    return { x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: size, r: R[size], rot: 0, vr: (Math.random() - .5) * 2, pts: pts };
  }
  function wave(A) {
    rocks = []; var n = 3 + A.level;
    for (var i = 0; i < n; i++) { var x, y; do { x = Math.random() * W; y = Math.random() * H; } while (Math.hypot(x - ship.x, y - ship.y) < 160); rocks.push(rock(x, y, 3, A.level)); }
    banner = 1.6;
  }
  function boom(x, y, n, c) { for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, v = 30 + Math.random() * 120; fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .4 + Math.random() * .5, c: c || '#e6f6ff' }); } }
  function T2(d, e) { return (window.SITE && SITE.T) ? SITE.T(d, e) : d; }
  function resetShip() { ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5, dead: 0 }; }
  ARC.add({
    id: 'asteroids', icon: '☄️', color: '#e6f6ff', w: W, h: H, pad: ['left', 'right', 'up', 'fire'],
    name: ['Asteroiden', 'Asteroids'], desc: ['Dreh dein Schiff, gib Schub und zerlege die Asteroiden in immer kleinere Stücke. Pass auf Ufos auf!', 'Rotate, thrust and blast asteroids into ever smaller pieces. Watch out for UFOs!'],
    keys: ['← → drehen · ↑ Schub · Leertaste schießen', '← → rotate · ↑ thrust · Space shoot'],
    preview: function () { ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 0, dead: 0 }; rocks = []; for (var i = 0; i < 5; i++) rocks.push(rock(Math.random() * W, Math.random() * H, 3, 1)); shots = []; fx = []; ufo = null; },
    start: function (A) { resetShip(); shots = []; fx = []; ufo = null; ufoT = 18; cool = 0; wave(A); },
    update: function (A) {
      var dt = A.dt;
      if (ship.dead > 0) { ship.dead -= dt; if (ship.dead <= 0) { if (A.lives <= 0) return A.over(); resetShip(); } }
      else {
        if (A.down.left) ship.a -= 4.2 * dt; if (A.down.right) ship.a += 4.2 * dt;
        if (A.down.up) { ship.vx += Math.cos(ship.a) * 230 * dt; ship.vy += Math.sin(ship.a) * 230 * dt; if (Math.random() < .5) fx.push({ x: ship.x - Math.cos(ship.a) * 12, y: ship.y - Math.sin(ship.a) * 12, vx: -Math.cos(ship.a) * 80 + A.rnd(-20, 20), vy: -Math.sin(ship.a) * 80 + A.rnd(-20, 20), l: .25, c: '#ff8a00' }); }
        var sp = Math.hypot(ship.vx, ship.vy); if (sp > 320) { ship.vx *= 320 / sp; ship.vy *= 320 / sp; }
        ship.vx *= 1 - .35 * dt; ship.vy *= 1 - .35 * dt; ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship); if (ship.inv > 0) ship.inv -= dt;
        cool -= dt; if ((A.hit('fire') || A.down.fire) && cool <= 0 && shots.filter(function (s) { return !s.e; }).length < 5) { shots.push({ x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14, vx: Math.cos(ship.a) * 440 + ship.vx * .4, vy: Math.sin(ship.a) * 440 + ship.vy * .4, l: 1.1 }); cool = .2; A.sfx('shoot'); }
      }
      rocks.forEach(function (r) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; wrap(r); });
      // Ufo
      ufoT -= dt; if (!ufo && ufoT <= 0 && !ship.dead) { ufo = { x: -20, y: A.rnd(60, H - 60), vx: 90, t: 1, small: A.level > 3 && Math.random() < .5, dir: 1 }; if (Math.random() < .5) { ufo.x = W + 20; ufo.vx = -90; } ufoT = 20; }
      if (ufo) {
        ufo.x += ufo.vx * dt; ufo.y += Math.sin(A.t * 2) * 30 * dt; ufo.t -= dt;
        if (ufo.t <= 0 && !ship.dead) { var a = Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + (ufo.small ? A.rnd(-.15, .15) : A.rnd(-.9, .9)); shots.push({ x: ufo.x, y: ufo.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, l: 1.6, e: 1 }); ufo.t = 1.2; }
        if (ufo.x < -40 || ufo.x > W + 40) ufo = null;
      }
      shots.forEach(function (s) { s.x += s.vx * dt; s.y += s.vy * dt; s.l -= dt; wrap(s); }); 
      // Kollisionen
      shots.forEach(function (s) {
        if (s.l <= 0) return;
        if (!s.e) {
          rocks.forEach(function (r) { if (s.l > 0 && !r.dead && Math.hypot(s.x - r.x, s.y - r.y) < r.r) { s.l = 0; r.dead = true; A.add(PT[r.s]); A.sfx('hit'); boom(r.x, r.y, 8); if (r.s > 1) { rocks.push(rock(r.x, r.y, r.s - 1, A.level)); rocks.push(rock(r.x, r.y, r.s - 1, A.level)); } } });
          if (ufo && s.l > 0 && Math.hypot(s.x - ufo.x, s.y - ufo.y) < (ufo.small ? 10 : 16)) { s.l = 0; A.add(ufo.small ? 1000 : 200); A.sfx('boom'); boom(ufo.x, ufo.y, 18, '#ff3d6e'); ufo = null; }
        } else if (!ship.dead && ship.inv <= 0 && Math.hypot(s.x - ship.x, s.y - ship.y) < 12) { s.l = 0; hitShip(A); }
      });
      rocks = rocks.filter(function (r) { return !r.dead; }); shots = shots.filter(function (s) { return s.l > 0; });
      if (!ship.dead && ship.inv <= 0) {
        rocks.forEach(function (r) { if (!ship.dead && Math.hypot(r.x - ship.x, r.y - ship.y) < r.r + 9) { hitShip(A); } });
        if (ufo && Math.hypot(ufo.x - ship.x, ufo.y - ship.y) < 22) { boom(ufo.x, ufo.y, 14, '#ff3d6e'); ufo = null; hitShip(A); }
      }
      fx.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }); fx = fx.filter(function (p) { return p.l > 0; });
      if (banner > 0) banner -= dt;
      if (!rocks.length && !ship.dead) { A.level++; A.add(300); A.sfx('win'); wave(A); }
    },
    draw: function (A, g) {
      g.lineWidth = 2; g.lineJoin = 'round'; g.shadowBlur = 8; g.shadowColor = '#9fd6ff'; g.strokeStyle = '#e6f6ff';
      rocks.forEach(function (r) { g.save(); g.translate(r.x, r.y); g.rotate(r.rot); g.beginPath(); for (var i = 0; i < r.pts.length; i++) { var a = i / r.pts.length * 6.283, d = r.r * r.pts[i]; i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); g.stroke(); g.restore(); });
      if (ship && !ship.dead && !(ship.inv > 0 && Math.floor(A.t * 14) % 2)) {
        g.save(); g.translate(ship.x, ship.y); g.rotate(ship.a); g.strokeStyle = '#00cfff'; g.shadowColor = '#00cfff'; g.beginPath(); g.moveTo(15, 0); g.lineTo(-11, 9); g.lineTo(-6, 0); g.lineTo(-11, -9); g.closePath(); g.stroke();
        if (A.down.up) { g.strokeStyle = '#ff8a00'; g.beginPath(); g.moveTo(-8, 4); g.lineTo(-17 - Math.random() * 6, 0); g.lineTo(-8, -4); g.stroke(); } g.restore();
      }
      if (ufo) { g.strokeStyle = '#ff3d6e'; g.shadowColor = '#ff3d6e'; var k = ufo.small ? .6 : 1; g.save(); g.translate(ufo.x, ufo.y); g.scale(k, k); g.beginPath(); g.ellipse(0, 0, 18, 6, 0, 0, 7); g.moveTo(-9, -4); g.quadraticCurveTo(0, -16, 9, -4); g.stroke(); g.restore(); }
      shots.forEach(function (s) { g.fillStyle = s.e ? '#ff3d6e' : '#fff'; g.shadowColor = g.fillStyle; g.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); });
      fx.forEach(function (p) { g.globalAlpha = Math.max(0, p.l * 2); g.fillStyle = p.c; g.fillRect(p.x - 1, p.y - 1, 2, 2); }); g.globalAlpha = 1; g.shadowBlur = 0;
      if (banner > 0 && A.state === 'play') { g.font = '900 28px Orbitron, monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,' + Math.min(1, banner) + ')'; g.fillText('LEVEL ' + A.level, W / 2, H / 2 - 60); }
    }
  });
  function hitShip(A) { A.sfx('boom'); boom(ship.x, ship.y, 24, '#00cfff'); A.lives--; ship.dead = 1.4; ship.vx = ship.vy = 0; }
})();
