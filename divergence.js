/* Phase 8 — game-type sensitivity detector.
 * Computes the recommended hand under WINS and POINTS; only when they disagree does
 * it raise a "depends on game type" callout, with both options and the crossover.
 * Crossover: prefer higher-value B over higher-prob A iff V_B/V_A > P_A/P_B.
 */
const S = require('./score.js');

function detect(rack) {
  const w = S.bestLine(rack, 'WINS');     // highest completion-probability line
  const p = S.bestLine(rack, 'POINTS');   // highest EV line
  const sensitive = w.key !== p.key;
  if (!sensitive) return { sensitive: false, pick: w };
  // probability proxy via distance; value via points
  const Pw = Math.exp(-S.LAMBDA * w.dist), Pp = Math.exp(-S.LAMBDA * p.dist);
  const Vw = S.V(w.key), Vp = S.V(p.key);
  const probRatio = Pw / Pp, valueRatio = Vp / Vw;
  return {
    sensitive: true,
    wins: { line: w.key, section: w.section, dist: w.dist, pApprox: Pw },
    points: { line: p.key, section: p.section, dist: p.dist, value: Vp, pApprox: Pp },
    trade: { valueRatio: +valueRatio.toFixed(2), probRatio: +probRatio.toFixed(2),
      reason: `points pick is worth ${valueRatio.toFixed(1)}x but ~${Math.round(100 * (1 - Pp / Pw))}% less likely` },
    crossover: `points choice wins once it is worth > ${probRatio.toFixed(2)}x the safe hand`,
  };
}

module.exports = { detect };
