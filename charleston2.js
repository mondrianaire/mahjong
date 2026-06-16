/* Phase 6 + Part 2 B.1 — Charleston decision-quality engine.
 *  - keepValue de-duplicated by strategic direction (section), fixing C2.
 *  - incoming tiles are policy-driven (a naive neighbor sheds its isolated tiles),
 *    i.e. junk-biased, not uniform — first-order fix for A.1 / C6.
 *  - Common Random Numbers: the same incoming bank scores every candidate, so the
 *    paired difference V(best)-V(a) has low variance (B.3).
 *  - Outputs EV-loss, percentile, and a "statistical dead heat" flag when the CRN
 *    paired CI vs the best pass does not separate from zero (B.1 + A.3).
 */
const E = require('./engine.js');
const META = require('./card-meta.js');
const stats = require('./stats.js');
const LAMBDA = 0.8;
const secV = s => META.pointsFor(s);

// ---- de-duplicated objective strength: best distance PER SECTION, not per line (C2)
function objScoreDedup(tiles, objective) {
  const lm = E.analyzeStatic(tiles).lineMin; const bySec = new Map();
  for (const [k, d] of lm) { const s = k.split(' | ')[0]; if (d < (bySec.get(s) ?? 99)) bySec.set(s, d); }
  let total = 0;
  for (const [s, d] of bySec) { const w = Math.exp(-LAMBDA * d); total += objective === 'POINTS' ? secV(s) * w : w; }
  return total;
}
function keepValueDedup(tiles, objective) {
  const base = objScoreDedup(tiles, objective);
  const seen = new Set(); const res = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]; if (t === 'JK' || seen.has(t)) continue; seen.add(t);
    const reduced = tiles.slice(); reduced.splice(i, 1);
    res.push({ tile: t, kv: base - objScoreDedup(reduced, objective) });
  }
  res.sort((a, b) => a.kv - b.kv);
  return res;
}

const removeTiles = (rack, tiles) => { const r = rack.slice(); for (const t of tiles) { const i = r.indexOf(t); if (i >= 0) r.splice(i, 1); } return r; };
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

// policy-driven incoming: your LEFT neighbor (random rack from the unseen pool) sheds
// its 3 most isolated tiles. Independent of which 3 YOU pass -> identical across
// candidates given a seed => true Common Random Numbers.
function sampleIncoming(yourRack, seed) {
  const rng = stats.mulberry32(seed);
  const rem = E.fullPool(); for (const t of yourRack) rem.set(t, (rem.get(t) || 0) - 1);
  const pool = []; for (const [t, n] of rem) for (let i = 0; i < n; i++) pool.push(t);
  for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
  const nbr = pool.slice(0, 13);
  const c = new Map(); for (const t of nbr) c.set(t, (c.get(t) || 0) + 1);
  // naive shed: lowest-duplicate, non-joker, isolated tiles first
  const shed = nbr.filter(t => t !== 'JK').sort((a, b) => (c.get(a) - c.get(b)));
  return shed.slice(0, 3);
}

function buildCandidatePasses(rack, kv, topK) {
  // funnel: take the bottom (most-passable) ~7 distinct tiles, enumerate 3-combos
  const pool = [];
  const c = new Map(); for (const t of rack) c.set(t, (c.get(t) || 0) + 1);
  for (const { tile } of kv) { let n = c.get(tile); while (n-- > 0) pool.push(tile); if (pool.length >= 7) break; }
  const combos = [], seen = new Set();
  for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) for (let d = b + 1; d < pool.length; d++) {
    const trio = [pool[a], pool[b], pool[d]]; const key = trio.slice().sort().join(',');
    if (seen.has(key)) continue; seen.add(key); combos.push(trio);
  }
  return combos.slice(0, topK);
}

function choosePass(yourRack, objective = 'WINS', opts = {}) {
  const seeds = stats.crnSeeds(opts.seeds ?? 60, opts.master ?? 999);
  const incomingBank = seeds.map(sd => sampleIncoming(yourRack, sd));
  const kv = keepValueDedup(yourRack, objective);
  const candidates = buildCandidatePasses(yourRack, kv, opts.topK ?? 14);

  const results = candidates.map(a => {
    const base = removeTiles(yourRack, a);
    const vals = incomingBank.map(inc => objScoreDedup(base.concat(inc), objective));
    return { pass: a, V: avg(vals), vals };
  });
  results.sort((x, y) => y.V - x.V);
  const best = results[0];
  const Vs = results.map(r => r.V);
  results.forEach(r => {
    r.evLoss = best.V - r.V;                                   // strength units
    r.percentile = 100 * (Vs.filter(v => v <= r.V).length - 1) / Math.max(1, Vs.length - 1);
    const diffs = best.vals.map((bv, j) => bv - r.vals[j]);    // paired under CRN (B.3)
    r.vsBest = stats.pairedDiffCI(diffs);
    r.deadHeatWithBest = r !== best && !r.vsBest.separated;    // CI overlaps 0 -> tie (A.3)
  });
  return { best, results, policyVersion: stats.ROLLOUT_POLICY.version, seeds: seeds.length };
}

// grade a player's ACTUAL pass against the optimum (EV-loss / percentile) — the
// mahjong "centipawn loss", luck-independent (B.1)
function gradePass(yourRack, actualPass, objective = 'WINS', opts = {}) {
  const res = choosePass(yourRack, objective, opts);
  const seeds = stats.crnSeeds(opts.seeds ?? 60, opts.master ?? 999);
  const incomingBank = seeds.map(sd => sampleIncoming(yourRack, sd));
  const base = removeTiles(yourRack, actualPass);
  const vals = incomingBank.map(inc => objScoreDedup(base.concat(inc), objective));
  const V = avg(vals);
  const evLoss = res.best.V - V;
  const allV = res.results.map(r => r.V).concat([V]);
  const percentile = 100 * (allV.filter(v => v <= V).length - 1) / Math.max(1, allV.length - 1);
  const diffs = res.best.vals.map((bv, j) => bv - vals[j]);
  return { V, evLoss, percentile, best: res.best.pass, deadHeat: !stats.pairedDiffCI(diffs).separated, policyVersion: res.policyVersion };
}

module.exports = { objScoreDedup, keepValueDedup, sampleIncoming, choosePass, gradePass };
