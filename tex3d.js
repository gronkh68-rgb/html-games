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
    oak: { a: [206, 168, 120], b: [152, 108, 66], ring: [108, 72, 42], planks: 2 },
    walnut: { a: [128, 84, 54], b: [74, 44, 26], ring: [40, 22, 13], planks: 2 },
    dark: { a: [86, 60, 42], b: [44, 28, 20], ring: [22, 12, 8], planks: 2 }
  };
  T3.woodKinds = Object.keys(WOODS);
  T3.wood = function (kind) {
    kind = WOODS[kind] ? kind : 'oak'; var key = 'w' + kind; if (cache[key]) return cache[key];
    var W = 1024, H = 512, P = WOODS[kind], c = canvas(W, H), x = c.getContext('2d'), im = x.createImageData(W, H), d = im.data, lum = new Float32Array(W * H);
    var nw = mkNoise(7, 3, 5), nw2 = mkNoise(13, 6, 14), nf = mkNoise(19, 3, 120), nf2 = mkNoise(29, 64, 40), np = mkNoise(31, 48, 100), nt = mkNoise(43, 2, 4), r = rng(17), plankH = H / P.planks;
    var knots = []; for (var k = 0; k < 2; k++) knots.push({ x: r() * W, y: (k + .5) / 2 * H + (r() - .5) * 50, rx: 34 + r() * 20, ry: 11 + r() * 7 });
    var sm = function (e0, e1, v) { var q = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return q * q * (3 - 2 * q); };
    var mix = function (a, b, q) { return a + (b - a) * q; };
    for (var j = 0; j < H; j++) {
      var pi = Math.floor(j / plankH), jy = j - pi * plankH, ph = jy / plankH, tone = (nt(pi * 1.7 + .3, 1) - .5) * .5;       // jede Bohle hat ihren eigenen Farbton
      for (var i = 0; i < W; i++) {
        var u = i / W;
        // Maserung: lange, ruhig geschwungene Linien (Wellen laufen langsam in x, schnell in y)
        var warp = (nw(u * 3 + pi * 1.3, ph * 3) - .5) * 1.9 + (nw2(u * 6 + pi * .6, ph * 12) - .5) * .5;
        var kn = 0, ke = 99;
        for (var q = 0; q < knots.length; q++) { var dx = i - knots[q].x; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; var dy = j - knots[q].y, e = (dx * dx) / (knots[q].rx * knots[q].rx) + (dy * dy) / (knots[q].ry * knots[q].ry); if (e < 12) kn += Math.exp(-e * .35) * (dy > 0 ? 1 : -1) * 1.1; if (e < ke) ke = e; }
        var v = ph * 5.5 + warp * 1.1 + kn, f = v - Math.floor(v);
        var ring = Math.pow(f, 4.5);                                           // Jahresring: weich dunkler werdend, dann abrupt hell (Frühholz/Spätholz)
        var stri = (nf(u * 3, jy * 2.4) - .5) * .15 + (nf2(u * 40, jy * .9) - .5) * .06;      // feine Streifen entlang der Faser
        var pore = np(u * 48, jy * .55) > .86 ? .2 : 0;                           // kleine dunkle Poren
        var tt = Math.max(0, Math.min(1, ring * .75 + stri + .12 + tone * .3));
        var kd = ke < 1.2 ? (1.2 - ke) * .6 : 0;                                    // Ast: dunkle Mitte
        var rr = mix(P.a[0], P.b[0], tt), gg = mix(P.a[1], P.b[1], tt), bb = mix(P.a[2], P.b[2], tt);
        var dark = Math.min(.85, pore + kd); rr = mix(rr, P.ring[0], dark); gg = mix(gg, P.ring[1], dark); bb = mix(bb, P.ring[2], dark);
        var edge = jy < 2 ? .35 : jy < 3 ? .6 : jy > plankH - 3 ? 1.12 : 1;       // Fuge zwischen den Bohlen mit heller Kante
        var br = 1 + tone * .25, k2 = (j * W + i) * 4;
        d[k2] = Math.min(255, rr * edge * br); d[k2 + 1] = Math.min(255, gg * edge * br); d[k2 + 2] = Math.min(255, bb * edge * br); d[k2 + 3] = 255;
        lum[j * W + i] = (.5 - tt) * .9 - dark * .5 - (edge < 1 ? .5 : 0) + stri * .6;
      }
    }
    x.putImageData(im, 0, 0);
    var bc = canvas(W, H), bx = bc.getContext('2d'), bi = bx.createImageData(W, H);
    for (var p = 0; p < W * H; p++) { var g = Math.max(0, Math.min(255, 128 + lum[p] * 200)); bi.data[p * 4] = bi.data[p * 4 + 1] = bi.data[p * 4 + 2] = g; bi.data[p * 4 + 3] = 255; }
    bx.putImageData(bi, 0, 0);
    return cache[key] = { map: mkTex(c), bump: mkTex(bc) };
  };
})();
