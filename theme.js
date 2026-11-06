/* Design "DEUKRO Cyber" (Voreinstellung). Umschalter unten links, Auswahl wird im Browser gemerkt. */
(function () {
  var KEY = 'html-games-style', FX = 'html-games-fx', RAIN = 'html-games-rain';
  var script = document.currentScript;
  var base = script.src.replace(/theme\.js.*$/, '');
  var root = document.documentElement;
  if (script.hasAttribute('data-legacy')) root.setAttribute('data-legacy', '');

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function addLink(id, href) {
    if (document.getElementById(id)) return;
    var l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.href = href;
    document.head.appendChild(l);
  }
  function apply(mode) {
    if (mode === true) mode = 'cyber';
    if (mode === false) mode = 'standard';
    if (mode === 'anime') {
      root.setAttribute('data-style', 'anime');
      addLink('anime-fonts', 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');
      addLink('anime-css', base + 'anime.css?v=4');
    } else if (mode === 'cyber') {
      root.setAttribute('data-style', 'cyber');
      addLink('cyber-fonts', 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@700;800&family=Share+Tech+Mono&display=swap');
      addLink('cyber-css', base + 'cyber.css');
    } else {
      root.removeAttribute('data-style');
    }
  }
  function applyFx(off) {
    if (off) root.setAttribute('data-fx', 'off'); else root.removeAttribute('data-fx');
  }

  function current() { var v = get(KEY); if (v === 'standard') return 'standard'; if (v === 'anime' && window.ANIME_STYLE) return 'anime'; return 'cyber'; }
  apply(current()); // Cyber ist die Voreinstellung; Anime gibt es nur auf Seiten mit window.ANIME_STYLE
  applyFx(get(FX) === 'off');
  if (get(RAIN) === 'off') root.setAttribute('data-rain', 'off');

  addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent =
      '#styleSwitch{position:fixed;left:8px;bottom:8px;z-index:500;display:flex;gap:6px;font:600 12px system-ui,sans-serif}' +
      '#styleSwitch button{font:inherit;color:#fff;background:rgba(20,22,40,.82);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:6px 10px;cursor:pointer}' +
      '#styleSwitch button:hover{border-color:#fff}';
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'styleSwitch';
    var b1 = document.createElement('button');
    var b2 = document.createElement('button');
    var b3 = document.createElement('button');
    var b4 = document.createElement('button');
    box.appendChild(b1); box.appendChild(b2); box.appendChild(b3); box.appendChild(b4);
    document.body.appendChild(box);

    function paint() {
      var st = root.getAttribute('data-style'), on = st === 'cyber';
      b1.textContent = st === 'cyber' ? 'Stil: Cyber' : (st === 'anime' ? 'Stil: Japan' : 'Stil: Standard');
      b1.title = 'Design umschalten (DEUKRO Cyber)';
      b2.hidden = !on;
      b2.textContent = root.getAttribute('data-fx') === 'off' ? 'Effekte: aus' : 'Effekte: an';
      b3.hidden = !(on && window.RAIN_OPTION);   // Regen gibt es nur in den 3D-Ansichten im Cyber-Stil
      b3.textContent = root.getAttribute('data-rain') === 'off' ? 'Regen: aus' : 'Regen: an';
      b4.hidden = !window.ANIME_STYLE;
      b4.textContent = st === 'anime' ? '🌸 Japan: an' : '🌸 Japan';
    }
    b1.onclick = function () {
      var st = root.getAttribute('data-style') || 'standard';
      var next = st === 'cyber' ? 'standard' : (st === 'standard' ? 'cyber' : 'cyber');
      apply(next); set(KEY, next); paint();
    };
    b4.onclick = function () {
      var next = root.getAttribute('data-style') === 'anime' ? 'cyber' : 'anime';
      apply(next); set(KEY, next); paint();
    };
    b2.onclick = function () {
      var off = root.getAttribute('data-fx') !== 'off';
      applyFx(off); set(FX, off ? 'off' : 'on'); paint();
    };
    b3.onclick = function () {
      var off = root.getAttribute('data-rain') !== 'off';
      if (off) root.setAttribute('data-rain', 'off'); else root.removeAttribute('data-rain');
      set(RAIN, off ? 'off' : 'on'); paint();
    };
    paint();
  });
})();
