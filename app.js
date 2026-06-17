/* Mobile — the lit-up full-card dashboard + Charleston practice loop.
 * The card IS the dashboard: every hand on the 2026 card (or the illustrative set
 * before unlock) is shown in its real 3-column section layout, as colored-text
 * notation, shaded by how much of it your current hand already covers (coverage =
 * 14 - joker-aware distance). Card-dominant, no-scroll (auto-fit shrinks rows to
 * fit any landscape device). Pass building + grading live in the slim strip above
 * a slim rack; P(win)/jokers/direction ride in the top bar; tap any hand for its
 * tiles (held vs needed).
 */
(function () {
  'use strict';
  var E = window.CharlestonEngine, TF = window.TileFaces, HN = window.HandNotation;
  var objective = 'WINS';
  var rack = null, selected = [], adviceByTile = {}, building = [];
  var sess = null, practice = false, curPass = 0;
  var sessLoss = 0, sessGraded = 0;
  var SEATNAME = { 1: 'Right', 2: 'Across', 3: 'Left' };
  var realCard = false, cardPayload = null;
  var CARDCOL = { green: '#2f7d44', red: '#b83227', blue: '#2660a4', black: '#5f5e5a' };
  var ILLUS_LAYOUT = [
    { sections: ['2026', '2468', 'Like Nos'] },
    { sections: ['Quints', 'Consec', '13579'] },
    { sections: ['W-D', '369', 'S&P'] },
  ];
  var boardRows = [];   // index -> {key, note, label, hand?, line?}

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

  // ---------- coverage shading ----------
  function klass(c) { if (c == null || c < 0) return 'cold'; if (c >= 8) return 'hot'; if (c >= 5) return 'warm'; return 'cold'; }
  function prettySec(s) { return String(s).replace(/\b[\w']+/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }); }
  function noteSpans(toks) { return toks.map(function (t) { return '<span style="color:' + t.color + '">' + t.text + '</span>'; }).join(''); }
  function realGroups(alt) { return (alt || []).map(function (g) { return { text: g.tiles, color: CARDCOL[g.color] || '#5f5e5a' }; }); }

  // active card -> [ {sections:[ {name,label,hands:[ {key,note,hand?/line?} ]} ]} ]
  function boardModel() {
    if (realCard && cardPayload) {
      var bySec = {}; cardPayload.hands.forEach(function (h) { (bySec[h.s] = bySec[h.s] || []).push(h); });
      var cols = (cardPayload.layout && cardPayload.layout.columns) || [];
      return cols.map(function (col) {
        return { sections: col.sections.map(function (sec) {
          return { name: sec, label: prettySec(sec), hands: (bySec[sec] || []).map(function (h) {
            return { key: h.s + ' | ' + h.id, note: noteSpans(realGroups(h.A && h.A[0])), hand: h };
          }) };
        }) };
      });
    }
    var bySecI = {}; E.engine.CARD.forEach(function (l) { (bySecI[l.section] = bySecI[l.section] || []).push(l); });
    return ILLUS_LAYOUT.map(function (col) {
      return { sections: col.sections.map(function (sec) {
        return { name: sec, label: HN.label(sec), hands: (bySecI[sec] || []).map(function (l) {
          return { key: l.section + ' | ' + l.name, note: noteSpans(HN.tokens(l).map(function (t) { return { text: t.text, color: t.color }; })), line: l };
        }) };
      }) };
    });
  }

  function renderBoard() {
    var board = el('board'); if (!board) return;
    var cov = rack ? E.score.coverageDetail(rack) : null;
    var model = boardModel(); boardRows = [];
    var leadKey = null, leadCov = -1;
    if (cov) cov.forEach(function (v, k) { if (v.coverage > leadCov) { leadCov = v.coverage; leadKey = k; } });
    var html = '';
    model.forEach(function (col) {
      html += '<div class="bcol">';
      col.sections.forEach(function (sec) {
        var bestC = -1; sec.hands.forEach(function (hd) { var c = cov && cov.get(hd.key); if (c && c.coverage > bestC) bestC = c.coverage; });
        html += '<div class="bsec ' + (cov ? klass(bestC) : 'cold') + '"><div class="sh"><span>' + sec.label + '</span>' + (cov && bestC >= 0 ? '<span class="cv">' + bestC + '/14</span>' : '') + '</div>';
        sec.hands.forEach(function (hd) {
          var c = cov && cov.get(hd.key), cc = c ? c.coverage : null;
          var idx = boardRows.push({ key: hd.key, note: hd.note, label: sec.label, hand: hd.hand, line: hd.line, cov: cc }) - 1;
          html += '<div class="hrow ' + (cov ? klass(cc) : 'cold') + (leadKey === hd.key && cc != null ? ' lead' : '') + '" data-idx="' + idx + '">' +
            '<span class="note">' + hd.note + '</span>' + (cc != null ? '<span class="cov">' + cc + '</span>' : '') + '</div>';
        });
        html += '</div>';
      });
      html += '</div>';
    });
    board.innerHTML = html;
    board.querySelectorAll('.hrow').forEach(function (row) { row.addEventListener('click', function () { openHandDetail(+row.dataset.idx); }); });
    scheduleFit();
  }

  // shrink --rowfs until no column overflows (guarantees no-scroll on any device/card)
  var fitPending = false;
  function scheduleFit() { if (fitPending) return; fitPending = true; requestAnimationFrame(function () { fitPending = false; fitBoard(); }); }
  function fitBoard() {
    var board = el('board'); if (!board || !board.querySelector('.bcol')) return;
    var fs = 13;
    function over() { var o = false; board.querySelectorAll('.bcol').forEach(function (c) { if (c.scrollHeight > c.clientHeight + 1) o = true; }); return o; }
    board.style.setProperty('--rowfs', fs + 'px');
    var guard = 0;
    while (over() && fs > 6 && guard < 60) { fs -= 0.5; board.style.setProperty('--rowfs', fs + 'px'); guard++; }
  }

  // ---------- top-bar chips ----------
  function renderBar() {
    if (!rack) { el('pchip').hidden = true; el('jkchip').hidden = true; el('dirchip').hidden = true; return; }
    var p = Math.round(100 * E.calibrated.predictP(rack));
    el('pchip').hidden = false; el('pchip').textContent = (objective === 'POINTS' ? 'EV ' : 'P ') + p + '%';
    var jk = rack.filter(function (c) { return c === 'JK'; }).length;
    el('jkchip').hidden = jk === 0; el('jkchip').textContent = jk + ' joker' + (jk !== 1 ? 's' : '');
    var c = E.direction.compass(rack, curPass), top = c.sorted && c.sorted[0];
    el('dirchip').hidden = !top; if (top) el('dirchip').textContent = (c.commit ? '🎯 ' : '🧭 ') + top[0] + ' ' + Math.round(100 * top[1]) + '%';
  }

  // ---------- shared read ----------
  function renderReads() {
    adviceByTile = {};
    var adv = E.tileAdvice.advise(rack, objective, null, { passIndex: curPass });
    adv.advice.forEach(function (a) { adviceByTile[a.tile] = a; });
    renderBoard(); renderBar(); renderRack(); return adv;
  }
  function renderRack() {
    var wrap = el('rack'); wrap.innerHTML = '';
    sortedIdx().forEach(function (i) {
      var c = rack[i], a = adviceByTile[c] || { action: 'FLEX' }, d = document.createElement('div');
      d.className = 'tile ' + a.action + (selected.indexOf(i) >= 0 ? ' sel' : '');
      d.innerHTML = TF.svg(c, { w: 30 }) + '<span class="tag ' + a.action + '">' + a.action + '</span>';
      d.addEventListener('click', function () { openSheet(i); });
      wrap.appendChild(d);
    });
    el('rackcount').textContent = rack.length + ' tiles · ' + selected.length + '/3 picked';
  }

  // ---------- hand-detail overlay (tiles: held vs needed) ----------
  function allTargets() { return (E.buildTargets ? E.buildTargets() : E.engine.buildTargets()) || []; }
  function openHandDetail(idx) {
    var row = boardRows[idx]; if (!row) return;
    var key = row.key, tgs = allTargets().filter(function (t) { return (t.section + ' | ' + t.name) === key; });
    var rk = rack || [], pool = {}; rk.forEach(function (c) { pool[c] = (pool[c] || 0) + 1; });
    function heldCount(t) { var h = 0; t.groups.forEach(function (g) { h += Math.min(pool[g.tile] || 0, g.count); }); return h; }
    tgs.sort(function (a, b) { return heldCount(b) - heldCount(a); });
    var t = tgs[0];
    var tilesHTML = '', usedJ = 0;
    if (t) {
      var used = {};
      t.groups.forEach(function (g) {
        for (var i = 0; i < g.count; i++) {
          var have = (pool[g.tile] || 0) - (used[g.tile] || 0), heldNow = have > 0;
          if (heldNow) used[g.tile] = (used[g.tile] || 0) + 1;
          tilesHTML += '<span style="display:inline-block;' + (heldNow ? '' : 'opacity:.3;filter:grayscale(.4)') + '">' + TF.svg(g.tile, { w: 30 }) + '</span>';
        }
      });
    }
    var cov = rack ? (E.score.coverageDetail(rack).get(key) || null) : null;
    var meta = '';
    if (cov) meta += '<div class="hd-meta">Coverage <b>' + cov.coverage + '/14</b> · still need <b>' + cov.d + '</b> tile' + (cov.d === 1 ? '' : 's') + '</div>';
    var conc = false, val = null;
    if (row.hand) { conc = !!row.hand.c; val = row.hand.v; }
    else { try { conc = E.score.isConcealedKey(key); val = E.score.V(key); } catch (e) {} }
    meta += '<div class="hd-meta">' + (conc ? 'Concealed' : 'Exposed') + (val != null ? ' · value ' + val : '') + (t ? '' : ' · no concrete target') + '</div>';
    var alts = (row.hand && row.hand.A) || null;
    var noteHTML = alts ? alts.map(function (a) { return '<span class="hd-note">' + noteSpans(realGroups(a)) + '</span>'; }).join('<span class="orsep">— or —</span>') : '<span class="hd-note">' + row.note + '</span>';
    el('hdname').textContent = row.label;
    el('hdbody').innerHTML = '<div>' + noteHTML + '</div>' + (tilesHTML ? '<div class="hd-tiles">' + tilesHTML + '</div>' : '') +
      meta + '<div class="hd-meta" style="margin-top:6px;font-size:11px">Solid = you hold it · faded = still needed' + (t && tgs.length > 1 ? ' · one suit assignment shown' : '') + '</div>';
    el('handview').classList.remove('hidden');
  }

  // ---------- ANALYZE ----------
  function analyze(r) {
    practice = false; sess = null; curPass = 0; rack = r; selected = [];
    el('ledger').classList.add('hidden');
    el('tempo').textContent = 'Single-hand analysis · policy ' + E.calibrated.policyVersion;
    var adv = renderReads(); renderAnalyzeBuilder(adv); scheduleFit();
  }
  function renderAnalyzeBuilder(adv) {
    var b = el('passbar'), rec = (adv && adv.pass) || [];
    var recHTML = '<span class="rec">Rec: <b>' + rec.map(lbl).join(' ') + '</b></span>';
    if (selected.length < 3) { b.innerHTML = slotsHTML() + '<span class="ptext muted">Tap ' + (3 - selected.length) + ' more tile(s), then grade.</span>' + recHTML; scheduleFit(); return; }
    var pass = selected.map(function (i) { return rack[i]; });
    b.innerHTML = slotsHTML() + '<span class="actbtns"><button id="grade">Grade pass</button><button id="clr" class="ghost">Clear</button></span><span id="gout" class="verdict"></span>' + recHTML;
    el('grade').addEventListener('click', function () { gradeInto('gout', pass); });
    el('clr').addEventListener('click', function () { selected = []; renderRack(); renderAnalyzeBuilder(adv); });
    scheduleFit();
  }

  // ---------- PRACTICE ----------
  function startPractice() {
    practice = true; selected = []; sessLoss = 0; sessGraded = 0;
    sess = E.session.newSession({ mode: 'sim', yourRack: deal13(), seed: (Math.random() * 1e9) | 0 });
    el('ledger').classList.remove('hidden');
    syncSession();
  }
  function syncSession() {
    var st = sess.state(); rack = st.ownRack; curPass = st.passIndex || 0; selected = [];
    renderReads(); renderLedger(st.ledger); renderAction(st); renderTempo(st); scheduleFit();
  }
  function renderTempo(st) {
    var dirName = { R: 'right', A: 'across', L: 'left' }[st.direction] || '';
    var label = st.phase === 'pass' ? 'Pass ' + (st.passIndex + 1) + ' · R' + st.round + ' → ' + dirName + (st.blindEligible ? ' (blind-eligible)' : '')
      : st.phase === 'stop' ? 'Stop decision' : st.phase === 'courtesy' ? 'Courtesy pass' : 'Charleston complete';
    el('tempo').textContent = label;
  }
  function renderAction(st) {
    var b = el('passbar');
    if (st.phase === 'pass') {
      var blindBtn = st.blindEligible ? '<button id="blindBtn" class="ghost">Pass blind</button>' : '';
      if (selected.length < 3) {
        b.innerHTML = '<span class="ptext">Pass ' + (st.passIndex + 1) + ' → ' + ({ R: 'right', A: 'across', L: 'left' }[st.direction]) + '</span>' + slotsHTML() +
          '<span class="ptext muted">Tap ' + (3 - selected.length) + ' more' + (st.blindEligible ? ', or pass blind.' : '.') + '</span><span class="actbtns">' + blindBtn + '</span>';
      } else {
        b.innerHTML = slotsHTML() + '<span class="actbtns"><button id="confirmBtn">Confirm pass</button><button id="clr2" class="ghost">Clear</button>' + blindBtn + '</span><span id="gout" class="verdict"></span>';
        el('confirmBtn').addEventListener('click', confirmPass);
        el('clr2').addEventListener('click', function () { selected = []; renderRack(); renderAction(sess.state()); });
      }
      var bb = el('blindBtn'); if (bb) bb.addEventListener('click', blindPass);
    } else if (st.phase === 'stop') {
      b.innerHTML = '<span class="ptext">First Charleston done — play the optional second?</span><span class="actbtns"><button id="contBtn">Continue</button><button id="stopBtn" class="ghost">Stop here</button></span>';
      el('contBtn').addEventListener('click', function () { sess.decideR2(true); syncSession(); });
      el('stopBtn').addEventListener('click', function () { sess.decideR2(false); syncSession(); });
    } else if (st.phase === 'courtesy') {
      b.innerHTML = '<span class="ptext">Optional courtesy — offer 0–3 across.</span>' + slotsHTML() + '<span class="actbtns"><button id="courtBtn">Send ' + selected.length + '</button><button id="skipBtn" class="ghost">Skip</button></span>';
      el('courtBtn').addEventListener('click', function () { sess.courtesy(selected.map(function (i) { return rack[i]; })); syncSession(); });
      el('skipBtn').addEventListener('click', function () { sess.courtesy([]); syncSession(); });
    } else {
      var avg = sessGraded ? (sessLoss / sessGraded) : 0;
      b.innerHTML = '<span class="summ"><span class="v">' + Math.round(100 * E.calibrated.predictP(rack)) + '%</span><span>final P(win) · EV-loss <b>' +
        (sessGraded ? sessLoss.toFixed(3) + '</b> over ' + sessGraded + ' (avg ' + avg.toFixed(3) + ')' : 'n/a</b>') + '</span></span>' +
        '<span class="actbtns"><button id="revealBtn" class="ghost">Reveal hands</button><button id="againBtn">New practice</button></span>';
      el('revealBtn').addEventListener('click', revealHands);
      el('againBtn').addEventListener('click', startPractice);
    }
    scheduleFit();
  }
  function confirmPass() {
    var pass = selected.map(function (i) { return rack[i]; });
    var out = el('gout'); if (out) out.innerHTML = '<span class="spin">⏳ grading…</span>';
    setTimeout(function () {
      var g = E.charleston2.gradePass(rack, pass, objective, { seeds: 16 });
      sessLoss += g.evLoss; sessGraded++;
      sess.applyPass(pass); syncSession();
    }, 25);
  }
  function blindPass() { sess.applyPass(null, null, true); syncSession(); }
  function revealHands() {
    var rep = sess.revealForReplay(); if (!rep) return;
    var names = ['You', 'Right', 'Across', 'Left'], h = '';
    rep.racks.forEach(function (r, s) {
      h += '<div class="hd-meta" style="margin-top:6px"><b>' + names[s] + '</b></div><div class="hd-tiles">' +
        r.slice().sort(function (a, b) { return ORD(a) - ORD(b); }).map(function (c) { return TF.svg(c, { w: 26 }); }).join('') + '</div>';
    });
    el('hdname').textContent = 'Revealed hands'; el('hdbody').innerHTML = h; el('handview').classList.remove('hidden');
  }
  function renderLedger(led) {
    var wrap = el('ledger'); if (!led || !led.seats) { wrap.innerHTML = ''; return; }
    var h = '';
    [1, 2, 3].forEach(function (s) {
      var seat = led.seats[s] || {}, solid = seat.solidHolds || [], neg = seat.notCollecting || [];
      var chips = solid.length ? solid.map(function (c) { return TF.svg(c, { w: 20 }); }).join('') : '<span class="empty2">nothing yet</span>';
      h += '<div class="ledseat"><div class="nm"><span>' + (SEATNAME[s] || s) + '</span><span>handed over</span></div><div class="ledchips">' + chips + '</div>' +
        (neg.length ? '<div class="neg">not collecting: ' + neg.join(', ') + '</div>' : '') + '</div>';
    });
    wrap.innerHTML = h;
  }

  // ---------- shared bits ----------
  function lbl(c) { return TF.label(c).replace(' ', ''); }
  function slotsHTML() {
    var s = '';
    for (var k = 0; k < 3; k++) s += selected[k] != null ? '<div class="slot full">' + TF.svg(rack[selected[k]], { w: 22 }) + '</div>' : '<div class="slot">+</div>';
    return '<div class="passslots">' + s + '</div>';
  }
  function gradeInto(outId, pass) {
    var out = el(outId); out.innerHTML = '<span class="spin">⏳ grading…</span>';
    setTimeout(function () {
      var g = E.charleston2.gradePass(rack, pass, objective, { seeds: 18 });
      var best = (g.best || []).map(lbl).join(' ');
      out.innerHTML = (g.evLoss < 1e-6 ? '<b style="color:var(--good)">Optimal.</b>' : g.deadHeat ? '<b>Tied with best.</b>' : 'EV-loss <b>' + g.evLoss.toFixed(3) + '</b> — best <b>' + best + '</b>');
    }, 25);
  }
  function reRenderAction() { if (practice) renderAction(sess.state()); else renderAnalyzeBuilder(E.tileAdvice.advise(rack, objective, null, { passIndex: curPass })); }

  // ---------- tile "why" sheet ----------
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

  // ---------- build-a-hand keypad ----------
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
  function setCardStat() {
    var b = el('loadcard'); if (b) { b.textContent = realCard ? '2026 ✓' : '2026 card'; b.disabled = !!realCard; }
    var e = el('cardstat'); if (e) e.textContent = realCard ? 'real card' : 'illustrative';
  }
  function resetViews() {
    rack = null; sess = null; selected = []; curPass = 0; practice = false; adviceByTile = {};
    el('ledger').classList.add('hidden'); el('ledger').innerHTML = '';
    el('passbar').innerHTML = '<div class="empty">Deal or build a hand, then tap 3 tiles to build a pass.</div>';
    el('rack').innerHTML = '<div class="empty">No hand yet.</div>'; el('rackcount').textContent = '';
    el('pchip').hidden = true; el('jkchip').hidden = true; el('dirchip').hidden = true;
    el('tempo').textContent = realCard ? 'Real 2026 card loaded — deal or build a hand' : '';
    renderBoard();
  }
  function doLoadCard() {
    var pw = el('cardpw').value; if (!pw) return; el('carderr').textContent = 'unlocking…';
    fetch('./card-2026.enc.json').then(function (r) { return r.json(); }).then(function (blob) { return window.CardCrypto.decrypt(blob, pw); })
      .then(function (txt) { cardPayload = JSON.parse(txt); var targets = window.CardInterp.expandCard(cardPayload); E.engine.setTargets(targets); realCard = true; el('carderr').textContent = ''; el('cardpad').classList.add('hidden'); resetViews(); setCardStat(); })
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
    document.querySelectorAll('#obj button').forEach(function (b) { b.addEventListener('click', function () { objective = b.dataset.o; document.querySelectorAll('#obj button').forEach(function (x) { x.classList.toggle('on', x === b); }); if (rack) { renderReads(); reRenderAction(); } }); });
    el('loadcard').addEventListener('click', function () { if (realCard) return; el('carderr').textContent = ''; el('cardpw').value = ''; el('cardpad').classList.remove('hidden'); el('cardpw').focus(); });
    el('cardcancel').addEventListener('click', function () { el('cardpad').classList.add('hidden'); });
    el('cardgo').addEventListener('click', doLoadCard);
    el('cardpw').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') doLoadCard(); });
    el('hdclose').addEventListener('click', function () { el('handview').classList.add('hidden'); });
    el('handview').addEventListener('click', function (ev) { if (ev.target === el('handview')) el('handview').classList.add('hidden'); });
    window.addEventListener('resize', scheduleFit);
    window.addEventListener('orientationchange', function () { setTimeout(scheduleFit, 120); });
    setCardStat(); renderBoard();   // resting card visible at launch
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.__app = { analyze: analyze, deal13: deal13, startPractice: startPractice, sess: function () { return sess; } };
})();
