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
  // Holz-Generator. W x H Pixel, planks Bohlen übereinander, seed = Zufallsmuster, xs = Streckung der Maserung in Faserrichtung (1 = Kachel 1024 px)
  function genWood(kind, W, H, planks, seed, xs) {
    var P = WOODS[kind], c = canvas(W, H), x = c.getContext('2d'), im = x.createImageData(W, H), d = im.data, lum = new Float32Array(W * H);
    var mk = function (sd, fx, fy) { var n = Math.max(1, Math.round(fx * xs)), f = mkNoise(seed * 977 + sd, n, fy); return function (u, y) { return f(u * n, y); }; };
    var nw = mk(7, 3, 5), nw2 = mk(13, 6, 14), nf = mk(19, 3, 120), nf2 = mk(29, 64, 40), np = mk(31, 48, 100), nt = mkNoise(seed * 977 + 43, 2, 4), r = rng(seed * 31 + 17), plankH = H / planks;
    var knots = [], kn0 = Math.max(1, Math.round(2 * xs * (H / plankH) * .5)); for (var k = 0; k < kn0; k++) knots.push({ x: r() * W, y: r() * H, rx: (34 + r() * 20) * W / (1024 * xs), ry: 11 + r() * 7 });
    var mix = function (a, b, q) { return a + (b - a) * q; };
    for (var j = 0; j < H; j++) {
      var pi = Math.floor(j / plankH), jy = j - pi * plankH, ph = jy / plankH, tone = (nt(pi * 1.7 + .3 + seed * .37, 1) - .5) * .5, sp = seed * 3.1;
      for (var i = 0; i < W; i++) {
        var u = i / W;
        var warp = (nw(u, ph * 3 + pi * 1.3 + sp) - .5) * 1.9 + (nw2(u, ph * 12 + pi * .6 + sp) - .5) * .5;
        var kn = 0, ke = 99;
        for (var q = 0; q < knots.length; q++) { var dx = i - knots[q].x; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; var dy = j - knots[q].y, e = (dx * dx) / (knots[q].rx * knots[q].rx) + (dy * dy) / (knots[q].ry * knots[q].ry); if (e < 12) kn += Math.exp(-e * .35) * (dy > 0 ? 1 : -1) * 1.1; if (e < ke) ke = e; }
        var v = ph * 5.5 + warp * 1.1 + kn + seed * .23, f = v - Math.floor(v);
        var ring = Math.pow(f, 4.5);                                           // Jahresring: weich dunkler werdend, dann abrupt hell (Frühholz/Spätholz)
        var stri = (nf(u, jy * 2.4 / 1 + sp) - .5) * .15 + (nf2(u, jy * .9 + sp) - .5) * .06;      // feine Streifen entlang der Faser
        var pore = np(u, jy * .55 + sp) > .86 ? .2 : 0;                            // kleine dunkle Poren
        var tt = Math.max(0, Math.min(1, ring * .75 + stri + .12 + tone * .3));
        var kd = ke < 1.2 ? (1.2 - ke) * .6 : 0;                                    // Ast: dunkle Mitte
        var rr = mix(P.a[0], P.b[0], tt), gg = mix(P.a[1], P.b[1], tt), bb = mix(P.a[2], P.b[2], tt);
        var dark = Math.min(.85, pore + kd); rr = mix(rr, P.ring[0], dark); gg = mix(gg, P.ring[1], dark); bb = mix(bb, P.ring[2], dark);
        var edge = planks < 2 ? 1 : (jy < 2 ? .35 : jy < 3 ? .6 : jy > plankH - 3 ? 1.12 : 1);       // Fuge zwischen den Bohlen mit heller Kante
        var br = 1 + tone * .25, k2 = (j * W + i) * 4;
        d[k2] = Math.min(255, rr * edge * br); d[k2 + 1] = Math.min(255, gg * edge * br); d[k2 + 2] = Math.min(255, bb * edge * br); d[k2 + 3] = 255;
        lum[j * W + i] = (.5 - tt) * .9 - dark * .5 - (edge < 1 ? .5 : 0) + stri * .6;
      }
    }
    x.putImageData(im, 0, 0);
    var bc = canvas(W, H), bx = bc.getContext('2d'), bi = bx.createImageData(W, H);
    for (var p = 0; p < W * H; p++) { var g = Math.max(0, Math.min(255, 128 + lum[p] * 200)); bi.data[p * 4] = bi.data[p * 4 + 1] = bi.data[p * 4 + 2] = g; bi.data[p * 4 + 3] = 255; }
    bx.putImageData(bi, 0, 0);
    return { map: mkTex(c), bump: mkTex(bc) };
  }
  // Kachel für große Flächen (Tisch): in x nahtlos
  T3.wood = function (kind) {
    kind = WOODS[kind] ? kind : 'oak'; var key = 'w' + kind; return cache[key] || (cache[key] = genWood(kind, 1024, 512, 2, 0, 1));
  };
  // Eine einzelne Leiste (Rand): jede bekommt ihr eigenes Maserungsmuster, ohne Wiederholung in Faserrichtung.
  // len x h Einheiten (Faser läuft entlang len); seed bestimmt das Muster
  T3.woodBoard = function (kind, len, h, seed) {
    kind = WOODS[kind] ? kind : 'oak'; var key = 'b' + kind + len + 'x' + h + 's' + seed;
    if (cache[key]) return cache[key];
    var t = genWood(kind, Math.min(2048, Math.round(len * 120)), Math.max(96, Math.round(h * 120)), 1, seed + 1, Math.max(.4, len / 4.6));
    t.map.wrapS = t.map.wrapT = t.bump.wrapS = t.bump.wrapT = THREE.ClampToEdgeWrapping; return cache[key] = t;
  };
  // Quader mit Maserung aus T3.woodBoard: Länge entlang x, jede Seite zeigt einen anderen Ausschnitt (kein Spiegeln, keine Wiederholung)
  T3.woodBox = function (kind, len, h, dep, seed, extra) {
    var tex = T3.woodBoard(kind, len, h, seed), g = new THREE.BoxGeometry(len, h, dep), uv = g.attributes.uv, i, f, vv;
    // Seiten: px, nx, py, ny, pz, nz (je 4 Ecken)
    for (f = 0; f < 6; f++) for (i = 0; i < 4; i++) {
      var k = f * 4 + i, u0 = uv.getX(k), v0 = uv.getY(k), s = dep / h;
      if (f < 2) { uv.setXY(k, u0 * (dep / len), v0); }                        // Stirnseiten: kurzer Ausschnitt vom Anfang
      else if (f < 4) { uv.setXY(k, f === 2 ? u0 : 1 - u0, .04 + v0 * Math.min(.92, s)); }              // oben/unten: schmaler Streifen
      else { uv.setXY(k, f === 4 ? u0 : 1 - u0, f === 4 ? v0 : 1 - v0); }      // lange Außen-/Innenseite: Außen normal, Innen gedreht (anderer Ausschnitt)
    }
    uv.needsUpdate = true;
    var m = new THREE.MeshStandardMaterial(Object.assign({ map: tex.map, bumpMap: tex.bump, bumpScale: 1.1, roughness: .55 }, extra || {}));
    return new THREE.Mesh(g, m);
  };
})();
