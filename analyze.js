/* Statistical verification of the metric set against MC P(reach mahjong). */
const fs = require('fs');
const L = fs.readFileSync('results.csv', 'utf8').trim().split('\n');
const head = L[0].split(',');
const data = L.slice(1).map(r => { const c = r.split(',').map(Number); const o = {}; head.forEach((h, i) => o[h] = c[i]); return o; });
const n = data.length;
const col = k => data.map(d => d[k]);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const pearson = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sx = 0, sy = 0; for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sx += dx * dx; sy += dy * dy; } return sxy / Math.sqrt(sx * sy); };
const z = k => { const a = col(k), m = mean(a), s = sd(a) || 1; return a.map(v => (v - m) / s); };

// OLS with intercept via normal equations (predictors already standardized)
function ols(yk, xks) {
  const y = col(yk); const X = xks.map(z); const p = xks.length;
  // design with intercept
  const M = []; for (let i = 0; i < n; i++) { const row = [1]; for (let j = 0; j < p; j++) row.push(X[j][i]); M.push(row); }
  const XtX = Array.from({ length: p + 1 }, () => new Array(p + 1).fill(0));
  const Xty = new Array(p + 1).fill(0);
  for (let i = 0; i < n; i++) { for (let a = 0; a <= p; a++) { Xty[a] += M[i][a] * y[i]; for (let b = 0; b <= p; b++) XtX[a][b] += M[i][a] * M[i][b]; } }
  // solve via Gaussian elimination
  const A = XtX.map((r, i) => r.concat([Xty[i]]));
  for (let c = 0; c <= p; c++) {
    let piv = c; for (let r = c + 1; r <= p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c] || 1e-9; for (let k = c; k <= p + 1; k++) A[c][k] /= d;
    for (let r = 0; r <= p; r++) if (r !== c) { const f = A[r][c]; for (let k = c; k <= p + 1; k++) A[r][k] -= f * A[c][k]; }
  }
  const beta = A.map(r => r[p + 1]);
  // R^2
  const my = mean(y); let ssr = 0, sst = 0;
  for (let i = 0; i < n; i++) { let yh = beta[0]; for (let j = 0; j < p; j++) yh += beta[j + 1] * X[j][i]; ssr += (y[i] - yh) ** 2; sst += (y[i] - my) ** 2; }
  return { beta, r2: 1 - ssr / sst };
}

console.log(`N = ${n} realistic hands\n`);
console.log('P(reach mahjong): mean', mean(col('p')).toFixed(3), ' sd', sd(col('p')).toFixed(3),
            ' best-distance', Math.min(...col('best')), '-', Math.max(...col('best')));

console.log('\n--- Univariate Pearson r with P ---');
for (const k of ['best', 'jokers', 'entropy', 'flexRel2', 'flexAbs5', 'flexAbs4', 'reachMass'])
  console.log('  ' + k.padEnd(10), pearson(col(k), col('p')).toFixed(3));

console.log('\n--- reachMass as a cheap surrogate for the MC ---');
console.log('  r(reachMass, P) =', pearson(col('reachMass'), col('p')).toFixed(3),
            ' R^2(P~reachMass) =', ols('p', ['reachMass']).r2.toFixed(3));

function show(name, ks) { const m = ols('p', ks); console.log('  ' + name + '  R^2=' + m.r2.toFixed(3));
  ks.forEach((k, i) => console.log('       ' + k.padEnd(10) + ' beta*=' + m.beta[i + 1].toFixed(4))); }
console.log('\n--- Multiple regression (standardized betas = independent signal) ---');
show('OLD  best+jokers+entropy+flexRel2 :', ['best', 'jokers', 'entropy', 'flexRel2']);
show('ABS  best+jokers+entropy+flexAbs5 :', ['best', 'jokers', 'entropy', 'flexAbs5']);
show('MASS reachMass+jokers            :', ['reachMass', 'jokers']);
show('FULL reachMass+best+jokers+flexAbs5+entropy :', ['reachMass', 'best', 'jokers', 'flexAbs5', 'entropy']);

// partial correlation of each flex variant with P controlling for best & jokers
function partial(fk) {
  const rf = ols(fk, ['best', 'jokers']); // predict flex from controls -> residual
  const X = ['best', 'jokers'].map(z); const ff = col(fk);
  const fres = ff.map((v, i) => v - (rf.beta[0] + rf.beta[1] * X[0][i] + rf.beta[2] * X[1][i]));
  const rp = ols('p', ['best', 'jokers']); const yy = col('p');
  const pres = yy.map((v, i) => v - (rp.beta[0] + rp.beta[1] * X[0][i] + rp.beta[2] * X[1][i]));
  return pearson(fres, pres);
}
console.log('\n--- Partial correlation with P, controlling for best & jokers ---');
for (const k of ['flexRel2', 'flexAbs5', 'flexAbs4', 'reachMass'])
  console.log('  ' + k.padEnd(10), partial(k).toFixed(3));
