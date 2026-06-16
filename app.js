/* Mobile analysis core — interactive landscape dashboard on the global engine.
 * Deal or build a hand -> full read (direction, P, closest hands, keep/pass/flex tray
 * with tap-for-why) -> build a 3-tile pass and grade it (EV-loss vs optimal).
 * The Charleston practice loop + ledger (with tile-glyph chips) come in the next build.
 */
(function () {
  'use strict';
  var E = window.CharlestonEngine, TF = window.TileFaces, HN = window.HandNotation;
  var objective = 'WINS';
  var rack = null;          // array of 13 tile codes
  var selected = [];        // rack indices chosen for the pass (max 3, no jokers)
  var adviceByTile = {};    // tile -> advice object
  var building = [];        // keypad build-a-hand buffer

  // ---- offline ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./service-worker.js').catch(function () {}); });
  }

  // ---- helpers ----
  function el(id) { return document.getElementById(id); }
  function poolMax() { var m = {}; E.fullPool().forEach(function (n, t) { m[t] = n; }); return m; }
  function deal13() {
    var pool = []; E.fullPool().forEach(function (n, t) { for (var i = 0; i < n; i++) pool.push(t); });
    for (var i = pool.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    return pool.slice(0, 13);
  }
  var ORD = function (t) { return t === 'JK' ? 990 : t === 'FL' ? 980 : t === 'DW' ? 970 : (t === 'DG' || t === 'DR') ? 960 : t[0] === 'W' ? 950 : ({ B: 0, C: 100, D: 200 }[t[1]] || 900) + (+t[0] || 0); };
  function sortedIdx() { return rack.map(function (c, i) { return i; }).sort(function (a, b) { return ORD(rack[a]) - ORD(rack[b]); }); }
  function closest(r, k) {
    var sl = E.score.shortlist(r, objective), seen = {}, rows = [];
    for (var i = 0; i < sl.cand.length && rows.length < k; i++) {
      var c = sl.cand[i], key = c.target.section + '|' + c.target.name; if (seen[key]) continue; seen[key] = 1;
      var ln = E.engine.CARD.find(function (x) { return x.section === c.target.section && x.name === c.target.name; });
      if (ln) rows.push({ ln: ln, d: c.d });
    }
    return rows;
  }

  // ---- analysis render ----
  function analyze(r) { rack = r; selected = []; render(); }
  function render() {
    el('tempo').textContent = 'Single-hand analysis · policy ' + E.calibrated.policyVersion;
    if (!rack) return;
    // advice
    var adv = E.tileAdvice.advise(rack, objective, null, { passIndex: 0 });
    adviceByTile = {}; adv.advice.forEach(function (a) { adviceByTile[a.tile] = a; });
    renderDirection(); renderP(); renderHands(); renderRack(); renderBuilder(adv);
  }
  function renderDirection() {
    var c = E.direction.compass(rack, 0), h = '';
    c.sorted.slice(0, 4).forEach(function (e) {
      h += '<div class="dirbar"><span class="nm">' + e[0] + '</span><div class="bar"><span style="width:' + Math.round(100 * e[1]) + '%"></span></div><span class="muted">' + Math.round(100 * e[1]) + '%</span></div>';
    });
    h += '<div class="muted" style="margin-top:4px">' + (c.commit ? '🎯 ' : '🧭 ') + c.guidance + '</div>';
    el('dir').innerHTML = h;
  }
  function renderP() { el('pwin').textContent = Math.round(100 * E.calibrated.predictP(rack)) + '%'; }
  function renderHands() {
    var rows = closest(rack, 6), h = '';
    rows.forEach(function (r) {
      h += '<div class="cardhand"><div>' + HN.html(r.ln, { size: 15 }) + '<div class="hsec">' + HN.label(r.ln.section) + '</div></div><span class="away">' + r.d + ' away</span></div>';
    });
    el('hands').innerHTML = h || '<div class="empty">—</div>';
  }
  function renderRack() {
    var wrap = el('rack'); wrap.innerHTML = '';
    sortedIdx().forEach(function (i) {
      var c = rack[i], a = adviceByTile[c] || { action: 'FLEX' }, d = document.createElement('div');
      d.className = 'tile ' + a.action + (selected.indexOf(i) >= 0 ? ' sel' : '');
      d.innerHTML = TF.svg(c, { w: 44 }) + '<span class="tag ' + a.action + '">' + a.action + '</span>';
      d.addEventListener('click', function () { openSheet(i); });
      wrap.appendChild(d);
    });
    el('rackcount').textContent = rack.length + ' tiles · ' + selected.length + '/3 picked';
  }
  function renderBuilder(adv) {
    var b = el('builder');
    var rec = adv && adv.pass ? adv.pass : [];
    var recHTML = '<div class="rec">Recommended: <b>' + rec.map(function (c) { return TF.label(c).replace(' ', ''); }).join(' · ') + '</b>' + (adv && adv.coherentGroupWarn ? ' · ⚠ ' + adv.coherentGroupWarn : '') + '</div>';
    if (selected.length < 3) {
      var slots = '';
      for (var k = 0; k < 3; k++) slots += selected[k] != null ? '<div class="slot" style="border-style:solid">' + TF.svg(rack[selected[k]], { w: 30 }) + '</div>' : '<div class="slot">+</div>';
      b.innerHTML = '<div class="passslots">' + slots + '</div><div class="muted">Tap ' + (3 - selected.length) + ' more tile(s) in the rack, then grade.</div>' + recHTML;
      return;
    }
    var passTiles = selected.map(function (i) { return rack[i]; });
    var slots2 = passTiles.map(function (c) { return '<div class="slot" style="border-style:solid">' + TF.svg(c, { w: 30 }) + '</div>'; }).join('');
    b.innerHTML = '<div class="passslots">' + slots2 + '</div><button id="grade">Grade this pass</button> <button id="clearpass" class="ghost">Clear</button><div id="gradeout" class="verdict"></div>' + recHTML;
    el('grade').addEventListener('click', function () { gradePass(passTiles); });
    el('clearpass').addEventListener('click', function () { selected = []; render(); });
  }
  function gradePass(passTiles) {
    var out = el('gradeout'); out.innerHTML = '<span class="spin">⏳ grading (full Monte-Carlo budget)…</span>';
    setTimeout(function () {
      var g = E.charleston2.gradePass(rack, passTiles, objective, { seeds: 18 });
      var best = (g.best || []).map(function (c) { return TF.label(c).replace(' ', ''); }).join(' · ');
      var v = g.evLoss < 1e-6 ? '<b style="color:var(--good)">Optimal pass.</b>'
        : g.deadHeat ? '<b>Statistically tied with the best.</b>'
          : 'EV-loss <b>' + g.evLoss.toFixed(4) + '</b> vs best — best: <b>' + best + '</b>.';
      out.innerHTML = v + '<div class="muted" style="font-size:10.5px;margin-top:3px">CRN seeds 18 · policy ' + g.policyVersion + '</div>';
    }, 30);
  }

  // ---- tile "why" bottom sheet ----
  function openSheet(idx) {
    var c = rack[idx], a = adviceByTile[c] || {}, sel = selected.indexOf(idx) >= 0;
    var canSelect = c !== 'JK' && (sel || selected.length < 3);
    var btn = c === 'JK' ? '<span class="muted">Jokers can’t be passed.</span>'
      : '<button id="sheetSel"' + (canSelect ? '' : ' disabled') + '>' + (sel ? 'Remove from pass' : 'Add to pass') + '</button>';
    var sh = el('sheet');
    sh.innerHTML = '<button class="close" id="sheetClose">×</button>' +
      '<div class="sh-top">' + TF.svg(c, { w: 38 }) + '<b>' + TF.label(c) + '</b>' + (a.action ? '<span class="sh-act ' + a.action + '">' + a.action + '</span>' : '') + '</div>' +
      '<div class="row2"><span class="k">Now</span> ' + (a.immediate || '—') + '</div>' +
      '<div class="row2"><span class="k">Later</span> ' + (a.longTerm || '—') + '</div>' +
      (a.constraints && a.constraints.length ? '<div class="row2"><span class="k">Note</span> ' + a.constraints.join(', ') + '</div>' : '') +
      '<div style="margin-top:8px">' + btn + '</div>';
    sh.classList.remove('hidden');
    el('sheetClose').addEventListener('click', closeSheet);
    var sb = el('sheetSel'); if (sb) sb.addEventListener('click', function () {
      var k = selected.indexOf(idx); if (k >= 0) selected.splice(k, 1); else if (selected.length < 3) selected.push(idx);
      closeSheet(); render();
    });
  }
  function closeSheet() { el('sheet').classList.add('hidden'); }

  // ---- build-a-hand keypad ----
  var KEYROWS = [
    ['Bam', ['1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B']],
    ['Crak', ['1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C']],
    ['Dot', ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D']],
    ['Hon', ['WN', 'WE', 'WW', 'WS', 'DG', 'DR', 'DW', 'FL', 'JK']]
  ];
  function openKeypad() {
    building = rack ? rack.slice() : [];
    var max = poolMax(), rows = '';
    KEYROWS.forEach(function (r) {
      rows += '<div class="padrow"><span class="lab">' + r[0] + '</span>';
      r[1].forEach(function (c) { rows += '<div class="tile" data-c="' + c + '">' + TF.svg(c, { w: 34 }) + '</div>'; });
      rows += '</div>';
    });
    el('padrows').innerHTML = rows;
    el('padrows').querySelectorAll('.tile').forEach(function (t) {
      t.addEventListener('click', function () {
        var c = t.dataset.c, have = building.filter(function (x) { return x === c; }).length;
        if (building.length >= 13) return; if (have >= (max[c] || 0)) return;
        building.push(c); renderBuilding(max);
      });
    });
    renderBuilding(max);
    el('keypad').classList.remove('hidden');
  }
  function renderBuilding(max) {
    var wrap = el('building'); wrap.innerHTML = building.slice().sort(function (a, b) { return ORD(a) - ORD(b); }).map(function (c) { return '<div class="tile">' + TF.svg(c, { w: 30 }) + '</div>'; }).join('') || '<span class="muted">Tap tiles above to add.</span>';
    el('buildcount').textContent = '· ' + building.length + '/13';
    el('padHint').textContent = building.length === 13 ? 'Ready' : (13 - building.length) + ' to go';
    el('padDone').disabled = building.length !== 13;
  }

  // ---- wire ----
  function wire() {
    el('deal').addEventListener('click', function () { analyze(deal13()); });
    el('build').addEventListener('click', openKeypad);
    el('padCancel').addEventListener('click', function () { el('keypad').classList.add('hidden'); });
    el('padUndo').addEventListener('click', function () { building.pop(); renderBuilding(poolMax()); });
    el('padClear').addEventListener('click', function () { building = []; renderBuilding(poolMax()); });
    el('padDone').addEventListener('click', function () { if (building.length === 13) { el('keypad').classList.add('hidden'); analyze(building.slice()); } });
    document.querySelectorAll('#obj button').forEach(function (b) {
      b.addEventListener('click', function () { objective = b.dataset.o; document.querySelectorAll('#obj button').forEach(function (x) { x.classList.toggle('on', x === b); }); el('pwinsub').textContent = objective === 'POINTS' ? 'EV (illustrative)' : 'P(reach mahjong)'; if (rack) render(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.__app = { analyze: analyze, deal13: deal13 };
})();
