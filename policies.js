/* Phase 3 — the policy zoo. Distinguishable Charleston strategies so the opponent
 * model (Phase 7) has something to detect. Each policy only ever sees a PrivateView.
 */
const S = require('./score.js');

const nonJoker = rack => rack.filter(t => t !== 'JK');
const counts = rack => { const m = new Map(); for (const t of rack) m.set(t, (m.get(t) || 0) + 1); return m; };

// --- score-driven policy (objective-parameterized): pass lowest keepValue 3 ---
function scorePolicy(objective, name) {
  return {
    name,
    selectPass(v) {
      const kv = S.keepValue(v.ownRack, objective).filter(x => x.tile !== 'JK');
      const out = []; const c = counts(v.ownRack);
      for (const { tile } of kv) { let avail = c.get(tile) || 0; while (avail-- > 0 && out.length < 3) out.push(tile); if (out.length >= 3) break; }
      return out.slice(0, 3);
    },
    stopVote(v) { const bl = S.bestLine(v.ownRack, objective); return bl.dist <= 2; }, // stop only when near-made
    courtesyOffer(v) { return Math.min(3, S.keepValue(v.ownRack, objective).filter(x => x.tile !== 'JK' && x.kv <= 1e-9).length); },
    blindDecision() { return false },
  };
}

// --- naive: pass the most isolated singletons (fewest duplicates, no real structure) ---
const naivePolicy = {
  name: 'naive',
  selectPass(v) {
    const c = counts(v.ownRack);
    const cand = nonJoker(v.ownRack).slice().sort((a, b) => (c.get(a) - c.get(b)) || 0);
    const seen = new Set(); const out = [];
    for (const t of cand) { out.push(t); if (out.length >= 3) break; }
    return out.slice(0, 3);
  },
  stopVote() { return false }, courtesyOffer() { return 0 }, blindDecision() { return false },
};

// --- random: pass 3 random non-jokers ---
function randomPolicy(rng) {
  return {
    name: 'random',
    selectPass(v) { const nj = nonJoker(v.ownRack).slice(); for (let i = nj.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[nj[i], nj[j]] = [nj[j], nj[i]]; } return nj.slice(0, 3); },
    stopVote() { return false }, courtesyOffer() { return 0 }, blindDecision() { return false },
  };
}

const winsFlexible = scorePolicy('WINS', 'wins-flexible');
const pointsChaser = scorePolicy('POINTS', 'points-chaser');

module.exports = { scorePolicy, winsFlexible, pointsChaser, naivePolicy, randomPolicy };
