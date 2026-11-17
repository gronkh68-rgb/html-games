// Straßenhüpfer: Kreuze die Straße und den Fluss und erreiche die fünf Buchten
(function () {
  var CS = 40, COLS = 13, ROWS = 14, W = COLS * CS, H = ROWS * CS, GOALS = [1, 3, 6, 9, 11];
  var lanes, frog, goals, fx, deadT, tLeft, best, T2 = function (d, e) { return (window.SITE && SITE.T) ? SITE.T(d, e) : d; };
  function mk(level) {
    var f = 1 + (level - 1) * .12, L = [];
    // Straße: Zeilen 7..11 (von oben nach unten), Fluss: Zeilen 1..5
    function lane(row, kind, dir, spd, w, gap, col) { var o = [], n = Math.ceil((COLS + 6) / (w + gap)), off = Math.random() * 3; for (var i = 0; i < n; i++) o.push({ x: i * (w + gap) + off, w: w }); return { row: row, kind: kind, dir: dir, spd: spd * f, w: w, gap: gap, col: col, o: o, span: n * (w + gap) }; }
    L.push(lane(1, 'turtle', -1, 1.5, 2, 2.5, '#2fd1a0')); L.push(lane(2, 'log', 1, 1.8, 4, 2.5, '#9a6a35')); L.push(lane(3, 'log', 1, 3, 6, 3, '#8b5a2b')); L.push(lane(4, 'turtle', -1, 1.7, 3, 2, '#2fd1a0')); L.push(lane(5, 'log', 1, 2.2, 3, 2.5, '#9a6a35'));
    L.push(lane(7, 'car', -1, 2.2, 1, 4, '#ff3d6e')); L.push(lane(8, 'car', 1, 1.6, 1, 3.5, '#ffd400')); L.push(lane(9, 'car', -1, 2.8, 1, 5, '#a06bff')); L.push(lane(10, 'car', 1, 1.4, 2, 4, '#00cfff')); L.push(lane(11, 'truck', -1, 1.2, 3, 4.5, '#ff8a00'));
    return L;
  }
  function spawn() { frog = { x: 6, y: 13, ride: 0, hop: 0, maxRow: 13, dir: 0 }; tLeft = 30; }
  function die(A, why) { if (deadT > 0) return; A.lives--; A.sfx(why === 'water' ? 'hit' : 'boom'); deadT = .9; frog.why = why; }
  function onLane(row) { for (var i = 0; i < lanes.length; i++) if (lanes[i].row === row) return lanes[i]; return null; }
  function under(l, x) { var xs = x + .5; return l.o.some(function (o) { var ox = o.x; return xs > ox + .12 && xs < ox + o.w - .12; }) && !(l.kind === 'turtle' && diving(l, x)); }
  function diving(l, x) { return Math.sin(frogT * .8 + l.row * 2) > .78; }
  var frogT = 0;
  ARC.add({
    id: 'hopper', icon: '🐸', color: '#7dff5a', w: W, h: H, swipe: true, tap: 'up', pad: ['left', 'up', 'down', 'right'],
    name: ['Straßenhüpfer', 'Road Hopper'], desc: ['Hüpfe über die vielbefahrene Straße, springe im Fluss auf Baumstämme und Schildkröten und erreiche alle fünf Buchten.', 'Hop across the busy road, ride logs and turtles over the river and reach all five bays.'],
    keys: ['Pfeile / WASD hüpfen · Wischen oder Tippen auf dem Feld · Zeitlimit beachten', 'Arrow keys / WASD hop · swipe or tap the field · watch the timer'],
    preview: function () { lanes = mk(1); spawn(); goals = []; fx = []; deadT = 0; },
    start: function (A) { lanes = mk(1); goals = []; fx = []; deadT = 0; spawn(); },
    update: function (A) {
      var dt = A.dt; frogT += dt;
      lanes.forEach(function (l) { l.o.forEach(function (o) { o.x += l.dir * l.spd * dt; if (l.dir > 0 && o.x > COLS + 3) o.x -= l.span; if (l.dir < 0 && o.x < -3 - o.w) o.x += l.span; }); });
      fx.forEach(function (p) { p.t -= dt; }); fx = fx.filter(function (p) { return p.t > 0; });
      if (deadT > 0) { deadT -= dt; if (deadT <= 0) { if (A.lives <= 0) return A.over(); spawn(); } return; }
      tLeft -= dt; if (tLeft <= 0) return die(A, 'time');
      if (frog.hop > 0) frog.hop -= dt;
      if (frog.hop <= 0) {
        var dx = 0, dy = 0; if (A.hit('left')) dx = -1; else if (A.hit('right')) dx = 1; else if (A.hit('up')) dy = -1; else if (A.hit('down')) dy = 1;
        if (dx || dy) {
          var nx = frog.dir === 0 && 0, tx = frog.x + dx, ty = frog.y + dy;
          if (dx) tx = Math.round(tx); if (tx < 0 || tx > COLS - 1 || ty > 13 || ty < 0) { /* Wand */ } else {
            frog.x = tx; frog.y = ty; frog.hop = .09; frog.dir = dx ? dx : (dy < 0 ? 0 : 2); A.sfx('tick');
            if (ty < frog.maxRow) { frog.maxRow = ty; A.add(10); }
          }
        }
      }
      var row = frog.y, l = onLane(row);
      if (row === 0) {
        var gi = GOALS.indexOf(Math.round(frog.x));
        if (gi < 0 || goals.indexOf(gi) >= 0) return die(A, 'hit');
        goals.push(gi); A.add(50 + Math.round(tLeft) * 5); A.sfx('win'); fx.push({ x: GOALS[gi], t: 99 });
        if (goals.length === GOALS.length) { A.level++; A.add(1000); lanes = mk(A.level); goals = []; fx = []; A.sfx('win'); }
        spawn(); return;
      }
      if (l && (l.kind === 'car' || l.kind === 'truck')) { if (l.o.some(function (o) { return frog.x + .8 > o.x + .1 && frog.x + .2 < o.x + o.w - .1; })) return die(A, 'hit'); }
      else if (l) { // Fluss
        if (frog.hop <= 0) { if (!under(l, frog.x)) return die(A, 'water'); }
        frog.x += l.dir * l.spd * dt; if (frog.x < -.4 || frog.x > COLS - .6) return die(A, 'water');
      }
    },
    draw: function (A, g) {
      var i, l;
      // Hintergrund
      g.fillStyle = '#0a2a4a'; g.fillRect(0, CS, W, CS * 5); g.fillStyle = '#141414'; g.fillRect(0, 7 * CS, W, CS * 5);
      g.fillStyle = '#133a1d'; g.fillRect(0, 0, W, CS); g.fillRect(0, 6 * CS, W, CS); g.fillRect(0, 12 * CS, W, CS * 2);
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 2; g.setLineDash([14, 14]); for (i = 8; i <= 11; i++) { g.beginPath(); g.moveTo(0, i * CS); g.lineTo(W, i * CS); g.stroke(); } g.setLineDash([]);
      // Buchten
      for (i = 0; i < GOALS.length; i++) { g.fillStyle = '#0a2a4a'; g.fillRect(GOALS[i] * CS + 2, 2, CS - 4, CS - 2); if (goals.indexOf(i) >= 0) { g.fillStyle = '#7dff5a'; g.beginPath(); g.arc(GOALS[i] * CS + CS / 2, CS / 2 + 2, 11, 0, 7); g.fill(); } }
      g.shadowBlur = 6;
      lanes.forEach(function (l) {
        l.o.forEach(function (o) {
          var x = o.x * CS, y = l.row * CS + 5, w = o.w * CS, h = CS - 10; g.shadowColor = l.col; g.fillStyle = l.col;
          if (l.kind === 'log') { g.fillRect(x, y, w - 4, h); g.fillStyle = 'rgba(0,0,0,.25)'; for (var k = 18; k < w - 10; k += 24) g.fillRect(x + k, y + 3, 3, h - 6); }
          else if (l.kind === 'turtle') { var dv = diving(l, o.x); for (var t = 0; t < o.w; t++) { g.globalAlpha = dv ? .3 : 1; g.beginPath(); g.arc(x + t * CS + CS / 2, y + h / 2, 13, 0, 7); g.fill(); } g.globalAlpha = 1; }
          else { g.fillRect(x + 2, y + 2, w - 6, h - 4); g.fillStyle = 'rgba(255,255,255,.55)'; var fx0 = l.dir < 0 ? x + 5 : x + w - 14; g.fillRect(fx0, y + 5, 8, h - 10); }
        });
      });
      g.shadowBlur = 0;
      if (frog) {
        var px = frog.x * CS + CS / 2, py = frog.y * CS + CS / 2 + (frog.hop > 0 ? -5 : 0);
        if (deadT > 0) { g.globalAlpha = Math.max(0, deadT / .9); }
        g.fillStyle = '#7dff5a'; g.shadowColor = '#7dff5a'; g.shadowBlur = 8; g.beginPath(); g.ellipse(px, py, 13, 12, 0, 0, 7); g.fill(); g.shadowBlur = 0;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(px - 6, py - 8, 4, 0, 7); g.arc(px + 6, py - 8, 4, 0, 7); g.fill(); g.fillStyle = '#05070d'; g.fillRect(px - 7, py - 9, 2.5, 3); g.fillRect(px + 5, py - 9, 2.5, 3);
        if (deadT > 0) { g.fillStyle = '#fff'; g.font = '900 22px monospace'; g.textAlign = 'center'; g.fillText(frog.why === 'water' ? '≈' : '✕', px, py + 7); } g.globalAlpha = 1;
      }
      // Zeit
      var k2 = Math.max(0, tLeft / 30); g.fillStyle = k2 < .25 ? '#ff3d6e' : '#39ff14'; g.fillRect(0, H - 6, W * k2, 6);
    }
  });
})();
