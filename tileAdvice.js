/* Part 3 Zone 3 — Tile Tray. Per-tile action + justification + immediate & long-term effect.
 *  - action from keepValueDedup (PASS≈0, KEEP high, FLEX mid); jokers/Flowers/Soap protected.
 *  - immediate = marginal change in your CURRENT best hand's deficiency if removed now.
 *  - longTerm  = effect on direction concentration / option value (the keepValue itself).
 */
const E = require('./engine.js');
const CH = require('./charleston2.js');
const S = require('./score.js');
const DIR = require('./direction.js');
const OBS = require('./observer.js');

const bestDist = rack => S.shortlist(rack, 'WINS').best;
const isHighUtil = t => t === 'FL' || t === 'DW';

function advise(rack, objective = 'WINS', ledger = null, opts = {}) {
  const kv = CH.keepValueDedup(rack, objective);            // distinct non-joker tiles, ascending kv
  const kvMap = new Map(kv.map(x => [x.tile, x.kv]));
  const maxKv = Math.max(...kv.map(x => x.kv), 1e-9);
  const base = bestDist(rack);
  // "core" tiles belong to the LEADING DIRECTION (robust), not the single closest hand (noisy).
  const comp = DIR.compass(rack, opts.passIndex || 0);
  const lead = comp.top[0];
  const hp = E.handPool(rack);
  let leadTarget = null, leadD = 99;
  for (const t of E.buildTargets()) { if (t.section !== lead) continue; const d = E.tilesNeeded(t, hp); if (d < leadD) { leadD = d; leadTarget = t; } }
  const needLead = new Set(); if (leadTarget) for (const g of leadTarget.groups) needLead.add(g.tile);
  const themePred = OBS.CHAR[lead] || (() => false);
  const isCore = t => themePred(t) || needLead.has(t);
  const counts = new Map(); for (const t of rack) counts.set(t, (counts.get(t) || 0) + 1);
  const distinct = [...new Set(rack)];

  const advice = distinct.map(t => {
    const kvVal = t === 'JK' ? Infinity : (kvMap.get(t) ?? 0);
    // immediate
    let immediate;
    if (t === 'JK') immediate = 'Illegal to pass; fills your pung/kong slots right now.';
    else { const r = rack.slice(); r.splice(r.indexOf(t), 1); const dd = bestDist(r) - base;
      immediate = dd <= 0 ? 'No effect on your current best hand.' : `Sets your best hand back ${dd} tile${dd > 1 ? 's' : ''}.`; }
    // action + long-term
    let action, longTerm;
    if (t === 'JK') { action = 'KEEP'; longTerm = 'Each joker ≈ +12% win prob; lives in pung/kong-heavy hands.'; }
    else if (isHighUtil(t)) { action = 'KEEP'; longTerm = 'Scarce and cross-useful — holding keeps several lines open at once.'; }
    else if (isCore(t) || kvVal >= 0.5 * maxKv) { action = 'KEEP'; longTerm = 'Anchors your live direction (' + lead + '); a member of the hand you are building.'; }
    else if (kvVal <= 0.05 * maxKv) { action = 'PASS'; longTerm = 'Dead pivot — sheds toward your committed direction and leaks least.'; }
    else { action = 'FLEX'; longTerm = 'Backup-section pivot; keep one more pass while cheap, then re-decide.'; }
    // constraints
    const constraints = [];
    if (t === 'JK') constraints.push('JOKER_NEVER_PASS');
    if ((counts.get(t) || 0) >= 2 && kvVal > 0 && kvVal !== Infinity) constraints.push('DONT_SPLIT_PAIR');
    if (isHighUtil(t)) constraints.push('HIGH_UTILITY');
    if (ledger && typeof ledger.defensiveFlag === 'function' && ledger.defensiveFlag(t)) constraints.push('DEFENSIVE_FLAG');
    const confidence = (t === 'JK' || isHighUtil(t)) ? 'high' : (action === 'FLEX' ? 'med' : 'high');
    return { tile: t, action, keepValue: kvVal === Infinity ? null : +kvVal.toFixed(4), immediate, longTerm, constraints, confidence };
  });

  // recommended pass = 3 lowest-keepValue non-jokers (consistent with charleston2)
  const pass = kv.filter(x => x.tile !== 'JK').slice(0, 3).map(x => x.tile);
  // coherent-group warning: would the pass hand one seat a usable set? (same number across suits / run)
  const coherent = isCoherent(pass);
  return { advice, pass, coherentGroupWarn: coherent };
}

function isCoherent(three) {
  const vals = three.map(t => (t.length === 2 && 'BCD'.includes(t[1])) ? +t[0] : null).filter(v => v != null);
  if (vals.length === 3) {
    if (new Set(vals).size === 1) return 'same number — feeds Like Numbers';
    const s = vals.slice().sort((a, b) => a - b);
    if (s[1] === s[0] + 1 && s[2] === s[1] + 1) return 'consecutive run — feeds Consec';
  }
  const suits = three.map(t => t[1]);
  if (three.every(t => t.length === 2 && 'BCD'.includes(t[1])) && new Set(suits).size === 1) return 'all one suit';
  return null;
}

module.exports = { advise, isCoherent };
