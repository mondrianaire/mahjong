const E = require('./engine.js');
const K = require('./kernel.js');
const D = require('./dealer.js');
const META = require('./card-meta.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok: ' : '  FAIL: ') + m); if (!c) fails++; };

console.log('== Phase 0: card meta ==');
const lm = META.buildMeta();
ok(lm.size === E.CARD.length, 'meta for every line (' + lm.size + ')');
ok(META.pointsFor('S&P') > META.pointsFor('Consec'), 'S&P worth more than Consec (illustrative)');

console.log('== Phase 1: kernel acceptance + C1 ==');
// 2468 L1A exposed in Bams: 222 444 6666 8888 ; rack one 8B short
const target = { section: '2468', name: 'L1A', groups: [
  { tile: '2B', count: 3, jokerable: true }, { tile: '4B', count: 3, jokerable: true },
  { tile: '6B', count: 4, jokerable: true }, { tile: '8B', count: 4, jokerable: true } ] };
const rack = ['2B','2B','2B','4B','4B','4B','6B','6B','6B','6B','8B','8B','8B']; // 13, needs 1x 8B
const unseen = K.unseenFromRack(rack);
const exp = K.acceptanceForTarget(target, rack, unseen, false);
const con = K.acceptanceForTarget(target, rack, unseen, true);
ok(exp.deficiency === 1, 'deficiency 1 (got ' + exp.deficiency + ')');
ok(exp.slots[0].acceptance === (4 - 3) + 8, 'exposed slot acceptance = 1 natural + 8 jokers = 9 (got ' + exp.slots[0].acceptance + ')');
ok(exp.slots[0].claimable === true, 'exposed kong slot is claimable');
ok(con.slots[0].claimable === false, 'C1: concealed slot NOT claimable');
ok(con.slots[0].acceptance === 9, 'C1: concealed acceptance set unchanged (jokers still legal) = 9');
ok(exp.drawOnlySlots === 0 && con.drawOnlySlots === 1, 'concealed turns the slot draw-only');

console.log('== Phase 2: Dealer conservation + hygiene (10,000 runs) ==');
// simple default policy: pass first 3 non-joker; never stop; offer 0 courtesy
const naive = {
  selectPass: v => v.ownRack.filter(t => t !== 'JK').slice(0, 3),
  stopVote: () => false, courtesyOffer: () => 0, blindDecision: () => false,
};
let conserved = 0, jokerMoves = 0, leak = 0, r2count = 0;
for (let s = 0; s < 10000; s++) {
  let res;
  try { res = D.runCharleston([naive, naive, naive, naive], { seed: s + 1 }); }
  catch (e) { if (/joker/.test(e.message)) jokerMoves++; else if (/conservation/.test(e.message)) {} console.log('  threw:', e.message); break; }
  if (res.conserved) conserved++;
  if (res.ranR2) r2count++;
  // hygiene: each observation a seat holds must be tiles it RECEIVED (we can't see opp-to-opp)
  for (let seat = 0; seat < 4; seat++)
    for (const o of res.observations[seat]) if (o.fromSeat === seat) leak++;
}
ok(conserved === 10000, 'all 10,000 runs conserve the 152-multiset (got ' + conserved + ')');
ok(jokerMoves === 0, 'no joker ever moved between racks');
ok(leak === 0, 'no seat observed a pass it did not receive (no god-view leak)');
console.log('  (R2 ran in ' + r2count + '/10000 with never-stop policy — expected 10000)');
ok(r2count === 10000, 'never-stop policy always reaches R2');

// stop-vote wiring: a policy that votes stop should suppress R2
const stopper = Object.assign({}, naive, { stopVote: () => true });
const r = D.runCharleston([stopper, naive, naive, naive], { seed: 7 });
ok(r.ranR2 === false, 'any single seat voting stop suppresses R2');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nWAVE A PASS');
process.exit(fails ? 1 : 0);
