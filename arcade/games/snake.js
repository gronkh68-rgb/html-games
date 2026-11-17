// Snake: Futter einsammeln, wachsen, nie in sich selbst oder die Wand fahren
(function () {
  var N = 20, C = 24, snake, dir, queue, food, bonus, acc, grow, flash;
  function free(x, y) { return !snake.some(function (s) { return s.x === x && s.y === y; }) && !(food && food.x === x && food.y === y) && !(bonus && bonus.x === x && bonus.y === y); }
  function spot() { for (var i = 0; i < 400; i++) { var x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N); if (free(x, y)) return { x: x, y: y }; } return { x: 0, y: 0 }; }
  function speed(A) { return Math.max(.06, .14 - A.level * .006); }
  ARC.add({
    id: 'snake', icon: '🐍', color: '#39ff14', w: N * C, h: N * C, noLives: true, swipe: true, pad: ['left', 'up', 'down', 'right'],
    name: ['Snake', 'Snake'], desc: ['Friss das Futter, wachse und weiche Wand und eigenem Schwanz aus. Mit jedem Level wird es schneller.', 'Eat the food, grow, and avoid the wall and your own tail. It gets faster every level.'],
    keys: ['Pfeile / WASD oder Wischen · P: Pause', 'Arrow keys / WASD or swipe · P: pause'],
    preview: function () { snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; dir = { x: 1, y: 0 }; food = { x: 15, y: 10 }; bonus = null; },
    start: function (A) { snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; dir = { x: 1, y: 0 }; queue = []; food = null; bonus = null; food = spot(); acc = 0; grow = 0; flash = 0; A.eaten = 0; A.bonusT = 0; },
    update: function (A) {
      if (A.hit('left')) q(-1, 0); if (A.hit('right')) q(1, 0); if (A.hit('up')) q(0, -1); if (A.hit('down')) q(0, 1);
      function q(x, y) { var l = queue.length ? queue[queue.length - 1] : dir; if (queue.length < 3 && !(l.x === -x && l.y === -y) && !(l.x === x && l.y === y)) queue.push({ x: x, y: y }); }
      if (bonus) { bonus.t -= A.dt; if (bonus.t <= 0) bonus = null; }
      acc += A.dt; if (flash > 0) flash -= A.dt;
      if (acc < speed(A)) return; acc = 0;
      if (queue.length) dir = queue.shift();
      var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N) { A.sfx('hit'); return A.over(); }
      var tail = grow > 0 ? 0 : 1;
      for (var i = 0; i < snake.length - tail; i++) if (snake[i].x === h.x && snake[i].y === h.y) { A.sfx('hit'); return A.over(); }
      snake.unshift(h);
      if (grow > 0) grow--; else snake.pop();
      if (food && h.x === food.x && h.y === food.y) {
        A.add(10 * A.level); A.sfx('coin'); grow += 1; A.eaten++; flash = .15; food = null; food = spot();
        if (A.eaten % 5 === 0) { A.level++; }
        if (A.eaten % 4 === 0 && !bonus) { var b = spot(); b.t = 6; bonus = b; }
      } else if (bonus && h.x === bonus.x && h.y === bonus.y) { A.add(50 * A.level); A.sfx('win'); grow += 2; bonus = null; flash = .2; }
    },
    draw: function (A, g) {
      g.fillStyle = '#070b12'; g.fillRect(0, 0, A.W, A.H);
      g.strokeStyle = 'rgba(57,255,20,.07)'; g.lineWidth = 1; g.beginPath();
      for (var i = 0; i <= N; i++) { g.moveTo(i * C, 0); g.lineTo(i * C, N * C); g.moveTo(0, i * C); g.lineTo(N * C, i * C); } g.stroke();
      if (!snake) return;
      g.shadowBlur = 14;
      if (food) { g.shadowColor = '#ff3d6e'; g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(food.x * C + C / 2, food.y * C + C / 2, C * .36 + Math.sin(A.t * 8) * 1.2, 0, 7); g.fill(); }
      if (bonus) { g.shadowColor = '#ffd400'; g.fillStyle = bonus.t < 2 && Math.floor(A.t * 8) % 2 ? '#7a6600' : '#ffd400'; g.fillRect(bonus.x * C + 4, bonus.y * C + 4, C - 8, C - 8); }
      g.shadowColor = '#39ff14';
      for (var k = snake.length - 1; k >= 0; k--) {
        var s = snake[k], a = 1 - k / (snake.length + 6) * .55;
        g.fillStyle = k === 0 ? (flash > 0 ? '#fff' : '#b6ff9a') : 'rgba(57,255,20,' + a.toFixed(2) + ')';
        g.fillRect(s.x * C + 2, s.y * C + 2, C - 4, C - 4);
      }
      g.shadowBlur = 0;
      var hd = snake[0]; g.fillStyle = '#05070d'; var ex = dir.y ? 5 : (dir.x > 0 ? 14 : 4), ey = dir.x ? 6 : (dir.y > 0 ? 14 : 4);
      g.fillRect(hd.x * C + ex, hd.y * C + ey, 4, 4); g.fillRect(hd.x * C + (dir.y ? 15 : ex), hd.y * C + (dir.x ? 15 : ey), 4, 4);
    }
  });
})();
