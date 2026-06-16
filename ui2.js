(function () {
  'use strict';
  const Lab = window.Lab, E = Lab.engine, S = Lab.score, CH = Lab.ch, DIV = Lab.div;
  let hand = [], objective = 'WINS';
  document.getElementById('pol').textContent = 'policy ' + Lab.stats.ROLLOUT_POLICY.version;

  function meta(c) {
    if (c === 'JK') return { cls: 'joker', num: 'JKR', suit: 'joker' };
    if (c === 'FL') return { cls: 'flower', num: '✿', suit: 'flower' };
    if (c === 'DG') return { cls: 'dragon g', num: 'GRN', suit: 'drg' };
    if (c === 'DR') return { cls: 'dragon r', num: 'RED', suit: 'drg' };
    if (c === 'DW') return { cls: 'dragon w', num: '◻0', suit: 'soap' };
    if (c[0] === 'W') return { cls: 'wind', num: c[1], suit: 'wind' };
    return { cls: { B: 'bam', C: 'crak', D: 'dot' }[c[1]], num: c[0], suit: { B: 'Bam', C: 'Crak', D: 'Dot' }[c[1]] };
  }
  function tile(c, sm, on) {
    const m = meta(c), d = document.createElement('div');
    d.className = 'tile ' + m.cls + (sm ? ' sm' : ''); d.innerHTML = '<span class="num">' + m.num + '</span><span class="suit">' + m.suit + '</span>';
    if (on) d.addEventListener('click', on); return d;
  }
  const CAP = c => (c === 'JK' ? 8 : c === 'FL' ? 8 : 4);

  function palette() {
    const p = document.getElementById('palette');
    [['Bam', ['1B','2B','3B','4B','5B','6B','7B','8B','9B']], ['Crak', ['1C','2C','3C','4C','5C','6C','7C','8C','9C']],
     ['Dot', ['1D','2D','3D','4D','5D','6D','7D','8D','9D']], ['Honors', ['WN','WE','WW','WS','DG','DR','DW','FL','JK']]]
    .forEach(([lab, cs]) => {
      const r = document.createElement('div'); r.className = 'row';
      const l = document.createElement('span'); l.className = 'lab'; l.textContent = lab; r.appendChild(l);
      cs.forEach(c => r.appendChild(tile(c, true, () => add(c)))); p.appendChild(r);
    });
  }
  function add(c) { if (hand.length >= 13) return; if (hand.filter(x => x === c).length >= CAP(c)) return; hand.push(c); render(); }
  function render() {
    const h = document.getElementById('hand'); h.innerHTML = '';
    if (!hand.length) { const e = document.createElement('span'); e.className = 'empty'; e.textContent = 'No tiles yet.'; h.appendChild(e); }
    const ord = c => c === 'JK' ? 99 : c === 'FL' ? 90 : c[0] === 'D' ? 80 : c[0] === 'W' ? 70 : ({ B: 0, C: 10, D: 20 }[c[1]]) + (+c[0]);
    hand.map((c, i) => i).sort((a, b) => ord(hand[a]) - ord(hand[b])).forEach(i => h.appendChild(tile(hand[i], false, () => { hand.splice(i, 1); render(); })));
    document.getElementById('ct').textContent = hand.length;
    document.getElementById('go').disabled = hand.length !== 13;
  }
  function deal() {
    const pool = []; for (const [t, n] of E.fullPool()) for (let i = 0; i < n; i++) pool.push(t);
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
    hand = pool.slice(0, 13); render();
  }

  function analyze() {
    if (hand.length !== 13) return;
    const strength = CH.objScoreDedup(hand, objective);
    const bl = S.bestLine(hand, objective);
    const div = DIV.detect(hand);
    let html = '<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">' +
      '<div><div class="big">' + strength.toFixed(3) + '</div><div class="muted">' + (objective === 'WINS' ? 'wins strength (Σ e^−0.8d by section)' : 'points strength (Σ V·e^−0.8d)') + '</div></div>' +
      '<div><div class="opt"><div class="k">closest hand (' + objective + ')</div><div class="v">' + bl.section + '</div><div class="muted">' + bl.key.split(' | ')[1] + ' · ' + bl.dist + ' away</div></div></div></div>';
    if (div.sensitive) {
      html += '<div class="callout"><div class="h">⚖ Depends on game type</div>' +
        '<div class="two"><div class="opt"><div class="k">Wins pick</div><div class="v">' + div.wins.section + '</div><div class="muted">' + div.wins.dist + ' away</div></div>' +
        '<div class="opt"><div class="k">Points pick</div><div class="v">' + div.points.section + '</div><div class="muted">value ' + div.points.value + ' · ' + div.points.dist + ' away</div></div></div>' +
        '<div class="muted" style="margin-top:6px">' + div.trade.reason + '. ' + div.crossover + '.</div></div>';
    } else {
      html += '<div class="muted" style="margin-top:8px">Both game types agree on this hand — direction is not game-type sensitive.</div>';
    }
    document.getElementById('rate').innerHTML = html;

    // pass ranking (lighter settings for browser responsiveness)
    const cp = CH.choosePass(hand, objective, { seeds: 40, topK: 12 });
    const maxV = cp.results[0].V || 1;
    let t = '<table><tr><th></th><th>Pass</th><th>EV-loss</th><th>vs best</th></tr>';
    cp.results.slice(0, 6).forEach((r, i) => {
      const tiles = r.pass.map(c => '<span style="color:' + ({ bam: 'var(--bam)', crak: 'var(--crak)', dot: 'var(--dot)' }[meta(c).cls] || 'var(--ink)') + '">' + meta(c).num + '</span>').join(' ');
      const pill = i === 0 ? '<span class="pill rec">best</span>' : (r.deadHeatWithBest ? '<span class="pill dead">dead heat</span>' : '<span class="pill">alt</span>');
      t += '<tr><td>' + pill + '</td><td>' + tiles + '</td><td>' + r.evLoss.toFixed(4) + '</td><td class="muted">' + (i === 0 ? '—' : (r.vsBest.separated ? 'separated' : 'tie')) + '</td></tr>';
    });
    t += '</table><div class="prov" style="margin-top:8px">CRN over ' + cp.seeds + ' shared incoming draws (junk-biased) · dedup by section · policy ' + cp.policyVersion + ' · strength units</div>';
    document.getElementById('passes').innerHTML = t;
  }

  function wire() {
    palette(); render();
    document.getElementById('go').addEventListener('click', analyze);
    document.getElementById('deal').addEventListener('click', deal);
    document.getElementById('clear').addEventListener('click', () => { hand = []; render(); document.getElementById('rate').innerHTML = '<div class="empty">Build or deal a hand, then Analyze.</div>'; document.getElementById('passes').innerHTML = '<div class="empty">—</div>'; });
    document.querySelectorAll('#obj button').forEach(b => b.addEventListener('click', () => {
      objective = b.dataset.o; document.querySelectorAll('#obj button').forEach(x => x.classList.toggle('on', x === b));
      if (hand.length === 13) analyze();
    }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
