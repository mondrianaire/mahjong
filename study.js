/* Generate a realistic spread of hands (strong->weak) by sampling a random
 * concrete target and keeping k of its tiles + filler, then record features
 * and MC P(reach mahjong). Appends rows to results.csv so runs accumulate. */
const fs = require('fs');
const E = require('./engine.js');
const TARGETS = E.buildTargets();
const FULL = E.fullPool();

function randTileFromPool(used) { // draw a legal random tile respecting caps
  while (true) {
    const keys = [...FULL.keys()];
    const t = keys[(Math.random() * keys.length) | 0];
    if ((used.get(t) || 0) < FULL.get(t)) return t;
  }
}
function sampleHand() {
  const T = TARGETS[(Math.random() * TARGETS.length) | 0];
  // flatten target tiles
  const tt = [];
  for (const g of T.groups) for (let i = 0; i < g.count; i++) tt.push(g.tile);
  for (let i = tt.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[tt[i], tt[j]] = [tt[j], tt[i]]; }
  const k = 5 + ((Math.random() * 7) | 0); // keep 5..11 of the target
  const used = new Map(); const hand = [];
  for (const t of tt.slice(0, k)) { if ((used.get(t) || 0) < FULL.get(t) && hand.length < 13) { hand.push(t); used.set(t, (used.get(t) || 0) + 1); } }
  while (hand.length < 13) { const t = randTileFromPool(used); hand.push(t); used.set(t, (used.get(t) || 0) + 1); }
  return hand;
}

function suitEntropy(tiles) {
  const c = { B: 0, C: 0, D: 0 }; let tot = 0;
  for (const t of tiles) if (t.length === 2 && 'BCD'.includes(t[1]) && t[0] >= '1' && t[0] <= '9') { c[t[1]]++; tot++; }
  if (!tot) return 0; let h = 0; for (const s of 'BCD') { const p = c[s] / tot; if (p > 0) h -= p * Math.log2(p); } return h;
}

const N = +process.argv[2] || 160;
const SIMS = +process.argv[3] || 600;
const rows = [];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const h = sampleHand();
  const st = E.analyzeStatic(h);
  const dists = [...st.lineMin.values()];
  const best = st.best;
  const jokers = h.filter(t => t === 'JK').length;
  const ent = suitEntropy(h);
  const flexRel2 = dists.filter(d => d <= best + 2).length;            // old (best-relative)
  const flexAbs5 = dists.filter(d => d <= 5).length;                   // absolute threshold
  const flexAbs4 = dists.filter(d => d <= 4).length;
  const reachMass = dists.reduce((a, d) => a + Math.exp(-0.8 * d), 0); // smooth proximity+breadth
  const mc = E.monteCarlo(h, { draws: 16, sims: SIMS });
  rows.push([mc.p.toFixed(4), best, jokers, ent.toFixed(3), flexRel2, flexAbs5, flexAbs4, reachMass.toFixed(4)].join(','));
}
const header = 'p,best,jokers,entropy,flexRel2,flexAbs5,flexAbs4,reachMass\n';
const exists = fs.existsSync('results.csv');
fs.appendFileSync('results.csv', (exists ? '' : header) + rows.join('\n') + '\n');
console.log(`appended ${N} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s -> results.csv`);
