/* Echte Würfelphysik: Wurf per Maus/Finger, das Ergebnis kommt aus der Physik (cannon-es).
   Ablauf für alle Spiele gleich:
     1. Wer würfelt, zieht den Würfel (View.drag) und lässt los -> Wurfdaten (Position, Geschwindigkeit, Drehung).
     2. Die Instanz, die das Ergebnis bestimmt (Host/Einzelspiel), rechnet D.simulate(params) -> { v:[Werte], track }.
     3. Alle Geräte spielen dieselbe Bahn mit View.play(track) ab, deshalb sehen alle denselben Wurf.
   Benötigt three.js (r128) und cannon-es; beides wird bei Bedarf nachgeladen.

   const view = Dice3D.view(containerEl);          // Überlagerung über dem Container
   const p = await view.drag(2);                   // 2 Würfel zum Werfen ziehen -> Wurfdaten (oder view.auto(2) für einen Zufallswurf)
   const r = await Dice3D.simulate(p);             // { v:[3,5], track }
   await view.play(r.track);                       // Würfel rollen lassen und liegen lassen                              */
(function () {
  var D = window.Dice3D = {};
  var CANNON_URL = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var C = null, loadP = null;
  var HALF = 0.5, TX = 4.3, TZ = 6.2, G = -42, DT = 1 / 60, EVERY = 2;      // Würfelkante 1, Tablett 8,6 x 12,4 (Schuss von unten nach oben)
  var FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], FACE_V = [3, 4, 1, 6, 2, 5];   // Reihenfolge der BoxGeometry-Seiten
  function load(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); }; document.head.appendChild(s); }); }
  D.ready = function () {
    if (loadP) return loadP;
    loadP = Promise.all([window.THREE ? 0 : load(THREE_URL), import(CANNON_URL).then(function (m) { C = m; })]);
    return loadP;
  };
  // Wurffläche anpassen (Halbbreite/-tiefe in Würfelkanten); vor dem ersten Würfel-Rig aufrufen. Standard: Tablett 4,3 x 6,2. Die Seite bestimmt es einheitlich für Host und Mitspieler.
  D.setArea = function (tx, tz) { TX = tx; TZ = tz; ANCH_Z = TZ - 1.7; ASP = (TX * 2 + 2.8) / (TZ * 2 + 2.8); MAXP = Math.max(4.6, TZ * .72); };
  D.setCannon = function (m) { C = m; };          // für Tests ohne Netz
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  function randQ() { var u = Math.random(), v = Math.random(), w = Math.random(); return [Math.sqrt(1 - u) * Math.sin(2 * Math.PI * v), Math.sqrt(1 - u) * Math.cos(2 * Math.PI * v), Math.sqrt(u) * Math.sin(2 * Math.PI * w), Math.sqrt(u) * Math.cos(2 * Math.PI * w)]; }
  function topFace(q) {         // Welche Seite zeigt nach oben? -> {v, d (Ausrichtung 0..1)}
    var x = q[0], y = q[1], z = q[2], w = q[3], best = -2, bv = 1;
    for (var i = 0; i < 6; i++) {
      var n = FACE_N[i], tx = n[0], ty = n[1], tz = n[2];
      // y-Komponente von q * n
      var cx = y * tz - z * ty, cy = z * tx - x * tz;                                    // q.xyz x n (x und y)
      var cy2 = z * cx - x * (x * ty - y * tx);                                          // y von q.xyz x (q.xyz x n)
      var ry = ty + 2 * (w * cy + cy2);
      if (ry > best) { best = ry; bv = FACE_V[i]; }
    }
    return { v: bv, d: best };
  }
  D.topFace = topFace;

  // ---------- Wurfdaten ----------
  // params: { dice: [ { p:[x,y,z], q:[x,y,z,w], v:[x,y,z], w:[x,y,z] } ] }
  D.autoParams = function (n) {
    var d = [];
    for (var i = 0; i < n; i++) {
      var ang = rnd(-.45, .45), sp = rnd(14, 38), x = (i - (n - 1) / 2) * 1.55 + rnd(-.3, .3), z = TZ - 1.7;
      d.push({ p: [x, .9, z], q: randQ(), v: [Math.sin(ang) * sp, rnd(-2, 2), -Math.cos(ang) * sp], w: [rnd(-20, 20), rnd(-20, 20), rnd(-20, 20)] });
    }
    return { dice: d };
  };
  D.clean = function (p, n) {       // Eingaben von Mitspielern prüfen und begrenzen
    if (!p || !Array.isArray(p.dice) || p.dice.length !== n) return null;
    var fin = function (a, k) { return Array.isArray(a) && a.length === k && a.every(function (x) { return typeof x === 'number' && isFinite(x); }); };
    var cl = function (x, m) { return Math.max(-m, Math.min(m, x)); };
    var out = [];
    for (var i = 0; i < n; i++) {
      var d = p.dice[i]; if (!d || !fin(d.p, 3) || !fin(d.q, 4) || !fin(d.v, 3) || !fin(d.w, 3)) return null;
      var ql = Math.hypot(d.q[0], d.q[1], d.q[2], d.q[3]) || 1;
      out.push({ p: [cl(d.p[0], TX - .6), cl(d.p[1], 3), cl(d.p[2], TZ - .6)], q: d.q.map(function (x) { return x / ql; }), v: [cl(d.v[0], 45), cl(d.v[1], 15), cl(d.v[2], 45)], w: [cl(d.w[0], 60), cl(d.w[1], 60), cl(d.w[2], 60)] });
    }
    return { dice: out };
  };

  // ---------- Simulation ----------
  // obs (optional): feste Hindernisse [x, z, Radius, Höhe] in Tablett-Koordinaten (z. B. Spielfiguren und Mittelobjekte), an denen die Würfel abprallen
  D.simulate = async function (params, obs) {
    await D.ready();
    var n = params.dice.length, world = new C.World({ gravity: new C.Vec3(0, G, 0) });
    world.allowSleep = false; world.solver.iterations = 24;
    var mDie = new C.Material('die'), mFloor = new C.Material('floor'), mWall = new C.Material('wall');
    world.addContactMaterial(new C.ContactMaterial(mDie, mFloor, { friction: .3, restitution: .5 }));      // Boden: federt spürbar
    world.addContactMaterial(new C.ContactMaterial(mDie, mWall, { friction: .1, restitution: .8 }));       // Ränder: sehr federnd wie Gummibanden
    world.addContactMaterial(new C.ContactMaterial(mDie, mDie, { friction: .22, restitution: .5 }));
    var mObs = new C.Material('obs'); world.addContactMaterial(new C.ContactMaterial(mDie, mObs, { friction: .35, restitution: .42 }));
    function wall(hx, hy, hz, x, y, z, mat) { var b = new C.Body({ mass: 0, material: mat || mWall }); b.addShape(new C.Box(new C.Vec3(hx, hy, hz))); b.position.set(x, y, z); world.addBody(b); }
    wall(TX + 2, .5, TZ + 2, 0, -.5, 0, mFloor);         // Boden (Oberkante y=0)
    wall(.5, 5, TZ + 2, TX + .5, 5, 0); wall(.5, 5, TZ + 2, -TX - .5, 5, 0); wall(TX + 2, 5, .5, 0, 5, TZ + .5); wall(TX + 2, 5, .5, 0, 5, -TZ - .5); wall(TX + 2, .5, TZ + 2, 0, 10.5, 0);   // Wände und Decke
    (obs || []).forEach(function (o) {      // Figur = große Kugel unten und kleinere oben (kegelartig)
      var b = new C.Body({ mass: 0, material: mObs }), r = o[2];
      b.addShape(new C.Sphere(r), new C.Vec3(0, r, 0)); if (o[3] > r * 2.2) { b.addShape(new C.Sphere(r * .72), new C.Vec3(0, o[3] - r * .72, 0)); if (o[3] > r * 3.4) b.addShape(new C.Sphere(r * .85), new C.Vec3(0, (r + o[3]) / 2 - r * .1, 0)); }
      b.position.set(o[0], 0, o[1]); world.addBody(b);
    });
    var bodies = params.dice.map(function (d) {
      var b = new C.Body({ mass: 1, material: mDie, linearDamping: .06, angularDamping: .10 });
      b.addShape(new C.Box(new C.Vec3(HALF, HALF, HALF)));
      b.position.set(d.p[0], d.p[1], d.p[2]); b.quaternion.set(d.q[0], d.q[1], d.q[2], d.q[3]);
      b.velocity.set(d.v[0], d.v[1], d.v[2]); b.angularVelocity.set(d.w[0], d.w[1], d.w[2]);
      world.addBody(b); return b;
    });
    var frames = [], step = 0, calm = 0, rerolls = 0, maxSteps = 60 * 6, res = null;
    function rec() { var f = []; bodies.forEach(function (b) { f.push(+b.position.x.toFixed(2), +b.position.y.toFixed(2), +b.position.z.toFixed(2), +b.quaternion.x.toFixed(3), +b.quaternion.y.toFixed(3), +b.quaternion.z.toFixed(3), +b.quaternion.w.toFixed(3)); }); frames.push(f); }
    var topOf = function (b) { return topFace([b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]); };
    rec();
    while (step < maxSteps) {
      world.step(DT); step++;
      if (step % EVERY === 0) rec();
      // "Ruhig" zählt nur die Geschwindigkeit: Ein schräg lehnender Würfel liegt höher als ein flacher und darf trotzdem nicht ewig warten
      var still = bodies.every(function (b) { return b.velocity.length() < .15 && b.angularVelocity.length() < .3; });
      calm = still ? calm + 1 : 0;
      if (calm > 14) {
        var tf = bodies.map(topOf);
        if (tf.every(function (t) { return t.d > .985; })) { res = tf.map(function (t) { return t.v; }); break; }
        // Schräg liegen geblieben (lehnt an Wand oder anderem Würfel): wie am echten Tisch sofort neu anstoßen
        if (rerolls++ < 2) { bodies.forEach(function (b, i) { if (tf[i].d <= .985) { b.velocity.set(rnd(-2.5, 2.5), 6.5, rnd(-2.5, 2.5)); b.angularVelocity.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)); } }); calm = 0; }
        else break;
      }
    }
    if (!res) {
      // Immer noch nicht flach (oder nach 8 s noch in Bewegung): kippt in die nächstliegende flache Lage ein, statt das Spiel warten zu lassen
      var tf2 = bodies.map(topOf);
      if (tf2.some(function (t) { return t.d <= .985; })) {
        var starts = bodies.map(function (b) { return { p: b.position.clone(), q: b.quaternion.clone() }; });
        var targets = bodies.map(function (b) {
          var q = b.quaternion, t = topOf(b), best = 0, bd = -2;
          for (var i = 0; i < 6; i++) { var nn = q.vmult(new C.Vec3(FACE_N[i][0], FACE_N[i][1], FACE_N[i][2])); if (nn.y > bd) { bd = nn.y; best = nn; } }
          var r = new C.Quaternion(); r.setFromVectors(best, new C.Vec3(0, 1, 0)); var tq = r.mult(q); tq.normalize(); return tq;
        });
        for (var f = 1; f <= 14; f++) {
          var u = f / 14, e = u * u * (3 - 2 * u);
          bodies.forEach(function (b, i) { var q = new C.Quaternion(); starts[i].q.slerp(targets[i], e, q); b.quaternion.copy(q); b.position.set(starts[i].p.x, starts[i].p.y + (HALF - starts[i].p.y) * e, starts[i].p.z); });
          rec(); rec();
        }
      }
      res = bodies.map(function (b) { return topOf(b).v; });
    }
    // Endlage ein letztes Mal exakt festhalten
    rec(); rec();
    return { v: res, track: { n: n, hz: 60 / EVERY, f: frames } };
  };

  function lum(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (.299 * r + .587 * g + .114 * b) / 255; }
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255, m = f > 0 ? 255 : 0, a = Math.abs(f); return 'rgb(' + Math.round(r + (m - r) * a) + ',' + Math.round(g + (m - g) * a) + ',' + Math.round(b + (m - b) * a) + ')'; }
  // Würfelseite; hex = Spielerfarbe (oder null für den neutralen Würfel)
  function faceTex(v, cyber, size, hex, sk) {      // sk: festes Design aus dem Profil (Farbverlauf, Augenfarbe), sonst Spielerfarbe oder Elfenbein
    var cv = document.createElement('canvas'); cv.width = cv.height = size; var x = cv.getContext('2d');
    var P = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.28, .28], [.5, .5], [.72, .72]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]], 6: [[.28, .25], [.72, .25], [.28, .5], [.72, .5], [.28, .75], [.72, .75]] };
    if (cyber) {      // Cyber: große Zahl statt Augen, Leuchtrand mit Eckmarken
      var col = hex || '#00f0ff';
      x.fillStyle = '#070d19'; x.fillRect(0, 0, size, size);
      var gr = x.createRadialGradient(size / 2, size / 2, size * .05, size / 2, size / 2, size * .7); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, size, size);
      x.shadowColor = col; x.shadowBlur = size * .07; x.strokeStyle = col; x.lineWidth = size * .045; x.strokeRect(size * .035, size * .035, size * .93, size * .93);
      x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.globalAlpha = .55; x.lineWidth = size * .012; x.strokeRect(size * .035, size * .035, size * .93, size * .93); x.globalAlpha = 1;
      x.strokeStyle = col; x.lineWidth = size * .03; var cl = size * .16, m0 = size * .1;       // Eckwinkel innen
      [[m0, m0, 1, 1], [size - m0, m0, -1, 1], [m0, size - m0, 1, -1], [size - m0, size - m0, -1, -1]].forEach(function (c) { x.beginPath(); x.moveTo(c[0] + c[2] * cl, c[1]); x.lineTo(c[0], c[1]); x.lineTo(c[0], c[1] + c[3] * cl); x.stroke(); });
      x.font = '900 ' + Math.round(size * .6) + 'px Orbitron, "Share Tech Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      var ty = size * .535;
      x.shadowColor = col; x.shadowBlur = size * .12; x.fillStyle = col; x.fillText(String(v), size / 2, ty);
      x.shadowBlur = size * .03; x.fillStyle = '#f4ffff'; x.fillText(String(v), size / 2, ty); x.shadowBlur = 0;
      if (v === 6) { x.fillStyle = '#f4ffff'; x.shadowColor = col; x.shadowBlur = size * .05; x.fillRect(size * .36, size * .86, size * .28, size * .04); x.shadowBlur = 0; }      // Strich unter der 6, damit sie nicht mit der 9 verwechselt wird
      var tc = new THREE.CanvasTexture(cv); tc.anisotropy = 4; return tc;
    }
    var pip;
    if (sk) { var g3 = x.createLinearGradient(0, 0, size, size); g3.addColorStop(0, sk.bg[0]); g3.addColorStop(1, sk.bg[1]); x.fillStyle = g3; x.fillRect(0, 0, size, size); x.strokeStyle = sk.edge; x.lineWidth = size * .035; x.strokeRect(size * .018, size * .018, size * .964, size * .964); pip = v === 1 ? sk.one : sk.pip; }
    else if (hex) { var g2 = x.createLinearGradient(0, 0, size, size); g2.addColorStop(0, shade(hex, .18)); g2.addColorStop(1, shade(hex, -.12)); x.fillStyle = g2; x.fillRect(0, 0, size, size); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = size * .03; x.strokeRect(size * .015, size * .015, size * .97, size * .97); pip = lum(hex) > .62 ? '#16161c' : '#ffffff'; }
    else { var g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#ece3c8'); x.fillStyle = g; x.fillRect(0, 0, size, size); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = size * .03; x.strokeRect(size * .015, size * .015, size * .97, size * .97); pip = null; }
    P[v].forEach(function (p) {
      x.beginPath(); x.arc(p[0] * size, p[1] * size, size * (v === 1 ? .12 : .085), 0, 7);
      x.fillStyle = pip || (v === 1 ? '#c62828' : '#16161c');
      x.fill();
    });
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  // Rechenwürfel: ein normaler Würfel, dessen Seiten 1 bis 4 die Rechenzeichen +2, -2, x2, geteilt durch 2 zeigen (die Seiten 5 und 6 kommen nie nach oben: die Seite, die das Spiel auswertet, ist immer 1 bis 4)
  var OPS = ['+2', '\u22122', '\u00d72', '\u00f72'];
  D.OPS = OPS;
  function modTex(v, size) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size; var x = cv.getContext('2d');
    var g = x.createRadialGradient(size / 2, size / 2, size * .1, size / 2, size / 2, size * .75); g.addColorStop(0, '#4a3208'); g.addColorStop(1, '#1d1304'); x.fillStyle = g; x.fillRect(0, 0, size, size);
    x.strokeStyle = '#ffd23f'; x.lineWidth = size * .045; x.strokeRect(size * .035, size * .035, size * .93, size * .93);
    x.font = '900 ' + Math.round(size * (OPS[(v - 1) % 4].length > 2 ? .44 : .5)) + 'px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ffd23f'; x.shadowBlur = size * .05; x.fillStyle = '#fff3c4'; x.fillText(OPS[(v - 1) % 4], size / 2, size * .53);
    var t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
  }
  // ---------- Darstellung: Tablett als Dock neben dem Spielfeld, Kamerafahrt nur beim eigenen Wurf ----------
  var ASP = (TX * 2 + 2.8) / (TZ * 2 + 2.8), MAXP = 4.6, ANCH_Z = TZ - 1.7;
  var cssDone = false;
  function addCss() {
    if (cssDone) return; cssDone = true;
    var st = document.createElement('style');
    st.textContent = '.dice-wrap{position:absolute;inset:0;border-radius:14px;overflow:hidden;background:rgba(8,12,22,.55);border:2px solid rgba(255,255,255,.18);box-shadow:0 6px 20px rgba(0,0,0,.45)}' +
      '.dice-wrap canvas{display:block;width:100%;height:100%;touch-action:none}' +
      '.dice-wrap .dh{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:3;pointer-events:none;background:rgba(10,14,30,.9);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:6px 10px;font:700 12px system-ui,sans-serif;text-align:center;display:none;width:88%}' +
      '.dice-wrap.big .dh{font-size:15px;padding:8px 14px;width:auto;max-width:92%}' +
      '.dice-wrap .dbtn{position:absolute;left:50%;bottom:54px;transform:translateX(-50%);z-index:4;font:600 13px system-ui,sans-serif;color:#fff;background:rgba(40,46,70,.95);border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:7px 14px;cursor:pointer}' +
      '#diceBackdrop{position:fixed;inset:0;z-index:899;background:rgba(5,8,18,.6);opacity:0;transition:opacity .35s;pointer-events:auto}';
    document.head.appendChild(st);
  }
  // ---------- Darstellung ----------
  // Das Tablett (Rig) ist ein Objekt in einer 3D-Szene. Es gibt zwei Einbauarten:
  //   D.view(host)   eigenes kleines Fenster (Dock) für 2D-Spiele, fährt beim eigenen Wurf groß ins Bild
  //   D.embed({...}) das Tablett steht als echtes Objekt neben dem Spielbrett in der Szene des Spiels, die Kamera fährt dorthin
  var ASP = (TX * 2 + 2.8) / (TZ * 2 + 2.8), MAXP = 4.6, ANCH_Z = TZ - 1.7;
  var cssDone = false;
  function addCss() {
    if (cssDone) return; cssDone = true;
    var st = document.createElement('style');
    st.textContent = '.dice-wrap{position:absolute;inset:0;border-radius:14px;overflow:hidden;background:rgba(8,12,22,.55);border:2px solid rgba(255,255,255,.18);box-shadow:0 6px 20px rgba(0,0,0,.45)}' +
      '.dice-wrap canvas{display:block;width:100%;height:100%;touch-action:none}' +
      '.dice-wrap .dzoom{position:absolute;right:6px;top:6px;z-index:5;width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:rgba(20,24,42,.85);color:#fff;font:700 15px system-ui,sans-serif;cursor:pointer;line-height:1;padding:0}' +
      '.dice-wrap.bare{background:transparent;border:0;box-shadow:none;border-radius:0;pointer-events:none}.dice-wrap.bare .dbtn{bottom:auto;top:4px}' +
      '.dice-embed{position:absolute;inset:0;pointer-events:none;z-index:60}' +
      '.dice-wrap .dh,.dice-embed .dh{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:3;pointer-events:none;background:rgba(10,14,30,.9);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:6px 10px;font:700 12px system-ui,sans-serif;text-align:center;display:none;width:88%}' +
      '.dice-wrap.big .dh,.dice-embed .dh{font-size:15px;padding:8px 14px;width:auto;max-width:92%}' +
      '.dice-embed .dh{bottom:62px}' +
      '.dice-wrap .dbtn,.dice-embed .dbtn{position:absolute;left:50%;bottom:54px;transform:translateX(-50%);z-index:4;font:600 13px system-ui,sans-serif;color:#fff;background:rgba(40,46,70,.95);border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:7px 14px;cursor:pointer;pointer-events:auto}' +
      '.dice-embed .dbtn{bottom:112px}' +
      '#diceBackdrop{position:fixed;inset:0;z-index:899;background:rgba(5,8,18,.6);opacity:0;transition:opacity .35s;pointer-events:auto}';
    document.head.appendChild(st);
  }
  var cyberNow = function () { return document.documentElement.getAttribute('data-style') === 'cyber'; };
  // Würfel-Design aus dem Profil (theme.js): 'auto' richtet sich nach dem Stil der Seite
  function skinNow(mine) {
    var pref = mine !== false && window.SITE && SITE.dice ? SITE.dice() : 'auto', d = pref !== 'auto' && SITE.DICE ? SITE.DICE[pref] : null;
    if (!d) return { key: cyberNow() ? 'c' : 's', neon: cyberNow(), color: true, sk: null };
    if (d.num) return { key: 'neon', neon: true, color: true, sk: null };
    if (d.player) return { key: 'pl', neon: false, color: true, sk: null };
    return { key: pref, neon: false, color: false, sk: d };
  }
  // Tablett-Bauteile: Filzboden, Holzrand, Abschussfeld, Zielhilfe und die Würfel. Lokale Koordinaten = Physik-Koordinaten.
  function mkRig(parent, bare) {      // bare: ohne Tablett (Würfel rollen direkt auf dem Spielbrett), nur eine feine Begrenzungslinie
    var R = { dice: [], shown: 0 }, geo = new THREE.BoxGeometry(1, 1, 1), mats = null, fontTried = false;
    R.group = new THREE.Group(); parent.add(R.group);
    var floorMat = new THREE.MeshStandardMaterial({ color: 0x1f6b4d, roughness: .95 });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(TX * 2 + .3, TZ * 2 + .3), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = .01; floor.receiveShadow = true; floor.visible = !bare; R.group.add(floor);
    var rimMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: .55 }), RT = .8, RH = 1.15;
    function rim(w, d, x, z) { var m = new THREE.Mesh(geo, rimMat); m.scale.set(w, RH, d); m.position.set(x, RH / 2, z); m.castShadow = m.receiveShadow = true; m.visible = !bare; R.group.add(m); }
    rim(TX * 2 + RT * 2, RT, 0, -TZ - RT / 2); rim(TX * 2 + RT * 2, RT, 0, TZ + RT / 2); rim(RT, TZ * 2, -TX - RT / 2, 0); rim(RT, TZ * 2, TX + RT / 2, 0);
    var padMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide });
    if (bare) padMat.opacity = 0;      // ohne Tablett kein Startring: das Spielfeld selbst ist die Fläche
    R.pad = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 40), padMat); R.pad.rotation.x = -Math.PI / 2; R.pad.position.set(0, .04, ANCH_Z); R.pad.visible = false; R.group.add(R.pad);
    // Zielhilfe: Gummiband, Griff und Punktreihe in Schussrichtung
    R.aimG = new THREE.Group(); R.aimG.visible = false; R.group.add(R.aimG);
    var am = function () { return new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, depthTest: false }); };
    var band = new THREE.Mesh(geo, am()); band.renderOrder = 10; R.aimG.add(band);
    var handle = new THREE.Mesh(new THREE.RingGeometry(.3, .45, 28), am()); handle.rotation.x = -Math.PI / 2; handle.renderOrder = 11; R.aimG.add(handle);
    var dots = []; for (var di = 0; di < 9; di++) { var dm = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), am()); dm.renderOrder = 10; R.aimG.add(dm); dots.push(dm); }
    R.skin = function () {
      var cy = cyberNow();
      floorMat.color.set(cy ? 0x0b1626 : 0x1f6b4d); floorMat.emissive.set(cy ? 0x001a24 : 0x000000);
      rimMat.color.set(cy ? 0x0e2a45 : 0x6b4a2b); rimMat.emissive.set(cy ? 0x06202f : 0x000000); padMat.color.set(R.color || (cy ? 0x00f0ff : 0xffe08a));      // Abschussring in Spielerfarbe
    };
    R.color = null; R.mine = true;      // mine: eigener Wurf (Profil-Design) oder Wurf eines anderen (Standard-Design)
    R.setColor = function (hex) { hex = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.toLowerCase() : null; if (hex !== R.color) { R.color = hex; R.mk(); R.skin(); } };      // Würfel in Spielerfarbe
    R.mk = function () {
      var S = skinNow(R.mine), cy = S.neon, col = S.color ? R.color : null, key = S.key + (col || '');
      if (mats && mats.key === key) return mats;
      mats = { key: key, list: FACE_V.map(function (v) {
        var t = faceTex(v, cy, cy ? 256 : 128, col, S.sk);
        // Neon: Zahl und Rand leuchten selbst (Emissive-Map), beim Liegenbleiben blitzt es auf
        return new THREE.MeshStandardMaterial(cy ? { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .75, roughness: .35, metalness: .3 } : { map: t, roughness: .55, metalness: 0 });
      }) };
      mats.cy = cy;
      R.dice.forEach(function (d, i) { d.mesh.material = R.mod && i === 1 && modMats ? modMats : mats.list; });
      if (cy && !fontTried && document.fonts && document.fonts.load) {      // Orbitron nachladen, dann Texturen neu zeichnen
        fontTried = true;
        document.fonts.load('900 40px Orbitron').then(function () { mats = null; R.mk(); R.skin(); }, function () { });
      }
      return mats;
    };
    R.mod = false; var modMats = null;      // mod: der zweite Würfel ist der Rechenwürfel
    R.assign = function () { var m = R.mk(); if (R.mod && !modMats) modMats = FACE_V.map(function (v) { return new THREE.MeshStandardMaterial({ map: modTex(v, 128), roughness: .45, metalness: .1, emissive: 0x2a1c00 }); }); R.dice.forEach(function (d, i) { d.mesh.material = R.mod && i === 1 ? modMats : m.list; }); };
    R.ensure = function (n) {
      while (R.dice.length < n) { var m = new THREE.Mesh(geo, R.mk().list); m.castShadow = true; R.group.add(m); R.dice.push({ mesh: m }); }
      R.dice.forEach(function (d, i) { d.mesh.visible = i < n || (d.mesh.visible && i < R.shown); });
      R.assign();
    };
    R.aim = function (ax, az, pull) {      // Gummiband, Griff und Zielpunkte; Rückgabe: Kraft 0..1
      var len = Math.hypot(pull.x, pull.z), power = Math.max(0, Math.min(1, (len - .7) / (MAXP - .7))), col = new THREE.Color().setHSL(.33 * (1 - power), .9, .55);
      R.aimG.visible = len > .2;
      if (!R.aimG.visible) return 0;
      var ex = ax + pull.x, ez = az + pull.z;
      band.position.set((ax + ex) / 2, .6, (az + ez) / 2); band.scale.set(len, .06, .16); band.rotation.y = -Math.atan2(pull.z, pull.x); band.material.color.copy(col);
      handle.position.set(ex, .6, ez); handle.material.color.copy(col);
      var dx = -pull.x / len, dz = -pull.z / len;
      dots.forEach(function (m, i) {
        var d = 1.1 + i * (.7 + power * .6), x = ax + dx * d, z = az + dz * d;
        m.visible = len > .7 && Math.abs(x) < TX - .3 && Math.abs(z) < TZ - .3;
        m.position.set(x, .55, z); m.scale.setScalar(1.15 - i * .09); m.material.color.copy(col);
      });
      return power;
    };
    // Landeeffekt (Cyber): Welle um jeden Würfel und kurzes Aufleuchten der Zahlen
    var fxT = 0, fxRings = [], fxRaf = 0, fxDone = null;
    R.fxStop = function () { cancelAnimationFrame(fxRaf); fxRaf = 0; fxRings.forEach(function (m) { m.visible = false; }); if (mats && mats.cy) mats.list.forEach(function (m) { m.emissiveIntensity = .75; }); };
    R.land = function (n, done) {
      if (!(mats && mats.cy)) return;
      R.fxStop(); fxDone = done; fxT = performance.now();
      var col = R.color || '#00f0ff';
      for (var i = 0; i < n; i++) {
        if (!fxRings[i]) { var m = new THREE.Mesh(new THREE.RingGeometry(.62, .72, 48), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; R.group.add(m); fxRings[i] = m; }
        fxRings[i].material.color.set(col); fxRings[i].position.set(R.dice[i].mesh.position.x, .06, R.dice[i].mesh.position.z); fxRings[i].visible = true;
      }
      function f(now) {
        var u = Math.min(1, (now - fxT) / 900), e = 1 - Math.pow(1 - u, 2);
        fxRings.forEach(function (m, i) { if (i >= n) return; m.scale.setScalar(1 + e * 3.2); m.material.opacity = .9 * (1 - u); });
        if (mats && mats.cy) { var fl = u < .2 ? 1 + 1.6 * (u / .2) : 2.6 - 1.85 * Math.min(1, (u - .2) / .8); mats.list.forEach(function (m) { m.emissiveIntensity = Math.max(.75, fl); }); }
        if (fxDone) fxDone();
        if (u < 1) fxRaf = requestAnimationFrame(f); else R.fxStop();
      }
      fxRaf = requestAnimationFrame(f);
    };
    R.skin();
    return R;
  }

  // Steuerung (Schleuder, Abspielen) – unabhängig davon, ob das Tablett im Dock oder in der Spielszene steht
  function controller(env) {
    var V = { busy: false, zoomed: false, wrap: env.wrap, host: env.host, shown: 0 }, hideT = 0, unzoomT = 0;
    function setDie(d, p, q) { d.mesh.position.set(p[0], p[1], p[2]); d.mesh.quaternion.set(q[0], q[1], q[2], q[3]); }
    V.hint = function (t) { env.hint(t); };
    V.show = function (on) { return env.show(on); };
    V.zoom = function (on) { if (on === V.zoomed) return; V.zoomed = on; env.focus(on); };
    V.hide = function () {      // Würfel wegräumen und aus der Kamerafahrt zurück
      clearTimeout(hideT); clearTimeout(unzoomT); env.anim(0); V._playing = 0; V.hint('');
      if (V.zoomed) V.zoom(false);
      var R = env.R; if (R) { R.fxStop(); R.aimG.visible = false; R.pad.visible = false; R.dice.forEach(function (d) { d.mesh.visible = false; }); R.shown = 0; env.once(); }
    };
    // Schleuder: Würfel nach hinten (nach unten) ziehen, zielen, loslassen -> Wurfdaten.
    V.drag = function (n, opts) {
      opts = opts || {};
      return V.show().then(function () {
        var R = env.R; R.mine = true; R.mod = !!opts.mod; R.setColor(opts.color); R.mk(); R.skin(); clearTimeout(hideT); clearTimeout(unzoomT); R.ensure(n); R.shown = n; V.busy = true; env.anim(1);
        if (opts.zoom !== false) V.zoom(true);
        var ax = 0, az = ANCH_Z, held = false, gp = [0, 0], pull = { x: 0, z: 0 }, q0 = R.dice.map(function () { return randQ(); }), spin = R.dice.map(function () { return [rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)]; }), t0 = performance.now(), last = t0;
        var base = opts.hint || (window.SITE ? SITE.T('Würfel nach unten ziehen, zielen und loslassen zum Abschießen', 'Pull the dice down, aim and release to shoot') : 'Pull down, aim, release');
        var off = function (i) { return (i - (n - 1) / 2) * 1.55; };
        R.pad.visible = true; R.aimG.visible = false;
        R.dice.slice(0, n).forEach(function (d, i) { d.mesh.visible = true; setDie(d, [ax + off(i), .5, az], q0[i]); });
        V.hint(base); env.cursor('grab');
        function tick(now) {
          var dt = Math.min(.05, (now - last) / 1000); last = now;
          R.dice.slice(0, n).forEach(function (d, i) {
            var s = held ? 1.6 : .35, ax2 = new THREE.Vector3(spin[i][0], spin[i][1], spin[i][2]), a = ax2.length() * dt * s;
            if (a > 0) { var dq = new THREE.Quaternion().setFromAxisAngle(ax2.normalize(), a); var cq = new THREE.Quaternion(q0[i][0], q0[i][1], q0[i][2], q0[i][3]).premultiply(dq); q0[i] = [cq.x, cq.y, cq.z, cq.w]; }
            var py = held ? .9 : .5 + .12 * Math.abs(Math.sin((now - t0) / 500));
            d.mesh.position.set(ax + off(i) + pull.x * .22, py, az + pull.z * .22); d.mesh.quaternion.set(q0[i][0], q0[i][1], q0[i][2], q0[i][3]);
          });
          env.once();
          if (V._tick) requestAnimationFrame(tick);
        }
        V._tick = 1; requestAnimationFrame(tick);
        var L = env.listen;
        return new Promise(function (res, rej) {
          function down(e) {
            var p = env.pt(e); if (!p) return;
            var hit = R.dice.slice(0, n).some(function (d) { return env.near(d.mesh.position, 1.9); });      // nur ein Griff auf den Würfel startet den Schuss
            if (!hit) return;
            held = true; gp = p.slice(); try { L.setPointerCapture(e.pointerId); } catch (er) {} env.cursor('grabbing'); e.preventDefault(); e.stopImmediatePropagation(); move(e);
          }
          function move(e) {
            if (!held) return; var p = env.pt(e); if (!p) return;
            var vx = p[0] - gp[0], vz = p[1] - gp[1], len = Math.hypot(vx, vz);
            if (len > MAXP) { vx *= MAXP / len; vz *= MAXP / len; }
            pull = { x: vx, z: vz };
            var pw = R.aim(ax, az, pull);
            V.hint(base + (Math.hypot(vx, vz) > .7 ? '  ·  ' + (window.SITE ? SITE.T('Kraft', 'Power') : 'Power') + ' ' + Math.round(pw * 100) + ' %' : ''));
            if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation();
          }
          function up(e) {
            if (!held) return; held = false; env.cursor('grab'); e.stopImmediatePropagation(); try { L.releasePointerCapture(e.pointerId); } catch (er) {}
            var len = Math.hypot(pull.x, pull.z);
            if (len < .7) { pull = { x: 0, z: 0 }; R.aimG.visible = false; V.hint(base); return; }      // zu wenig gezogen: nichts passiert, nochmal versuchen
            var power = Math.max(0, Math.min(1, (len - .7) / (MAXP - .7))), speed = 10 + power * 34, dice = [], base0 = Math.atan2(-pull.z, -pull.x);
            cleanup(); R.aimG.visible = false; R.pad.visible = false;
            for (var i = 0; i < n; i++) {
              var ang = base0 + rnd(-.04, .04), vx2 = Math.cos(ang) * speed, vz2 = Math.sin(ang) * speed;
              // Drehung: Rollen in Schussrichtung plus zufälliges Taumeln aus der Hand
              var w = [vz2 * 1.0 + rnd(-9, 9) + spin[i][0] * 1.5, rnd(-8, 8) + spin[i][1] * 1.5, -vx2 * 1.0 + rnd(-9, 9) + spin[i][2] * 1.5];
              dice.push({ p: [ax + off(i) + pull.x * .22, env.bare ? 2.6 : .9, az + pull.z * .22], q: q0[i].slice(), v: [vx2, env.bare ? rnd(-5, -2) : rnd(-1.5, .5), vz2], w: w });
            }
            res({ dice: dice });
          }
          function cleanup() { L.removeEventListener('pointerdown', down, true); L.removeEventListener('pointermove', move, true); L.removeEventListener('pointerup', up, true); L.removeEventListener('pointercancel', up, true); env.cursor(''); V._tick = 0; V.hint(''); V._cleanup = null; }
          V._cleanup = function () { cleanup(); rej(new Error('cancel')); };
          L.addEventListener('pointerdown', down, true); L.addEventListener('pointermove', move, true); L.addEventListener('pointerup', up, true); L.addEventListener('pointercancel', up, true);
        });
      });
    };
    V.stopDrag = function () { if (V._cleanup) V._cleanup(); };                       // Zieh-Eingabe beenden, Kamerafahrt bleibt (der Wurf folgt gleich)
    V.cancel = function () { if (V._cleanup) V._cleanup(); V.busy = false; V.hide(); };    // alles zurücksetzen
    // Gerechnete Bahn abspielen. Rückgabe: Promise (Würfel liegen). Beim Werfenden fährt die Kamera zum Tablett, bei den anderen bleibt sie.
    V.play = function (track, opts) {
      opts = opts || {};
      return V.show().then(function () {
        var R = env.R; R.mine = opts.mine !== false; R.mod = !!opts.mod; R.setColor(opts.color); R.mk(); R.skin(); clearTimeout(hideT); clearTimeout(unzoomT); if (V._cleanup) { try { V._cleanup(); } catch (e) {} }
        V._tick = 0; V.busy = true; V._playing = 1; V.hint(''); R.aimG.visible = false; R.pad.visible = false; R.ensure(track.n); R.shown = track.n; R.dice.slice(0, track.n).forEach(function (d) { d.mesh.visible = true; }); env.anim(1);
        var frames = track.f, hz = track.hz, n = track.n, t0 = performance.now(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
        return new Promise(function (res) {
          var done = false;
          function fin() {
            if (done) return; done = true; V._playing = 0; setFrame(frames.length - 1, 0); env.once(); V.busy = false; R.land(n, env.once);
            setTimeout(function () { if (!V._playing && !V._tick) env.anim(0); }, 120);
            if (V.zoomed) unzoomT = setTimeout(function () { if (!V._playing) V.zoom(false); }, opts.hold == null ? 1300 : opts.hold);      // zurück; die Würfel bleiben auf dem Tablett liegen
            res();
          }
          function setFrame(i, u) {
            var a = frames[i], b = frames[Math.min(frames.length - 1, i + 1)];
            for (var k = 0; k < n; k++) {
              var o = k * 7, d = R.dice[k];
              d.mesh.position.set(a[o] + (b[o] - a[o]) * u, a[o + 1] + (b[o + 1] - a[o + 1]) * u, a[o + 2] + (b[o + 2] - a[o + 2]) * u);
              q1.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]); q2.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]); d.mesh.quaternion.copy(q1).slerp(q2, u);
            }
          }
          var prevY = null;
          function step() {
            if (done) return;
            var el = (performance.now() - t0) / 1000 * hz, i = Math.floor(el);
            if (i >= frames.length - 1) { fin(); return; }
            setFrame(i, el - i); env.once();
            if (opts.sound) { var y = frames[i][1]; if (prevY != null && prevY > .62 && y <= .62) opts.sound('hit'); prevY = y; }
            requestAnimationFrame(step);
          }
          step();
          // Notbremse für Hintergrund-Tabs: Das Spiel darf nicht hängen
          setTimeout(fin, frames.length / hz * 1000 + 1500);
        });
      });
    };
    V.destroy = function () { V.cancel(); if (env.destroy) env.destroy(); };
    Object.defineProperty(V, 'R', { get: function () { return env.R; } });
    return V;
  }

  // ----- Dock: eigenes kleines Fenster; beim eigenen Wurf fährt es groß in die Bildmitte -----
  D.view = function (host) {
    addCss();
    var cs = getComputedStyle(host); if (cs.position === 'static') host.style.position = 'relative';
    var wrap = document.createElement('div'); wrap.className = 'dice-wrap'; wrap.setAttribute('data-noi18n', '');
    var cv = document.createElement('canvas'), hint = document.createElement('div'); hint.className = 'dh';
    wrap.appendChild(cv); wrap.appendChild(hint); host.appendChild(wrap);
    var bare = !!(host.dataset && host.dataset.bare); if (bare) wrap.classList.add('bare');      // data-bare: Würfelfläche liegt direkt über dem Spielbrett
    var zb = document.createElement('button'); zb.className = 'dzoom'; if (bare) zb.style.display = 'none'; zb.textContent = '⤢'; zb.title = 'Würfelfeld vergrößern / verkleinern'; wrap.appendChild(zb); zb.onclick = function () { V.zoom(!V.zoomed); zb.textContent = V.zoomed ? '⤡' : '⤢'; };
    var env = { host: host, wrap: wrap, R: null, bare: bare }, V;
    var renderer, scene, cam, ray, plane, tmp = null, raf = 0, anim = 0, visible = true, backdrop = null, zoomed = false;
    function build() {
      if (renderer) return;
      renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'high-performance' }); renderer.setClearColor(0, 0); renderer.shadowMap.enabled = true;
      tmp = new THREE.Vector3(); scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, 1, .1, 100); ray = new THREE.Raycaster(); plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.5);
      scene.add(new THREE.AmbientLight(0xffffff, .72));
      var dl = new THREE.DirectionalLight(0xffffff, .75); dl.position.set(-4, 14, 6); dl.castShadow = true; dl.shadow.mapSize.set(1024, 1024);
      var sc = dl.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 40; scene.add(dl);
      var sp = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: .38 })); sp.rotation.x = -Math.PI / 2; sp.position.y = .03; sp.receiveShadow = true; scene.add(sp);
      env.R = mkRig(scene, bare); env.R.mk(); resize();
    }
    function resize() {
      if (!renderer) return;
      var w = wrap.clientWidth || 200, h = wrap.clientHeight || 280;
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
      cam.aspect = w / h; var vf = cam.fov * Math.PI / 180, mg = bare ? 0 : 1.4, needH = (TZ + mg) * 2, needW = (TX + mg) * 2;
      var dist = Math.max(needH / (2 * Math.tan(vf / 2)), needW / (2 * Math.tan(vf / 2) * cam.aspect));
      if (bare) cam.position.set(0, dist, .001); else cam.position.set(0, dist * .93, dist * .37); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); once();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(wrap);
    // Es wird nur gezeichnet, wenn sich etwas bewegt (spart Leistung); sonst genau ein Bild pro Änderung
    function loop() { raf = 0; if (renderer && visible) renderer.render(scene, cam); if (anim) raf = requestAnimationFrame(loop); }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    function once() { if (renderer && visible && !anim) renderer.render(scene, cam); }
    new MutationObserver(function () { if (env.R) { env.R.skin(); env.R.mk(); once(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'] });
    env.ready = function () { return D.ready().then(build); };
    env.show = function (on) {
      if (on === false) { visible = false; host.style.display = 'none'; anim = 0; return Promise.resolve(); }
      return env.ready().then(function () { if (!visible || host.style.display === 'none') { visible = true; host.style.display = ''; resize(); } });
    };
    env.hint = function (t) { hint.textContent = t || ''; hint.style.display = t ? 'block' : 'none'; };
    env.anim = function (f) { anim = f; if (f) kick(); else once(); };
    env.once = once;
    env.pt = function (e) { var r = cv.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); return ray.ray.intersectPlane(plane, tmp) ? [tmp.x, tmp.z] : null; };
    env.near = function (v3, rad) { return ray.ray.distanceToPoint(v3) < rad; };
    env.listen = wrap; env.cursor = function (c) { wrap.style.cursor = c; if (bare) wrap.style.pointerEvents = c ? 'auto' : 'none'; };      // bare: die Fläche über dem Brett fängt nur beim Ziehen Eingaben ab, sonst bleibt das Brett bedienbar
    function bigRect() {
      var iw = window.innerWidth, ih = window.innerHeight, h = Math.min(ih * .92, 940), w = h * ASP;
      if (w > iw * .96) { w = iw * .96; h = w / ASP; }
      return { left: (iw - w) / 2, top: (ih - h) / 2, width: w, height: h };
    }
    function applyBig() { var b = bigRect(); wrap.style.cssText = 'position:fixed;z-index:900;left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.width + 'px;height:' + b.height + 'px;inset:auto'; wrap.style.left = b.left + 'px'; wrap.style.top = b.top + 'px'; }
    env.focus = function (on) {      // Kamerafahrt als Vergrößerung des Fensters
      if (!renderer || on === zoomed || bare) return;
      var first = wrap.getBoundingClientRect(); zoomed = on;
      if (on) {
        if (!backdrop) { backdrop = document.createElement('div'); backdrop.id = 'diceBackdrop'; }
        document.body.appendChild(backdrop); void backdrop.offsetWidth; backdrop.style.opacity = '1';
        document.body.appendChild(wrap); applyBig(); wrap.classList.add('big');
      } else {
        if (backdrop) { backdrop.style.opacity = '0'; var bd = backdrop; setTimeout(function () { if (!zoomed && bd.parentNode) bd.remove(); }, 380); }
        host.appendChild(wrap); wrap.style.cssText = ''; wrap.classList.remove('big');
      }
      resize();
      var last = wrap.getBoundingClientRect();
      if (wrap.animate && last.width && first.width) {
        wrap.animate([{ transformOrigin: '0 0', transform: 'translate(' + (first.left - last.left) + 'px,' + (first.top - last.top) + 'px) scale(' + (first.width / last.width) + ',' + (first.height / last.height) + ')' }, { transformOrigin: '0 0', transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' });
        var keep = anim; anim = 1; kick(); setTimeout(function () { if (!V._tick && !V._playing) { anim = 0; once(); } else anim = keep || anim; }, 480);
      }
    };
    addEventListener('resize', function () { if (zoomed) { applyBig(); resize(); } });
    env.destroy = function () { if (ro) ro.disconnect(); wrap.remove(); };
    V = controller(env);
    return V;
  };

  // ----- Eingebettet: das Tablett steht als Objekt neben dem Spielbrett in der Szene des Spiels -----
  // o: { scene, camera, dom (Zeichenfläche), stage (Element für Hinweise), pos:[x,y,z], scale, rotY, focus(on) (Kamerafahrt) }
  D.embed = function (o) {
    addCss();
    var overlay = document.createElement('div'); overlay.className = 'dice-embed'; overlay.setAttribute('data-noi18n', '');
    var hint = document.createElement('div'); hint.className = 'dh'; overlay.appendChild(hint);
    var st = o.stage; st.appendChild(overlay);      // die Position der Bühne bleibt unverändert (ihr Stil legt sie fest)
    var env = { host: st, wrap: overlay, R: null, bare: !!o.bare }, ray = null, pl = null, tmp = null, S = o.scale || 1;
    env.ready = function () {
      return D.ready().then(function () {
        if (env.R) return;
        ray = new THREE.Raycaster(); pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); tmp = new THREE.Vector3();
        env.R = mkRig(o.scene, o.bare); env.R.mk();
        var g = env.R.group; g.position.set(o.pos[0], o.pos[1], o.pos[2]); g.scale.setScalar(S); g.rotation.y = o.rotY || 0; g.updateMatrixWorld(true);
        new MutationObserver(function () { env.R.skin(); env.R.mk(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'] });
      });
    };
    env.show = function (on) { return env.ready().then(function () { env.R.group.visible = on !== false; }); };
    env.hint = function (t) { hint.textContent = t || ''; hint.style.display = t ? 'block' : 'none'; };
    env.anim = function () { }; env.once = function () { };      // die Szene des Spiels zeichnet ohnehin ständig
    env.pt = function (e) {
      var r = o.dom.getBoundingClientRect(), g = env.R.group; g.updateMatrixWorld(true);
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), o.camera);
      pl.constant = -(g.position.y + .5 * S);
      if (!ray.ray.intersectPlane(pl, tmp)) return null;
      var l = g.worldToLocal(tmp.clone()); return [l.x, l.z];
    };
    env.near = function (v3, rad) { return ray.ray.distanceToPoint(env.R.group.localToWorld(v3.clone())) < rad * S; };
    env.listen = o.dom; env.cursor = function (c) { o.dom.style.cursor = c; };
    env.focus = function (on) { if (o.focus) o.focus(on); };
    env.destroy = function () { overlay.remove(); };
    return controller(env);
  };
})();
