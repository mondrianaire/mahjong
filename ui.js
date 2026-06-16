(function () {
  'use strict';
  const E = window.MahjonggEngine;
  const MAX = { JK: 8, FL: 8 }; // per-tile caps; numbers/winds/dragons = 4
  let hand = [];

  // ---- tile rendering -------------------------------------------------
  function tileMeta(code) {
    if (code === 'JK') return { cls: 'joker', num: 'JKR', suit: 'joker' };
    if (code === 'FL') return { cls: 'flower', num: '✿', suit: 'flower' };
    if (code === 'DG') return { cls: 'dragon g', num: 'GRN', suit: 'dragon' };
    if (code === 'DR') return { cls: 'dragon r', num: 'RED', suit: 'dragon' };
    if (code === 'DW') return { cls: 'dragon w', num: '◻0', suit: 'soap' };
    if (code[0] === 'W') {
      const w = { N: 'N', E: 'E', W: 'W', S: 'S' }[code[1]];
      return { cls: 'wind', num: w, suit: 'wind' };
    }
    const suit = { B: 'bam', C: 'crak', D: 'dot' }[code[1]];
    const sl = { B: 'Bam', C: 'Crak', D: 'Dot' }[code[1]];
    return { cls: suit, num: code[0], suit: sl };
  }
  function tileEl(code, sm) {
    const m = tileMeta(code);
    const d = document.createElement('div');
    d.className = 'tile ' + m.cls + (sm ? ' sm' : '');
    d.innerHTML = '<span class="num">' + m.num + '</span><span class="suit">' + m.suit + '</span>';
    d.dataset.code = code;
    return d;
  }

  // ---- palette --------------------------------------------------------
  function buildPalette() {
    const pal = document.getElementById('palette');
    const rows = [
      ['Bams', ['1B','2B','3B','4B','5B','6B','7B','8B','9B']],
      ['Craks', ['1C','2C','3C','4C','5C','6C','7C','8C','9C']],
      ['Dots', ['1D','2D','3D','4D','5D','6D','7D','8D','9D']],
      ['Winds', ['WN','WE','WW','WS']],
      ['Dr/Fl/Jk', ['DG','DR','DW','FL','JK']],
    ];
    for (const [lab, codes] of rows) {
      const r = document.createElement('div'); r.className = 'palette-row';
      const l = document.createElement('span'); l.className = 'lab'; l.textContent = lab; r.appendChild(l);
      for (const c of codes) {
        const t = tileEl(c, true);
        t.addEventListener('click', () => addTile(c));
        r.appendChild(t);
      }
      pal.appendChild(r);
    }
  }

  function cap(code) { return MAX[code] || 4; }
  function addTile(code) {
    if (hand.length >= 13) return;
    if (hand.filter(x => x === code).length >= cap(code)) return;
    hand.push(code); renderHand();
  }
  function removeAt(i) { hand.splice(i, 1); renderHand(); }

  function renderHand() {
    const h = document.getElementById('hand'); h.innerHTML = '';
    if (!hand.length) { const e = document.createElement('span'); e.className = 'empty'; e.textContent = 'No tiles yet.'; h.appendChild(e); }
    // sort for display: suits then winds/dragons/flower/joker
    const order = c => {
      if (c === 'JK') return 99; if (c === 'FL') return 90;
      if (c[0] === 'D') return 80 + 'GRW'.indexOf(c[1]);
      if (c[0] === 'W') return 70 + 'NEWS'.indexOf(c[1]);
      return ({ B: 0, C: 10, D: 20 }[c[1]]) + (+c[0]);
    };
    const idx = hand.map((c, i) => i).sort((a, b) => order(hand[a]) - order(hand[b]));
    idx.forEach(i => {
      const t = tileEl(hand[i]);
      t.addEventListener('click', () => removeAt(i));
      h.appendChild(t);
    });
    document.getElementById('ct').textContent = hand.length;
    document.getElementById('analyzeBtn').disabled = hand.length !== 13;
  }

  // ---- random deal ----------------------------------------------------
  function dealRandom() {
    const pool = [];
    for (const [tile, n] of E.fullPool()) for (let i = 0; i < n; i++) pool.push(tile);
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
    hand = pool.slice(0, 13); renderHand();
  }

  // ---- rating verdict -------------------------------------------------
  function tier(p) {
    if (p >= 0.45) return { t: 'Strong', d: 'Multiple live paths to mahjong; commit confidently and pass cleanly.', col: 'var(--good)' };
    if (p >= 0.22) return { t: 'Good', d: 'A solid hand with real upside — Charleston choices matter most here.', col: 'var(--good)' };
    if (p >= 0.10) return { t: 'Marginal', d: 'Workable but thin; lean on the most flexible direction and keep jokers.', col: 'var(--warn)' };
    return { t: 'Weak', d: 'Far from any hand — stay flexible, defend, and watch for a switch.', col: 'var(--bad)' };
  }

  // ---- analyze --------------------------------------------------------
  function analyze() {
    if (hand.length !== 13) return;
    const draws = +document.getElementById('drawsR').value;
    const sims = +document.getElementById('simsR').value;
    const m = E.metrics(hand);
    const mc = E.monteCarlo(hand, { draws, sims });
    const p = mc.p, pct = Math.round(p * 100), tv = tier(p);

    // rating panel
    const res = document.getElementById('result');
    res.innerHTML =
      '<div class="rating">' +
        '<div class="gauge" style="--p:' + pct + '"><div class="val"><div class="big">' + pct + '%</div><div class="lbl">reach MJ</div></div></div>' +
        '<div class="verdict"><div class="tier" style="color:' + tv.col + '">' + tv.t + '</div>' +
        '<div class="desc">' + tv.d + '</div>' +
        '<div class="hint">' + sims.toLocaleString() + ' sims · ' + draws + ' draws · ' + mc.candidates + ' candidate hands</div></div>' +
      '</div>' +
      '<div class="metrics">' +
        mcard('Distance', m.distance, 'tiles to nearest hand') +
        mcard('Reach-mass', m.reachMass, 'strength surrogate (r=.89)') +
        mcard('Jokers', m.jokers, 'wild in groups of 3+') +
        mcard('Suit spread', m.suitEntropy, 'entropy (0=pure,1.58=even)') +
        mcard('Pairs / Pungs', m.pairs + ' / ' + m.pungs, 'existing structure') +
        mcard('Even / Odd', m.even + ' / ' + m.odd, '2026 favors evens') +
      '</div>';

    // detail: nearest hands + charleston
    const near = [...m.lineMin.entries()].sort((a, b) => a[1] - b[1]).slice(0, 8);
    let html = '<div style="display:grid;grid-template-columns:1.1fr .9fr;gap:24px" class="dgrid">';
    html += '<div><h2 style="margin-top:0">Nearest card hands</h2><div class="targets">';
    for (const [key, d] of near) {
      const [sec, nm] = key.split(' | ');
      html += '<div class="row"><span class="sec">' + sec + '</span><span class="nm">' + nm + '</span><span class="d">' + d + '</span></div>';
    }
    html += '</div></div>';

    const opt = E.charlestonOptimize(hand, { received: 24 });
    const top = opt.results.slice(0, 4);
    const evMax = top[0].ev || 1;
    const toP = ev => Math.max(0, E.CALIB.A + E.CALIB.B * ev);
    html += '<div><h2 style="margin-top:0">Charleston — best 3-tile pass <span class="badge">MC optimizer</span></h2>';
    html += '<p class="hint" style="margin-top:0">Ranked by expected post-pass strength, simulating the tiles you receive. Recommended pass is highlighted.</p>';
    top.forEach((r, i) => {
      const tmp = document.createElement('div');
      for (const c of r.pass) { const e = tileEl(c, true); if (i === 0) e.classList.add('rec'); tmp.appendChild(e); }
      const bar = Math.round(100 * r.ev / evMax);
      html += '<div class="passrow' + (i === 0 ? ' best' : '') + '">' +
why(i) +
        '<div class="passtiles">' + tmp.innerHTML + '</div>' +
        '<div class="passbar"><span style="width:' + bar + '%"></span></div>' +
        '<div class="passev">~' + Math.round(toP(r.ev) * 100) + '% MJ</div></div>';
    });
    const worst = opt.results[opt.results.length - 1];
    html += '<p class="hint">Keep your core: worst pass would be <b>' + worst.pass.map(prettyTile).join(' ') +
            '</b> (~' + Math.round(toP(worst.ev) * 100) + '%). Jokers are never passed.</p>';
    html += '<p class="hint">' + opt.candidates + ' candidate hands · received tiles modeled as random from the unseen pool.</p>';
    html += '</div></div>';
    document.getElementById('detail').innerHTML = html;
  }
  function mcard(k, v, sub) {
    return '<div class="metric"><div class="k">' + k + '</div><div class="v">' + v +
           ' <small>' + sub + '</small></div></div>';
  }
  function why(i) { return '<div class="passlabel">' + (i === 0 ? 'Recommended' : 'Alt ' + i) + '</div>'; }
  function prettyTile(code) {
    const m = tileMeta(code);
    if (code === 'JK') return 'Joker'; if (code === 'FL') return 'Flower';
    if (code === 'DW') return 'Soap'; if (code[0] === 'D') return m.num + ' Dragon';
    if (code[0] === 'W') return m.num + ' Wind';
    return code[0] + ' ' + m.suit;
  }

  // ---- wire up --------------------------------------------------------
  function wire() {
    buildPalette(); renderHand();
    document.getElementById('analyzeBtn').addEventListener('click', analyze);
    document.getElementById('dealBtn').addEventListener('click', dealRandom);
    document.getElementById('clearBtn').addEventListener('click', () => { hand = []; renderHand();
      document.getElementById('result').innerHTML = '<div class="empty">Build or deal a hand, then press <b>Analyze</b>.</div>';
      document.getElementById('detail').innerHTML = '<div class="empty" style="margin:0">Analysis appears here.</div>'; });
    const dr = document.getElementById('drawsR'), drv = document.getElementById('drawsV');
    dr.addEventListener('input', () => drv.textContent = dr.value);
    const sr = document.getElementById('simsR'), srv = document.getElementById('simsV');
    sr.addEventListener('input', () => srv.textContent = (+sr.value).toLocaleString());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
