/* Automatische Bildqualität für die 3D-Ansichten: Läuft ein Spiel dauerhaft zu langsam (unter etwa 38 Bilder pro Sekunde),
   wird die Auflösung (Pixel-Verhältnis) schrittweise gesenkt. Die Spiele rufen frame(now) in ihrer Zeichenschleife auf.
   Standard: höchstens 1,5-faches Pixel-Verhältnis statt 2 (spart auf Retina- und 4K-Bildschirmen bis zur Hälfte der Pixel). */
(function () {
  window.Perf3D = {
    create: function (o) {
      var r = o.r, max = o.max || 1.5, min = o.min || .6, pr = Math.min(window.devicePixelRatio || 1, max);
      r.setPixelRatio(pr);
      var acc = 0, n = 0, last = 0, slow = 0;
      return {
        get ratio() { return pr; },
        frame: function (now) {
          if (!last) { last = now; return; }
          var dt = now - last; last = now;
          if (dt > 200 || dt <= 0) return;            // Tab-Wechsel oder bedarfsgesteuertes Zeichnen: nicht mitzählen
          acc += dt; n++;
          if (n < 40) return;
          var avg = acc / n; acc = 0; n = 0;
          if (avg > 26 && pr > min) {
            if (++slow >= 2) { slow = 0; pr = Math.max(min, +(pr * .8).toFixed(2)); r.setPixelRatio(pr); if (o.resize) o.resize(); }
          } else slow = 0;
        }
      };
    }
  };
})();
