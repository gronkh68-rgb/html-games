/* Gemeinsamer Würfel: Punkte im Standard-Stil, "Hack" mit Entschlüsselungs-Animation im Cyber-Stil. */
(function () {
  var PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  var GLYPHS = '#$%&<>/\\01ABCDEF▓▒░';
  var FRAMES = 10;
  function el() { return document.getElementById('die'); }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += '0123456789ABCDEF'[rnd(16)]; return s; }

  window.rollLabel = function () {
    return document.documentElement.getAttribute('data-style') === 'cyber' ? 'Hack starten' : 'Würfeln';
  };
  // Text je nach Stil: erster Wert im Cyber-Stil, zweiter sonst
  window.cyTx = function (c, s) { return document.documentElement.getAttribute('data-style') === 'cyber' ? c : s; };
  // Beim Umschalten des Stils Beschriftungen nachziehen
  new MutationObserver(function () {
    var b = document.getElementById('rollBtn'), cy = document.documentElement.getAttribute('data-style') === 'cyber';
    if (b) b.textContent = b.textContent.replace(/^(Hack starten|Würfeln)/, cy ? 'Hack starten' : 'Würfeln').replace(/^(Hacken|Würfeln) \(/, (cy ? 'Hacken' : 'Würfeln') + ' (');
    var e = document.getElementById('eventLbl'); if (e) e.textContent = cy ? 'Hack-Terminal' : 'Würfel-Feld';
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-style'] });
  window.rollFrames = FRAMES;

  // Ruhezustand oder Ergebnis (state: '' | 'ok')
  window.setDie = function (v, state) {
    var d = el(); if (!d) return;
    var pips = '';
    for (var k = 0; k < 9; k++) pips += '<i class="' + (PIPS[v].indexOf(k) >= 0 ? 'on' : '') + '"></i>';
    d.className = 'die' + (state ? ' ' + state : '');
    d.innerHTML = '<div class="dp">' + pips + '</div><div class="dn">' + (v || '?') + '</div>' +
      '<div class="dh">' + (v ? 'ZUGRIFF ' + v : 'BEREIT') + '</div><div class="db"><b style="width:' + (v ? 100 : 0) + '%"></b></div>';
  };
  // Ein Bild der Würfel-Animation (k = 0 … FRAMES-1): erst Zeichensalat, dann Ziffern, die "einrasten"
  window.dieFrame = function (k) {
    var d = el(); if (!d) return;
    if (!d.querySelector('.dn')) window.setDie(0);
    d.classList.add('roll'); d.classList.remove('ok');
    var late = k >= FRAMES * 0.6;
    d.querySelector('.dn').textContent = late ? String(1 + rnd(6)) : GLYPHS[rnd(GLYPHS.length)];
    d.querySelector('.dh').textContent = '0x' + hex(4);
    d.querySelector('.db b').style.width = Math.round(((k + 1) / FRAMES) * 100) + '%';
    var pips = d.querySelectorAll('.dp i'), on = PIPS[1 + rnd(6)];
    for (var i = 0; i < pips.length; i++) pips[i].className = on.indexOf(i) >= 0 ? 'on' : '';
  };
  window.dieDone = function (v) { var d = el(); if (d) d.classList.remove('roll'); window.setDie(v, 'ok'); };
})();
