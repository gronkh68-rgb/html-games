/* Chomp Arena: Labyrinth-Erzeugung, Spielregeln und Computer-Spieler.
   Läuft im Browser (window.Chomp) und in Node (require), damit die Regeln automatisch testbar sind. */
(function (root) {
  'use strict';

  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // 0 oben, 1 rechts, 2 unten, 3 links
  const opp = d => (d + 2) & 3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const CFG = {
    T: 31,                       // Spielfeld: 31 x 31 Kacheln
    playerSpeed: 6.0,            // Kacheln pro Sekunde
    ghostBase: [0.76, 0.86, 0.95], // Geistertempo je Stufe (Anteil am Spielertempo)
    ghostCap: 1.0,
    scaredSpeed: 0.55,
    eyesSpeed: 11,
    collide: 0.62,               // Abstand in Kacheln, ab dem zwei Figuren sich berühren
    countdown: 3.4,
    protect: 3.0,                // Schutz nach dem Wiederbeleben
    respawnDelay: 1.4,
    ghostChain: [200, 400, 800, 1600],
    coop: {
      lives: 5, maxLives: 7, extraLifeEvery: 300,
      ghostStart: [3, 4, 4],                    // Geister in Level 1 (Leicht / Normal / Schwer)
      ghostMore: [[4, 8], [3, 6], [2, 4, 6]],   // ab diesem Level kommt je ein Geist dazu
      dot: 10, special: 50, clearBonus: 300,
      powerTime: 10, minPower: 6,
      waveFirst: 14, waveCooldown: 10, waveDuration: 28,
      release: [4, 9, 14, 20, 6, 8, 10],
      chase: 20, scatter: 5
    },
    versus: {
      lives: 3, roomDot: 10, arenaDot: 3, pellet: 50,
      powerTime: 7, hunterBoost: 1.12,
      eatPlayer: 300, victimLoss: 100, lastMan: 400,
      arenaTime: 120, autoOpen: 30, maxRoom: 180, pelletRespawn: 12, dotRespawn: 20,
      roomGhostRelease: 5, arenaGhostRelease: 2
    }
  };

  // ---------------------------------------------------------------- Hilfsfunktionen
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function dsu(n) {
    const p = new Int32Array(n).map((_, i) => i);
    const find = x => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    return { find, union(a, b) { a = find(a); b = find(b); if (a === b) return false; p[a] = b; return true; } };
  }

  // ---------------------------------------------------------------- Labyrinth
  // Zellenlabyrinth C x C ohne Sackgassen. Ist H < C, werden die Kanten an beiden Mittelachsen
  // gespiegelt: Alle vier Ecken sind dann spiegelbildlich gleich (faire Startbedingungen).
  function genCellMaze(rnd, C, H, loopP, force) {
    const W = H - 1;
    const fold = c => (c < H ? c : C - 1 - c);
    const hOpen = new Uint8Array(W * H), vOpen = new Uint8Array(W * H);
    const iH = (c, r) => fold(r) * W + Math.min(fold(c), fold(c + 1));
    const iV = (c, r) => Math.min(fold(r), fold(r + 1)) * H + fold(c);
    const open = (c, r, d) => {
      if (d === 1) return c < C - 1 && !!hOpen[iH(c, r)];
      if (d === 3) return c > 0 && !!hOpen[iH(c - 1, r)];
      if (d === 2) return r < C - 1 && !!vOpen[iV(c, r)];
      return r > 0 && !!vOpen[iV(c, r - 1)];
    };
    const edges = [];
    for (let b = 0; b < H; b++) for (let a = 0; a < W; a++) edges.push({ h: 1, i: b * W + a, u: b * H + a, v: b * H + a + 1 });
    for (let b = 0; b < W; b++) for (let a = 0; a < H; a++) edges.push({ h: 0, i: b * H + a, u: b * H + a, v: (b + 1) * H + a });
    const set = e => { (e.h ? hOpen : vOpen)[e.i] = 1; e.done = true; };
    const uf = dsu(H * H);
    const forced = new Set((force || []).map(f => f.h + ':' + f.i));
    for (const e of edges) if (forced.has(e.h + ':' + e.i)) { set(e); uf.union(e.u, e.v); }
    shuffle(edges, rnd);
    for (const e of edges) if (!e.done && uf.union(e.u, e.v)) set(e);       // zufälliger Spannbaum
    for (const e of edges) if (!e.done && rnd() < loopP) set(e);            // zusätzliche Rundwege
    const deg = (c, r) => (open(c, r, 0) ? 1 : 0) + (open(c, r, 1) ? 1 : 0) + (open(c, r, 2) ? 1 : 0) + (open(c, r, 3) ? 1 : 0);
    for (let it = 0; it < 2000; it++) {                                      // Sackgassen aufbrechen
      const dead = [];
      for (let r = 0; r < C; r++) for (let c = 0; c < C; c++) if (deg(c, r) <= 1) dead.push([c, r]);
      if (!dead.length) break;
      const [c, r] = dead[Math.floor(rnd() * dead.length)];
      const cand = [];
      for (let d = 0; d < 4; d++) {
        const nc = c + DX[d], nr = r + DY[d];
        if (nc >= 0 && nr >= 0 && nc < C && nr < C && !open(c, r, d)) cand.push(d);
      }
      const d = cand[Math.floor(rnd() * cand.length)];
      if (d === 1) hOpen[iH(c, r)] = 1; else if (d === 3) hOpen[iH(c - 1, r)] = 1;
      else if (d === 2) vOpen[iV(c, r)] = 1; else vOpen[iV(c, r - 1)] = 1;
    }
    return { C, open };
  }

  function finishMap(m) {
    const { w, h, wall } = m;
    m.nbr = new Int16Array(w * h * 4).fill(-1);
    m.openList = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (wall[i]) continue;
      m.openList.push(i);
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !wall[ny * w + nx]) m.nbr[i * 4 + d] = ny * w + nx;
      }
    }
    return m;
  }

  // Zusammen-Modus: ein großes, viermal gespiegeltes Labyrinth mit Platz in der Mitte
  function buildCoopMap(seed) {
    const rnd = mulberry32((seed >>> 0) || 1);
    const C = 15, H = 8, T = CFG.T;
    const force = [{ h: 1, i: 6 * 7 + 6 }, { h: 1, i: 7 * 7 + 6 }, { h: 0, i: 6 * 8 + 6 }, { h: 0, i: 6 * 8 + 7 }];
    const maze = genCellMaze(rnd, C, H, 0.10, force);
    const wall = new Uint8Array(T * T).fill(1);
    for (let r = 0; r < C; r++) for (let c = 0; c < C; c++) {
      wall[(2 * r + 1) * T + 2 * c + 1] = 0;
      if (maze.open(c, r, 1)) wall[(2 * r + 1) * T + 2 * c + 2] = 0;
      if (maze.open(c, r, 2)) wall[(2 * r + 2) * T + 2 * c + 1] = 0;
    }
    const pdec = []; for (let i = 0; i < 49; i++) pdec.push(rnd() < 0.4);
    for (let pr = 0; pr < C - 1; pr++) for (let pc = 0; pc < C - 1; pc++) {   // Säulen zwischen vier offenen Zellen entfernen
      if (maze.open(pc, pr, 1) && maze.open(pc, pr + 1, 1) && maze.open(pc, pr, 2) && maze.open(pc + 1, pr, 2) &&
          pdec[Math.min(pc, C - 2 - pc) * 7 + Math.min(pr, C - 2 - pr)]) wall[(2 * pr + 2) * T + 2 * pc + 2] = 0;
    }
    for (let y = 13; y <= 17; y++) for (let x = 13; x <= 17; x++) wall[y * T + x] = 0;   // Platz in der Mitte
    const e = T - 2;
    const m = {
      mode: 'coop', w: T, h: T, wall,
      starts: [{ x: 1, y: 1 }, { x: e, y: 1 }, { x: 1, y: e }, { x: e, y: e }],
      ghostSpawns: [{ x: 15, y: 13 }, { x: 13, y: 15 }, { x: 17, y: 15 }, { x: 15, y: 17 }, { x: 14, y: 15 }, { x: 16, y: 15 }, { x: 14, y: 13 }],
      zone: new Uint8Array(T * T).fill(4), gateAt: new Int8Array(T * T).fill(-1)
    };
    return finishMap(m);
  }

  // Gegeneinander-Modus: vier Räume in den Ecken (je ein Labyrinth, spiegelbildlich gleich) und eine gemeinsame Arena (Kreuz)
  function buildVersusMap(seed) {
    const rnd = mulberry32(((seed >>> 0) || 1) ^ 0x1234567);
    const T = CFG.T, e = T - 1;
    const maze = genCellMaze(rnd, 6, 6, 0.18, []);
    const wall = new Uint8Array(T * T).fill(1);
    const zone = new Uint8Array(T * T).fill(255);
    const gateAt = new Int8Array(T * T).fill(-1);
    const put = (x, y, z) => { wall[y * T + x] = 0; zone[y * T + x] = z; };
    const mir = (lx, ly, z) => [(z & 1) ? e - lx : lx, (z & 2) ? e - ly : ly];
    const local = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
      local.push([2 * c + 1, 2 * r + 1]);
      if (maze.open(c, r, 1)) local.push([2 * c + 2, 2 * r + 1]);
      if (maze.open(c, r, 2)) local.push([2 * c + 1, 2 * r + 2]);
    }
    for (let z = 0; z < 4; z++) for (const [lx, ly] of local) { const [x, y] = mir(lx, ly, z); put(x, y, z); }
    for (let y = 1; y <= e - 1; y++) for (let x = 13; x <= 17; x++) put(x, y, 4);   // senkrechtes Band
    for (let x = 1; x <= e - 1; x++) for (let y = 13; y <= 17; y++) put(x, y, 4);   // waagerechtes Band
    const pillar = (x, y) => { wall[y * T + x] = 1; };
    for (let y = 14; y <= 16; y++) for (let x = 14; x <= 16; x++) pillar(x, y);        // Block in der Mitte
    for (const [v, u] of [[-1, 3], [1, 3], [0, 6], [-1, 9], [1, 9]]) {                    // Säulen in den vier Armen
      pillar(15 + v, u); pillar(15 + v, e - u); pillar(u, 15 + v); pillar(e - u, 15 + v);
    }
    const gates = [{ x: 12, y: 9 }, { x: e - 12, y: 9 }, { x: 12, y: e - 9 }, { x: e - 12, y: e - 9 }];
    gates.forEach((g, i) => { wall[g.y * T + g.x] = 0; zone[g.y * T + g.x] = 255; gateAt[g.y * T + g.x] = i; });
    const roomSpots = [[11, 1], [1, 11]];
    const m = {
      mode: 'versus', w: T, h: T, wall, zone, gateAt, gates,
      starts: [0, 1, 2, 3].map(z => { const [x, y] = mir(1, 1, z); return { x, y }; }),
      roomGhost: [0, 1, 2, 3].map(z => { const [x, y] = mir(11, 11, z); return { x, y }; }),
      roomPellets: [0, 1, 2, 3].map(z => roomSpots.map(([lx, ly]) => { const [x, y] = mir(lx, ly, z); return { x, y }; })),
      arenaPellets: [{ x: 13, y: 13 }, { x: 17, y: 13 }, { x: 13, y: 17 }, { x: 17, y: 17 }],
      ghostSpawns: [{ x: 13, y: 15 }, { x: 17, y: 15 }]
    };
    return finishMap(m);
  }

  // ---------------------------------------------------------------- Spiel
  const GHOST_TYPES = ['hunter', 'ambusher', 'splitter', 'wanderer'];

  function makePlayer(i, slot) {
    return {
      id: i, human: !!slot.human, bot: !slot.human, isGhost: false,
      x: 0, y: 0, dir: -1, p: 0, want: -1, face: i % 2 === 0 ? 1 : 3, speed: CFG.playerSpeed,
      fx: 0, fy: 0, pfx: 0, pfy: 0, startX: 0, startY: 0,
      score: 0, dots: 0, lives: CFG.versus.lives, protect: 0, power: 0, chain: 0, charged: false,
      respawnT: 0, eliminated: false, deaths: 0, ghostsEaten: 0, playersEaten: 0, specials: 0, rank: 0
    };
  }

  class Game {
    constructor(o) {
      o = o || {};
      this.mode = o.mode === 'versus' ? 'versus' : 'coop';
      this.seed = ((o.seed != null ? o.seed : Math.floor(Math.random() * 2147483647)) >>> 0) || 1;
      this.diff = clamp(o.ghostLevel != null ? o.ghostLevel : 1, 0, 2);
      this.botLevel = clamp(o.botLevel != null ? o.botLevel : 1, 0, 2);
      this.slots = [0, 1, 2, 3].map(i => (o.slots && o.slots[i]) || { human: false });
      this.rnd = mulberry32(this.seed ^ 0x5bd1e995);
      this.events = [];
      this.t = 0;
      this.level = 1;
      this.team = { lives: CFG.coop.lives, dots: 0 };
      this.players = this.slots.map((s, i) => makePlayer(i, s));
      this.result = null;
      this.setupLevel();
    }

    emit(e) { this.events.push(e); }
    drain() { const e = this.events; this.events = []; return e; }
    isActive(p) { return !p.eliminated && p.respawnT <= 0; }

    // ---------- Aufbau ----------
    setupLevel() {
      const seed = (this.seed + this.level * 7919) >>> 0;
      const m = this.map = this.mode === 'coop' ? buildCoopMap(seed) : buildVersusMap(seed);
      const n = m.w * m.h, w = m.w;
      this.dots = new Uint8Array(n);
      this.gateOpen = [false, false, false, false];
      this.ghosts = [];
      this.specials = [];
      this.playT = 0;
      this.phase = 'countdown'; this.phaseT = CFG.countdown;
      this.endAfter = null;
      this.scatter = false; this.cycleT = 0;
      this.power = { t: 0, max: 0, chain: 0 };
      this.wave = { state: 'wait', t: CFG.coop.waveFirst };
      this.vs = null;
      const startIdx = new Set(m.starts.map(s => s.y * w + s.x));
      if (this.mode === 'coop') {
        this.dotsLeft = 0;
        for (const i of m.openList) if (!startIdx.has(i)) { this.dots[i] = 1; this.dotsLeft++; }
        const count = Math.min(7, CFG.coop.ghostStart[this.diff] + CFG.coop.ghostMore[this.diff].filter(l => this.level >= l).length);
        for (let i = 0; i < count; i++) this.ghosts.push(this.makeGhost(i, GHOST_TYPES[i % 4], m.ghostSpawns[i], -1, CFG.coop.release[i]));
      } else {
        this.roomLeft = [0, 0, 0, 0]; this.arenaLeft = 0;
        const pelletIdx = new Set();
        m.roomPellets.forEach(list => list.forEach(s => pelletIdx.add(s.y * w + s.x)));
        const arenaPel = new Set(m.arenaPellets.map(s => s.y * w + s.x));
        const spawnIdx = new Set(m.ghostSpawns.map(s => s.y * w + s.x));
        for (const i of m.openList) {
          const z = m.zone[i];
          if (startIdx.has(i)) continue;
          if (z < 4) { this.dots[i] = pelletIdx.has(i) ? 2 : 1; this.roomLeft[z]++; }
          else if (z === 4 && !arenaPel.has(i) && !spawnIdx.has(i)) { this.dots[i] = 1; this.arenaLeft++; }
        }
        for (let z = 0; z < 4; z++) this.ghosts.push(this.makeGhost(z, 'hunter', m.roomGhost[z], z, CFG.versus.roomGhostRelease));
        const sw = this.rnd() < 0.5 ? 1 : 0;                                      // linke/rechte Seite zufällig, damit keine Seite bevorzugt wird
        this.ghosts.push(this.makeGhost(4, 'hunter', m.ghostSpawns[sw], -1, Infinity));
        this.ghosts.push(this.makeGhost(5, 'wanderer', m.ghostSpawns[1 - sw], -1, Infinity));
        this.vs = { arenaT: null, autoT: null, pellets: false, spots: m.arenaPellets.map(() => ({ t: 0 })), order: [], back: [] };
      }
      this.players.forEach((p, i) => { this.placePlayer(p, m.starts[i]); p.protect = 0; p.respawnT = 0; });
    }

    ghostSpeedFactor() {
      return Math.min(CFG.ghostBase[this.diff] * (1 + 0.03 * (this.level - 1)), CFG.ghostCap);
    }

    makeGhost(id, type, s, home, release) {
      const w = this.map.w;
      const rel = this.mode === 'coop' ? release * Math.pow(0.85, this.level - 1) : release;
      return {
        id, type, isGhost: true, home, alive: true, mode: 'house', scared: 0,
        x: s.x, y: s.y, dir: -1, p: 0, speed: 0, release: rel, spawn: s.y * w + s.x, spawnX: s.x, spawnY: s.y,
        fx: s.x, fy: s.y, pfx: s.x, pfy: s.y
      };
    }

    placePlayer(p, s) {
      p.x = s.x; p.y = s.y; p.startX = s.x; p.startY = s.y;
      p.dir = -1; p.p = 0; p.want = -1;
      p.fx = p.pfx = s.x; p.fy = p.pfy = s.y;
    }

    // ---------- Eingabe ----------
    setWant(i, d) {
      const p = this.players[i];
      if (!p || p.bot) return;
      p.want = d;
      if (d >= 0 && this.phase === 'play' && p.dir >= 0 && d === opp(p.dir) && p.p > 0 && this.isActive(p)) this.flip(p);
    }
    flip(e) {                      // Umkehren mitten auf dem Weg
      e.x += DX[e.dir]; e.y += DY[e.dir];
      e.dir = opp(e.dir); e.p = 1 - e.p;
    }

    // ---------- Wegsuche ----------
    canMove(e, d) {
      const m = this.map, t = m.nbr[(e.y * m.w + e.x) * 4 + d];
      if (t < 0) return false;
      const g = m.gateAt[t];
      if (g >= 0 && (e.isGhost || !this.gateOpen[g])) return false;
      return true;
    }
    field(src, forGhost) {
      const m = this.map, n = m.w * m.h, nb = m.nbr;
      const dist = new Int16Array(n).fill(-1);
      const q = this._q || (this._q = new Int16Array(n));
      let qh = 0, qt = 0;
      for (const s of src) if (dist[s] < 0) { dist[s] = 0; q[qt++] = s; }
      const gA = m.gateAt, gO = this.gateOpen;
      while (qh < qt) {
        const c = q[qh++], dc = dist[c] + 1;
        for (let d = 0; d < 4; d++) {
          const t = nb[c * 4 + d];
          if (t < 0 || dist[t] >= 0) continue;
          const g = gA[t];
          if (g >= 0 && (forGhost || !gO[g])) continue;
          dist[t] = dc; q[qt++] = t;
        }
      }
      return dist;
    }

    // ---------- Bewegung ----------
    advance(e, dt) {
      e.pfx = e.fx; e.pfy = e.fy;
      let d = e.speed * dt, guard = 0;
      while (d > 1e-9 && guard++ < 8) {
        if (e.dir < 0) { this.chooseDir(e); if (e.dir < 0) break; }
        const room = 1 - e.p;
        if (d < room) { e.p += d; d = 0; }
        else {
          d -= room;
          e.x += DX[e.dir]; e.y += DY[e.dir]; e.p = 0;
          if (e.isGhost) this.arriveGhost(e); else this.arrivePlayer(e);
          if (this.phase !== 'play' || e.dir === -2) break;
          this.chooseDir(e);
        }
      }
      if (e.dir >= 0) { e.fx = e.x + DX[e.dir] * e.p; e.fy = e.y + DY[e.dir] * e.p; e.face = e.dir; }
      else { e.fx = e.x; e.fy = e.y; }
    }

    chooseDir(e) {
      if (e.isGhost) { this.ghostDecide(e); return; }
      if (e.bot) this.botDecide(e);
      let d = -1;
      if (e.want >= 0 && this.canMove(e, e.want)) d = e.want;
      else if (e.dir >= 0 && this.canMove(e, e.dir)) d = e.dir;
      e.dir = d;
      if (d < 0) e.p = 0;
    }

    // ---------- Spieler ----------
    stepPlayers(dt) {
      const order = shuffle([0, 1, 2, 3], this.rnd);        // reihum zufällig: kein Platz bevorzugt
      for (const i of order) {
        const p = this.players[i];
        if (p.eliminated) continue;
        if (p.respawnT > 0) {
          p.respawnT -= dt;
          if (p.respawnT <= 0) { p.respawnT = 0; this.placePlayer(p, this.map.starts[p.id]); p.protect = CFG.protect; this.emit({ t: 'respawn', p: p.id }); }
          continue;
        }
        if (p.protect > 0) p.protect = Math.max(0, p.protect - dt);
        if (p.power > 0) { p.power -= dt; if (p.power <= 0) { p.power = 0; p.chain = 0; this.emit({ t: 'powerEnd', p: p.id }); } }
        p.speed = CFG.playerSpeed * (this.mode === 'versus' && p.power > 0 ? CFG.versus.hunterBoost : 1);
        this.advance(p, dt);
        if (this.phase !== 'play') return;
      }
    }

    arrivePlayer(p) {
      const m = this.map, idx = p.y * m.w + p.x, v = this.dots[idx];
      if (v) this.collect(p, idx, v);
      if (this.mode === 'coop') {
        for (const s of this.specials) {
          if (!s.taken && s.owner === p.id && s.x === p.x && s.y === p.y) {
            s.taken = true; p.charged = true; p.score += CFG.coop.special; p.specials++;
            this.emit({ t: 'special', p: p.id, x: p.x, y: p.y });
            this.checkSync();
          }
        }
      }
    }

    collect(p, idx, v) {
      const m = this.map, z = m.zone[idx];
      this.dots[idx] = 0;
      p.dots++;
      let val;
      if (this.mode === 'coop') val = CFG.coop.dot;
      else val = v === 2 ? CFG.versus.pellet : (z < 4 ? CFG.versus.roomDot : CFG.versus.arenaDot);
      p.score += val;
      this.emit({ t: 'dot', p: p.id, x: p.x, y: p.y, v });
      if (this.mode === 'coop') {
        this.dotsLeft--; this.team.dots++;
        if (this.team.dots % CFG.coop.extraLifeEvery === 0 && this.team.lives < CFG.coop.maxLives) { this.team.lives++; this.emit({ t: 'life' }); }
        if (this.dotsLeft <= 0) this.levelClear();
        return;
      }
      if (v === 2) this.vsPellet(p, z);
      if (z < 4) { if (--this.roomLeft[z] === 0) this.openGate(z); }
      else if (v === 1) { this.arenaLeft--; this.vs.back.push({ i: idx, t: this.playT + CFG.versus.dotRespawn }); }
    }

    vsPellet(p, z) {
      p.power = CFG.versus.powerTime; p.chain = 0;
      for (const g of this.ghosts) {
        if (!g.alive || g.mode === 'eyes') continue;
        if ((z < 4 && g.home === z) || (z === 4 && g.home < 0)) { g.scared = CFG.versus.powerTime; if (g.mode === 'normal' && g.dir >= 0 && g.p > 0) this.flip(g); }
      }
      this.emit({ t: 'pellet', p: p.id, x: p.x, y: p.y });
    }

    // ---------- Geister ----------
    stepGhosts(dt) {
      const base = CFG.playerSpeed * this.ghostSpeedFactor();
      for (const g of this.ghosts) {
        if (!g.alive) continue;
        if (g.scared > 0) g.scared = Math.max(0, g.scared - dt);
        if (g.mode === 'house') {
          if (this.playT >= g.release) { g.mode = 'normal'; g.dir = -1; g.p = 0; } else { g.pfx = g.fx; g.pfy = g.fy; continue; }
        }
        g.speed = g.mode === 'eyes' ? CFG.eyesSpeed : base * (g.scared > 0 ? CFG.scaredSpeed : 1);
        this.advance(g, dt);
      }
    }

    arriveGhost(g) {
      if (g.mode === 'eyes' && g.x === g.spawnX && g.y === g.spawnY) {
        g.mode = 'house'; g.release = this.playT + 1.5; g.scared = 0; g.dir = -2; g.p = 0;
        g.fx = g.x; g.fy = g.y;
        this.emit({ t: 'ghostRespawn', g: g.id });
      }
    }

    spawnField(g) {
      const c = this._sf || (this._sf = {});
      return c[g.spawn] || (c[g.spawn] = this.field([g.spawn], true));
    }
    argSel(g, dirs, f, wantMax) {
      const m = this.map; let best = [], bv = wantMax ? -1e9 : 1e9;
      for (const d of dirs) {
        const t = m.nbr[(g.y * m.w + g.x) * 4 + d]; let v = f[t]; if (v < 0) v = wantMax ? -1 : 9999;
        if (wantMax ? v > bv : v < bv) { bv = v; best = [d]; } else if (v === bv) best.push(d);
      }
      return best[Math.floor(this.rnd() * best.length)];
    }

    preyFor(g) {
      const out = [];
      for (const p of this.players) {
        if (!this.isActive(p) || p.protect > 0) continue;
        if (this.mode === 'versus' && g.home >= 0 && p.id !== g.home) continue;
        out.push(p);
      }
      return out;
    }

    ghostDecide(g) {
      if (g.dir === -2) { g.dir = -1; }
      const m = this.map, w = m.w, idx = g.y * w + g.x;
      const all = [];
      for (let d = 0; d < 4; d++) if (this.canMove(g, d)) all.push(d);
      if (!all.length) { g.dir = -1; return; }
      if (g.mode === 'eyes') { g.dir = this.argSel(g, all, this.spawnField(g), false); return; }
      let cand = g.dir >= 0 ? all.filter(d => d !== opp(g.dir)) : all;
      if (!cand.length) cand = all;
      if (cand.length === 1) { g.dir = cand[0]; return; }
      const fg = this.field([idx], true);
      const prey = this.preyFor(g).filter(p => fg[p.y * w + p.x] >= 0);
      shuffle(prey, this.rnd);                                         // bei gleicher Entfernung zufällig, kein Platz wird bevorzugt
      prey.sort((a, b) => fg[a.y * w + a.x] - fg[b.y * w + b.x]);
      if (g.scared > 0) {
        if (!prey.length || this.rnd() < 0.3) { g.dir = cand[Math.floor(this.rnd() * cand.length)]; return; }
        const fp = this.field([prey[0].y * w + prey[0].x], false);
        g.dir = this.argSel(g, cand, fp, true); return;
      }
      if (this.mode === 'coop' && this.scatter) {
        const s = this.map.starts[g.id % 4];
        g.dir = this.argSel(g, cand, this.field([s.y * w + s.x], true), false); return;
      }
      if (!prey.length) { g.dir = cand[Math.floor(this.rnd() * cand.length)]; return; }
      let target = prey[0], tIdx = target.y * w + target.x;
      const near = fg[tIdx];
      if (g.type === 'ambusher' && near > 4) {
        let t = tIdx;
        for (let k = 0; k < 4; k++) { const n = m.nbr[t * 4 + target.face]; if (n < 0 || m.gateAt[n] >= 0) break; t = n; }
        tIdx = t;
      } else if (g.type === 'splitter' && prey.length > 1) {
        target = prey[1]; tIdx = target.y * w + target.x;
      } else if (g.type === 'wanderer' && near > 7) {
        g.dir = cand[Math.floor(this.rnd() * cand.length)]; return;
      }
      g.dir = this.argSel(g, cand, this.field([tIdx], true), false);
    }

    // ---------- Kollisionen ----------
    collisions() {
      const R2 = CFG.collide * CFG.collide;
      const order = shuffle([0, 1, 2, 3], this.rnd);
      for (const i of order) {
        const p = this.players[i];
        if (!this.isActive(p)) continue;
        for (const g of this.ghosts) {
          if (!g.alive || g.mode === 'house' || g.mode === 'eyes') continue;
          const dx = g.fx - p.fx, dy = g.fy - p.fy;
          if (dx * dx + dy * dy >= R2) continue;
          if (this.mode === 'coop') {
            if (g.scared > 0) this.eatGhost(p, g);
            else if (p.protect <= 0) { this.killPlayer(p, 'ghost'); break; }
          } else if (p.power > 0) this.eatGhost(p, g);                 // mit Kraft frisst man jeden Geist
          else if (g.scared > 0) continue;                              // verängstigte Geister sind harmlos
          else if (p.protect <= 0) { this.killPlayer(p, 'ghost'); break; }
        }
        if (this.phase !== 'play') return;
      }
      if (this.mode === 'versus') {
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
          const pa = this.players[a], pb = this.players[b];
          if (!this.isActive(pa) || !this.isActive(pb)) continue;
          const dx = pa.fx - pb.fx, dy = pa.fy - pb.fy;
          if (dx * dx + dy * dy >= R2) continue;
          if (pa.power > 0 && pb.power <= 0 && pb.protect <= 0) this.eatPlayer(pa, pb);
          else if (pb.power > 0 && pa.power <= 0 && pa.protect <= 0) this.eatPlayer(pb, pa);
        }
      }
    }

    eatGhost(p, g) {
      const chain = this.mode === 'coop' ? this.power : p;
      const pts = CFG.ghostChain[Math.min(chain.chain, 3)];
      chain.chain++;
      p.score += pts; p.ghostsEaten++;
      g.mode = 'eyes'; g.scared = 0;
      this.emit({ t: 'ghostEaten', p: p.id, g: g.id, x: g.fx, y: g.fy, pts });
    }

    killPlayer(p, by) {
      p.deaths++;
      this.emit({ t: 'death', p: p.id, x: p.fx, y: p.fy, by });
      p.respawnT = CFG.respawnDelay; p.dir = -1; p.want = -1; p.p = 0; p.power = 0; p.chain = 0;
      p.fx = p.pfx = p.x; p.fy = p.pfy = p.y;
      if (this.mode === 'coop') {
        p.charged = false;
        for (const s of this.specials) if (s.owner === p.id) s.taken = false;   // Kristall ist wieder frei
        this.team.lives--;
        if (this.team.lives <= 0 && !this.endAfter) this.endAfter = { t: CFG.respawnDelay + 0.6, reason: 'lives' };
      } else {
        p.lives--;
        if (p.lives <= 0) { p.eliminated = true; this.emit({ t: 'eliminated', p: p.id }); }
      }
    }

    eatPlayer(h, v) {
      const loss = Math.min(v.score, CFG.versus.victimLoss);
      v.score -= loss; h.score += CFG.versus.eatPlayer; h.playersEaten++;
      this.emit({ t: 'playerEaten', hunter: h.id, victim: v.id, x: v.fx, y: v.fy });
      this.killPlayer(v, 'player');
    }

    // ---------- Zusammen: Specials, Power, Level ----------
    updateCoop(dt) {
      const C = CFG.coop;
      // Jagd- und Verstreuphasen
      this.cycleT += dt;
      const cyc = C.chase + C.scatter, ph = this.cycleT % cyc;
      const sc = ph >= C.chase;
      if (sc !== this.scatter) { this.scatter = sc; for (const g of this.ghosts) if (g.mode === 'normal' && g.scared <= 0 && g.dir >= 0 && g.p > 0) this.flip(g); }
      // Power
      if (this.power.t > 0) {
        this.power.t -= dt;
        if (this.power.t <= 0) { this.power.t = 0; this.power.chain = 0; this.wave = { state: 'wait', t: C.waveCooldown }; this.emit({ t: 'powerEnd' }); }
        return;
      }
      const w = this.wave;
      w.t -= dt;
      if (w.state === 'wait' && w.t <= 0) this.spawnWave();
      else if (w.state === 'active' && w.t <= 0) {
        this.specials = []; this.players.forEach(p => { p.charged = false; });
        this.wave = { state: 'wait', t: C.waveCooldown };
        this.emit({ t: 'fizzle' });
      }
    }

    spawnWave() {
      const m = this.map, w = m.w, T = m.w - 1;
      const s0 = m.starts[0];
      const f = this.field([s0.y * w + s0.x], false);
      const inQ = (i, lo, hi) => { const x = i % w, y = (i / w) | 0; return x >= lo && x <= hi && y >= lo && y <= hi; };
      let cand = m.openList.filter(i => inQ(i, 3, 11) && f[i] >= 10 && f[i] <= 28);   // weit weg von der Mitte, in der eigenen Ecke
      if (!cand.length) cand = m.openList.filter(i => inQ(i, 2, 13) && f[i] >= 6);
      if (!cand.length) cand = m.openList.filter(i => inQ(i, 0, 14) && f[i] >= 4);
      const i = cand[Math.floor(this.rnd() * cand.length)];
      const x = i % w, y = (i / w) | 0;
      const spots = [[x, y], [T - x, y], [x, T - y], [T - x, T - y]];
      this.specials = spots.map((s, o) => ({ owner: o, x: s[0], y: s[1], taken: false }));
      this.players.forEach(p => { p.charged = false; });
      this.wave = { state: 'active', t: CFG.coop.waveDuration };
      this.emit({ t: 'wave', specials: this.specials.map(s => ({ owner: s.owner, x: s.x, y: s.y })) });
    }

    checkSync() {
      if (!this.players.every(p => p.charged)) return;
      const C = CFG.coop;
      const dur = Math.max(C.minPower, C.powerTime - 0.7 * (this.level - 1));
      this.power = { t: dur, max: dur, chain: 0 };
      this.players.forEach(p => { p.charged = false; });
      this.specials = [];
      this.wave = { state: 'power', t: 0 };
      for (const g of this.ghosts) if (g.mode !== 'eyes') { g.scared = dur; if (g.mode === 'normal' && g.dir >= 0 && g.p > 0) this.flip(g); }
      this.emit({ t: 'sync', dur });
    }

    levelClear() {
      if (this.phase !== 'play') return;
      this.phase = 'clear'; this.phaseT = 3.2;
      this.players.forEach(p => { p.score += Math.floor(CFG.coop.clearBonus / 4); });
      this.emit({ t: 'levelClear', level: this.level });
    }

    // ---------- Gegeneinander ----------
    openGate(z) {
      const v = this.vs;
      if (this.gateOpen[z]) return;
      this.gateOpen[z] = true; v.order.push(z);
      for (const g of this.ghosts) if (g.home === z && g.alive) { g.alive = false; this.emit({ t: 'ghostPoof', g: g.id, x: g.fx, y: g.fy }); }
      this.emit({ t: 'gateOpen', p: z });
      if (v.arenaT === null) {
        v.arenaT = CFG.versus.arenaTime; v.autoT = CFG.versus.autoOpen;
        for (const g of this.ghosts) if (g.home < 0) g.release = this.playT + CFG.versus.arenaGhostRelease;
        this.emit({ t: 'arenaOpen', p: z });
      }
      this.checkPellets();
    }
    openAllGates() {
      for (let z = 0; z < 4; z++) if (!this.gateOpen[z] && !this.players[z].eliminated) this.openGate(z);
    }
    checkPellets() {
      const v = this.vs;
      if (v.pellets) return;
      const alive = this.players.filter(p => !p.eliminated).length;
      const open = this.gateOpen.filter((o, z) => o && !this.players[z].eliminated).length;
      if (open >= Math.min(2, alive) && open > 0) {
        v.pellets = true;
        this.map.arenaPellets.forEach((s, i) => { this.dots[s.y * this.map.w + s.x] = 2; v.spots[i].t = 0; });
        this.emit({ t: 'fight' });
      }
    }

    updateVersus(dt) {
      const v = this.vs, V = CFG.versus, w = this.map.w;
      if (v.arenaT !== null) {
        v.arenaT -= dt;
        if (v.arenaT <= 0) { v.arenaT = 0; this.endVersus('time'); return; }
      } else if (this.playT > V.maxRoom) this.openAllGates();
      if (v.autoT !== null) { v.autoT -= dt; if (v.autoT <= 0) { v.autoT = null; this.openAllGates(); } }
      if (v.pellets) {
        this.map.arenaPellets.forEach((s, i) => {
          const idx = s.y * w + s.x, sp = v.spots[i];
          if (this.dots[idx] === 2) return;
          if (sp.t === 0) sp.t = V.pelletRespawn;
          sp.t -= dt;
          if (sp.t <= 0) { sp.t = 0; this.dots[idx] = 2; this.emit({ t: 'pelletBack', x: s.x, y: s.y }); }
        });
      }
      while (v.back.length && v.back[0].t <= this.playT) {           // gefressene Arena-Punkte wachsen nach
        const b = v.back.shift();
        if (!this.dots[b.i]) { this.dots[b.i] = 1; this.arenaLeft++; }
      }
      if (this.players.filter(p => !p.eliminated).length <= 1) this.endVersus('last');
    }

    endVersus(reason) {
      if (this.phase === 'over') return;
      const alive = this.players.filter(p => !p.eliminated);
      if (reason === 'last' && alive.length === 1) alive[0].score += CFG.versus.lastMan;
      this.finish(reason);
    }

    // ---------- Ende ----------
    ranking() {
      const arr = this.players.slice();
      arr.sort((a, b) => (b.score - a.score) || (b.lives - a.lives) || (b.dots - a.dots) || (a.id - b.id));
      return arr;
    }
    finish(reason) {
      this.phase = 'over';
      const r = this.ranking();
      r.forEach((p, i) => { p.rank = i + 1; });
      const top = r[0];
      const winners = this.mode === 'versus' ? r.filter(p => p.score === top.score && p.lives === top.lives).map(p => p.id) : [];
      this.result = { reason, mode: this.mode, level: this.level, ranking: r.map(p => p.id), winners, mvp: top.id, total: this.players.reduce((s, p) => s + p.score, 0) };
      this.emit({ t: 'over', result: this.result });
    }

    // ---------- Takt ----------
    step(dt) {
      this.t += dt;
      if (this.phase === 'over') return;
      if (this.phase === 'countdown') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) { this.phase = 'play'; this.emit({ t: 'go' }); }
        return;
      }
      if (this.phase === 'clear') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) {
          this.level++;
          if (this.level % 2 === 0) this.team.lives = Math.min(CFG.coop.maxLives, this.team.lives + 1);
          this.setupLevel();
          this.emit({ t: 'level', level: this.level });
        }
        return;
      }
      this.playT += dt;
      this.stepPlayers(dt);
      if (this.phase !== 'play') return;
      this.stepGhosts(dt);
      this.collisions();
      if (this.phase !== 'play') return;
      if (this.mode === 'coop') this.updateCoop(dt); else this.updateVersus(dt);
      if (this.endAfter && this.phase === 'play') { this.endAfter.t -= dt; if (this.endAfter.t <= 0) this.finish(this.endAfter.reason); }
    }

    // ---------- Computer-Spieler ----------
    botDecide(p) {
      const m = this.map, w = m.w, idx = p.y * w + p.x, lvl = this.botLevel;
      const dirs = [];
      for (let d = 0; d < 4; d++) if (this.canMove(p, d)) dirs.push(d);
      if (!dirs.length) { p.want = -1; return; }
      if (dirs.length === 1) { p.want = dirs[0]; return; }
      const R = [2, 3, 3][lvl], noise = [5, 1.2, 0.3][lvl];
      const danger = [];
      if (p.protect <= 0) {
        for (const g of this.ghosts) {
          if (!g.alive || g.mode !== 'normal' || g.scared > 0) continue;
          if (Math.abs(g.x - p.x) + Math.abs(g.y - p.y) > 14) continue;
          danger.push({ f: this.field([g.y * w + g.x], true), r: R });
        }
        if (this.mode === 'versus' && p.power <= 0) {
          for (const q of this.players) {
            if (q === p || !this.isActive(q) || q.power <= 0) continue;
            if (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 16) continue;
            danger.push({ f: this.field([q.y * w + q.x], false), r: R + 1 });
          }
        }
      }
      const tg = this.botTargets(p, idx);
      const tf = this.field(tg.main, false);
      const pf = tg.pellets.length ? this.field(tg.pellets, false) : null;
      let best = -1, bs = -1e9;
      for (const d of dirs) {
        const n = m.nbr[idx * 4 + d];
        let s = 0;
        for (const dg of danger) {
          const v = dg.f[n];
          if (v >= 0 && v <= dg.r) s -= (dg.r + 1 - v) * 40;
          if (v >= 0 && v <= 1) s -= 500;
        }
        let td = tf[n]; if (td < 0) td = 60;
        let val = -td;
        if (pf && pf[n] >= 0) val = Math.max(val, -(pf[n] - 5));
        s += val;
        if (p.dir >= 0 && d === opp(p.dir)) s -= 4;
        if (d === p.dir) s += 1;
        s += this.rnd() * noise;
        if (s > bs) { bs = s; best = d; }
      }
      p.want = best;
    }

    botTargets(p, idx) {
      const m = this.map, w = m.w;
      const dotsAll = [], pellets = [];
      if (this.mode === 'coop') {
        const sp = this.specials.find(s => s.owner === p.id && !s.taken);
        if (sp) return { main: [sp.y * w + sp.x], pellets: [] };
        if (this.power.t > 2.5) {
          const gs = this.ghosts.filter(g => g.alive && g.mode === 'normal' && g.scared > 0).map(g => g.y * w + g.x);
          if (gs.length) return { main: gs, pellets: [] };
        }
        const dMe = this.field([idx], false);
        const others = this.players.filter(q => q !== p && this.isActive(q)).map(q => this.field([q.y * w + q.x], false));
        const mine = [];
        for (const i of m.openList) {
          if (!this.dots[i]) continue;
          dotsAll.push(i);
          const dm = dMe[i]; if (dm < 0) continue;
          let ok = true;
          for (const f of others) if (f[i] >= 0 && f[i] + 3 < dm) { ok = false; break; }
          if (ok) mine.push(i);
        }
        return { main: mine.length ? mine : dotsAll, pellets: [] };
      }
      if (p.power > 1.5) {
        const prey = this.players.filter(q => q !== p && this.isActive(q) && q.power <= 0 && q.protect <= 0).map(q => q.y * w + q.x);
        if (prey.length) return { main: prey, pellets: [] };
        const gs = this.ghosts.filter(g => g.alive && g.mode === 'normal' && g.scared > 0).map(g => g.y * w + g.x);
        if (gs.length) return { main: gs, pellets: [] };
      }
      for (const i of m.openList) { const v = this.dots[i]; if (v === 1) dotsAll.push(i); else if (v === 2) pellets.push(i); }
      return { main: dotsAll.length ? dotsAll : pellets, pellets: dotsAll.length ? pellets : [] };
    }
  }

  const api = { Game, CFG, DX, DY, opp, mulberry32, genCellMaze, buildCoopMap, buildVersusMap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chomp = api;
})(typeof window !== 'undefined' ? window : this);
