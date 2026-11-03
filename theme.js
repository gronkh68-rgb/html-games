/* Optionales Design "DEUKRO Cyber". Umschalter unten links, Auswahl wird im Browser gemerkt. */
(function () {
  var KEY = 'html-games-style', FX = 'html-games-fx';
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
  function apply(on) {
    if (on) {
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

  apply(get(KEY) === 'cyber');
  applyFx(get(FX) === 'off');

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
    box.appendChild(b1); box.appendChild(b2);
    document.body.appendChild(box);

    function paint() {
      var on = root.getAttribute('data-style') === 'cyber';
      b1.textContent = on ? 'Stil: Cyber' : 'Stil: Standard';
      b1.title = 'Design umschalten (DEUKRO Cyber)';
      b2.hidden = !on;
      b2.textContent = root.getAttribute('data-fx') === 'off' ? 'Effekte: aus' : 'Effekte: an';
    }
    b1.onclick = function () {
      var on = root.getAttribute('data-style') !== 'cyber';
      apply(on); set(KEY, on ? 'cyber' : 'standard'); paint();
    };
    b2.onclick = function () {
      var off = root.getAttribute('data-fx') !== 'off';
      applyFx(off); set(FX, off ? 'off' : 'on'); paint();
    };
    paint();
  });
})();
