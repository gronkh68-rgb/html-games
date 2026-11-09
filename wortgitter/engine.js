/* Wortgitter: Regeln, Wertung und Computer-Züge (läuft beim Host). */
(function () {
  var E = window.WGE = {}, L2 = HK.L2, K = null;
  E.bind = function (k) { K = k; };
  var SETS = {
    de: { A: [5, 1], B: [2, 3], C: [2, 4], D: [4, 1], E: [15, 1], F: [2, 4], G: [3, 2], H: [4, 2], I: [6, 1], J: [1, 6], K: [2, 4], L: [3, 2], M: [4, 3], N: [9, 1], O: [3, 2], P: [1, 4], Q: [1, 10], R: [6, 1], S: [7, 1], T: [6, 1], U: [6, 1], V: [1, 6], W: [1, 3], X: [1, 8], Y: [1, 10], Z: [1, 3], 'Ä': [1, 6], 'Ö': [1, 8], 'Ü': [1, 6], '?': [2, 0] },
    en: { A: [9, 1], B: [2, 3], C: [2, 3], D: [4, 2], E: [12, 1], F: [2, 4], G: [3, 2], H: [2, 4], I: [9, 1], J: [1, 8], K: [1, 5], L: [4, 1], M: [2, 3], N: [6, 1], O: [8, 1], P: [2, 3], Q: [1, 10], R: [6, 1], S: [4, 1], T: [6, 1], U: [4, 1], V: [2, 4], W: [2, 4], X: [1, 8], Y: [2, 4], Z: [1, 10], '?': [2, 0] }
  };
  E.SETS = SETS;
  E.letters = function (lang) { return Object.keys(SETS[lang]).filter(function (l) { return l !== '?'; }); };
  E.val = function (lang, l) { return SETS[lang][l] ? SETS[lang][l][1] : 0; };
  // Prämienfelder: 3W, 2W, 3B, 2B
  var PREM = new Array(225).fill('');
  (function () {
    var tw = [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]];
    var dw = [[1, 1], [2, 2], [3, 3], [4, 4], [1, 13], [2, 12], [3, 11], [4, 10], [13, 1], [12, 2], [11, 3], [10, 4], [13, 13], [12, 12], [11, 11], [10, 10], [7, 7]];
    var tl = [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]];
    var dl = [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]];
    tw.forEach(function (p) { PREM[p[0] * 15 + p[1]] = 'TW'; }); dw.forEach(function (p) { PREM[p[0] * 15 + p[1]] = 'DW'; });
    tl.forEach(function (p) { PREM[p[0] * 15 + p[1]] = 'TL'; }); dl.forEach(function (p) { PREM[p[0] * 15 + p[1]] = 'DL'; });
  })();
  E.PREM = PREM;

  // ---------- Auswertung eines Zuges ----------
  // board: Array(225) mit {l,v} oder null; placed: [{x,y,l,v}] (l = Buchstabe, bei Joker der gewählte)
  E.evaluate = function (board, placed, first) {
    if (!placed.length) return { err: L2('Lege mindestens einen Stein.', 'Place at least one tile.') };
    var seen = {};
    for (var i = 0; i < placed.length; i++) {
      var t = placed[i]; if (t.x < 0 || t.x > 14 || t.y < 0 || t.y > 14) return { err: L2('Außerhalb des Bretts.', 'Off the board.') };
      var k = t.y * 15 + t.x; if (board[k] || seen[k]) return { err: L2('Das Feld ist schon belegt.', 'That square is taken.') }; seen[k] = 1;
    }
    var rows = {}, cols = {}; placed.forEach(function (t) { rows[t.y] = 1; cols[t.x] = 1; });
    var horiz = Object.keys(rows).length === 1, vert = Object.keys(cols).length === 1;
    if (!horiz && !vert) return { err: L2('Alle Steine müssen in einer Reihe oder Spalte liegen.', 'All tiles must be in one row or column.') };
    if (placed.length === 1) { var t0 = placed[0], hN = (t0.x > 0 && board[t0.y * 15 + t0.x - 1]) || (t0.x < 14 && board[t0.y * 15 + t0.x + 1]); horiz = !!hN; vert = !hN; }
    var get = function (x, y) { if (x < 0 || x > 14 || y < 0 || y > 14) return null; var k2 = y * 15 + x; if (board[k2]) return board[k2]; return seen[k2] ? placed.find(function (p) { return p.x === x && p.y === y; }) : null; };
    var dx = horiz ? 1 : 0, dy = horiz ? 0 : 1;
    // Lückenlos?
    var xs = placed.map(function (p) { return horiz ? p.x : p.y; }), lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs), line = horiz ? placed[0].y : placed[0].x;
    for (var q = lo; q <= hi; q++) if (!(horiz ? get(q, line) : get(line, q))) return { err: L2('Die Steine müssen lückenlos zusammenhängen.', 'The tiles must be connected without gaps.') };
    if (first) {
      if (!seen[112]) return { err: L2('Das erste Wort muss über den Stern in der Mitte gehen.', 'The first word must cover the centre star.') };
      if (placed.length < 2) return { err: L2('Das erste Wort braucht mindestens 2 Buchstaben.', 'The first word needs at least 2 letters.') };
    } else {
      var touch = placed.some(function (p) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var x = p.x + d[0], y = p.y + d[1]; return x >= 0 && x < 15 && y >= 0 && y < 15 && board[y * 15 + x]; }); });
      if (!touch) return { err: L2('Das Wort muss an liegende Steine anschließen.', 'The word must connect to tiles on the board.') };
    }
    var words = [];
    function wordAt(x, y, ddx, ddy) {
      while (get(x - ddx, y - ddy)) { x -= ddx; y -= ddy; }
      var s = '', sum = 0, wm = 1, cells = [];
      while (get(x, y)) {
        var c = get(x, y), k3 = y * 15 + x, nw = !!seen[k3], lv = c.v;
        if (nw) { var pr = PREM[k3]; if (pr === 'DL') lv *= 2; else if (pr === 'TL') lv *= 3; else if (pr === 'DW') wm *= 2; else if (pr === 'TW') wm *= 3; }
        s += c.l; sum += lv; cells.push(k3); x += ddx; y += ddy;
      }
      return { w: s, score: sum * wm, cells: cells };
    }
    var main = wordAt(placed[0].x, placed[0].y, dx, dy);
    if (main.w.length >= 2) words.push(main);
    placed.forEach(function (p) { var cw = wordAt(p.x, p.y, dy, dx); if (cw.w.length >= 2) words.push(cw); });
    if (!words.length) return { err: L2('Es muss ein Wort mit mindestens 2 Buchstaben entstehen.', 'A word of at least 2 letters must be formed.') };
    var score = words.reduce(function (a, w) { return a + w.score; }, 0), bingo = placed.length === 7;
    if (bingo) score += 50;
    return { words: words, score: score, bingo: bingo };
  };

  // ---------- Computer: Zuggenerator (Anker, Kreuzprüfung, Präfixsuche im Wörterbuch) ----------
  E.genMoves = function (board, rack, lang, dict, first, budgetMs) {
    var has = function (s) { return WGDict.has(dict, s); }, pre = function (s) { return WGDict.hasPrefix(dict, s); };
    var LET = E.letters(lang), t0 = performance.now(), out = [], steps = 0, stop = false;
    var at = function (b, x, y) { return x < 0 || x > 14 || y < 0 || y > 14 ? null : b[y * 15 + x]; };
    for (var dir = 0; dir < 2 && !stop; dir++) {
      // dir 0: waagrecht, dir 1: senkrecht (über Koordinaten-Tausch)
      var get = dir === 0 ? function (r, c) { return at(board, c, r); } : function (r, c) { return at(board, r, c); };
      var xy = dir === 0 ? function (r, c) { return { x: c, y: r }; } : function (r, c) { return { x: r, y: c }; };
      for (var r = 0; r < 15 && !stop; r++) {
        // Kreuzprüfung je Feld der Zeile
        var cross = [], anchor = [];
        for (var c = 0; c < 15; c++) {
          if (get(r, c)) { cross.push(null); anchor.push(false); continue; }
          var up = '', dn = '', k = r - 1; while (k >= 0 && get(k, c)) { up = get(k, c).l + up; k--; }
          k = r + 1; while (k < 15 && get(k, c)) { dn += get(k, c).l; k++; }
          if (!up && !dn) cross.push(true);
          else { var ok = {}; LET.forEach(function (L) { if (has(up + L + dn)) ok[L] = 1; }); cross.push(ok); }
          anchor.push(first ? (r === 7 && c === 7) : !!(get(r, c - 1) || get(r, c + 1) || get(r - 1, c) || get(r + 1, c)));
        }
        for (var a = 0; a < 15 && !stop; a++) {
          if (!anchor[a]) continue;
          var rk = rack.slice();
          if (a > 0 && get(r, a - 1)) {
            var s = '', q = a - 1; while (q >= 0 && get(r, q)) { s = get(r, q).l + s; q--; }
            if (pre(s)) extend(r, a, s, rk, [], a);
          } else {
            var lim = 0, q2 = a - 1; while (q2 >= 0 && !get(r, q2) && !anchor[q2] && lim < rack.length - 1) { lim++; q2--; }
            left(r, a, '', rk, [], lim);
          }
        }
        function left(r, a, part, rk, pl, lim) {
          extend(r, a, part, rk, pl, a);
          if (lim <= 0 || stop) return;
          tryLetters(rk, function (L, rest, blank, id) {
            var np = part + L; if (!pre(np)) return;
            // Linke Steine rücken nach links: Positionen neu berechnen
            var pl2 = pl.map(function (t) { return { c: t.c - 1, l: t.l, b: t.b, id: t.id }; }); pl2.push({ c: a - 1, l: L, b: blank, id: id });
            left(r, a, np, rest, pl2, lim - 1);
          });
        }
        function extend(r, c, part, rk, pl, a) {
          if (stop) return;
          if (++steps % 512 === 0 && performance.now() - t0 > budgetMs) { stop = true; return; }
          if (c > 14 || !get(r, c)) {
            if (pl.length && c > a && part.length >= 2 && has(part)) out.push({ dir: dir, r: r, tiles: pl.map(function (t) { var p = xy(r, t.c); return { x: p.x, y: p.y, l: t.l, b: t.b, id: t.id }; }) });
            if (c > 14) return;
            var cr = cross[c];
            tryLetters(rk, function (L, rest, blank, id) {
              if (cr !== true && !(cr && cr[L])) return;
              var np = part + L; if (!pre(np)) return;
              extend(r, c + 1, np, rest, pl.concat([{ c: c, l: L, b: blank, id: id }]), a);
            });
          } else {
            var np2 = part + get(r, c).l; if (pre(np2)) extend(r, c + 1, np2, rk, pl, a);
          }
        }
      }
    }
    function tryLetters(rk, f) {
      var used = {};
      for (var i = 0; i < rk.length; i++) {
        var t = rk[i], rest = rk.slice(0, i).concat(rk.slice(i + 1));
        if (t.l === '?') { if (used['?']) continue; used['?'] = 1; for (var j = 0; j < LET.length; j++) f(LET[j], rest, true, t.id); }
        else { if (used[t.l]) continue; used[t.l] = 1; f(t.l, rest, false, t.id); }
      }
    }
    // Schritte zur Bewertung: linke Teile wurden vor dem Anker abgelegt; die Positionen stimmen schon
    return { moves: out, timedOut: stop };
  };
})();
