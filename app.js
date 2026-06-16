/* M1 — PWA shell app logic. Registers the service worker (offline) and renders a
 * minimal lesson-card frame: deal a hand → Direction + Portfolio + Rack. The full
 * teaching tray (M3) and practice loop (M4) build on this frame.
 * Uses the global engine bundle (window.CharlestonEngine) — cheap ops run on the
 * main thread (<5ms each per the benchmark); choosePass moves to the worker in M4.
 */
(function () {
  'use strict';
  var E = window.CharlestonEngine;
  var objective = 'WINS';

  // --- offline: register the service worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./service-worker.js').then(function () {
        var el = document.getElementById('offline'); if (el) el.textContent = '● offline-ready';
      }).catch(function () {});
    });
  }

  function meta(c) {
    if (c === 'JK') return { cls: 'joker', num: 'JKR', suit: 'jok' };
    if (c === 'FL') return { cls: 'flower', num: '✿', suit: 'flw' };
    if (c === 'DG') return { cls: 'dragon g', num: 'GRN', suit: 'drg' };
    if (c === 'DR') return { cls: 'dragon r', num: 'RED', suit: 'drg' };
    if (c === 'DW') return { cls: 'dragon w', num: '◻0', suit: 'soap' };
    if (c[0] === 'W') return { cls: 'wind', num: c[1], suit: 'wind' };
    return { cls: { B: 'bam', C: 'crak', D: 'dot' }[c[1]], num: c[0], suit: { B: 'Bam', C: 'Crak', D: 'Dot' }[c[1]] };
  }
  function tileHTML(c) { var m = meta(c); return '<div class="tile ' + m.cls + '"><span class="num">' + m.num + '</span><span class="suit">' + m.suit + '</span></div>'; }

  function deal13() {
    var pool = []; var fp = E.fullPool();
    fp.forEach(function (n, t) { for (var i = 0; i < n; i++) pool.push(t); });
    for (var i = pool.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    return pool.slice(0, 13);
  }

  function render(rack) {
    var comp = E.direction.compass(rack, 0);
    var p = E.calibrated.predictP(rack);
    var sl = E.score.shortlist(rack, objective);
    var seen = {}, lines = [];
    for (var k = 0; k < sl.cand.length && lines.length < 5; k++) {
      var c = sl.cand[k], key = c.target.section + '|' + c.target.name;
      if (seen[key]) continue; seen[key] = 1; lines.push({ sec: c.target.section, nm: c.target.name.split(/\s+/)[0], d: c.d });
    }
    var ord = function (t) { return t === 'JK' ? 99 : t === 'FL' ? 90 : t[0] === 'D' ? 80 : t[0] === 'W' ? 70 : ({ B: 0, C: 10, D: 20 }[t[1]]) + (+t[0]); };
    var sorted = rack.slice().sort(function (a, b) { return ord(a) - ord(b); });

    var h = '';
    // Zone 1 — Direction
    h += '<div class="card"><h2>Direction <span class="z">Zone 1</span></h2>';
    comp.sorted.slice(0, 4).forEach(function (e) {
      h += '<div class="dirbar"><span class="nm">' + e[0] + '</span><div class="bar"><span style="width:' + Math.round(100 * e[1]) + '%"></span></div><span class="muted">' + Math.round(100 * e[1]) + '%</span></div>';
    });
    h += '<div class="muted" style="margin-top:6px">' + (comp.commit ? '🎯 ' : '🧭 ') + comp.guidance + '</div></div>';
    // Zone 2 — Portfolio
    h += '<div class="card"><h2>Hand Portfolio <span class="z">Zone 2</span></h2>';
    h += '<div class="big" style="color:var(--good)">' + Math.round(100 * p) + '%</div><div class="muted">P(reach mahjong) — calibrated (ECE ~2.5%)</div>';
    h += '<table><tr><th>closest hands</th><th>away</th></tr>';
    lines.forEach(function (l) { h += '<tr><td>' + l.sec + ' ' + l.nm + '</td><td>' + l.d + '</td></tr>'; });
    h += '</table></div>';
    // Rack
    h += '<div class="card"><h2>Your rack <span class="z">' + rack.length + ' tiles</span></h2><div class="tiles">' + sorted.map(tileHTML).join('') + '</div>';
    h += '<div class="prov">Full keep/pass tray + the Charleston practice loop arrive in the next build.</div></div>';
    document.getElementById('cards').innerHTML = h;
  }

  function wire() {
    var btn = document.getElementById('deal');
    if (btn) btn.addEventListener('click', function () { render(deal13()); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.__app = { render: render, deal13: deal13 }; // test hook
})();
