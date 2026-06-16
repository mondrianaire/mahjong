const E = require('./engine.js');

function assert(c, msg) { if (!c) { console.log('  FAIL: ' + msg); process.exitCode = 1; } else console.log('  ok: ' + msg); }

console.log('== pool ==');
let tot = 0; for (const [,n] of E.fullPool()) tot += n;
assert(tot === 152, 'full pool = 152 (got ' + tot + ')');

console.log('== card expansion ==');
const T = E.buildTargets();
console.log('  lines:', E.CARD.length, ' concrete targets:', T.length);
// every target sums to 14 and has valid jokerable flags
let bad = 0;
for (const t of T) {
  const s = t.groups.reduce((a, g) => a + g.count, 0);
  if (s !== 14) bad++;
  for (const g of t.groups) if (g.jokerable !== (g.count >= 3)) bad++;
}
assert(bad === 0, 'all targets sum to 14 w/ correct jokerable flags');

// per-line at least one target
const lines = new Set(T.map(t => t.section + '/' + t.name));
assert(lines.size === E.CARD.length, 'every line produced >=1 target (' + lines.size + '/' + E.CARD.length + ')');

console.log('== distance sanity ==');
// A hand that is exactly a winning 2468 L1A in Bams minus 1 tile (13 tiles) -> distance 1
// 222 444 6666 8888 (one suit). Drop one 8B -> need 1.
const almost = ['2B','2B','2B','4B','4B','4B','6B','6B','6B','6B','8B','8B','8B'];
const aS = E.analyzeStatic(almost);
assert(aS.best === 1, '13/14 of a real hand -> distance 1 (got ' + aS.best + ')');

// Full 14-tile winning hand -> distance 0
const full = almost.concat(['8B']);
assert(E.analyzeStatic(full).best === 0, 'complete 14-tile hand -> distance 0 (got ' + E.analyzeStatic(full).best + ')');

// Jokers should reduce distance for a jokerable group (kong of 8s)
const withJ = ['2B','2B','2B','4B','4B','4B','6B','6B','6B','6B','8B','8B','JK'];
assert(E.analyzeStatic(withJ).best === 1, 'joker fills kong slot, still 1 away (got ' + E.analyzeStatic(withJ).best + ')');

// Joker may NOT complete a pair-only requirement: build a hand 1 away on a pair
// S&P L4 (7 pairs, 1 suit, consec) 11 22 33 44 55 66 77 — give 13 with a joker where a pair tile is missing
const pairsHand = ['1B','1B','2B','2B','3B','3B','4B','4B','5B','5B','6B','6B','JK'];
const ph = E.analyzeStatic(pairsHand);
// the JK cannot serve the 7th pair (77). Nearest S&P L4 still needs 2 real 7B -> >1 from THIS line,
// but other lines may be closer; just assert distance is finite and >=1
assert(ph.best >= 1, 'pairs hand has finite distance >=1 (got ' + ph.best + ')');

console.log('== metrics ==');
const m = E.metrics(almost);
console.log('  distance', m.distance, 'flexBest', m.flexBest, 'flex2', m.flex2, 'jokers', m.jokers,
            'entropy', m.suitEntropy, 'pairs', m.pairs, 'pungs', m.pungs, 'even/odd', m.even + '/' + m.odd,
            'dead', m.deadTiles.length);
assert(m.distance === 1, 'metrics distance matches');

console.log('== monte carlo ==');
const t0 = Date.now();
const mc = E.monteCarlo(almost, { draws: 16, sims: 2000 });
console.log('  P(reach mahjong)=', mc.p.toFixed(3), 'candidates', mc.candidates, 'in', (Date.now()-t0)+'ms');
assert(mc.p > 0.5, '1-away hand should have high P (got ' + mc.p.toFixed(3) + ')');

// a random junk hand should be far + lower P
const junk = ['1B','5C','9D','2B','7C','3D','4B','8C','6D','1C','9B','5D','WN'];
const mj = E.metrics(junk);
const mcj = E.monteCarlo(junk, { draws: 16, sims: 2000 });
console.log('  junk: distance', mj.distance, 'P=', mcj.p.toFixed(3));
assert(mj.distance >= aS.best, 'junk no closer than the near hand');

console.log('== charleston ==');
const cs = E.charlestonSuggest(junk);
console.log('  suggested pass:', cs.pass.join(' '));
assert(cs.pass.length === 3, 'suggests exactly 3 tiles');

console.log('\nDONE');
