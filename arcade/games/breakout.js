// Ziegelbrecher: Ball per Schläger lenken und alle Ziegel zerstören
(function () {
  var W = 480, H = 600, COLS = 10, BW = 44, BH = 18, ROWC = ['#ff3d6e', '#ff8a00', '#ffd400', '#39ff14', '#00cfff', '#a06bff'];
  var pad, balls, bricks, caps, fx, stuck, speed, wide;
  function T2(d, e) { return (window.SITE && SITE.T) ? SITE.T(d, e) : d; }
  function build(level) {
    bricks = []; var rows = Math.min(8, 4 + level), pat = (level - 1) % 3;
    for (var r = 0; r < rows; r++) for (var c = 0; c < COLS; c++) {
      if (pat === 1 && (r + c) % 2) continue; if (pat === 2 && (c === 4 || c === 5) && r > 0 && r < rows - 1) continue;
      bricks.push({ x: 20 + c * BW, y: 60 + r * (BH + 4), hp: r < 1 && level > 2 ? 2 : 1, col: ROWC[r % ROWC.length], pts: (rows - r) * 10 });
    }
  }
  function launch(A) { var a = -Math.PI / 2 + A.rnd(-.4, .4); stuck = false; balls.forEach(function (b) { if (b.stuck) { b.stuck = false; b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed; } }); }
  function newBall() { balls = [{ x: pad.x, y: H - 60, vx: 0, vy: 0, stuck: true }]; stuck = true; }
  ARC.add({
    id: 'breakout', icon: '🧱', color: '#a06bff', w: W, h: H, pad: ['left', 'right', 'fire'],
    name: ['Ziegelbrecher', 'Brick Breaker'], desc: ['Lenke den Ball mit dem Schläger und zerstöre alle Ziegel. Fallende Kapseln machen den Schläger breiter oder liefern Extra-Bälle.', 'Steer the ball with your paddle and smash all bricks. Falling capsules widen the paddle or add extra balls.'],
    keys: ['← → oder Maus/Finger bewegen · Leertaste/Tippen: Ball abschießen', '← → or mouse/finger to move · Space/tap: launch ball'],
    preview: function () { pad = { x: W / 2, w: 84 }; build(1); balls = []; caps = []; fx = []; },
    start: function (A) { pad = { x: W / 2, w: 84 }; speed = 340; build(1); caps = []; fx = []; wide = 0; newBall(); },
    update: function (A) {
      var dt = A.dt, sp = 460 * dt;
      if (A.down.left) pad.x -= sp; if (A.down.right) pad.x += sp;
      if (!A.down.left && !A.down.right && (A.ptr.down || (A.ptr.in && A.ptr.mouse))) pad.x += Math.max(-sp * 2.5, Math.min(sp * 2.5, A.ptr.x - pad.x));
      var pw = pad.w + (wide > 0 ? 40 : 0); if (wide > 0) wide -= dt;
      pad.x = Math.max(pw / 2, Math.min(W - pw / 2, pad.x));
      if (A.hit('fire') || (A.ptr.down && stuck)) { if (stuck) launch(A); }
      balls.forEach(function (b) {
        if (b.stuck) { b.x = pad.x; b.y = H - 60; return; }
        var steps = 3; for (var s = 0; s < steps; s++) {
          b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
          if (b.x < 7) { b.x = 7; b.vx = Math.abs(b.vx); A.sfx('bounce'); } if (b.x > W - 7) { b.x = W - 7; b.vx = -Math.abs(b.vx); A.sfx('bounce'); } if (b.y < 7) { b.y = 7; b.vy = Math.abs(b.vy); A.sfx('bounce'); }
          if (b.vy > 0 && b.y > H - 48 && b.y < H - 34 && Math.abs(b.x - pad.x) < pw / 2 + 6) {
            var k = (b.x - pad.x) / (pw / 2), a = -Math.PI / 2 + k * 1.05, v = Math.min(560, speed + A.level * 8); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = H - 49; A.sfx('bounce');
          }
          for (var i = 0; i < bricks.length; i++) {
            var br = bricks[i]; if (b.x + 6 < br.x || b.x - 6 > br.x + BW - 2 || b.y + 6 < br.y || b.y - 6 > br.y + BH) continue;
            var ox = Math.min(b.x + 6 - br.x, br.x + BW - 2 - (b.x - 6)), oy = Math.min(b.y + 6 - br.y, br.y + BH - (b.y - 6));
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy; b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
            br.hp--; A.sfx('coin');
            if (br.hp <= 0) { A.add(br.pts); for (var q = 0; q < 6; q++) fx.push({ x: br.x + BW / 2, y: br.y + BH / 2, vx: A.rnd(-120, 120), vy: A.rnd(-120, 120), l: .5, c: br.col }); bricks.splice(i, 1); if (Math.random() < .12) caps.push({ x: br.x + BW / 2, y: br.y, t: Math.random() < .5 ? 'W' : 'B' }); }
            break;
          }
        }
      });
      var lost = balls.filter(function (b) { return b.y > H + 10; }); balls = balls.filter(function (b) { return b.y <= H + 10; });
      if (!balls.length && lost.length) { A.lives--; A.sfx('hit'); if (A.lives <= 0) return A.over(); newBall(); }
      caps.forEach(function (c) { c.y += 130 * dt; if (c.y > H - 50 && c.y < H - 30 && Math.abs(c.x - pad.x) < pw / 2 + 10) { c.dead = true; A.sfx('win'); A.add(50); if (c.t === 'W') wide = 12; else { var nb = balls.filter(function (b) { return !b.stuck; })[0]; if (nb) { balls.push({ x: nb.x, y: nb.y, vx: -nb.vx, vy: nb.vy }); balls.push({ x: nb.x, y: nb.y, vx: nb.vx * .7, vy: -Math.abs(nb.vy) }); } } } if (c.y > H) c.dead = true; });
      caps = caps.filter(function (c) { return !c.dead; });
      fx.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }); fx = fx.filter(function (p) { return p.l > 0; });
      if (!bricks.length) { A.level++; A.add(200); A.sfx('win'); speed += 20; build(A.level); caps = []; newBall(); }
    },
    draw: function (A, g) {
      g.shadowBlur = 8;
      bricks.forEach(function (b) { g.shadowColor = b.col; g.fillStyle = b.col; g.globalAlpha = b.hp > 1 ? 1 : .88; g.fillRect(b.x, b.y, BW - 2, BH); if (b.hp > 1) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(b.x + 1, b.y + 1, BW - 4, BH - 2); } }); g.globalAlpha = 1;
      var pw = pad.w + (wide > 0 ? 40 : 0); g.shadowColor = '#00cfff'; g.fillStyle = '#00cfff'; g.fillRect(pad.x - pw / 2, H - 42, pw, 10); g.fillStyle = '#e6fbff'; g.fillRect(pad.x - pw / 2 + 4, H - 42, pw - 8, 3);
      g.shadowColor = '#fff'; g.fillStyle = '#fff'; balls.forEach(function (b) { g.beginPath(); g.arc(b.x, b.y, 6, 0, 7); g.fill(); });
      caps.forEach(function (c) { g.fillStyle = c.t === 'W' ? '#39ff14' : '#ffd400'; g.shadowColor = g.fillStyle; g.fillRect(c.x - 14, c.y - 7, 28, 14); g.fillStyle = '#05070d'; g.font = '700 11px monospace'; g.textAlign = 'center'; g.fillText(c.t === 'W' ? '↔' : '×3', c.x, c.y + 4); });
      fx.forEach(function (p) { g.globalAlpha = Math.max(0, p.l * 2); g.fillStyle = p.c; g.fillRect(p.x - 2, p.y - 2, 4, 4); }); g.globalAlpha = 1; g.shadowBlur = 0;
      if (stuck && A.state === 'play') { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 14px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText(T2('Leertaste / Tippen zum Abschuss', 'Space / tap to launch'), W / 2, H - 90); }
    }
  });
})();
