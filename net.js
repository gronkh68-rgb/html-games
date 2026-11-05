/* Gemeinsame Mehrspieler-Verbindung (Host <-> Mitspieler) ohne eigenen Server.
   1. Direkt per WebRTC über PeerJS (braucht peerjs, wird von der Seite geladen).
   2. Ersatz-Weg ("Relay"): Nachrichten laufen über einen öffentlichen MQTT-Broker per WebSocket,
      falls WebRTC blockiert ist. Achtung: unverschlüsselt über einen fremden Broker, nur für Spielzüge.
   API:
     Net.newCode()                         -> 5-stelliger Raumcode
     Net.host(prefix, code, onConn)        -> Promise<room>; onConn(conn) für jede neue Verbindung
     Net.join(prefix, code, {attach, open, fail}) -> {cancel()}
   conn: on('data'|'close'|'open', fn), send(obj), close(), open (bool)                              */
(function () {
  var BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  var TIMEOUT = 20000;
  var Net = window.Net = { debug: false };
  function log() { if (Net.debug) console.log.apply(console, ['[Net]'].concat([].slice.call(arguments))); }

  // Minimaler MQTT-3.1.1-Client (CONNECT/SUBSCRIBE/PUBLISH QoS0/PING)
  function MiniMqtt() {
    this.ws = null; this.buf = new Uint8Array(0); this.pingTimer = null;
    this.onmessage = null; this.onclose = null; this.ready = false; this.closing = false;
  }
  MiniMqtt.str = function (s) {
    var b = new TextEncoder().encode(s), o = new Uint8Array(2 + b.length);
    o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o;
  };
  MiniMqtt.varint = function (n) {
    var a = []; do { var d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; a.push(d); } while (n > 0); return a;
  };
  MiniMqtt.packet = function (first) {
    var parts = [].slice.call(arguments, 1), len = 0, i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var head = [first].concat(MiniMqtt.varint(len)), out = new Uint8Array(head.length + len);
    out.set(head); var o = head.length;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  };
  MiniMqtt.prototype.connect = async function (urls) {
    var lastErr = null;
    for (var i = 0; i < urls.length; i++) {
      try { await this.connectOne(urls[i]); log('Broker verbunden', urls[i]); return; }
      catch (e) { lastErr = e; log('Broker nicht erreichbar', urls[i]); }
    }
    throw lastErr || new Error('Kein Broker erreichbar');
  };
  MiniMqtt.prototype.connectOne = function (url) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var done = false, ws;
      try { ws = new WebSocket(url, 'mqtt'); } catch (e) { reject(e); return; }
      ws.binaryType = 'arraybuffer';
      function fail(err) { if (done) return; done = true; try { ws.close(); } catch (e) {} reject(err); }
      var timer = setTimeout(function () { fail(new Error('Timeout')); }, 6000);
      ws.onopen = function () {
        var id = 'g' + Math.random().toString(36).slice(2, 12);
        ws.send(MiniMqtt.packet(0x10, MiniMqtt.str('MQTT'), [4], [0x02], [0, 60], MiniMqtt.str(id)));
      };
      ws.onerror = function () { fail(new Error('WebSocket-Fehler')); };
      ws.onclose = function () {
        clearTimeout(timer);
        if (!done) { fail(new Error('Geschlossen')); return; }
        self.ready = false; clearInterval(self.pingTimer);
        if (!self.closing && self.onclose) self.onclose();
      };
      ws.onmessage = function (ev) {
        var add = new Uint8Array(ev.data), nb = new Uint8Array(self.buf.length + add.length);
        nb.set(self.buf); nb.set(add, self.buf.length); self.buf = nb;
        self.parse(function () {
          if (!done) {
            done = true; clearTimeout(timer); self.ws = ws; self.ready = true;
            self.pingTimer = setInterval(function () { try { ws.send(new Uint8Array([0xC0, 0])); } catch (e) {} }, 20000);
            resolve();
          }
        }, fail);
      };
    });
  };
  MiniMqtt.prototype.parse = function (onConnack, onFail) {
    while (this.buf.length >= 2) {
      var rem = 0, mult = 1, i = 1, ok = false;
      while (i < this.buf.length && i <= 4) {
        var b = this.buf[i++]; rem += (b & 127) * mult; mult *= 128;
        if (!(b & 128)) { ok = true; break; }
      }
      if (!ok || this.buf.length < i + rem) return;
      var first = this.buf[0], body = this.buf.slice(i, i + rem);
      this.buf = this.buf.slice(i + rem);
      var type = first >> 4;
      if (type === 2) { if (body[1] === 0) onConnack(); else onFail(new Error('CONNACK ' + body[1])); }
      else if (type === 3) {
        var tl = (body[0] << 8) | body[1], topic = new TextDecoder().decode(body.slice(2, 2 + tl)), off = 2 + tl;
        if ((first >> 1) & 3) off += 2;
        var text = new TextDecoder().decode(body.slice(off));
        if (this.onmessage) { try { this.onmessage(topic, text); } catch (e) { console.error(e); } }
      }
    }
  };
  MiniMqtt.prototype.subscribe = function (topic) { if (this.ready) this.ws.send(MiniMqtt.packet(0x82, [0, 1], MiniMqtt.str(topic), [0])); };
  MiniMqtt.prototype.publish = function (topic, text) {
    if (!this.ready) return false;
    try { this.ws.send(MiniMqtt.packet(0x30, MiniMqtt.str(topic), new TextEncoder().encode(text))); return true; } catch (e) { return false; }
  };
  MiniMqtt.prototype.close = function () {
    this.closing = true; clearInterval(this.pingTimer);
    try { if (this.ws) { this.ws.send(new Uint8Array([0xE0, 0])); this.ws.close(); } } catch (e) {}
    this.ready = false;
  };

  // Verbindungsobjekt mit der Schnittstelle einer PeerJS-DataConnection
  function RelayConn(owner, peerId) {
    this.owner = owner; this.peer = peerId; this.open = false; this.relay = true; this.handlers = {}; this.lastSeen = Date.now();
  }
  RelayConn.prototype.on = function (ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); };
  RelayConn.prototype.emit = function (ev) {
    var args = [].slice.call(arguments, 1), list = (this.handlers[ev] || []).slice();
    for (var i = 0; i < list.length; i++) { try { list[i].apply(null, args); } catch (e) { console.error(e); } }
  };
  RelayConn.prototype.send = function (obj) { if (!this.open) throw new Error('Relay-Verbindung nicht offen'); this.owner.sendConn(this, obj); };
  RelayConn.prototype.close = function () { this.owner.closeConn(this, true); };
  RelayConn.prototype.destroy = function () { if (!this.open) return; this.open = false; this.emit('close'); };

  function newId() { return 'c' + Math.random().toString(36).slice(2, 12); }

  function RelayHost(prefix, gameId, onConnection) {
    this.prefix = 'net-' + prefix; this.gameId = gameId; this.onConnection = onConnection;
    this.conns = new Map(); this.mq = null; this.closed = false; this.timer = null;
  }
  RelayHost.prototype.hostTopic = function () { return this.prefix + this.gameId + '/h'; };
  RelayHost.prototype.clientTopic = function (cid) { return this.prefix + this.gameId + '/c/' + cid; };
  RelayHost.prototype.start = async function () {
    var self = this; await this.openMq();
    this.timer = setInterval(function () { self.tick(); }, 5000);
  };
  RelayHost.prototype.openMq = async function () {
    var self = this, mq = new MiniMqtt();
    mq.onmessage = function (t, s) { self.onMsg(s); };
    mq.onclose = function () {
      if (self.closed) return; self.mq = null;
      var retry = function () { if (self.closed) return; self.openMq().catch(function () { setTimeout(retry, 3000); }); };
      setTimeout(retry, 2000);
    };
    await mq.connect(BROKERS); mq.subscribe(this.hostTopic()); this.mq = mq;
  };
  RelayHost.prototype.publishTo = function (cid, obj) { return this.mq ? this.mq.publish(this.clientTopic(cid), JSON.stringify(obj)) : false; };
  RelayHost.prototype.onMsg = function (text) {
    var m; try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m.c !== 'string' || m.c.length > 40) return;
    var conn = this.conns.get(m.c);
    if (m.t === 'hello') {
      if (!conn) { conn = new RelayConn(this, m.c); this.conns.set(m.c, conn); this.onConnection(conn); }
      conn.lastSeen = Date.now(); this.publishTo(m.c, { t: 'welcome' });
      if (!conn.open) { conn.open = true; conn.emit('open'); }
      return;
    }
    if (!conn) return;
    conn.lastSeen = Date.now();
    if (m.t === 'msg') conn.emit('data', m.d);
    else if (m.t === 'bye') { this.conns.delete(m.c); conn.destroy(); }
  };
  RelayHost.prototype.sendConn = function (conn, obj) { this.publishTo(conn.peer, { t: 'msg', d: obj }); };
  RelayHost.prototype.closeConn = function (conn) { this.publishTo(conn.peer, { t: 'bye' }); this.conns.delete(conn.peer); conn.destroy(); };
  RelayHost.prototype.tick = function () {
    var now = Date.now(), self = this;
    this.conns.forEach(function (conn, cid) {
      if (now - conn.lastSeen > TIMEOUT) { self.conns.delete(cid); conn.destroy(); } else self.publishTo(cid, { t: 'hb' });
    });
  };
  RelayHost.prototype.close = function () {
    this.closed = true; clearInterval(this.timer);
    var self = this; Array.from(this.conns.values()).forEach(function (c) { self.closeConn(c); });
    if (this.mq) this.mq.close();
  };

  function RelayClient(prefix, gameId) {
    this.prefix = 'net-' + prefix; this.gameId = gameId; this.cid = newId(); this.conn = new RelayConn(this, 'host'); this.mq = null;
    this.closed = false; this.helloTimer = null; this.hbTimer = null; this.tries = 0; this.onGiveUp = null;
  }
  RelayClient.prototype.hostTopic = function () { return this.prefix + this.gameId + '/h'; };
  RelayClient.prototype.myTopic = function () { return this.prefix + this.gameId + '/c/' + this.cid; };
  RelayClient.prototype.connect = async function () { await this.openMq(); return this.conn; };
  RelayClient.prototype.openMq = async function () {
    var self = this, mq = new MiniMqtt();
    mq.onmessage = function (t, s) { self.onMsg(s); };
    mq.onclose = function () {
      if (self.closed) return; self.mq = null;
      var retry = function () { if (self.closed) return; self.openMq().catch(function () { setTimeout(retry, 3000); }); };
      setTimeout(retry, 2000);
    };
    await mq.connect(BROKERS); mq.subscribe(this.myTopic()); this.mq = mq;
  };
  RelayClient.prototype.pub = function (obj) { obj.c = this.cid; return this.mq ? this.mq.publish(this.hostTopic(), JSON.stringify(obj)) : false; };
  RelayClient.prototype.begin = function () {   // erst aufrufen, wenn die Handler an conn hängen
    var self = this;
    var hello = function () {
      if (self.closed || self.conn.open) return;
      if (++self.tries > 15) { clearInterval(self.helloTimer); if (self.onGiveUp) self.onGiveUp(); return; }
      self.pub({ t: 'hello' });
    };
    hello(); this.helloTimer = setInterval(hello, 1000);
    this.hbTimer = setInterval(function () {
      if (self.closed) return;
      if (self.conn.open) { self.pub({ t: 'ping' }); if (Date.now() - self.conn.lastSeen > TIMEOUT) self.closeConn(self.conn, false); }
    }, 5000);
  };
  RelayClient.prototype.onMsg = function (text) {
    var m; try { m = JSON.parse(text); } catch (e) { return; }
    if (!m) return;
    var conn = this.conn; conn.lastSeen = Date.now();
    if (m.t === 'welcome') { if (!conn.open) { conn.open = true; clearInterval(this.helloTimer); conn.emit('open'); } }
    else if (m.t === 'msg') conn.emit('data', m.d);
    else if (m.t === 'bye') this.closeConn(conn, false);
  };
  RelayClient.prototype.sendConn = function (conn, obj) { this.pub({ t: 'msg', d: obj }); };
  RelayClient.prototype.closeConn = function (conn, notify) { if (notify) this.pub({ t: 'bye' }); this.shutdown(); conn.destroy(); };
  RelayClient.prototype.shutdown = function () {
    this.closed = true; clearInterval(this.helloTimer); clearInterval(this.hbTimer); if (this.mq) this.mq.close();
  };
  RelayClient.prototype.close = function () { this.closeConn(this.conn, true); };

  // Google-STUN. Optional kann eine Seite vor dem Laden TURN-Server (z. B. von Metered) in window.NET_TURN eintragen,
  // dann werden sie für Netze genutzt, in denen direkte Verbindungen scheitern. Zugangsdaten stehen bewusst nicht in dieser Datei.
  function iceOptions() {
    var extra = Array.isArray(window.NET_TURN) ? window.NET_TURN : [];
    return { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }].concat(extra) } };
  }

  Net.newCode = function () {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  };

  // Raum eröffnen. Läuft auch dann, wenn der PeerJS-Server nicht erreichbar ist (dann nur über Relay).
  Net.host = function (prefix, code, onConn) {
    return new Promise(function (resolve, reject) {
      var room = { code: code, peer: null, relay: null, close: function () {
        try { if (room.relay) room.relay.close(); } catch (e) {}
        try { if (room.peer) room.peer.destroy(); } catch (e) {}
      } };
      var done = false;
      function finish() { if (!done) { done = true; resolve(room); } }
      try { room.relay = new RelayHost(prefix, code, onConn); room.relay.start().catch(function (e) { log('Relay-Host fehlgeschlagen', e); }); } catch (e) {}
      if (!window.Peer) { setTimeout(finish, 600); return; }
      try {
        var peer = room.peer = new Peer(prefix + code, iceOptions());
        peer.on('open', finish);
        peer.on('connection', function (c) { onConn(c); });
        peer.on('error', function (e) {
          log('Peer-Fehler', e && e.type);
          if (!done && e && e.type === 'unavailable-id') { done = true; room.close(); reject(new Error('Dieser Code ist schon vergeben')); }
          else finish();
        });
        setTimeout(finish, 8000);
      } catch (e) { setTimeout(finish, 300); }
    });
  };

  // Einem Raum beitreten: erst WebRTC, bei Problemen zusätzlich über den Relay.
  Net.join = function (prefix, code, cb) {
    var finished = false, peer = null, rc = null, relayStarted = false, timers = [];
    function stopAll(except) {
      timers.forEach(clearTimeout);
      try { if (except !== 'peer' && peer) peer.destroy(); } catch (e) {}
      try { if (except !== 'relay' && rc) rc.shutdown(); } catch (e) {}
    }
    function ok(conn, via) { if (finished) return; finished = true; stopAll(via === 'relay' ? 'relay' : 'peer'); cb.open(conn, via); }
    function fail(msg) { if (finished) return; finished = true; stopAll(); cb.fail(msg); }
    async function startRelay() {
      if (finished || relayStarted) return; relayStarted = true;
      try {
        rc = new RelayClient(prefix, code);
        rc.onGiveUp = function () { fail('Raum nicht gefunden'); };
        var conn = await rc.connect();
        if (finished) { rc.shutdown(); return; }
        cb.attach(conn);
        conn.on('open', function () { ok(conn, 'relay'); });
        rc.begin();
      } catch (e) { log('Relay-Beitritt fehlgeschlagen', e); if (!peer || !window.Peer) fail('Keine Verbindung möglich'); }
    }
    if (window.Peer) {
      try {
        peer = new Peer(undefined, iceOptions());
        peer.on('open', function () {
          var c = peer.connect(prefix + code, { reliable: true });
          cb.attach(c);
          c.on('open', function () { ok(c, 'p2p'); });
          c.on('error', function () { startRelay(); });
        });
        peer.on('error', function (e) { log('Peer-Fehler', e && e.type); startRelay(); });
        timers.push(setTimeout(startRelay, 5000));
      } catch (e) { startRelay(); }
    } else startRelay();
    timers.push(setTimeout(function () { fail('Raum nicht gefunden oder keine Verbindung'); }, 30000));
    return { cancel: function () { if (!finished) { finished = true; stopAll(); } } };
  };
})();
