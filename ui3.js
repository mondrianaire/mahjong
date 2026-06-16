(function () {
  'use strict';
  const L = window.Lab, E = L.engine;
  let objective = 'WINS', sess = null, selected = [];

  function meta(c) {
    if (c === 'JK') return { cls: 'joker', num: 'JKR', suit: 'jok' };
    if (c === 'FL') return { cls: 'flower', num: '✿', suit: 'flw' };
    if (c === 'DG') return { cls: 'dragon g', num: 'GRN', suit: 'drg' };
    if (c === 'DR') return { cls: 'dragon r', num: 'RED', suit: 'drg' };
    if (c === 'DW') return { cls: 'dragon w', num: '◻0', suit: 'soap' };
    if (c[0] === 'W') return { cls: 'wind', num: c[1], suit: 'wind' };
    return { cls: { B: 'bam', C: 'crak', D: 'dot' }[c[1]], num: c[0], suit: { B: 'Bam', C: 'Crak', D: 'Dot' }[c[1]] };
  }
  function tileNode(c, sm, cls) { const m = meta(c), d = document.createElement('div'); d.className = 'tile ' + m.cls + (sm ? ' sm' : '') + (cls ? ' ' + cls : ''); d.innerHTML = '<span class="num">' + m.num + '</span><span class="suit">' + m.suit + '</span>'; return d; }

  function deal13() { const p = []; for (const [t, n] of E.fullPool()) for (let i = 0; i < n; i++) p.push(t); for (let i = p.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[p[i], p[j]] = [p[j], p[i]]; } return p.slice(0, 13); }
  function start() { sess = L.session.newSession({ mode: 'sim', yourRack: deal13(), seed: (Math.random() * 1e9) | 0 }); selected = []; renderAll(); }

  function renderAll() {
    const st = sess.state();
    document.getElementById('tempo').textContent = 'policy ' + L.stats.ROLLOUT_POLICY.version;
    if (st.phase === 'stop') return renderStop(st);
    if (st.phase === 'done') return renderDone(st);
    renderDirection(st); renderPortfolio(st); renderTray(st); renderBuilder(st); renderLedger(st); renderState(st);
  }

  function renderPortfolio(st) {
    const p = L.cal.predictP(st.ownRack);
    const sl = L.score.shortlist(st.ownRack, objective);
    const seen = new Set(), lines = [];
    for (const c of sl.cand) { const key = c.target.section + '|' + c.target.name; if (seen.has(key)) continue; seen.add(key); lines.push({ sec: c.target.section, nm: c.target.name.split(/\s+/)[0], d: c.d }); if (lines.length >= 5) break; }
    let h = '<div class="big" style="color:var(--good)">' + Math.round(100 * p) + '% <span class="muted" style="font-weight:400;font-size:12px">P(reach mahjong) — calibrated</span></div>';
    h += '<div class="prov">ECE ~2.5% on held-out self-play · policy ' + L.cal.policyVersion + '</div>';
    h += '<table><tr><th>closest hands</th><th>away</th></tr>';
    for (const l of lines) h += '<tr><td>' + l.sec + ' ' + l.nm + '</td><td>' + l.d + '</td></tr>';
    h += '</table>';
    document.getElementById('portfolio').innerHTML = h;
  }

  function renderDirection(st) {
    const c = L.dir.compass(st.ownRack, st.passIndex);
    let h = '';
    c.sorted.slice(0, 4).forEach(([s, w]) => { h += '<div class="dirbar"><span class="nm">' + s + '</span><div class="bar"><span style="width:' + Math.round(100 * w) + '%"></span></div><span class="muted">' + Math.round(100 * w) + '%</span></div>'; });
    h += '<div class="muted" style="margin-top:6px">' + (c.commit ? '🎯 ' : '🧭 ') + c.guidance + ' <span class="prov">concentration ' + c.concentration.toFixed(2) + '</span></div>';
    document.getElementById('dir').innerHTML = h;
  }

  function renderTray(st) {
    const adv = L.ta.advise(st.ownRack, objective, null, { passIndex: st.passIndex });
    const byTile = {}; adv.advice.forEach(a => byTile[a.tile] = a);
    const ord = c => c === 'JK' ? 99 : c === 'FL' ? 90 : c[0] === 'D' ? 80 : c[0] === 'W' ? 70 : ({ B: 0, C: 10, D: 20 }[c[1]]) + (+c[0]);
    const tray = document.getElementById('tray'); tray.innerHTML = '';
    const row = document.createElement('div'); row.className = 'tray';
    st.ownRack.map((c, i) => i).sort((a, b) => ord(st.ownRack[a]) - ord(st.ownRack[b])).forEach(i => {
      const c = st.ownRack[i], a = byTile[c];
      const wrap = document.createElement('div'); wrap.className = 'tilewrap';
      const t = tileNode(c, false, a.action + (selected.includes(i) ? ' sel' : ''));
      t.addEventListener('click', () => { const k = selected.indexOf(i); if (k >= 0) selected.splice(k, 1); else if (selected.length < 3 && c !== 'JK') selected.push(i); renderAll(); });
      wrap.appendChild(t);
      const lab = document.createElement('div'); lab.className = 'muted'; lab.style.cssText = 'font-size:10px;text-align:center;margin-top:2px'; lab.textContent = a.action; wrap.appendChild(lab);
      const ex = document.createElement('div'); ex.className = 'explain'; ex.innerHTML = '<b>Now:</b> ' + a.immediate + '<br><b>Later:</b> ' + a.longTerm + (a.constraints.length ? '<br><i>' + a.constraints.join(', ') + '</i>' : '');
      wrap.appendChild(ex);
      wrap.addEventListener('mouseenter', () => wrap.classList.add('open')); wrap.addEventListener('mouseleave', () => wrap.classList.remove('open'));
      row.appendChild(wrap);
    });
    tray.appendChild(row);
    document.getElementById('trayhint').innerHTML = 'Hover a tile for its immediate / long-term effect. Recommended pass: <b>' + adv.pass.map(c => meta(c).num).join(' ') + '</b>' + (adv.coherentGroupWarn ? ' · ⚠ ' + adv.coherentGroupWarn : '') + '. Click 3 tiles to assemble your pass.';
  }

  function renderBuilder(st) {
    const b = document.getElementById('builder');
    if (selected.length < 3) { b.innerHTML = '<div class="muted">Select ' + (3 - selected.length) + ' more tile(s) in the tray to build your pass.</div>'; return; }
    const pass = selected.map(i => st.ownRack[i]);
    const g = L.ch.gradePass(st.ownRack, pass, objective, { seeds: 36 });
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px'; pass.forEach(c => row.appendChild(tileNode(c, true)));
    const tie = g.deadHeat ? ' <span class="pill dead">≈ optimal (dead heat)</span>' : '';
    const verdict = g.evLoss < 1e-6 ? '<b style="color:var(--good)">Optimal pass.</b>' : (g.deadHeat ? 'Statistically tied with the best.' : 'EV-loss <b>' + g.evLoss.toFixed(4) + '</b> vs best — best is <b>' + g.best.map(c => meta(c).num).join(' ') + '</b>.');
    b.innerHTML = '<div>' + row.outerHTML + '</div><div class="muted">' + verdict + tie + '</div>' +
      '<div style="margin-top:8px"><button id="confirm">Confirm pass ' + (st.direction === 'R' ? '→ right' : st.direction === 'L' ? '→ left' : '↔ across') + '</button></div>' +
      '<div class="prov">EV-loss in strength units · CRN ' + 36 + ' shared incoming · policy ' + g.policyVersion + '</div>';
    document.getElementById('confirm').addEventListener('click', () => { const res = sess.applyPass(pass); selected = []; flashReceived(res.received); renderAll(); });
  }

  function flashReceived(r) { const s = document.getElementById('state'); if (s) s.dataset.recv = r.join(' '); }

  function renderLedger(st) {
    const led = st.ledger; let h = '';
    for (const seat of [1, 2, 3]) {
      const s = led.seats[seat];
      h += '<div class="seat"><div class="hd">Seat ' + seat + (seat === 1 ? ' (right)' : seat === 3 ? ' (left)' : ' (across)') + '</div>';
      if (s.solidHolds.length) { h += '<div class="chips">'; s.solidHolds.forEach(t => h += '<span class="ledchip">' + meta(t).num + '</span>'); h += ' <span class="muted" style="font-size:10px">just handed over</span></div>'; }
      if (s.fadedHolds.length) { h += '<div class="chips">'; s.fadedHolds.forEach(f => h += '<span class="ledchip faded">' + meta(f.tile).num + ' ' + Math.round(100 * f.p) + '%</span>'); h += '</div>'; }
      if (s.notCollecting.length) h += '<div class="notcol">✗ not collecting: ' + s.notCollecting.join(', ') + '</div>';
      if (s.lean) h += '<div class="lean">lean (tentative): ' + s.lean.section + ' ' + Math.round(100 * s.lean.p) + '%</div>';
      if (!s.solidHolds.length && !s.fadedHolds.length && !s.notCollecting.length) h += '<div class="muted">nothing yet</div>';
      h += '</div>';
    }
    document.getElementById('ledger').innerHTML = h;
  }

  function renderState(st) {
    const names = ['right', 'across', 'left', 'left', 'across', 'right'];
    document.getElementById('state').innerHTML =
      '<div class="big">Pass ' + (st.passIndex + 1) + ' · R' + st.round + ' ' + (st.direction === 'R' ? '→ right' : st.direction === 'L' ? '→ left' : '↔ across') + (st.blindEligible ? ' · blind-eligible' : '') + '</div>' +
      '<div class="muted">Jokers in hand: <b>' + st.jokers + '</b> · ' + (st.jokers ? '~+12% win prob each — never pass' : 'none yet') + '</div>' +
      (st.ledger.notReturned.length ? '<div class="muted">You passed, never saw again: ' + st.ledger.notReturned.map(c => meta(c).num).join(' ') + '</div>' : '') +
      '<div class="prov">Spend deliberation here — empirically ~16.7s/Charleston decision vs ~3.5s in play.</div>';
  }

  function renderStop(st) {
    renderDirection(st); renderTray({ ...st, passIndex: 3 }); renderLedger(st); renderState(st);
    document.getElementById('builder').innerHTML = '<div class="big">Second Charleston?</div>' +
      '<div class="muted">Continue only if you have ≥3 clearly passable tiles. Habitual stopping is a flagged myth.</div>' +
      '<div style="margin-top:8px;display:flex;gap:8px"><button id="cont">Continue (R2)</button><button class="ghost" id="stop">Stop here</button></div>';
    document.getElementById('cont').addEventListener('click', () => { sess.decideR2(true); selected = []; renderAll(); });
    document.getElementById('stop').addEventListener('click', () => { sess.decideR2(false); selected = []; renderAll(); });
  }

  function renderDone(st) {
    renderDirection(st); renderLedger(st); renderState(st);
    const c = L.dir.compass(st.ownRack, 6);
    document.getElementById('tray').innerHTML = '<div class="rec">Charleston complete. Final direction: <b>' + c.top[0] + '</b>. Your hand is set for the wall.</div>';
    document.getElementById('trayhint').textContent = '';
    // replay reveal (sim only) — legitimate full-state teaching view
    const rv = sess.revealForReplay();
    let h = '<div class="big">Replay reveal (teaching)</div><table><tr><th>Seat</th><th>Your read</th><th>Actual direction</th></tr>';
    for (const seat of [1, 2, 3]) {
      const led = st.ledger.seats[seat]; const truth = L.score.bestLine(rv.racks[seat], 'WINS').section;
      const read = led.lean ? led.lean.section : '—';
      h += '<tr><td>' + seat + '</td><td class="muted">' + read + (led.notCollecting.length ? ' (not ' + led.notCollecting.join('/') + ')' : '') + '</td><td><b>' + truth + '</b></td></tr>';
    }
    h += '</table><div class="prov">Full state is shown only here, post-game — a teaching aid, never live.</div>';
    document.getElementById('builder').innerHTML = h;
  }

  function wire() {
    document.getElementById('new').addEventListener('click', start);
    document.querySelectorAll('#obj button').forEach(b => b.addEventListener('click', () => { objective = b.dataset.o; document.querySelectorAll('#obj button').forEach(x => x.classList.toggle('on', x === b)); if (sess) renderAll(); }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
