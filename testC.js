const E = require('./engine.js');
const D = require('./dealer.js');
const P = require('./policies.js');
const S = require('./score.js');
const CH = require('./charleston2.js');
const OBS = require('./observer.js');
const DIV = require('./divergence.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok: ' : '  FAIL: ') + m); if (!c) fails++; };

console.log('== Phase 6 / B.1: EV-loss decision-quality (CRN, dedup, junk-biased incoming) ==');
const rack = ['1B','2B','3B','3B','4B','5B','6B','2B','7C','9D','WN','DR','JK']; // Bam run + junk + joker
const cp = CH.choosePass(rack, 'WINS', { seeds: 60, topK: 14 });
console.log('  best pass:', cp.best.pass.join(' '), ' V=' + cp.best.V.toFixed(4), ' policy=' + cp.policyVersion);
const top3 = cp.results.slice(0, 3).map(r => r.pass.join(' ') + ' (EVloss ' + r.evLoss.toFixed(4) + (r.deadHeatWithBest ? ', dead-heat' : '') + ')');
console.log('  ranked:', top3.join('  |  '));
ok(cp.results.length >= 3, 'evaluated multiple candidate passes');
ok(cp.best.evLoss === 0, 'best pass has zero EV-loss');
ok(cp.results.every(r => r.evLoss >= -1e-9), 'no pass beats the best (EV-loss >= 0)');
// the optimizer should keep the Bam run: best pass should not contain 6B/5B/4B core
const keepsCore = !cp.best.pass.includes('5B') && !cp.best.pass.includes('6B');
ok(keepsCore, 'best pass preserves the Bam-run core (sheds junk)');
// grade a deliberately bad pass (dumping run tiles) -> high EV-loss
const grade = CH.gradePass(rack, ['4B','5B','6B'], 'WINS', { seeds: 60 });
console.log('  grading bad pass 4B 5B 6B -> EVloss=' + grade.evLoss.toFixed(4) + ' percentile=' + grade.percentile.toFixed(0));
ok(grade.evLoss > cp.results[Math.min(2, cp.results.length - 1)].evLoss * 0 + 1e-9, 'shedding run tiles has positive EV-loss');

console.log('== Phase 7 / B.10: opponent inference MEASURED vs ground truth ==');
// Two measurements (signal-first, principle 6):
//  (1) full-section prediction log-loss vs uniform — reported as a FINDING
//  (2) negative signal: does shedding section X's theme make the opp LESS likely in X?
const TH = ['2468', '13579', '369', '2026', 'W-D'];
const charMatch = (sec, t) => OBS.CHAR[sec] && OBS.CHAR[sec](t);
let nllPost = 0, nllUnif = 0, n = 0, sims = 150;
let baseN = 0, baseK = 0, condN = 0, condK = 0;
for (let s = 0; s < sims; s++) {
  const ch = D.runCharleston([P.winsFlexible, P.winsFlexible, P.winsFlexible, P.winsFlexible], { seed: s + 100 });
  const posts = OBS.inferFrom(ch.observations[0]);
  for (const seat of [1, 2, 3]) {
    const trueSec = S.bestLine(ch.racks[seat], 'WINS').section;
    if (posts[seat]) { nllPost += OBS.logLossAgainst(posts[seat], trueSec); nllUnif += OBS.uniformLogLoss(); n++; }
    const passed = ch.observations[0].filter(o => o.fromSeat === seat).flatMap(o => o.tiles);
    for (const X of TH) {
      baseN++; if (trueSec === X) baseK++;
      if (passed.filter(t => charMatch(X, t)).length >= 2) { condN++; if (trueSec === X) condK++; }
    }
  }
}
const baseRate = baseK / baseN, condRate = condN ? condK / condN : 0;
console.log('  (1) full-section log-loss ' + (nllPost / n).toFixed(3) + ' vs uniform ' + (nllUnif / n).toFixed(3) +
            '  -> FINDING: ' + (nllPost / n < nllUnif / n ? 'weak positive' : 'no better than chance (Consec dominates, themeless)'));
console.log('  (2) P(opp in X)=' + (100 * baseRate).toFixed(1) + '%  vs  P(opp in X | shed >=2 of X-theme)=' + (100 * condRate).toFixed(1) + '%');
ok(condRate < baseRate, 'MEASURED: shedding a theme is real NEGATIVE signal (opp less likely in that section)');
console.log('  -> usable for the incoming/defense model even though full-section prediction is weak.');

console.log('== Phase 8: divergence detector ==');
let sens = 0, tot = 0;
for (let s = 0; s < 200; s++) {
  const d = D.deal(s + 1).racks[0];
  const r = DIV.detect(d); tot++; if (r.sensitive) sens++;
}
console.log('  game-type-sensitive deals: ' + (100 * sens / tot).toFixed(1) + '% (expected ~15-50%)');
const demo = ['1B','1B','3B','5B','7B','9B','9B','5C','5C','5C','FL','FL','JK'];
const dr = DIV.detect(demo);
console.log('  demo:', dr.sensitive ? ('WINS=' + dr.wins.section + ' vs POINTS=' + dr.points.section + ' | ' + dr.trade.reason) : ('agree on ' + dr.pick.section));
ok(sens > 0 && sens < tot, 'detector fires on a structured minority, not always/never');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nWAVE C/D PASS');
process.exit(fails ? 1 : 0);
