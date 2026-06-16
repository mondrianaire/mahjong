/* Part 3 — interactive Charleston SESSION (the panel spine).
 *  sim mode   : seats 1-3 are policy agents; applyPass(my3) auto-returns what you receive.
 *  manual mode: live-table use; applyPass(my3, received3) — you type the 3 tiles you got.
 * Either way the caller only ever sees seat 0's information set (fair-play, §2.2).
 */
const E = require('./engine.js');
const dealer = require('./dealer.js');
const P = require('./policies.js');
const LED = require('./ledger.js');

const NB = { R: i => (i + 1) % 4, A: i => (i + 2) % 4, L: i => (i + 3) % 4 };   // give-to
const RECV = { R: i => (i + 3) % 4, A: i => (i + 2) % 4, L: i => (i + 1) % 4 }; // receive-from

function flatRemaining(yourRack) {
  const m = E.fullPool(); for (const t of yourRack) m.set(t, (m.get(t) || 0) - 1);
  const a = []; for (const [t, n] of m) for (let i = 0; i < n; i++) a.push(t); return a;
}

function newSession(opts = {}) {
  const mode = opts.mode || 'sim';
  const rng = dealer.mulberry32(opts.seed ?? 1);
  let racks, wall = [], dealerExtra = null, policies = [null, null, null, null];

  if (mode === 'sim') {
    if (opts.yourRack) {
      const pool = flatRemaining(opts.yourRack);
      for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
      racks = [opts.yourRack.slice(), pool.slice(0, 13), pool.slice(13, 26), pool.slice(26, 39)];
      dealerExtra = pool[39]; wall = pool.slice(40);
    } else { const d = dealer.deal(opts.seed ?? 1); racks = d.racks; wall = d.wall; dealerExtra = d.dealerExtra; }
    const opp = opts.opponents || [P.winsFlexible, P.winsFlexible, P.winsFlexible];
    policies = [null, opp[0], opp[1], opp[2]];
  } else {
    if (!opts.yourRack) throw new Error('manual mode requires yourRack');
    racks = [opts.yourRack.slice(), null, null, null]; // only seat 0 tracked
  }

  const observations = [[], [], [], []];
  const ledger = LED.newLedger();
  const seq = [{ d: 'R', r: 1 }, { d: 'A', r: 1 }, { d: 'L', r: 1, blind: true }];
  let idx = 0, phase = 'pass', ranR2 = false, done = false;

  function oppPass(s, dir) {
    const pv = { seat: s, ownRack: racks[s].slice(), observations: observations[s].slice(), publicState: { passIndex: idx, round: seq[idx].r, direction: dir } };
    const p = dealer.sanitizePass(racks[s], policies[s].selectPass(pv));
    for (const t of p) racks[s].splice(racks[s].indexOf(t), 1);
    return p;
  }

  function applyPass(my3, received3) {
    if (phase !== 'pass') throw new Error('not at a pass step (phase=' + phase + ')');
    const step = seq[idx], dir = step.d;
    const my = dealer.sanitizePass(racks[0], my3);
    for (const t of my) racks[0].splice(racks[0].indexOf(t), 1);

    let recv;
    if (mode === 'sim') {
      const outgoing = [my, oppPass(1, dir), oppPass(2, dir), oppPass(3, dir)];
      for (let s = 0; s < 4; s++) { const j = NB[dir](s); for (const t of outgoing[s]) racks[j].push(t); observations[j].push({ fromSeat: s, direction: dir, passIndex: idx, tiles: outgoing[s].slice() }); }
      recv = observations[0].filter(o => o.passIndex === idx)[0].tiles.slice();
    } else {
      if (!received3 || received3.length !== 3) throw new Error('manual mode: supply the 3 tiles you received');
      recv = received3.slice(); for (const t of recv) racks[0].push(t);
    }

    LED.decayAll(ledger);
    LED.recordPass(ledger, NB[dir](0), my, idx);
    LED.recordReceive(ledger, RECV[dir](0), recv, idx);
    idx++;
    if (idx >= seq.length) phase = ranR2 ? 'done' : 'stop';
    if (phase === 'done') done = true;
    return { received: recv, ownRack: racks[0].slice(), passed: my };
  }

  // R2 decision after R1. In sim mode opponents vote; R2 runs only if ALL continue.
  function decideR2(humanContinue) {
    if (phase !== 'stop') throw new Error('not at the stop decision');
    let proceed = !!humanContinue;
    if (mode === 'sim' && proceed) {
      const votesStop = [1, 2, 3].some(s => policies[s].stopVote({ seat: s, ownRack: racks[s].slice(), observations: observations[s].slice(), publicState: {} }));
      proceed = proceed && !votesStop;
    }
    if (proceed) { seq.push({ d: 'L', r: 2 }, { d: 'A', r: 2 }, { d: 'R', r: 2, blind: true }); ranR2 = true; phase = 'pass'; }
    else { phase = 'done'; done = true; }
    return { ranR2: proceed };
  }

  function state() {
    const step = seq[idx];
    return {
      mode, phase, done,
      passIndex: idx, round: step ? step.r : null, direction: step ? step.d : null,
      blindEligible: !!(step && step.blind),
      ownRack: racks[0].slice(),
      jokers: racks[0].filter(t => t === 'JK').length,
      ledger: LED.snapshot(ledger),
    };
  }
  // teaching/replay ONLY (sim mode): the legitimate place for full state (§7.4)
  function revealForReplay() { return mode === 'sim' ? { racks: racks.map(r => r.slice()) } : null; }

  return { mode, applyPass, decideR2, state, ledger, revealForReplay };
}

module.exports = { newSession };
