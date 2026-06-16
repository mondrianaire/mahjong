/* B.9 — calibrated win-probability predictor, fit to the multi-agent MC ground truth.
 * ECE ~2.5% on held-out self-play (vs ~15% for the old reachMass->CALIB predictor).
 * Dominant learned feature: drawOnly (pair/single slots) — the pair-hardness [DERIV] from data.
 */
const E = require('./engine.js');
const S = require('./score.js');
const K = require('./kernel.js');
const W = {"feat":["best","rm","jokers","drawOnly","minAcc","ent"],"mean":[5.199810606060606,0.09443475378787879,0.7054924242424242,2.115530303030303,4.635416666666667,1.0957035984848476],"std":[1.1251430726031741,0.0654391134611657,0.7805690328818555,1.746724559990972,2.3873553059173953,0.374946958655798],"beta":[-1.332089034904413,-0.272096614472194,0.152252296861723,0.11993446068678076,-0.35047005487712757,0.09748362293388202,-0.00954767541836356],"policyVersion":"0.1.0-greedy"};

function features(rack) {
  const lm = E.analyzeStatic(rack).lineMin;
  let best = 99, rm = 0; for (const [, d] of lm) { if (d < best) best = d; rm += Math.exp(-0.8 * d); }
  const jokers = rack.filter(t => t === 'JK').length;
  const sl = S.shortlist(rack, 'WINS'); const tgt = sl.committed ? sl.committed.target : null;
  let drawOnly = 0, minAcc = 0;
  if (tgt) { const a = K.acceptanceForTarget(tgt, rack, K.unseenFromRack(rack), false); drawOnly = a.drawOnlySlots; minAcc = isFinite(a.minAccept) ? a.minAccept : 0; }
  const c = { B: 0, C: 0, D: 0 }; let tot = 0;
  for (const t of rack) if (t.length === 2 && 'BCD'.includes(t[1]) && t[0] >= '1' && t[0] <= '9') { c[t[1]]++; tot++; }
  let H = 0; if (tot) for (const s of 'BCD') { const p = c[s] / tot; if (p > 0) H -= p * Math.log2(p); }
  return [best, rm, jokers, drawOnly, minAcc, H];
}
function predictP(rack) {
  const f = features(rack); let z = W.beta[0];
  for (let j = 0; j < W.feat.length; j++) z += W.beta[j + 1] * ((f[j] - W.mean[j]) / W.std[j]);
  return 1 / (1 + Math.exp(-z));
}
module.exports = { features, predictP, WEIGHTS: W, policyVersion: W.policyVersion };
