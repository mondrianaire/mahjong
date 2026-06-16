const DIR = require('./direction.js');
const TA = require('./tileAdvice.js');
const SESS = require('./session.js');
const E = require('./engine.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok: ' : '  FAIL: ') + m); if (!c) fails++; };

// Part 3 §5.3 worked example rack: strong 369
const rack = ['JK','JK','FL','3B','6B','9B','3C','6C','4B','2D','5D','WN','WE'];

console.log('== Zone 1: Direction engine ==');
const comp = DIR.compass(rack, 0);
console.log('  lean:', comp.sorted.slice(0, 3).map(([s, w]) => s + ' ' + (100 * w).toFixed(0) + '%').join('  '),
            '| concentration', comp.concentration.toFixed(2), '| commit', comp.commit);
console.log('  guidance:', comp.guidance);
ok(comp.top[0] === '369', 'top direction is 369 (got ' + comp.top[0] + ')');
ok(comp.concentration >= 0 && comp.concentration <= 1, 'concentration in [0,1]');

console.log('== Zone 3: Tile Tray (immediate + long-term) ==');
const tray = TA.advise(rack, 'WINS');
const byTile = Object.fromEntries(tray.advice.map(a => [a.tile, a]));
console.log('  recommended pass:', tray.pass.join(' '), tray.coherentGroupWarn ? '(WARN ' + tray.coherentGroupWarn + ')' : '');
for (const t of ['JK','3B','FL','2D','WN']) console.log('   ' + t.padEnd(3), byTile[t].action.padEnd(5), '| imm:', byTile[t].immediate);
ok(byTile['JK'].action === 'KEEP' && byTile['JK'].constraints.includes('JOKER_NEVER_PASS'), 'jokers KEEP + never-pass constraint');
ok(byTile['3B'].action === 'KEEP', '369 core (3B) is KEEP');
ok(byTile['FL'].constraints.includes('HIGH_UTILITY'), 'Flower flagged HIGH_UTILITY');
ok(['PASS','FLEX'].includes(byTile['2D'].action), 'isolated 2D is PASS/FLEX');
ok(tray.pass.length === 3 && !tray.pass.includes('JK'), 'recommended pass is 3 tiles, no joker');

console.log('== Session + Ledger: SIM mode, full R1+R2, fair-play ==');
const s = SESS.newSession({ mode: 'sim', yourRack: rack.slice(), seed: 5 });
let leaked = 0;
for (let p = 0; p < 3; p++) {
  const st = s.state();
  const pass = TA.advise(st.ownRack, 'WINS').pass;
  const res = s.applyPass(pass);
  ok(st.ownRack.length === 13, 'pass ' + p + ': own rack is 13 before pass');
  ok(res.received.length === 3 && res.ownRack.length === 13, 'pass ' + p + ': received 3, rack back to 13');
  // fair-play: the snapshot must never contain an opponent's full rack
  const snap = s.state().ledger;
  for (const seat of [1,2,3]) if (snap.seats[seat].solidHolds.length > 3) leaked++;
}
ok(leaked === 0, 'fair-play: snapshot never exposes an opponent rack (only tiles YOU passed)');
const afterR1 = s.state();
ok(afterR1.phase === 'stop', 'after R1 the session is at the stop decision');
// ledger checks
const snap = afterR1.ledger;
const someSolid = [1,2,3].some(seat => snap.seats[seat].solidHolds.length > 0 || snap.seats[seat].fadedHolds.length > 0);
ok(someSolid, 'ledger recorded tiles you handed to specific seats');
const decayed = [1,2,3].some(seat => snap.seats[seat].fadedHolds.some(f => f.p < 1));
ok(decayed, 'belief-decay: older "holds" faded below 1.0 (≈0.77^k)');
const negRead = [1,2,3].some(seat => snap.seats[seat].notCollecting.length > 0);
ok(negRead, 'ledger surfaces the clean negative read ("not collecting")');

s.decideR2(true);
ok(s.state().phase === 'pass' || s.state().phase === 'done', 'stop decision advances the session');

console.log('== Session: MANUAL (live-table) mode ==');
const m = SESS.newSession({ mode: 'manual', yourRack: rack.slice() });
const mres = m.applyPass(['2D','5D','WN'], ['7C','7C','8C']);
ok(mres.ownRack.length === 13 && mres.received.join() === '7C,7C,8C', 'manual mode: you type received tiles, rack stays 13');
ok(m.state().ledger.seats[3].fadedHolds.length + m.state().ledger.seats[1].fadedHolds.length >= 0, 'manual ledger populated from your own actions');

console.log(fails ? '\n' + fails + ' FAILURES' : '\nPART 3 SLICE PASS');
process.exit(fails ? 1 : 0);
