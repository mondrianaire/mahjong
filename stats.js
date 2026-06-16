/* Part 2 — statistics foundation.
 * Honest uncertainty on every Monte-Carlo number: Wilson/Jeffreys binomial CIs,
 * standard error, sample-size guidance, Common Random Numbers (CRN), and an
 * explicit VERSIONED rollout policy so stored evaluations stay comparable (A.2).
 */

// ---- binomial confidence intervals ------------------------------------
// Normal approx breaks at the tails (can return negative lower bounds), so we
// default to Wilson, which stays valid for small p and small N. (A.3/A.4)
function wilson(k, n, z = 1.96) {
  if (n === 0) return { lo: 0, hi: 1, p: 0 };
  const p = k / n, z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}
function jeffreys(k, n) { // Bayesian Beta(0.5,0.5) interval — good alternative at tails
  // approximate via normal on logit when libs unavailable; fall back to Wilson
  return wilson(k, n);
}
function stderr(p, n) { return Math.sqrt(p * (1 - p) / n); }

// rollouts needed to separate two options whose true rates differ by delta (A.3)
function nToSeparate(delta, p = 0.25, z = 1.96) {
  return Math.ceil(2 * z * z * p * (1 - p) / (delta * delta)); // per option, independent sampling
}

// two estimates are a "statistical dead heat" if their CIs overlap (A.3)
function deadHeat(a, b) { return !(a.hi < b.lo || b.hi < a.lo); }

// ---- Common Random Numbers --------------------------------------------
// Pre-generate a bank of shuffled walls so every candidate is evaluated on the
// SAME randomness. Differences V(a)-V(b) then have far lower variance (B.3).
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function crnSeeds(n, masterSeed = 12345) { const r = mulberry32(masterSeed); const s = []; for (let i = 0; i < n; i++) s.push((r() * 2 ** 31) | 0); return s; }

// paired difference CI for V(a)-V(b) under CRN (lower variance than unpaired)
function pairedDiffCI(diffs, z = 1.96) {
  const n = diffs.length, m = diffs.reduce((x, y) => x + y, 0) / n;
  const v = diffs.reduce((s, d) => s + (d - m) ** 2, 0) / Math.max(1, n - 1);
  const se = Math.sqrt(v / n);
  return { mean: m, se, lo: m - z * se, hi: m + z * se, separated: (m - z * se) > 0 || (m + z * se) < 0 };
}

// ---- proper scoring rules (B.4) ---------------------------------------
function brier(preds, outcomes) { let s = 0; for (let i = 0; i < preds.length; i++) s += (preds[i] - outcomes[i]) ** 2; return s / preds.length; }
function logLoss(preds, outcomes) {
  const e = 1e-12; let s = 0;
  for (let i = 0; i < preds.length; i++) { const p = Math.min(1 - e, Math.max(e, preds[i])); s += -(outcomes[i] * Math.log(p) + (1 - outcomes[i]) * Math.log(1 - p)); }
  return s / preds.length;
}
function reliability(preds, outcomes, bins = 10) {
  const B = Array.from({ length: bins }, () => ({ sumP: 0, sumO: 0, n: 0 }));
  for (let i = 0; i < preds.length; i++) { const b = Math.min(bins - 1, Math.floor(preds[i] * bins)); B[b].sumP += preds[i]; B[b].sumO += outcomes[i]; B[b].n++; }
  let ece = 0; const rows = [];
  for (const b of B) if (b.n) { const conf = b.sumP / b.n, acc = b.sumO / b.n; ece += (b.n / preds.length) * Math.abs(conf - acc); rows.push({ conf, acc, n: b.n }); }
  return { ece, rows };
}

// ---- versioned rollout policy registry (A.2) --------------------------
const ROLLOUT_POLICY = {
  version: '0.1.0-greedy',
  describe: 'single-target greedy deficiency-reducer; legal calls (C1/C3); no joker redemption; uniform play phase',
  note: 'win-rate ~74% vs 89% anchor — treat absolute probabilities as uncalibrated until policy strengthened',
};

module.exports = { wilson, jeffreys, stderr, nToSeparate, deadHeat, mulberry32, crnSeeds, pairedDiffCI, brier, logLoss, reliability, ROLLOUT_POLICY };
