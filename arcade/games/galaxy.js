// Sternenjäger: Formationsshooter – Gegner fliegen ein, stürzen sich auf dich und schießen zurück
(function () {
  var W = 480, H = 640, P, pb, en, eb, fx, stars, wave, banner, cool, formT, diveT, respawn, msg;
  var COLS = 8, ROWS = 4;
  function mkStars() { stars = []; for (var i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: .5 + Math.random() * 2 }); }
  function spawnWave(A) {
    en = []; var k = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var side = (c + r) % 2 ? 1 : -1;
      en.push({ r: r, c: c, type: r === 0 ? 2 : r === 1 ? 1 : 0, sx: side > 0 ? W + 30 : -30, sy: 60 + (r % 2) * 120, d: .12 * k++, t: 0, st: 'enter', x: -50, y: -50, hp: r === 0 && wave > 2 ? 2 : 1, tm: 0 });
    }
    banner = 2; msg = T2('Welle ', 'Wave ') + wave; diveT = 2.5;
  }
  function T2(d, e) { return (window.SITE && SITE.T) ? SITE.T(d, e) : d; }
  function slot(e) { return { x: 62 + e.c * 51 + Math.sin(formT * .7) * 26, y: 90 + e.r * 42 + Math.sin(formT * 1.3 + e.c) * 2 }; }
  function boom(x, y, col, n) { for (var i = 0; i < (n || 14); i++) { var a = Math.random() * 6.28, v = 40 + Math.random() * 160; fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: .5 + Math.random() * .4, c: col }); } }
  function die(A) { A.sfx('boom'); boom(P.x, P.y, '#00cfff', 26); A.lives--; if (A.lives <= 0) { P.dead = true; P.t = 1.2; P.final = true; } else { P.dead = true; P.t = 1; } }
  ARC.add({
    id: 'galaxy', icon: '🛸', color: '#00cfff', w: W, h: H, pad: ['left', 'right', 'fire'],
    name: ['Sternenjäger', 'Star Hunter'], desc: ['Formationsshooter: Gegner fliegen ein, stürzen sich auf dich und schießen zurück. Räume Welle für Welle ab.', 'Formation shooter: enemies fly in, dive at you and shoot back. Clear wave after wave.'],
    keys: ['← → / A D bewegen · Leertaste schießen (halten = Dauerfeuer) · Touch: ziehen', '← → / A D move · Space shoot (hold = autofire) · Touch: drag'],
    preview: function () { mkStars(); en = []; eb = []; pb = []; fx = []; P = { x: W / 2, y: H - 50 }; banner = 0; formT = 0; },
    start: function (A) { mkStars(); P = { x: W / 2, y: H - 50, dead: false, t: 0, inv: 1.5 }; pb = []; eb = []; fx = []; wave = 1; cool = 0; formT = 0; A.level = 1; spawnWave(A); },
    update: function (A) {
      var dt = A.dt; formT += dt; stars.forEach(function (s) { s.y += s.s * 40 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
      fx.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }); fx = fx.filter(function (p) { return p.l > 0; });
      if (banner > 0) banner -= dt;
      // Spieler
      if (P.dead) { P.t -= dt; if (P.t <= 0) { if (P.final) return A.over(); P.dead = false; P.x = W / 2; P.inv = 2; } }
      else {
        var sp = 300 * dt; if (A.down.left) P.x -= sp; if (A.down.right) P.x += sp;
        if (A.ptr.down) { var d = A.ptr.x - P.x; P.x += Math.max(-sp * 1.6, Math.min(sp * 1.6, d)); }
        P.x = Math.max(24, Math.min(W - 24, P.x)); if (P.inv > 0) P.inv -= dt;
        cool -= dt;
        if ((A.hit('fire') || A.down.fire || A.ptr.down) && cool <= 0 && pb.length < 3) { pb.push({ x: P.x, y: P.y - 18 }); cool = .2; A.sfx('shoot'); }
      }
      pb.forEach(function (b) { b.y -= 640 * dt; }); pb = pb.filter(function (b) { return b.y > -10; });
      // Gegner
      var live = 0, divers = 0, ebv = 170 + wave * 12;
      en.forEach(function (e) {
        if (e.dead) return; live++;
        if (e.st === 'enter') {
          e.d -= dt; if (e.d > 0) return; e.t += dt / 1.7; var s = slot(e), t = Math.min(1, e.t), u = 1 - t;
          var cx = W / 2 + (e.sx > 0 ? 90 : -90), cy = 360;
          e.x = u * u * e.sx + 2 * u * t * cx + t * t * s.x; e.y = u * u * e.sy + 2 * u * t * cy + t * t * s.y; e.y = Math.max(e.y, -20);
          if (e.t >= 1) e.st = 'form';
        } else if (e.st === 'form') { var s2 = slot(e); e.x = s2.x; e.y = s2.y; }
        else if (e.st === 'dive') {
          divers++; e.t += dt; var t2 = e.t;
          e.y = e.y0 + t2 * (230 + wave * 14); e.x = e.x0 + (e.tx - e.x0) * Math.min(1, t2 / 1.8) + Math.sin(t2 * 4 + e.c) * 46 * Math.min(1, t2);
          e.tm -= dt; if (e.tm <= 0 && e.y < P.y - 80 && e.shots > 0) { eb.push({ x: e.x, y: e.y + 10, vx: (P.x - e.x) * .15, vy: ebv }); e.shots--; e.tm = .6 + Math.random() * .4; }
          if (e.y > H + 30) { e.st = 'return'; e.t = 0; e.y = -30; e.x = slot(e).x; }
        } else if (e.st === 'return') { var s3 = slot(e); e.t += dt; e.y += (s3.y - e.y) * Math.min(1, dt * 3) + 120 * dt * (e.y < s3.y - 4 ? 1 : 0); e.x += (s3.x - e.x) * Math.min(1, dt * 4); if (Math.abs(e.y - s3.y) < 3) e.st = 'form'; }
      });
      if (live === 0 && banner <= 0) { wave++; A.level = wave; A.add(500); A.sfx('win'); spawnWave(A); }
      // Sturzflüge starten
      diveT -= dt;
      if (diveT <= 0 && live > 0 && !P.dead) {
        var f = en.filter(function (e) { return !e.dead && e.st === 'form'; });
        if (f.length && divers < 2 + Math.min(4, wave)) { var e2 = f[Math.floor(Math.random() * f.length)]; e2.st = 'dive'; e2.t = 0; e2.x0 = e2.x; e2.y0 = e2.y; e2.tx = P.x; e2.shots = wave > 2 ? 2 : 1; e2.tm = .5; }
        diveT = Math.max(.5, 1.8 - wave * .12) * (.6 + Math.random() * .8);
      }
      // Treffer: Schüsse -> Gegner
      pb.forEach(function (b) {
        en.forEach(function (e) {
          if (e.dead || b.hit || Math.abs(e.x - b.x) > 17 || Math.abs(e.y - b.y) > 16) return;
          b.hit = true; e.hp--; if (e.hp <= 0) { e.dead = true; A.add((e.type === 2 ? 100 : e.type === 1 ? 80 : 50) * (e.st === 'dive' ? 2 : 1)); A.sfx('hit'); boom(e.x, e.y, e.type === 2 ? '#ff3d6e' : e.type === 1 ? '#ffd400' : '#39ff14'); } else A.sfx('bounce');
        });
      }); pb = pb.filter(function (b) { return !b.hit; });
      // Gegnerschüsse
      eb.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; if (!P.dead && P.inv <= 0 && Math.abs(b.x - P.x) < 14 && Math.abs(b.y - P.y) < 16) { b.y = H + 99; die(A); } });
      eb = eb.filter(function (b) { return b.y < H + 20 && b.x > -10 && b.x < W + 10; });
      // Rammen
      if (!P.dead && P.inv <= 0) en.forEach(function (e) { if (!e.dead && e.st === 'dive' && Math.abs(e.x - P.x) < 22 && Math.abs(e.y - P.y) < 20) { e.dead = true; boom(e.x, e.y, '#ff3d6e'); die(A); } });
      // Gelegentliche Schüsse aus der Formation
      if (live > 0 && Math.random() < dt * (.4 + wave * .08) && !P.dead) { var fs = en.filter(function (e) { return !e.dead && e.st === 'form'; }); if (fs.length) { var q = fs[Math.floor(Math.random() * fs.length)]; eb.push({ x: q.x, y: q.y + 10, vx: 0, vy: ebv }); } }
    },
    draw: function (A, g) {
      stars.forEach(function (s) { g.fillStyle = 'rgba(200,230,255,' + (.25 + s.s * .2) + ')'; g.fillRect(s.x, s.y, s.s, s.s); });
      g.shadowBlur = 10;
      en.forEach(function (e) {
        if (e.dead || e.y < -25) return; var col = e.type === 2 ? '#ff3d6e' : e.type === 1 ? '#ffd400' : '#39ff14', fl = Math.sin(A.t * 10 + e.c) * 3;
        g.shadowColor = col; g.fillStyle = col; g.save(); g.translate(e.x, e.y);
        g.beginPath(); g.moveTo(0, 13); g.lineTo(14, -2 + fl * .3); g.lineTo(10, -12); g.lineTo(0, -6); g.lineTo(-10, -12); g.lineTo(-14, -2 + fl * .3); g.closePath(); g.fill();
        g.fillStyle = '#05070d'; g.fillRect(-6, -3, 4, 4); g.fillRect(2, -3, 4, 4);
        g.restore();
      });
      g.shadowColor = '#00cfff'; g.fillStyle = '#fff';
      pb.forEach(function (b) { g.fillRect(b.x - 1.5, b.y - 8, 3, 14); });
      g.shadowColor = '#ff3d6e'; g.fillStyle = '#ff9bb0'; eb.forEach(function (b) { g.beginPath(); g.arc(b.x, b.y, 4, 0, 7); g.fill(); });
      if (P && !P.dead) {
        if (P.inv > 0 && Math.floor(A.t * 14) % 2) { /* blinken */ } else {
          g.shadowColor = '#00cfff'; g.fillStyle = '#00cfff'; g.save(); g.translate(P.x, P.y);
          g.beginPath(); g.moveTo(0, -20); g.lineTo(8, -4); g.lineTo(20, 12); g.lineTo(8, 8); g.lineTo(0, 14); g.lineTo(-8, 8); g.lineTo(-20, 12); g.lineTo(-8, -4); g.closePath(); g.fill();
          g.fillStyle = '#e6fbff'; g.fillRect(-2, -10, 4, 12); g.restore();
        }
      }
      fx.forEach(function (p) { g.globalAlpha = Math.max(0, p.l * 2); g.fillStyle = p.c; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }); g.globalAlpha = 1; g.shadowBlur = 0;
      if (banner > 0 && A.state === 'play') { g.font = '900 30px Orbitron, monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,' + Math.min(1, banner) + ')'; g.fillText(msg, W / 2, H / 2); }
    }
  });
})();
