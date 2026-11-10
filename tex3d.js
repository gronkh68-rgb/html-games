/* Gezeichnete Texturen für 3D-Szenen (Filz, Holz). Alles entsteht im Programm, es werden keine Bilddateien geladen.
   Tex3D.felt(hex)          -> { map, bump }   Filz in der Farbe hex, nahtlos kachelbar (512 x 512)
   Tex3D.wood(kind)         -> { map, bump }   Holz: 'oak' (Eiche), 'walnut' (Nussbaum), 'dark' (dunkles Holz); Maserung läuft in x-Richtung, in x kachelbar
   Beide brauchen THREE (r128).  Ergebnisse werden zwischengespeichert.                                                   */
(function () {
  var T3 = window.Tex3D = {}, cache = {};
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  // Wertrauschen mit Gitter, das in x und y umläuft (dadurch kachelbar)
  function mkNoise(seed, px, py) {
    var r = rng(seed), g = []; for (var i = 0; i < px * py; i++) g.push(r());
    var sm = function (t) { return t * t * (3 - 2 * t); };
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
      var x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
      var a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    };
  }
  function hexRgb(h) { var n = parseInt(String(h).replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mkTex(cv, srgb) { var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------- Filz ----------
  T3.felt = function (hex) {
    hex = hex || '#1f6b4d'; var key = 'f' + hex; if (cache[key]) return cache[key];
    var S = 512, c = canvas(S, S), x = c.getContext('2d'), im = x.createImageData(S, S), d = im.data, base = hexRgb(hex);
    var n1 = mkNoise(11, 6, 6), n2 = mkNoise(23, 24, 24), n3 = mkNoise(37, 96, 96), r = rng(5), lum = new Float32Array(S * S);
    for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
      var u = i / S, v = j / S;
      var l = (n1(u * 6, v * 6) - .5) * .12 + (n2(u * 24, v * 24) - .5) * .07 + (n3(u * 96, v * 96) - .5) * .05 + (r() - .5) * .06;      // Wolken (Flor), Büschel, feine Körnung
      lum[j * S + i] = l; var k = (j * S + i) * 4, f = 1 + l;
      d[k] = Math.max(0, Math.min(255, base[0] * f)); d[k + 1] = Math.max(0, Math.min(255, base[1] * f)); d[k + 2] = Math.max(0, Math.min(255, base[2] * f)); d[k + 3] = 255;
    }
    x.putImageData(im, 0, 0);
    // Fasern: kurze helle und dunkle Striche, an den Rändern umlaufend
    x.lineWidth = 1; x.lineCap = 'round';
    var fr = rng(99), draw = function (px, py, a, len, light) {
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var bx = px + ox * S, by = py + oy * S; if (bx < -10 || by < -10 || bx > S + 10 || by > S + 10) continue;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len); x.stroke();
      }
    };
    for (var q = 0; q < 5200; q++) { var li = fr() < .5; x.strokeStyle = li ? 'rgba(255,255,255,' + (.03 + fr() * .04) + ')' : 'rgba(0,0,0,' + (.04 + fr() * .05) + ')'; draw(fr() * S, fr() * S, fr() * 6.283, 3 + fr() * 6, li); }
    var bc = canvas(S, S), bx2 = bc.getContext('2d'), bi = bx2.createImageData(S, S);
    for (var p = 0; p < S * S; p++) { var g = Math.max(0, Math.min(255, 128 + lum[p] * 300)); bi.data[p * 4] = bi.data[p * 4 + 1] = bi.data[p * 4 + 2] = g; bi.data[p * 4 + 3] = 255; }
    bx2.putImageData(bi, 0, 0);
    return cache[key] = { map: mkTex(c), bump: mkTex(bc) };
  };

  // ---------- Holz ----------
  var WOODS = {
    oak: { a: [196, 150, 96], b: [142, 98, 56], ring: [112, 74, 40], planks: 2 },
    walnut: { a: [112, 74, 48], b: [72, 44, 28], ring: [46, 26, 16], planks: 2 },
    dark: { a: [74, 52, 38], b: [44, 28, 20], ring: [26, 15, 10], planks: 2 }
  };
  T3.woodKinds = Object.keys(WOODS);
  T3.wood = function (kind) {
    kind = WOODS[kind] ? kind : 'oak'; var key = 'w' + kind; if (cache[key]) return cache[key];
    var W = 1024, H = 512, P = WOODS[kind], c = canvas(W, H), x = c.getContext('2d'), im = x.createImageData(W, H), d = im.data, lum = new Float32Array(W * H);
    var nw = mkNoise(7, 4, 6), nf = mkNoise(19, 8, 96), nr = mkNoise(31, 16, 40), nk = mkNoise(43, 5, 3), r = rng(17), plankH = H / P.planks;
    var knots = []; for (var k = 0; k < 3; k++) knots.push({ x: r() * W, y: (k + .5) / 3 * H + (r() - .5) * 60, rx: 30 + r() * 26, ry: 12 + r() * 10 });
    for (var j = 0; j < H; j++) {
      var pi = Math.floor(j / plankH), jy = j - pi * plankH, po = pi * 137 + 40;       // jede Bohle hat ihren eigenen Versatz und Farbton
      for (var i = 0; i < W; i++) {
        var u = i / W, ww = nw(u * 4 + pi * .7, (j / H) * 6) * 2.4;                    // sanftes Wellen der Jahresringe
        var kn = 0; for (var q = 0; q < knots.length; q++) { var dx = (i - knots[q].x); if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; var dy = j - knots[q].y, e = (dx * dx) / (knots[q].rx * knots[q].rx) + (dy * dy) / (knots[q].ry * knots[q].ry); if (e < 9) kn += Math.exp(-e * .45); }
        var rings = (jy / plankH) * 9 + ww + kn * 1.7 + po * .01, ringV = Math.pow(.5 + .5 * Math.sin(rings * 6.283), 2.2);
        var fine = nf(u * 8 + po, jy * .6) , pore = nr(u * 16, jy * .35);                // Poren und Streifen entlang der Faser
        var t = Math.max(0, Math.min(1, ringV * .55 + (fine - .5) * .5 + (pore - .5) * .35 + .22 + (nk(u * 5, pi) - .5) * .3));
        var rr = P.b[0] + (P.a[0] - P.b[0]) * t, gg = P.b[1] + (P.a[1] - P.b[1]) * t, bb = P.b[2] + (P.a[2] - P.b[2]) * t;
        var dark = Math.min(1, kn * .5 + (pore < .3 ? (.3 - pore) * 1.2 : 0)); rr += (P.ring[0] - rr) * dark; gg += (P.ring[1] - gg) * dark; bb += (P.ring[2] - bb) * dark;
        var seam = jy < 3 || jy > plankH - 4 ? .45 : 1; var k2 = (j * W + i) * 4; // Fuge zwischen den Bohlen
        d[k2] = rr * seam; d[k2 + 1] = gg * seam; d[k2 + 2] = bb * seam; d[k2 + 3] = 255; lum[j * W + i] = (t - .5) * .8 - dark * .5 - (seam < 1 ? .4 : 0);
      }
    }
    x.putImageData(im, 0, 0);
    var bc = canvas(W, H), bx = bc.getContext('2d'), bi = bx.createImageData(W, H);
    for (var p = 0; p < W * H; p++) { var g = Math.max(0, Math.min(255, 128 + lum[p] * 240)); bi.data[p * 4] = bi.data[p * 4 + 1] = bi.data[p * 4 + 2] = g; bi.data[p * 4 + 3] = 255; }
    bx.putImageData(bi, 0, 0);
    return cache[key] = { map: mkTex(c), bump: mkTex(bc) };
  };
})();
