/* Part 3 Zone 5 — the Information Ledger.
 * Records only the player's OWN certain actions (what you passed/received and when),
 * derives decaying "holds" beliefs and a tentative section-lean, and exposes a snapshot
 * STRICTLY bounded by the fair-play rule (§2.2): never any opponent hidden tile.
 *
 * Honest design: positive section-lean is suppressed/greyed during the Charleston because
 * the engine MEASURED that signal to be ≈ chance (observer.js). The clean early read is the
 * NEGATIVE one — "not collecting" — surfaced from the classes a seat dumped on you.
 */
const OBS = require('./observer.js');
const DECAY = 0.77;   // ≈ (1 − 3/13): a seat sheds ~3 of ~13 tiles each later pass-out (§7.2)

function newLedger() { return { passedOut: {}, received: {}, holds: {}, sectionLean: {}, notReturned: new Set(), public: [] }; }
const ens = (o, s) => (o[s] = o[s] || {});

function decayAll(L) { for (const s in L.holds) for (const t in L.holds[s]) L.holds[s][t] *= DECAY; }

function recordPass(L, seat, tiles, passIndex) {           // you handed `seat` these tiles
  const po = ens(L.passedOut, seat), h = ens(L.holds, seat);
  for (const t of tiles) { (po[t] = po[t] || []).push(passIndex); h[t] = 1.0; L.notReturned.add(t); }
}
function recordReceive(L, seat, tiles, passIndex) {        // `seat` handed you these (they're shedding them)
  const r = ens(L.received, seat);
  for (const t of tiles) { (r[t] = r[t] || []).push(passIndex); L.notReturned.delete(t); }
  if (!L.sectionLean[seat]) L.sectionLean[seat] = OBS.newPosterior();
  for (const t of tiles) OBS.updateWithPassedTile(L.sectionLean[seat], t);
}

// sections a seat is demonstrably NOT collecting = themes whose characteristic tiles they passed you
function notCollecting(L, seat) {
  const out = new Set(); const r = L.received[seat] || {};
  for (const t in r) for (const sec in OBS.CHAR) if (OBS.CHAR[sec](t)) out.add(sec);
  return [...out];
}

// fair-play: during the Charleston we intentionally do NOT raise a hard defensive flag — the
// measured opponent signal is too weak. The hook exists for the wall phase (public data).
function defensiveFlag() { return false; }

// snapshot for the UI — ONLY player-derived facts + inferences, never an opponent's rack
function snapshot(L) {
  const seats = {};
  for (const seat of [1, 2, 3]) {
    const h = L.holds[seat] || {};
    const solid = [], faded = [];
    for (const t in h) { if (h[t] >= 0.999) solid.push(t); else if (h[t] > 0.05) faded.push({ tile: t, p: +h[t].toFixed(2) }); }
    const lean = L.sectionLean[seat] ? OBS.argmax(L.sectionLean[seat]) : null;
    seats[seat] = {
      solidHolds: solid,                              // confidence 1.0 — you handed these over
      fadedHolds: faded.sort((a, b) => b.p - a.p),    // decaying belief they still hold them
      notCollecting: notCollecting(L, seat),          // the clean early read
      lean: lean ? { section: lean.section, p: +lean.p.toFixed(2), tentative: true } : null, // greyed: ≈chance
    };
  }
  return { seats, notReturned: [...L.notReturned] };
}

module.exports = { newLedger, decayAll, recordPass, recordReceive, notCollecting, defensiveFlag, snapshot, DECAY };
