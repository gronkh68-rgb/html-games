/* Wortgitter: Wörterbuch (vorne komprimierte, sortierte Wortliste) mit Suche ohne große Zeichenketten.
   Quellen: all-the-german-words (MIT), an-array-of-english-words (MIT), aufbereitet: nur A–Z/ÄÖÜ, ß → SS, 2–15 Buchstaben. */
(function () {
  var D = window.WGDict = {};
  var cache = {};
  D.load = function (lang) {
    if (cache[lang]) return cache[lang];
    cache[lang] = fetch((lang === 'en' ? 'en' : 'de') + '.dic').then(function (r) { if (!r.ok) throw new Error('dict ' + r.status); return r.text(); }).then(function (txt) {
      var n = 1; for (var i = 0; i < txt.length; i++) if (txt.charCodeAt(i) === 10) n++;
      var buf = new Uint8Array(txt.length + 16 * n + 16), off = new Int32Array(n + 1), pos = 0, w = 0, prevStart = 0, i2 = 0;
      while (i2 < txt.length) {
        var p = txt.charCodeAt(i2) - 48; i2++;
        var start = pos;
        buf.copyWithin(pos, prevStart, prevStart + p); pos += p;
        while (i2 < txt.length) { var c = txt.charCodeAt(i2); i2++; if (c === 10) break; buf[pos++] = c; }
        off[w++] = start; prevStart = start;
      }
      off[w] = pos;
      return { buf: buf.subarray(0, pos), off: off, n: w };
    });
    return cache[lang];
  };
  // Vergleich: Wort (String) mit Eintrag k. <0: Wort kleiner, 0 gleich, >0 größer. prefix=true: Eintrag beginnt mit Wort zählt als gleich
  function cmp(d, k, s, prefix) {
    var a = d.off[k], b = d.off[k + 1], L = b - a;
    for (var i = 0; i < s.length; i++) {
      if (i >= L) return 1;
      var x = s.charCodeAt(i), y = d.buf[a + i];
      if (x !== y) return x - y;
    }
    return prefix ? 0 : (s.length === L ? 0 : -1);
  }
  function lower(d, s, prefix) { var lo = 0, hi = d.n; while (lo < hi) { var m = (lo + hi) >> 1; if (cmp(d, m, s, prefix) > 0) lo = m + 1; else hi = m; } return lo; }
  D.has = function (d, s) { var k = lower(d, s, false); return k < d.n && cmp(d, k, s, false) === 0; };
  D.hasPrefix = function (d, s) { var k = lower(d, s, true); return k < d.n && cmp(d, k, s, true) === 0; };
})();
