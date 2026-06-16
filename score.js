/* Phase 3 — objective-aware scoring (WINS vs POINTS, correction C10).
 * WINS strength = Σ_lines exp(-λ·d).  POINTS strength = Σ_lines V(line)·exp(-λ·d).
 * Distance is joker-aware (from the engine). V() is illustrative until Phase 0 verified.
 */
const E = require('./engine.js');
const META = require('./card-meta.js');
const LAMBDA = 0.8;
const lineMeta = META.buildMeta();
const V = key => (lineMeta.get(key)?.points ?? 25);
const isConcealedKey = key => (lineMeta.get(key)?.concealed ?? false);

function objScoreFromLineMin(lineMin, objective) {
  let s = 0;
  for (const [k, d] of lineMin) { const w = Math.exp(-LAMBDA * d); s += objective === 'POINTS' ? V(k) * w : w; }
  return s;
}
function objScore(tiles, objective) { return objScoreFromLineMin(E.analyzeStatic(tiles).lineMin, objective); }

function bestLine(tiles, objective) {
  const lm = E.analyzeStatic(tiles).lineMin; let best = null;
  for (const [k, d] of lm) {
    const sc = objective === 'POINTS' ? V(k) * Math.exp(-LAMBDA * d) : Math.exp(-LAMBDA * d);
    if (!best || sc > best.score) best = { key: k, dist: d, score: sc, section: k.split(' | ')[0] };
  }
  return best;
}

// keepValue: drop in objScore when one copy of a tile is removed. Ascending = most passable.
function keepValue(tiles, objective) {
  const base = objScore(tiles, objective);
  const counts = new Map(); for (const t of tiles) counts.set(t, (counts.get(t) || 0) + 1);
  const res = [];
  for (const [t] of counts) {
    if (t === 'JK') { res.push({ tile: t, kv: Infinity }); continue; }
    const reduced = tiles.slice(); reduced.splice(reduced.indexOf(t), 1);
    res.push({ tile: t, kv: base - objScore(reduced, objective) });
  }
  res.sort((a, b) => a.kv - b.kv);
  return res;
}

// performance: pre-order target groups (non-jokerable first) ONCE so the hot loop
// never re-sorts. fastNeeded mirrors engine coverage without the per-call sort.
let _ordered = null, _ver = -1;
function orderedTargets() {
  if (_ordered && _ver === E.targetsVersion()) return _ordered;
  _ver = E.targetsVersion();
  _ordered = E.buildTargets().map(t => ({
    section: t.section, name: t.name,
    groups: t.groups.slice().sort((a, b) => (a.jokerable ? 1 : 0) - (b.jokerable ? 1 : 0)),
  }));
  return _ordered;
}
function fastNeeded(groups, hp) {
  let jk = hp.jokers, filled = 0; const local = new Map();
  for (const g of groups) {
    let need = g.count; const used = local.get(g.tile) || 0;
    const have = (hp.pool.get(g.tile) || 0) - used;
    const ur = Math.min(have, need); local.set(g.tile, used + ur); need -= ur; filled += ur;
    if (g.jokerable && need > 0) { const uj = Math.min(jk, need); jk -= uj; filled += uj; }
  }
  return 14 - filled;
}

// shortlist of concrete targets (for fast play + win detection)
function shortlist(tiles, objective, window = 4, cap = 60) {
  const hp = E.handPool(tiles); let best = 99; const arr = [];
  for (const t of orderedTargets()) { const d = fastNeeded(t.groups, hp); if (d < best) best = d; arr.push([t, d]); }
  const cand = arr.filter(([, d]) => d <= best + window).sort((a, b) => a[1] - b[1]).slice(0, cap).map(([t, d]) => ({ target: t, d }));
  let committed = cand[0];
  if (objective === 'POINTS') {
    let bsc = -1; for (const c of cand) { const sc = V(c.target.section + ' | ' + c.target.name) * Math.exp(-LAMBDA * c.d); if (sc > bsc) { bsc = sc; committed = c; } }
  }
  return { best, cand, committed };
}

function isWinningRack(tiles, candCache) {
  const hp = E.handPool(tiles);
  const list = candCache ? candCache.map(c => c.target) : orderedTargets();
  for (const t of list) if (fastNeeded(t.groups, hp) === 0) return t;
  return null;
}

module.exports = { LAMBDA, V, isConcealedKey, objScore, objScoreFromLineMin, bestLine, keepValue, shortlist, isWinningRack };
