/* Phase 5 + Part 2 B.4 — calibration harness.
 *  - Normative gates (C4): joker-curve shape (P(win) increases in jokers held) and
 *    pair-hardness ordering (S&P << Consec). NOT gated on the ~22% mean (vacuous) or
 *    on category frequency (a population's policy, which an optimal engine should beat).
 *  - Conditional calibration (B.4): predict each post-Charleston hand's P_complete with
 *    the closed form, score against the REAL sim outcome -> Brier / log-loss / ECE +
 *    reliability curve. Wilson CIs throughout (C5: report shape, not causal slope).
 */
const E = require('./engine.js');
const D = require('./dealer.js');
const P = require('./policies.js');
const PLAY = require('./play.js');
const stats = require('./stats.js');

const LAMBDA = 0.8;
function predictP(rack) { // closed-form P_complete (reachMass -> CALIB), the surrogate under test
  let rm = 0; for (const [, d] of E.analyzeStatic(rack).lineMin) rm += Math.exp(-LAMBDA * d);
  return Math.max(0, Math.min(1, E.CALIB.A + E.CALIB.B * rm));
}

function runCalibration(N = 150, opts = {}) {
  const pol = [P.winsFlexible, P.winsFlexible, P.winsFlexible, P.winsFlexible];
  let wins = 0; const jbin = new Map(); const sec = {};
  const preds = [], outs = [];
  for (let s = 0; s < N; s++) {
    const ch = D.runCharleston(pol, { seed: s + 1 });
    const g = PLAY.playGame(ch, 'WINS');
    if (!g.wallGame && g.winner >= 0) { wins++; sec[g.section] = (sec[g.section] || 0) + 1; }
    for (let seat = 0; seat < 4; seat++) {
      const j = g.jokersPerSeat[seat];
      const b = jbin.get(j) || { n: 0, win: 0 }; b.n++; if (!g.wallGame && g.winner === seat) b.win++; jbin.set(j, b);
      preds.push(predictP(ch.racks[seat])); outs.push((!g.wallGame && g.winner === seat) ? 1 : 0);
    }
  }
  const winRate = stats.wilson(wins, N);
  const jokerCurve = [...jbin.entries()].sort((a, b) => a[0] - b[0])
    .map(([j, b]) => ({ jokers: j, n: b.n, ...stats.wilson(b.win, b.n) }));
  // normative checks
  const themed = jokerCurve.filter(r => r.n >= 8);
  const jokerMonotone = themed.length >= 2 && themed[themed.length - 1].p > themed[0].p;
  const pairHardness = (sec['S&P'] || 0) <= (sec['Consec'] || 0);
  // conditional calibration
  const rel = stats.reliability(preds, outs, 10);
  return {
    N, winRate, sections: sec, jokerCurve, jokerMonotone, pairHardness,
    brier: stats.brier(preds, outs), logLoss: stats.logLoss(preds, outs), ece: rel.ece, reliability: rel.rows,
    policyVersion: stats.ROLLOUT_POLICY.version,
  };
}

if (require.main === module) {
  const N = +process.argv[2] || 150;
  const r = runCalibration(N);
  console.log('Calibration (policy ' + r.policyVersion + ', N=' + r.N + ')');
  console.log('  win-or-mahjong rate: ' + (100 * r.winRate.p).toFixed(1) + '%  [' + (100 * r.winRate.lo).toFixed(1) + ', ' + (100 * r.winRate.hi).toFixed(1) + ']  (anchor ~89%)');
  console.log('  NORMATIVE GATE joker curve monotone increasing: ' + r.jokerMonotone);
  console.log('    ' + r.jokerCurve.filter(c => c.n >= 5).map(c => 'J' + c.jokers + ':' + (100 * c.p).toFixed(0) + '%(n' + c.n + ')').join('  '));
  console.log('  NORMATIVE GATE pair-hardness (S&P<=Consec): ' + r.pairHardness + '  [S&P ' + (r.sections['S&P'] || 0) + ', Consec ' + (r.sections['Consec'] || 0) + ']');
  console.log('  conditional calibration  Brier=' + r.brier.toFixed(3) + '  logLoss=' + r.logLoss.toFixed(3) + '  ECE=' + (100 * r.ece).toFixed(1) + '%');
  console.log('  reliability (pred -> obs):', r.reliability.map(b => b.conf.toFixed(2) + '->' + b.acc.toFixed(2)).join('  '));
}

module.exports = { runCalibration, predictP };
