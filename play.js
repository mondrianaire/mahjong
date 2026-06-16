/* Phase 4 — multi-agent play to wall exhaustion (the ground-truth engine).
 * After the Charleston, East gets the extra tile and play proceeds counter-clockwise.
 * Greedy deficiency-reducing discards; legal calls for exposure / mahjong.
 *
 * C1: only NON-concealed targets may call a discard for exposure (concealed may still
 *     call the single winning tile to declare mahjong).
 * C3: a discard is claimed by at most ONE seat (first qualifying in turn order) — calls
 *     are contested, not free, so calling is not over-credited.
 * Horizon H is NOT assumed — games run until someone wins or the wall is empty.
 */
const E = require('./engine.js');
const S = require('./score.js');

const jokersIn = r => r.filter(t => t === 'JK').length;
const tileCounts = r => { const m = new Map(); for (const t of r) m.set(t, (m.get(t) || 0) + 1); return m; };

function recompute(seatState, rack, objective) {
  const sl = S.shortlist(rack, objective);
  seatState.cand = sl.cand; seatState.committed = sl.committed; seatState.best = sl.best;
}

// choose a tile to discard from a 14-tile rack given the committed concrete target
function chooseDiscard(rack, committed) {
  if (!committed) { const nj = rack.filter(t => t !== 'JK'); return nj[nj.length - 1] || rack[0]; }
  const need = new Map(); for (const g of committed.target.groups) need.set(g.tile, (need.get(g.tile) || 0) + g.count);
  const have = tileCounts(rack);
  // surplus = held copies beyond what the target needs (never discard jokers)
  const surplus = [];
  for (const [t, n] of have) { if (t === 'JK') continue; const ex = n - (need.get(t) || 0); for (let i = 0; i < ex; i++) surplus.push(t); }
  if (surplus.length) {
    // discard the surplus tile that helps the target least (fewest needed copies)
    surplus.sort((a, b) => (need.get(a) || 0) - (need.get(b) || 0));
    return surplus[0];
  }
  // no surplus: shed a non-joker not in need, else highest suited number
  const nj = rack.filter(t => t !== 'JK');
  const notNeeded = nj.filter(t => !need.has(t));
  if (notNeeded.length) return notNeeded[0];
  return nj.sort().slice(-1)[0] || rack[0];
}

// can seat win by adding `tile`? (uses cached shortlist; falls back to full)
function winsWith(rack, tile, cand) { return !!S.isWinningRack(rack.concat([tile]), cand); }

// can seat call `tile` for a legal exposure that advances its committed (non-concealed) target?
function canCallExposure(rack, tile, committed) {
  if (!committed) return false;
  const key = committed.target.section + ' | ' + committed.target.name;
  if (S.isConcealedKey(key)) return false;                 // C1: concealed can't expose
  const have = (tileCounts(rack).get(tile) || 0);
  if (have < 2) return false;                               // need a pair in hand to pung the discard
  // does the target actually want a pung+ of this tile, still unfilled?
  const grp = committed.target.groups.find(g => g.tile === tile && g.jokerable);
  if (!grp) return false;
  const hp = E.handPool(rack); const before = E.tilesNeeded(committed.target, hp);
  const after = E.tilesNeeded(committed.target, E.handPool(rack.concat([tile])));
  return after < before;
}

function playGame(charleston, objective = 'WINS', opts = {}) {
  const racks = charleston.racks.map(r => r.slice());
  const wall = charleston.wall.slice();
  racks[0].push(charleston.dealerExtra);                   // East starts with 14
  const seats = [0, 1, 2, 3];
  const st = seats.map(() => ({})); seats.forEach(i => recompute(st[i], racks[i], objective));
  const finish = o => { o.jokersPerSeat = racks.map(r => r.filter(t => t === 'JK').length); if (o.winner == null) o.winner = -1; return o; };

  let turn = 0, firstTurn = true, guard = 0;
  const maxTurns = opts.maxTurns ?? 400;
  while (guard++ < maxTurns) {
    const cur = turn % 4;
    // draw (East's very first turn discards without drawing)
    if (!firstTurn) {
      if (wall.length === 0) return finish({ wallGame: true, wallLeft: 0, turns: guard });
      racks[cur].push(wall.shift());
      recompute(st[cur], racks[cur], objective);
      const w = S.isWinningRack(racks[cur], st[cur].cand);
      if (w) return finish(outcome(cur, w, racks[cur], wall.length, guard));
    }
    firstTurn = false;
    // discard
    const disc = chooseDiscard(racks[cur], st[cur].committed);
    const di = racks[cur].indexOf(disc); racks[cur].splice(di, 1);
    recompute(st[cur], racks[cur], objective);
    // claims, in turn order starting from the player to current's right
    let claimed = -1, claimWin = null;
    for (let k = 1; k <= 3; k++) {
      const y = (cur + k) % 4;
      if (winsWith(racks[y], disc, st[y].cand)) { claimed = y; claimWin = 'mahjong'; break; }
    }
    if (claimed < 0) for (let k = 1; k <= 3; k++) {
      const y = (cur + k) % 4;
      if (canCallExposure(racks[y], disc, st[y].committed)) { claimed = y; claimWin = 'expose'; break; }
    }
    if (claimed >= 0) {
      racks[claimed].push(disc); recompute(st[claimed], racks[claimed], objective);
      if (claimWin === 'mahjong') { const w = S.isWinningRack(racks[claimed], st[claimed].cand); return finish(outcome(claimed, w, racks[claimed], wall.length, guard)); }
      // exposure: claimer now discards and turn continues from them
      const d2 = chooseDiscard(racks[claimed], st[claimed].committed);
      const i2 = racks[claimed].indexOf(d2); racks[claimed].splice(i2, 1);
      recompute(st[claimed], racks[claimed], objective);
      turn = claimed + 1; continue;
    }
    turn = cur + 1;
  }
  return finish({ wallGame: true, wallLeft: wall.length, turns: guard, timeout: true });
}

function outcome(seat, winTarget, rack, wallLeft, turns) {
  return { winner: seat, section: winTarget ? winTarget.section : null,
    line: winTarget ? winTarget.section + ' | ' + winTarget.name : null,
    winnerJokers: jokersIn(rack), wallLeft, turns, wallGame: false };
}

module.exports = { playGame };
