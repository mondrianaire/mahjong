/* Phase 7 + Part 2 B.10 — online opponent characterization.
 * Categorical posterior over each opponent's section, updated from the tiles they
 * pass you (a seat sheds tiles it does NOT need -> evidence against sections that use
 * those tiles). "Hints not conclusions": start uniform, decay, never assert.
 *
 * The deliverable is a MEASUREMENT first (principle 6): does the posterior actually
 * beat a uniform prior at predicting an opponent's section? The Dealer's ground truth
 * lets us score it with log-loss instead of asserting the heuristic works.
 */
const E = require('./engine.js');

const SECTIONS = [...new Set(E.CARD.map(l => l.section))];

// CHARACTERISTIC number-theme of each section — the discriminative signal. "Appears
// anywhere" is too blunt (most number tiles appear in almost every section), so we key
// on each section's bread-and-butter tiles: a player sheds their OWN theme last.
function suitVal(t) { return (t.length === 2 && 'BCD'.includes(t[1]) && t[0] >= '1' && t[0] <= '9') ? t[0] : null; }
function isWindDragon(t) { return (t[0] === 'W' && 'NEWS'.includes(t[1])) || ['DG', 'DR', 'DW'].includes(t); }
const CHAR = {
  '2468': t => ['2', '4', '6', '8'].includes(suitVal(t)),
  '13579': t => ['1', '3', '5', '7', '9'].includes(suitVal(t)),
  '369': t => ['3', '6', '9'].includes(suitVal(t)),
  '2026': t => ['2', '6'].includes(suitVal(t)) || t === 'DW',
  'W-D': t => isWindDragon(t),
};                                  // Consec / Like Nos / Quints / S&P have no sharp theme

function newPosterior() { const p = {}; for (const s of SECTIONS) p[s] = 1 / SECTIONS.length; return p; }

// A seat that passes you tile t is shedding it -> evidence AGAINST sections whose theme
// includes t, mild evidence FOR a themed section when t is off-theme. Non-themed sections
// carry no number signal (honest: the Charleston can't distinguish them).
function updateWithPassedTile(post, tile, opts = {}) {
  const down = opts.down ?? 0.45, up = opts.up ?? 1.12;
  let z = 0;
  for (const s of SECTIONS) {
    const pred = CHAR[s];
    let L = 1;
    if (pred) L = pred(tile) ? down : up;   // themed sections only
    post[s] *= L; z += post[s];
  }
  for (const s of SECTIONS) post[s] /= (z || 1);
  return post;
}

// build seat-0's posteriors over the other three seats from the Charleston observations
function inferFrom(observations, decay = 1.0) {
  const posts = {}; // fromSeat -> posterior
  for (const o of observations) {
    if (!posts[o.fromSeat]) posts[o.fromSeat] = newPosterior();
    for (const t of o.tiles) updateWithPassedTile(posts[o.fromSeat], t);
  }
  return posts;
}

function argmax(post) { let bs = null, bv = -1; for (const s in post) if (post[s] > bv) { bv = post[s]; bs = s; } return { section: bs, p: bv }; }
function logLossAgainst(post, trueSection) { const e = 1e-9; return -Math.log(Math.max(e, post[trueSection] || 0)); }
const uniformLogLoss = () => -Math.log(1 / SECTIONS.length);

module.exports = { SECTIONS, CHAR, newPosterior, updateWithPassedTile, inferFrom, argmax, logLossAgainst, uniformLogLoss };
