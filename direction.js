/* Part 3 Zone 1 — Direction engine.
 * Aggregates the portfolio to SECTION level (robust: per-hand noise cancels) and
 * reports a lean + a commit/stay-flexible signal. W(S) blends current presence
 * (exp(-λ·bestDistance) in the section) with an empirical base-rate prior.
 * Prior is ILLUSTRATIVE (from the multi-agent sim's section win-share + pair-hardness).
 */
const E = require('./engine.js');
const LAMBDA = 0.8;
const SECTIONS = [...new Set(E.CARD.map(l => l.section))];

// illustrative base rates: Consec common, S&P rare (from Phase-4 sim + §6 anchor direction)
const PRIOR = { 'Consec': 0.22, '2468': 0.16, '13579': 0.13, 'Like Nos': 0.12, '369': 0.10, '2026': 0.09, 'W-D': 0.08, 'Quints': 0.06, 'S&P': 0.04 };

function sectionBestDist(rack) {
  const lm = E.analyzeStatic(rack).lineMin; const m = {};
  for (const [k, d] of lm) { const s = k.split(' | ')[0]; if (d < (m[s] ?? 99)) m[s] = d; }
  return m;
}
function weights(rack) {
  const bd = sectionBestDist(rack); const W = {}; let z = 0;
  for (const s of SECTIONS) { const d = bd[s] ?? 14; const w = Math.exp(-LAMBDA * d) * (PRIOR[s] ?? 0.05); W[s] = w; z += w; }
  for (const s of SECTIONS) W[s] /= (z || 1);
  return W;
}
function concentration(W) {
  let H = 0; for (const s of SECTIONS) { const p = W[s]; if (p > 0) H -= p * Math.log(p); }
  return 1 - H / Math.log(SECTIONS.length);   // 0 = flat (stay flexible), 1 = single direction
}
function compass(rack, passIndex = 0) {
  const W = weights(rack);
  const sorted = Object.entries(W).sort((a, b) => b[1] - a[1]);
  const conc = concentration(W);
  const flexPremium = Math.max(0, 1 - passIndex / 6);   // keeping a backup is cheap early, costly late
  const top = sorted[0], second = sorted[1];
  // commit when the direction is concentrated OR the leader is strong; weight by how late it is
  const commit = conc > 0.30 || top[1] > 0.40 || (passIndex >= 4 && top[1] > 0.30);
  const guidance = commit
    ? `Commit your passes to ${top[0]}` + (second[1] > 0.18 && flexPremium > 0.3 ? `; hold one ${second[0]} pivot for one more round.` : '.')
    : `No clear direction yet — pass only obvious junk, keep ${top[0]} and ${second[0]} both alive.`;
  return { weights: W, sorted, concentration: conc, flexPremium, top, second, commit, guidance };
}

module.exports = { SECTIONS, PRIOR, weights, concentration, compass };
