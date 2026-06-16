/* B.9 step 2 — fit logistic regression on the corpus; compare calibration vs old predictor. */
const fs = require('fs');
const E = require('./engine.js');
const stats = require('./stats.js');
const L = fs.readFileSync('corpus.csv', 'utf8').trim().split('\n');
const head = L[0].split(',');
const data = L.slice(1).map(r => r.split(',').map(Number));
const FEAT = ['best', 'rm', 'jokers', 'drawOnly', 'minAcc', 'ent'];
const fi = FEAT.map(f => head.indexOf(f)), yi = head.indexOf('win');

// shuffle + split
let rng = 7; const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
data.sort(() => rand() - 0.5);
const cut = Math.floor(data.length * 0.8);
const tr = data.slice(0, cut), te = data.slice(cut);

// standardize on train
const mean = fi.map(i => tr.reduce((s, r) => s + r[i], 0) / tr.length);
const std = fi.map((i, k) => Math.sqrt(tr.reduce((s, r) => s + (r[i] - mean[k]) ** 2, 0) / tr.length) || 1);
const X = rows => rows.map(r => fi.map((i, k) => (r[i] - mean[k]) / std[k]));
const Xtr = X(tr), Xte = X(te), ytr = tr.map(r => r[yi]), yte = te.map(r => r[yi]);

// logistic regression via gradient descent + L2
const sig = z => 1 / (1 + Math.exp(-z));
let b = new Array(FEAT.length + 1).fill(0); const lr = 0.3, lambda = 0.01, iters = 4000;
for (let it = 0; it < iters; it++) {
  const grad = new Array(b.length).fill(0);
  for (let n = 0; n < Xtr.length; n++) {
    let z = b[0]; for (let j = 0; j < FEAT.length; j++) z += b[j + 1] * Xtr[n][j];
    const e = sig(z) - ytr[n];
    grad[0] += e; for (let j = 0; j < FEAT.length; j++) grad[j + 1] += e * Xtr[n][j];
  }
  for (let j = 0; j < b.length; j++) { const reg = j === 0 ? 0 : lambda * b[j]; b[j] -= lr * (grad[j] / Xtr.length + reg); }
}
const predNew = x => { let z = b[0]; for (let j = 0; j < FEAT.length; j++) z += b[j + 1] * x[j]; return sig(z); };
const predOld = r => Math.max(0, Math.min(1, E.CALIB.A + E.CALIB.B * r[head.indexOf('rm')]));

const pNew = Xte.map(predNew), pOld = te.map(predOld);
function report(name, preds) {
  console.log('  ' + name.padEnd(18), 'Brier=' + stats.brier(preds, yte).toFixed(3),
    'logLoss=' + stats.logLoss(preds, yte).toFixed(3), 'ECE=' + (100 * stats.reliability(preds, yte, 8).ece).toFixed(1) + '%');
}
console.log('Test set n=' + te.length + ' (base win rate ' + (100 * yte.reduce((a, c) => a + c, 0) / yte.length).toFixed(1) + '%)');
report('OLD (CALIB·rm)', pOld);
report('NEW (logistic)', pNew);
console.log('\nStandardized coefficients (signal direction):');
FEAT.forEach((f, j) => console.log('  ' + f.padEnd(9), b[j + 1].toFixed(3)));
console.log('  intercept', b[0].toFixed(3));

fs.writeFileSync('calibrated-weights.json', JSON.stringify({ feat: FEAT, mean, std, beta: b, policyVersion: stats.ROLLOUT_POLICY.version }, null, 0));
console.log('\nwrote calibrated-weights.json');
