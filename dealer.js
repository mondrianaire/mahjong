/* Phase 2 — the Dealer (the spine).
 *
 * Holds ONE conserved 152-tile deal, runs four engine instances over private views,
 * routes the full Charleston (R1, R2 w/ stop vote, courtesy), and enforces:
 *   - conservation: multiset(racks ∪ wall ∪ dealerExtra) == fullPool at all times
 *   - jokers never move between racks
 *   - information hygiene: a policy only ever sees its PrivateView
 * Blind passing is decision-capable in policies but executed off by default in v1
 * (kept simple to guarantee conservation); see Phase 6 notes.
 */
const E = require('./engine.js');

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function flatPool() { const a = []; for (const [t, n] of E.fullPool()) for (let i = 0; i < n; i++) a.push(t); return a; }

function deal(seed = 1) {
  const rng = mulberry32(seed);
  const pool = flatPool();
  for (let i = pool.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
  const racks = [pool.slice(0, 13), pool.slice(13, 26), pool.slice(26, 39), pool.slice(39, 52)];
  const dealerExtra = pool[52];        // goes to East (seat 0) at start of play
  const wall = pool.slice(53);          // 99 tiles
  return { racks, dealerExtra, wall, rng };
}

// conservation: full multiset is invariant
function multisetKey(tiles) { const m = new Map(); for (const t of tiles) m.set(t, (m.get(t) || 0) + 1); return m; }
function assertConserved(state) {
  const all = [].concat(...state.racks, state.wall, [state.dealerExtra]);
  if (all.length !== 152) return 'tile count ' + all.length + ' != 152';
  const a = multisetKey(all), full = E.fullPool();
  for (const [t, n] of full) if ((a.get(t) || 0) !== n) return 'mismatch ' + t + ' ' + (a.get(t) || 0) + '/' + n;
  for (const [t] of a) if (!full.has(t)) return 'unknown tile ' + t;
  return null;
}

// remove a multiset of tiles from a rack array (by value); returns true if all removed
function removeTiles(rack, tiles) {
  for (const t of tiles) { const i = rack.indexOf(t); if (i < 0) return false; rack.splice(i, 1); }
  return true;
}

// sanitize a policy's proposed pass: exactly 3 tiles, all present in rack, NO jokers
function sanitizePass(rack, proposed) {
  const out = []; const work = rack.slice();
  for (const t of (proposed || [])) {
    if (t === 'JK') continue;
    const i = work.indexOf(t);
    if (i >= 0 && out.length < 3) { out.push(t); work.splice(i, 1); }
  }
  // backfill from remaining non-joker tiles if policy under-supplied
  for (const t of work) { if (out.length >= 3) break; if (t !== 'JK') out.push(t); }
  return out.slice(0, 3);
}

const NB = { // give-target for seat i
  R: i => (i + 1) % 4, A: i => (i + 2) % 4, L: i => (i + 3) % 4,
};

function privateView(state, seat, observations, pub) {
  return { seat, ownRack: state.racks[seat].slice(), observations: observations[seat].slice(), publicState: pub };
}

// execute one directional pass for all four seats simultaneously
function doPass(state, dir, policies, observations, passIndex, round, jokerGuard) {
  const give = NB[dir];
  const outgoing = [];
  for (let i = 0; i < 4; i++) {
    const view = privateView(state, i, observations, { passIndex, round, direction: dir });
    const pass = sanitizePass(state.racks[i], policies[i].selectPass(view));
    if (pass.includes('JK')) throw new Error('joker in pass (seat ' + i + ')'); // hygiene/legality
    if (!removeTiles(state.racks[i], pass)) throw new Error('pass tile not in rack');
    outgoing.push(pass);
  }
  // distribute
  for (let i = 0; i < 4; i++) {
    const j = give(i);
    for (const t of outgoing[i]) state.racks[j].push(t);
    observations[j].push({ fromSeat: i, direction: dir, passIndex, round, tiles: outgoing[i].slice(), blind: false });
  }
  const err = assertConserved(state); if (err) throw new Error('conservation broken after ' + dir + ': ' + err);
  if (jokerGuard) jokerGuard(state, 'pass ' + dir);
}

function courtesy(state, policies, observations, pub) {
  // across pairs: (0,2) and (1,3)
  for (const [a, b] of [[0, 2], [1, 3]]) {
    const va = privateView(state, a, observations, pub), vb = privateView(state, b, observations, pub);
    const k = Math.max(0, Math.min(3, policies[a].courtesyOffer(va), policies[b].courtesyOffer(vb)));
    if (k === 0) continue;
    const pa = sanitizePass(state.racks[a], policies[a].selectPass(va)).slice(0, k);
    const pb = sanitizePass(state.racks[b], policies[b].selectPass(vb)).slice(0, k);
    if (pa.length !== k || pb.length !== k) continue;
    removeTiles(state.racks[a], pa); removeTiles(state.racks[b], pb);
    for (const t of pb) state.racks[a].push(t);
    for (const t of pa) state.racks[b].push(t);
    observations[a].push({ fromSeat: b, direction: 'courtesy', tiles: pb.slice(), blind: false });
    observations[b].push({ fromSeat: a, direction: 'courtesy', tiles: pa.slice(), blind: false });
  }
  const err = assertConserved(state); if (err) throw new Error('conservation broken after courtesy: ' + err);
}

function runCharleston(policies, opts = {}) {
  const state = deal(opts.seed ?? 1);
  const observations = [[], [], [], []];
  // joker positions per rack must be invariant across passes
  const jokerCounts = state.racks.map(r => r.filter(t => t === 'JK').length);
  const jokerGuard = (st) => { st.racks.forEach((r, i) => { if (r.filter(t => t === 'JK').length !== jokerCounts[i]) throw new Error('joker moved at seat ' + i); }); };

  let pi = 0;
  // R1: right, across, left
  for (const dir of ['R', 'A', 'L']) doPass(state, dir, policies, observations, pi++, 1, jokerGuard);
  // R2 optional: proceeds only if ALL seats vote to continue (any one can stop)
  const pub2 = { passIndex: pi, round: 2 };
  const votesStop = policies.map((p, i) => p.stopVote(privateView(state, i, observations, pub2)));
  const r2 = !votesStop.some(Boolean);
  if (r2) for (const dir of ['L', 'A', 'R']) doPass(state, dir, policies, observations, pi++, 2, jokerGuard);
  // courtesy across
  courtesy(state, policies, observations, { passIndex: pi, round: 3 });

  return { racks: state.racks, observations, wall: state.wall, dealerExtra: state.dealerExtra,
    ranR2: r2, votesStop, conserved: assertConserved(state) === null };
}

module.exports = { deal, assertConserved, runCharleston, sanitizePass, privateView, mulberry32, flatPool };
