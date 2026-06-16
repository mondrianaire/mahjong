/* B.9 step 1 — generate a labeled self-play corpus.
 * For each game, for each seat: features of its POST-CHARLESTON hand + whether it won.
 * Appends to corpus.csv so runs accumulate. */
const fs = require('fs');
const E = require('./engine.js');
const S = require('./score.js');
const K = require('./kernel.js');
const D = require('./dealer.js');
const P = require('./policies.js');
const PLAY = require('./play.js');

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
  return [best, +rm.toFixed(4), jokers, drawOnly, minAcc, +H.toFixed(3)];
}

const N = +process.argv[2] || 180;
const pol = [P.winsFlexible, P.winsFlexible, P.winsFlexible, P.winsFlexible];
const rows = [];
const t0 = Date.now();
for (let s = 0; s < N; s++) {
  const ch = D.runCharleston(pol, { seed: (Date.now() % 100000) + s });
  const g = PLAY.playGame(ch, 'WINS');
  for (let seat = 0; seat < 4; seat++) {
    const win = (!g.wallGame && g.winner === seat) ? 1 : 0;
    rows.push(features(ch.racks[seat]).concat([win]).join(','));
  }
}
const header = 'best,rm,jokers,drawOnly,minAcc,ent,win\n';
fs.appendFileSync('corpus.csv', (fs.existsSync('corpus.csv') ? '' : header) + rows.join('\n') + '\n');
console.log('appended ' + rows.length + ' samples in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
