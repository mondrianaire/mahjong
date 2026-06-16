/* Phase 0 — card metadata (points / concealed / suitFlex).
 *
 * IMPORTANT: point values + concealed flags below are ILLUSTRATIVE and UNVERIFIED.
 * They are section-level defaults, not the real 2026 NMJL face values. The WINS
 * objective never reads them; only POINTS mode does. `verified:false` marks this.
 * Replace `SECTION_POINTS` / `CONCEALED_LINES` against a physical card before
 * trusting any POINTS-mode output. (Correction C8.)
 */
const E = require('./engine.js');

const SECTION_POINTS = { // illustrative
  '2026': 30, '2468': 25, 'Like Nos': 30, 'Quints': 45, 'Consec': 25,
  '13579': 30, 'W-D': 30, '369': 30, 'S&P': 55,
};
// lines commonly played concealed (illustrative subset). Singles & Pairs cannot
// use jokers and are effectively built in hand; mark them concealed for modeling.
const CONCEALED_SECTIONS = new Set(['S&P']);

function pointsFor(section) { return SECTION_POINTS[section] ?? 25; }
function concealedFor(line) { return CONCEALED_SECTIONS.has(line.section); }
function suitFlexFor(line) {
  return ({ 0: 'FIXED', 1: 'ANY_1_SUIT', 2: 'ANY_2_SUIT', 3: 'ANY_3_SUIT' })[line.suits] ?? 'ANY_1_SUIT';
}

// attach meta to every concrete target, keyed by its line
function buildMeta() {
  const lineMeta = new Map();
  for (const line of E.CARD) {
    const key = line.section + ' | ' + line.name;
    lineMeta.set(key, {
      points: pointsFor(line.section),
      concealed: concealedFor(line),
      suitFlex: suitFlexFor(line),
      category: line.section,
      verified: false,
    });
  }
  return lineMeta;
}

module.exports = { SECTION_POINTS, pointsFor, concealedFor, suitFlexFor, buildMeta,
  metaForTarget: (t, lineMeta) => lineMeta.get(t.section + ' | ' + t.name) };
