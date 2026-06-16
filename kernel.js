/* Phase 1 — deficiency & acceptance kernel.
 *
 * Correction C1: a CONCEALED hand makes no exposures, so it cannot CALL a discard
 * for any slot. Jokers are still legal in its pung+ groups (self-draw places them),
 * so concealment changes `claimable`, NOT the per-slot acceptance set. The cost of
 * concealment is the loss of the claim channel (≈3 opponents' discards), applied in
 * the opportunity term of the scorer (Phase 3), not here.
 */
const E = require('./engine.js');

function unseenFromRack(rackTiles, extraSeen = []) {
  const m = E.fullPool();
  for (const t of rackTiles.concat(extraSeen)) m.set(t, (m.get(t) || 0) - 1);
  return m;
}

// per-group fill detail against a rack (jokers from rack), mirrors engine coverage
function fillDetail(target, hp) {
  const groups = target.groups.map(g => ({ tile: g.tile, count: g.count, jokerable: g.jokerable, fnat: 0, fjok: 0, remaining: g.count }));
  const order = groups.slice().sort((a, b) => (a.jokerable ? 1 : 0) - (b.jokerable ? 1 : 0));
  const local = new Map(); let jk = hp.jokers;
  for (const g of order) {
    let need = g.count;
    const used = local.get(g.tile) || 0;
    const have = (hp.pool.get(g.tile) || 0) - used;
    const useReal = Math.min(have, need); local.set(g.tile, used + useReal); need -= useReal; g.fnat = useReal;
    if (g.jokerable && need > 0) { const uj = Math.min(jk, need); jk -= uj; need -= uj; g.fjok = uj; }
    g.remaining = need;
  }
  return groups;
}

// D(P) and per-slot acceptance for ONE concrete target, given a rack + unseen pool.
function acceptanceForTarget(target, rackTiles, unseenMap, concealed) {
  const hp = E.handPool(rackTiles);
  const groups = fillDetail(target, hp);
  const jokUnseen = unseenMap.get('JK') || 0;
  const slots = [];
  for (const g of groups) {
    for (let s = 0; s < g.remaining; s++) {
      const natural = unseenMap.get(g.tile) || 0;
      const acc = natural + (g.jokerable ? jokUnseen : 0);
      const claimable = g.jokerable && !concealed; // C1
      slots.push({ tile: g.tile, acceptance: acc, claimable, jokerable: g.jokerable });
    }
  }
  const deficiency = slots.length;
  const minAccept = slots.length ? Math.min(...slots.map(s => s.acceptance)) : Infinity;
  const drawOnlySlots = slots.filter(s => !s.claimable).length;
  const usableJokerSlots = slots.filter(s => s.jokerable).length;
  return { deficiency, slots, minAccept, drawOnlySlots, usableJokerSlots };
}

module.exports = { unseenFromRack, fillDetail, acceptanceForTarget };
