// Fass-Kletterer: Klettere über Leitern nach oben, springe über rollende Fässer und rette die Prinzessin
(function () {
  var W = 480, H = 640, SL = .04;
  // Plattformen von unten (0) nach oben (5): Mittelhöhe, Ausdehnung, Rollrichtung (1 = nach rechts)
  var PL = [
    { c: 604, a: 0, b: 480, d: 1 }, { c: 508, a: 40, b: 480, d: -1 }, { c: 412, a: 0, b: 440, d: 1 },
    { c: 316, a: 40, b: 480, d: -1 }, { c: 220, a: 0, b: 440, d: 1 }, { c: 124, a: 0, b: 330, d: 0 }
  ];
  var LAD = [[0, 300], [0, 80], [1, 160], [1, 400], [2, 330], [2, 70], [3, 120], [3, 400], [4, 290]];      // [untere Plattform, x]
  function py(p, x) { var q = PL[p]; return q.c + q.d * (x - (q.a + q.b) / 2) * SL; }
  var pl, bar, thr, bonus, deadT, wonT, kongA, T2 = function (d, e) { return (window.SITE && SITE.T) ? SITE.T(d, e) : d; };
  function resetPlayer() { pl = { x: 40, p: 0, st: 'walk', jy: 0, vy: 0, dir: 1, ly: 0, lad: null, step: 0, inv: 1.2 }; }
  function feet() { return pl.st === 'climb' ? pl.ly : py(pl.p, pl.x) - pl.jy; }
  function ladderAt(p, x) { for (var i = 0; i < LAD.length; i++) if (LAD[i][0] === p && Math.abs(LAD[i][1] - x) < 12) return LAD[i]; return null; }
  function ladderDown(p, x) { for (var i = 0; i < LAD.length; i++) if (LAD[i][0] === p - 1 && Math.abs(LAD[i][1] - x) < 12) return LAD[i]; return null; }
  ARC.add({
    id: 'barrels', icon: '🦍', color: '#ff8a00', w: W, h: H, pad: ['left', 'right', 'up', 'down', 'fire'], fireIcon: '⤒',
    name: ['Fass-Kletterer', 'Barrel Climber'], desc: ['Der Affe wirft Fässer: Springe darüber, klettere über die Leitern nach oben und erreiche die Prinzessin.', 'The ape throws barrels: jump over them, climb the ladders and reach the princess at the top.'],
    keys: ['← → laufen · ↑ ↓ Leiter · Leertaste springen (über Fässer: Bonus)', '← → walk · ↑ ↓ ladder · Space jump (over barrels: bonus)'],
    preview: function () { resetPlayer(); bar = []; thr = 1; kongA = 0; bonus = 5000; },
    start: function (A) { resetPlayer(); bar = []; thr = 1.5; bonus = 5000; deadT = 0; wonT = 0; kongA = 0; },
    update: function (A) {
      var dt = A.dt; kongA += dt;
      if (deadT > 0) { deadT -= dt; if (deadT <= 0) { if (A.lives <= 0) return A.over(); resetPlayer(); bar = []; thr = 1.5; } return; }
      if (wonT > 0) { wonT -= dt; if (wonT <= 0) { A.level++; resetPlayer(); bar = []; bonus = 5000; thr = 1.5; } return; }
      bonus = Math.max(0, bonus - 80 * dt); if (pl.inv > 0) pl.inv -= dt;
      var sp = 95 * dt, q = PL[pl.p];
      if (pl.st === 'climb') {
        var L = pl.lad, top = py(L[0] + 1, L[1]), bot = py(L[0], L[1]);
        if (A.down.up) pl.ly -= 70 * dt; if (A.down.down) pl.ly += 70 * dt; pl.step += dt * ((A.down.up || A.down.down) ? 8 : 0);
        if (pl.ly <= top) { pl.p = L[0] + 1; pl.st = 'walk'; pl.jy = 0; }
        else if (pl.ly >= bot) { pl.p = L[0]; pl.st = 'walk'; pl.jy = 0; }
      } else {
        if (pl.jy === 0 && pl.vy === 0) {
          if (A.down.left) { pl.x -= sp; pl.dir = -1; pl.step += dt * 9; } if (A.down.right) { pl.x += sp; pl.dir = 1; pl.step += dt * 9; }
          pl.x = Math.max(q.a + 8, Math.min(q.b - 8, pl.x));
          if (A.down.up) { var lu = ladderAt(pl.p, pl.x); if (lu && pl.p < 5) { pl.st = 'climb'; pl.lad = lu; pl.x = lu[1]; pl.ly = py(pl.p, pl.x) - 1; } }
          else if (A.down.down) { var ld = ladderDown(pl.p, pl.x); if (ld) { pl.st = 'climb'; pl.lad = ld; pl.x = ld[1]; pl.p = ld[0]; pl.ly = py(ld[0] + 1, ld[1]) + 1; } }
          if (pl.st === 'walk' && A.hit('fire')) { pl.vy = 250; pl.jy = .01; A.sfx('jump'); }
        } else {
          if (A.down.left) { pl.x -= sp * .8; pl.dir = -1; } if (A.down.right) { pl.x += sp * .8; pl.dir = 1; }
          pl.x = Math.max(q.a + 8, Math.min(q.b - 8, pl.x));
          pl.vy -= 720 * dt; pl.jy += pl.vy * dt; if (pl.jy <= 0) { pl.jy = 0; pl.vy = 0; }
        }
      }
      // Ziel
      if (pl.p === 5 && pl.x > 240 && pl.st === 'walk') { A.add(1000 + Math.round(bonus)); A.sfx('win'); wonT = 2; return; }
      // Fässer werfen
      thr -= dt; if (thr <= 0) { bar.push({ x: 105, y: 150, vy: 0, p: 5, st: 'fall', dir: 1, jumped: false, lad: null }); thr = Math.max(1, 2.8 - A.level * .25) * (.7 + Math.random() * .6); }
      var bs = (66 + A.level * 7) * dt;
      bar.forEach(function (b) {
        if (b.st === 'fall') {
          b.vy += 600 * dt; b.y += b.vy * dt; b.x += b.dir * 34 * dt; var t = b.p - 1;
          if (t >= 0) { var Q = PL[t]; if (b.x >= Q.a && b.x <= Q.b && b.y >= py(t, b.x) - 9) { b.y = py(t, b.x) - 9; b.p = t; b.st = 'roll'; b.vy = 0; b.dir = Q.d || 1; A.sfx('tick'); } }
          if (b.y > H + 30) b.dead = true;
        } else if (b.st === 'roll') {
          var Q2 = PL[b.p]; b.x += b.dir * bs; b.y = py(b.p, b.x) - 9; b.rot = (b.rot || 0) + b.dir * dt * 8;
          if (b.p > 0 && !b.skip) { for (var i = 0; i < LAD.length; i++) if (LAD[i][0] === b.p - 1 && Math.abs(LAD[i][1] - b.x) < 3 && Math.random() < .3) { b.st = 'down'; b.lad = LAD[i]; b.x = LAD[i][1]; break; } }
          b.skip = false; if (b.x < Q2.a - 4 || b.x > Q2.b + 4) { if (b.p === 0) b.dead = true; else { b.st = 'fall'; b.vy = 0; b.dir = b.x > Q2.b ? 1 : -1; b.dir = b.dir; } }
        } else if (b.st === 'down') {
          b.y += 80 * dt; var Lb = b.lad; if (b.y >= py(Lb[0], b.x) - 9) { b.p = Lb[0]; b.y = py(b.p, b.x) - 9; b.st = 'roll'; b.dir = PL[b.p].d || 1; b.skip = true; }
        }
        // Kollision / Überspringen
        if (!b.dead && pl.st !== 'climb') {
          var fy = feet(), dx = Math.abs(b.x - pl.x);
          if (dx < 13 && b.y - 9 < fy && b.y + 9 > fy - 26) {
            if (pl.inv <= 0 && pl.jy < 10) { A.lives--; A.sfx('lose'); deadT = 1.4; boomSet(); }
          }
          if (!b.jumped && pl.jy > 14 && dx < 14 && Math.abs(b.y - (py(pl.p, pl.x) - 9)) < 6 && b.p === pl.p) { b.jumped = true; A.add(100); A.sfx('coin'); }
        } else if (!b.dead && pl.st === 'climb' && Math.abs(b.x - pl.x) < 12 && Math.abs(b.y - (pl.ly - 12)) < 16 && pl.inv <= 0) { A.lives--; A.sfx('lose'); deadT = 1.4; }
      });
      bar = bar.filter(function (b) { return !b.dead; });
      function boomSet() { }
    },
    draw: function (A, g) {
      // Plattformen
      g.lineWidth = 8; g.lineCap = 'butt';
      PL.forEach(function (q, i) {
        var xa = q.a, xb = q.b; g.strokeStyle = '#ff3d6e'; g.shadowColor = '#ff3d6e'; g.shadowBlur = 6; g.beginPath(); g.moveTo(xa, py(i, xa) + 4); g.lineTo(xb, py(i, xb) + 4); g.stroke();
        g.shadowBlur = 0; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.setLineDash([10, 10]); g.beginPath(); g.moveTo(xa, py(i, xa) + 4); g.lineTo(xb, py(i, xb) + 4); g.stroke(); g.setLineDash([]); g.lineWidth = 8;
      });
      // Leitern
      g.strokeStyle = '#00cfff'; g.lineWidth = 2; g.shadowColor = '#00cfff'; g.shadowBlur = 5;
      LAD.forEach(function (L) { var t = py(L[0] + 1, L[1]), b = py(L[0], L[1]); g.beginPath(); g.moveTo(L[1] - 8, t); g.lineTo(L[1] - 8, b); g.moveTo(L[1] + 8, t); g.lineTo(L[1] + 8, b); for (var y = t + 6; y < b; y += 10) { g.moveTo(L[1] - 8, y); g.lineTo(L[1] + 8, y); } g.stroke(); });
      g.shadowBlur = 0;
      // Affe
      var kb = Math.sin(kongA * 6) * 2; g.save(); g.translate(55, py(5, 55) - 24); g.fillStyle = '#8a5a2b'; g.fillRect(-26, -20 + kb, 52, 44); g.fillRect(-34, -4 + kb, 14, 30); g.fillRect(20, -4 + kb, 14, 30);
      g.fillStyle = '#c99a5b'; g.fillRect(-14, -10 + kb, 28, 18); g.fillStyle = '#fff'; g.fillRect(-9, -6 + kb, 6, 6); g.fillRect(3, -6 + kb, 6, 6); g.fillStyle = '#000'; g.fillRect(-7, -4 + kb, 3, 3); g.fillRect(5, -4 + kb, 3, 3); g.restore();
      // Prinzessin
      g.save(); g.translate(290, py(5, 290) - 4); g.fillStyle = '#ff9ee8'; g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.lineTo(4, -20); g.lineTo(-4, -20); g.closePath(); g.fill(); g.fillStyle = '#ffd9b0'; g.beginPath(); g.arc(0, -25, 6, 0, 7); g.fill(); g.fillStyle = '#ffd400'; g.fillRect(-5, -33, 10, 4); g.restore();
      // Fässer
      bar.forEach(function (b) { g.save(); g.translate(b.x, b.y); g.rotate(b.rot || 0); g.fillStyle = '#c8741e'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill(); g.strokeStyle = '#5a3208'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.stroke(); g.restore(); });
      // Spieler
      if (pl && !(pl.inv > 0 && Math.floor(A.t * 14) % 2)) {
        var fy = feet(), dead = deadT > 0; g.save(); g.translate(pl.x, fy);
        if (dead) { g.rotate(Math.min(1.5, (1.4 - deadT) * 4)); }
        g.fillStyle = '#00cfff'; g.fillRect(-7, -22, 14, 14); g.fillStyle = '#ffd9b0'; g.fillRect(-5, -30, 10, 9); g.fillStyle = '#ff3d6e'; g.fillRect(-6, -32, 12, 4);
        g.fillStyle = '#2a3cff'; var s = pl.st === 'climb' ? Math.sin(pl.step) * 3 : (Math.floor(pl.step) % 2 ? 2 : -2); g.fillRect(-6, -9, 5, 9 + (s > 0 ? -1 : 0)); g.fillRect(1, -9, 5, 9 + (s > 0 ? 0 : -1));
        g.restore();
      }
      g.font = '700 14px ui-monospace, monospace'; g.fillStyle = '#ffd400'; g.textAlign = 'right'; g.fillText('BONUS ' + Math.round(bonus), W - 10, 20);
      if (wonT > 0) { g.font = '900 30px Orbitron, monospace'; g.textAlign = 'center'; g.fillStyle = '#39ff14'; g.fillText(T2('GERETTET!', 'RESCUED!'), W / 2, 330); }
    }
  });
})();
