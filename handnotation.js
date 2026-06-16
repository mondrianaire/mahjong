/* handnotation.js — render a card line as colored grouped notation, in our own
 * design identity using the FUNCTIONAL suit-color convention (groups sharing a
 * color = same suit; different colors = different suits). Driven entirely by our
 * engine's encoded patterns (engine.js `CARD`, with per-group suit roles); this
 * is a re-derivation of the game's mechanics, not a copy of any printed card.
 *
 * API:  HandNotation.tokens(line)      -> [{text,color,kind,role}]  (testable)
 *       HandNotation.html(line, opts)  -> '<span …>' notation HTML
 *       HandNotation.lineHTML(line)    -> section label + notation + suit hint
 * A `line` is an element of engine `CARD` (has .section, .name, .suits, .gen()). */
(function (root) {
  'use strict';
  // role -> abstract suit color (matches our tile palette; 3 distinct hues)
  var ROLE = ['#2f7d44', '#b83227', '#2660a4'];      // green / red / blue
  var SOAP = '#5f5e5a', WIND = '#3a3470', FLOWER = '#c2780a', NEUTRAL = '#5f5e5a';

  function firstGroups(line) {
    var r = line.gen(), first;
    if (r && typeof r.next === 'function') first = r.next().value;   // generator of group-arrays
    else if (Array.isArray(r)) first = r[0];                          // array of group-arrays
    else first = r;
    return Array.isArray(first) ? first : [];
  }
  function roleColor(role) { return ROLE[role] != null ? ROLE[role] : NEUTRAL; }

  function tokens(line) {
    var gs = firstGroups(line), out = [];
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (g.k === 'num') out.push({ text: String(g.n).repeat(g.c), color: roleColor(g.role), kind: 'num', role: g.role });
      else if (g.k === 'soap') out.push({ text: '0'.repeat(g.c), color: SOAP, kind: 'soap' });
      else if (g.k === 'wind') out.push({ text: String(g.w).repeat(g.c), color: WIND, kind: 'wind' });
      else if (g.k === 'flow') out.push({ text: 'F'.repeat(g.c), color: FLOWER, kind: 'flow' });
      else if (g.k === 'drg') out.push({ text: 'D'.repeat(g.c), color: g.mode === 'match' ? roleColor(g.role) : NEUTRAL, kind: 'dragon', role: g.role });
    }
    return out;
  }

  function html(line, opts) {
    opts = opts || {};
    var sz = opts.size || 18, toks = tokens(line), s = '';
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      s += '<span style="color:' + t.color + ';font-weight:700;margin-right:' + (i < toks.length - 1 ? '7px' : '0') +
        ';letter-spacing:.5px">' + t.text + '</span>';
    }
    return '<span class="hand-notation" style="font-size:' + sz + 'px;font-variant-numeric:tabular-nums">' + s + '</span>';
  }

  var SUIT_HINT = { 0: 'any suits', 1: '1 suit', 2: '2 suits', 3: '3 suits' };
  function lineHTML(line, opts) {
    opts = opts || {};
    var hint = SUIT_HINT[line.suits] || '';
    var sec = '<span style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7a7066">' +
      label(line.section) + '</span>';
    var suit = hint ? '<span style="font-size:9.5px;color:#9a9088;border:1px solid #e3d9c8;border-radius:5px;padding:1px 5px;margin-left:6px">' + hint + '</span>' : '';
    return '<div class="hand-line" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0">' +
      '<div>' + html(line, opts) + '</div><div style="white-space:nowrap">' + sec + suit + '</div></div>';
  }

  // our own neutral section labels (descriptive, not a copy of any card's text)
  var LABEL = {
    '2026': 'Year', '2468': 'Evens', '13579': 'Odds', '369': '3·6·9',
    'Like Nos': 'Like Numbers', 'Quints': 'Quints', 'Consec': 'Consecutive',
    'W-D': 'Winds & Dragons', 'S&P': 'Singles & Pairs',
  };
  function label(section) { return LABEL[section] || section; }

  root.HandNotation = { tokens: tokens, html: html, lineHTML: lineHTML, label: label, ROLE: ROLE };
})(typeof window !== 'undefined' ? window : this);
