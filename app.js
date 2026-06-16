/* Mobile — analysis core + Charleston practice loop, on the global engine bundle.
 * Analyze: deal/build a hand -> full read -> grade one pass.
 * Practice: deal -> step the Charleston vs sim opponents (R1 -> stop -> R2 -> courtesy
 *   -> done), pass/blind/courtesy, glyph Information Ledger, replay reveal + EV-loss grade.
 * Blind + courtesy are human actions (sim opponents keep their policy; no recalibration).
 */
(function () {
  'use strict';
  var E = window.CharlestonEngine, TF = window.TileFaces, HN = window.HandNotation;
  var objective = 'WINS';
  var rack = null, selected = [], adviceByTile = {}, building = [];
  var sess = null, practice = false, curPass = 0;       // session state
  var sessLoss = 0, sessGraded = 0;                      // EV-loss accumulation
  var SEATNAME = { 1: 'Right', 2: 'Across', 3: 'Left' };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('./service-worker.js').catch(function () {}); });
  }

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

  // ---------- shared read renderers ----------
  function renderReads() {
    adviceByTile = {};
    var adv = E.tileAdvice.advise(rack, objective, null, { passIndex: curPass });
    adv.advice.forEach(function (a) { adviceByTile[a.tile] = a; });
    renderDirection(); renderP(); renderHands(); renderRack(); return adv;
  }
  function renderDirection() {
    var c = E.direction.compass(rack, curPass), h = '';
    c.sorted.slice(0, 4).forEach(function (e) { h += '<div class="dirbar"><span class="nm">' + e[0] + '</span><div class="bar"><span style="width:' + Math.round(100 * e[1]) + '%"></span></div><span class="muted">' + Math.round(100 * e[1]) + '%</span></div>'; });
    h += '<div class="muted" style="margin-top:4px">' + (c.commit ? '🎯 ' : '🧭 ') + c.guidance + '</div>';
    el('dir').innerHTML = h;
  }
  function renderP() { el('pwin').textContent = Math.round(100 * E.calibrated.predictP(rack)) + '%'; }
  function renderHands() {
    var h = ''; closest(rack, 6).forEach(function (r) { h += '<div class="cardhand"><div>' + HN.html(r.ln, { size: 15 }) + '<div class="hsec">' + HN.label(r.ln.section) + '</div></div><span class="away">' + r.d + ' away</span></div>'; });
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

  // ---------- ANALYZE mode ----------
  function analyze(r) { practice = false; sess = null; curPass = 0; rack = r; selected = []; el('ledger').classList.add('hidden'); el('tempo').textContent = 'Single-hand analysis · policy ' + E.calibrated.policyVersion; var adv = renderReads(); renderAnalyzeBuilder(adv); }
  function renderAnalyzeBuilder(adv) {
    var b = el('builder'), rec = (adv && adv.pass) || [];
    var recHTML = '<div class="rec">Recommended: <b>' + rec.map(lbl).join(' · ') + '</b></div>';
    if (selected.length < 3) { b.innerHTML = slotsHTML() + '<div class="muted">Tap ' + (3 - selected.length) + ' more tile(s), then grade.</div>' + recHTML; return; }
    var pass = selected.map(function (i) { return rack[i]; });
    b.innerHTML = slotsHTML() + '<button id="grade">Grade this pass</button> <button id="clr" class="ghost">Clear</button><div id="gout" class="verdict"></div>' + recHTML;
    el('grade').addEventListener('click', function () { gradeInto('gout', pass); });
    el('clr').addEventListener('click', function () { selected = []; renderReads(); renderAnalyzeBuilder(adv); });
  }

  // ---------- PRACTICE mode ----------
  function startPractice() {
    practice = true; selected = []; sessLoss = 0; sessGraded = 0;
    sess = E.session.newSession({ mode: 'sim', yourRack: deal13(), seed: (Math.random() * 1e9) | 0 });
    el('ledger').classList.remove('hidden');
    syncSession();
  }
  function syncSession() {
    var st = sess.state(); rack = st.ownRack; curPass = st.passIndex || 0; selected = [];
    renderReads(); renderLedger(st.ledger); renderAction(st); renderTempo(st);
  }
  function renderTempo(st) {
    var dirName = { R: 'right', A: 'across', L: 'left' }[st.direction] || '';
    var label = st.phase === 'pass' ? 'Pass ' + (st.passIndex + 1) + ' · R' + st.round + ' → ' + dirName + (st.blindEligible ? ' (blind-eligible)' : '')
      : st.phase === 'stop' ? 'Stop decision' : st.phase === 'courtesy' ? 'Courtesy pass' : 'Charleston complete';
    el('tempo').textContent = label;
  }
  function renderAction(st) {
    var b = el('builder');
    if (st.phase === 'pass') {
      var blindBtn = st.blindEligible ? ' <button id="blindBtn" class="ghost">Pass blind</button>' : '';
      if (selected.length < 3) { b.innerHTML = '<div class="muted" style="margin-bottom:6px">Pass ' + (st.passIndex + 1) + ' → ' + ({ R: 'right', A: 'across', L: 'left' }[st.direction]) + '</div>' + slotsHTML() + '<div class="muted">Tap ' + (3 - selected.length) + ' more, then confirm.' + (st.blindEligible ? ' Or pass the incoming blind.' : '') + '</div><div class="actbtns">' + blindBtn + '</div>'; }
      else { b.innerHTML = slotsHTML() + '<div class="actbtns"><button id="confirmBtn">Confirm pass</button><button id="clr2" class="ghost">Clear</button>' + blindBtn + '</div><div id="gout" class="verdict"></div>'; el('confirmBtn').addEventListener('click', confirmPass); el('clr2').addEventListener('click', function () { selected = []; renderReads(); renderAction(sess.state()); }); }
      var bb = el('blindBtn'); if (bb) bb.addEventListener('click', blindPass);
    } else if (st.phase === 'stop') {
      b.innerHTML = '<div class="muted" style="margin-bottom:8px">First Charleston done. Play the optional second Charleston?</div><div class="actbtns"><button id="contBtn">Continue</button><button id="stopBtn" class="ghost">Stop here</button></div>';
      el('contBtn').addEventListener('click', function () { sess.decideR2(true); syncSession(); });
      el('stopBtn').addEventListener('click', function () { sess.decideR2(false); syncSession(); });
    } else if (st.phase === 'courtesy') {
      b.innerHTML = '<div class="muted" style="margin-bottom:6px">Optional courtesy — offer 0–3 across.</div>' + slotsHTML() + '<div class="actbtns"><button id="courtBtn">Send ' + selected.length + '</button><button id="skipBtn" class="ghost">Skip</button></div>';
      el('courtBtn').addEventListener('click', function () { sess.courtesy(selected.map(function (i) { return rack[i]; })); syncSession(); });
      el('skipBtn').addEventListener('click', function () { sess.courtesy([]); syncSession(); });
    } else { // done
      var avg = sessGraded ? (sessLoss / sessGraded) : 0;
      b.innerHTML = '<div class="summ"><div class="v" style="color:var(--good)">' + Math.round(100 * E.calibrated.predictP(rack)) + '%</div>final P(win)</div>' +
        '<div class="muted" style="margin-top:6px">Charleston EV-loss: <b>' + (sessGraded ? sessLoss.toFixed(4) + '</b> over ' + sessGraded + ' graded pass(es) · avg ' + avg.toFixed(4) : 'n/a (no graded passes)') + '</div>' +
        '<div class="muted" style="font-size:11px">Lower is better; 0 = every pass optimal.</div>' +
        '<div class="actbtns"><button id="revealBtn" class="ghost">Reveal hands</button><button id="againBtn">New practice</button></div>';
      el('revealBtn').addEventListener('click', revealHands);
      el('againBtn').addEventListener('click', startPractice);
    }
  }
  function confirmPass() {
    var pass = selected.map(function (i) { return rack[i]; });
    var out = el('gout'); if (out) out.innerHTML = '<span class="spin">⏳ grading…</span>';
    setTimeout(function () {
      var g = E.charleston2.gradePass(rack, pass, objective, { seeds: 16 });
      sessLoss += g.evLoss; sessGraded++;
      sess.applyPass(pass);
      syncSession();
    }, 25);
  }
  function blindPass() { sess.applyPass(null, null, true); syncSession(); }
  function revealHands() {
    var rep = sess.revealForReplay(); if (!rep) return;
    var names = ['You', 'Right', 'Across', 'Left'], h = '';
    rep.racks.forEach(function (r, s) {
      h += '<div class="hsec" style="margin-top:4px">' + names[s] + '</div><div style="display:flex;flex-wrap:wrap;gap:3px">' + r.slice().sort(function (a, b) { return ORD(a) - ORD(b); }).map(function (c) { return TF.svg(c, { w: 24 }); }).join('') + '</div>';
    });
    el('hands').innerHTML = h;
  }
  function renderLedger(led) {
    var wrap = el('ledger'); if (!led || !led.seats) { wrap.innerHTML = ''; return; }
    var h = '';
    [1, 2, 3].forEach(function (s) {
      var seat = led.seats[s] || {}, solid = seat.solidHolds || [], neg = seat.notCollecting || [];
      var chips = solid.length ? solid.map(function (c) { return TF.svg(c, { w: 22 }); }).join('') : '<span class="empty2">nothing yet</span>';
      h += '<div class="ledseat"><div class="nm"><span>' + (SEATNAME[s] || s) + '</span><span>handed over</span></div><div class="ledchips">' + chips + '</div>' +
        (neg.length ? '<div class="neg">not collecting: ' + neg.join(', ') + '</div>' : '') + '</div>';
    });
    wrap.innerHTML = h;
  }

  // ---------- shared bits ----------
  function lbl(c) { return TF.label(c).replace(' ', ''); }
  function slotsHTML() {
    var s = '';
    for (var k = 0; k < 3; k++) s += selected[k] != null ? '<div class="slot" style="border-style:solid">' + TF.svg(rack[selected[k]], { w: 30 }) + '</div>' : '<div class="slot">+</div>';
    return '<div class="passslots">' + s + '</div>';
  }
  function gradeInto(outId, pass) {
    var out = el(outId); out.innerHTML = '<span class="spin">⏳ grading (full budget)…</span>';
    setTimeout(function () {
      var g = E.charleston2.gradePass(rack, pass, objective, { seeds: 18 });
      var best = (g.best || []).map(lbl).join(' · ');
      out.innerHTML = (g.evLoss < 1e-6 ? '<b style="color:var(--good)">Optimal pass.</b>' : g.deadHeat ? '<b>Tied with the best.</b>' : 'EV-loss <b>' + g.evLoss.toFixed(4) + '</b> — best: <b>' + best + '</b>.') + '<div class="muted" style="font-size:10.5px">policy ' + g.policyVersion + '</div>';
    }, 25);
  }
  function reRenderAction() { if (practice) renderAction(sess.state()); else renderAnalyzeBuilder(E.tileAdvice.advise(rack, objective, null, { passIndex: curPass })); }

  // ---------- tile "why" sheet (+ add-to-pass) ----------
  function openSheet(idx) {
    var c = rack[idx], a = adviceByTile[c] || {}, sel = selected.indexOf(idx) >= 0;
    var canSel = c !== 'JK' && (sel || selected.length < 3);
    var btn = c === 'JK' ? '<span class="muted">Jokers can’t be passed.</span>' : '<button id="ssel"' + (canSel ? '' : ' disabled') + '>' + (sel ? 'Remove from pass' : 'Add to pass') + '</button>';
    var sh = el('sheet');
    sh.innerHTML = '<button class="close" id="sclose">×</button><div class="sh-top">' + TF.svg(c, { w: 38 }) + '<b>' + TF.label(c) + '</b>' + (a.action ? '<span class="sh-act ' + a.action + '">' + a.action + '</span>' : '') + '</div>' +
      '<div class="row2"><span class="k">Now</span> ' + (a.immediate || '—') + '</div><div class="row2"><span class="k">Later</span> ' + (a.longTerm || '—') + '</div>' +
      (a.constraints && a.constraints.length ? '<div class="row2"><span class="k">Note</span> ' + a.constraints.join(', ') + '</div>' : '') + '<div style="margin-top:8px">' + btn + '</div>';
    sh.classList.remove('hidden');
    el('sclose').addEventListener('click', closeSheet);
    var sb = el('ssel'); if (sb) sb.addEventListener('click', function () { var k = selected.indexOf(idx); if (k >= 0) selected.splice(k, 1); else if (selected.length < 3) selected.push(idx); closeSheet(); renderRack(); reRenderAction(); });
  }
  function closeSheet() { el('sheet').classList.add('hidden'); }

  // ---------- build-a-hand keypad (Analyze) ----------
  var KEYROWS = [['Bam', ['1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B']], ['Crak', ['1C', '2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C']], ['Dot', ['1D', '2D', '3D', '4D', '5D', '6D', '7D', '8D', '9D']], ['Hon', ['WN', 'WE', 'WW', 'WS', 'DG', 'DR', 'DW', 'FL', 'JK']]];
  function openKeypad() {
    building = (rack && !practice) ? rack.slice() : [];
    var rows = ''; KEYROWS.forEach(function (r) { rows += '<div class="padrow"><span class="lab">' + r[0] + '</span>'; r[1].forEach(function (c) { rows += '<div class="tile" data-c="' + c + '">' + TF.svg(c, { w: 34 }) + '</div>'; }); rows += '</div>'; });
    el('padrows').innerHTML = rows;
    var max = poolMax();
    el('padrows').querySelectorAll('.tile').forEach(function (t) { t.addEventListener('click', function () { var c = t.dataset.c, have = building.filter(function (x) { return x === c; }).length; if (building.length >= 13 || have >= (max[c] || 0)) return; building.push(c); renderBuilding(max); }); });
    renderBuilding(max); el('keypad').classList.remove('hidden');
  }
  function renderBuilding(max) {
    el('building').innerHTML = building.slice().sort(function (a, b) { return ORD(a) - ORD(b); }).map(function (c) { return '<div class="tile">' + TF.svg(c, { w: 30 }) + '</div>'; }).join('') || '<span class="muted">Tap tiles above to add.</span>';
    el('buildcount').textContent = '· ' + building.length + '/13'; el('padHint').textContent = building.length === 13 ? 'Ready' : (13 - building.length) + ' to go'; el('padDone').disabled = building.length !== 13;
  }

  // ---------- real 2026 card (password-locked) ----------
  var realCard = false;
  function setCardStat() { var e = el('cardstat'); if (e) e.textContent = realCard ? '2026 ✓' : 'illustrative'; }
  function rerenderCurrent() { if (sess) syncSession(); else if (rack) { renderReads(); reRenderAction(); } }
  function doLoadCard() {
    var pw = el('cardpw').value; if (!pw) return; el('carderr').textContent = 'unlocking…';
    fetch('./card-2026.enc.json').then(function (r) { return r.json(); }).then(function (blob) { return window.CardCrypto.decrypt(blob, pw); })
      .then(function (txt) { var targets = window.CardInterp.expandCard(JSON.parse(txt)); E.setTargets(targets); realCard = true; el('cardpad').classList.add('hidden'); setCardStat(); rerenderCurrent(); })
      .catch(function () { el('carderr').textContent = 'Wrong password or card failed to load.'; });
  }

  // ---------- wire ----------
  function wire() {
    el('practice').addEventListener('click', startPractice);
    el('deal').addEventListener('click', function () { analyze(deal13()); });
    el('build').addEventListener('click', openKeypad);
    el('padCancel').addEventListener('click', function () { el('keypad').classList.add('hidden'); });
    el('padUndo').addEventListener('click', function () { building.pop(); renderBuilding(poolMax()); });
    el('padClear').addEventListener('click', function () { building = []; renderBuilding(poolMax()); });
    el('padDone').addEventListener('click', function () { if (building.length === 13) { el('keypad').classList.add('hidden'); analyze(building.slice()); } });
    document.querySelectorAll('#obj button').forEach(function (b) { b.addEventListener('click', function () { objective = b.dataset.o; document.querySelectorAll('#obj button').forEach(function (x) { x.classList.toggle('on', x === b); }); el('pwinsub').textContent = objective === 'POINTS' ? 'EV (illustrative)' : 'P(reach mahjong)'; if (rack) { renderReads(); reRenderAction(); } }); });
    el('loadcard').addEventListener('click', function () { el('carderr').textContent = ''; el('cardpw').value = ''; el('cardpad').classList.remove('hidden'); el('cardpw').focus(); });
    el('cardcancel').addEventListener('click', function () { el('cardpad').classList.add('hidden'); });
    el('cardgo').addEventListener('click', doLoadCard);
    el('cardpw').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doLoadCard(); });
    setCardStat();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.__app = { analyze: analyze, deal13: deal13, startPractice: startPractice, sess: function () { return sess; } };
})();
