/* Generic card interpreter: decrypted card definition -> concrete 14-tile targets.
 * Ships plaintext (no card data). Reused by the app after decrypt -> engine.setTargets. */
(function (root) {
  'use strict';
  var SUITS = ['B', 'C', 'D'], DRAGON_OF = { B: 'DG', C: 'DR', D: 'DW' }, ALLD = ['DG', 'DR', 'DW'];
  var ROLE = { green: 0, red: 1, blue: 2 };
  function injections(roles) { var res = []; (function rec(i, used, m) { if (i === roles.length) { res.push(Object.assign({}, m)); return; } for (var k = 0; k < SUITS.length; k++) { var s = SUITS[k]; if (used[s]) continue; used[s] = 1; m[roles[i]] = s; rec(i + 1, used, m); used[s] = 0; } })(0, {}, {}); return res; }
  function product(arrs) { return arrs.reduce(function (acc, a) { var out = []; acc.forEach(function (p) { a.forEach(function (x) { out.push(p.concat([x])); }); }); return out; }, [[]]); }
  function suitDigits(alt) { var ds = []; alt.forEach(function (g) { if (isSuit(g)) for (var i = 0; i < g.tiles.length; i++) { var ch = g.tiles[i]; if (ch >= '1' && ch <= '9') ds.push(+ch); } }); return ds; }
  function isSuit(g) { return !g.dragonRole && !g.composite && /[1-9]/.test(g.tiles) && g.color !== 'black' || (g.color !== 'black' && !g.dragonRole && !g.composite && g.tiles !== 'NEWS'); }
  // simpler suit test: a group is a suit-number group if it has digits and is not a dragon/composite and not a pure wind/flower
  function isNumGroup(g) { return !g.dragonRole && !g.composite && /[0-9]/.test(g.tiles); }
  function isWind(g) { return /^[NEWS]+$/.test(g.tiles); }
  function isFlower(g) { return /^F+$/.test(g.tiles); }

  function family(p, alt) {
    if (/Like/i.test(p || '')) return { kind: 'like', set: /Odd/i.test(p) ? [1, 3, 5, 7, 9] : /Even/i.test(p) ? [2, 4, 6, 8] : [1, 2, 3, 4, 5, 6, 7, 8, 9] };
    if ((/Consec/i.test(p || '') || /Any Run/i.test(p || '')) && !/These Nos/i.test(p || '')) {
      var ds = suitDigits(alt).filter(function (d) { return d >= 1; }); var mn = Math.min.apply(null, ds), mx = Math.max.apply(null, ds), len = mx - mn + 1, starts = [];
      for (var s = 1; s + len - 1 <= 9; s++) starts.push(s); return { kind: 'consec', mn: mn, starts: starts };
    }
    return { kind: 'fixed' };
  }
  function numInstances(fam) {
    if (fam.kind === 'like') return fam.set.map(function (n) { return { mode: 'like', n: n }; });
    if (fam.kind === 'consec') return fam.starts.map(function (s) { return { mode: 'consec', delta: s - fam.mn }; });
    return [{ mode: 'fixed' }];
  }
  function mapDigit(ch, ni) { var n = +ch; if (ch === '0') return '0'; if (ni.mode === 'like') return '' + ni.n; if (ni.mode === 'consec') return '' + (n + ni.delta); return ch; }

  function expandAlt(def, alt) {
    var out = [], seen = {}; var fam = family(def.p, alt); var nis = numInstances(fam);
    nis.forEach(function (ni) {
      // suit roles: from num groups + matching-dragon + composite
      var roleColors = {};
      alt.forEach(function (g) { if (isNumGroup(g) && !isWind(g) && !isFlower(g)) roleColors[g.color] = 1; if (g.composite) roleColors[g.color] = 1; if (g.dragonRole === 'matching') roleColors[g.color] = 1; });
      var roles = Object.keys(roleColors).filter(function (c) { return c !== 'black'; }).map(function (c) { return ROLE[c]; });
      var ru = roles.filter(function (v, i) { return roles.indexOf(v) === i; });
      injections(ru).forEach(function (sa) {
        // resolve dragon groups -> choice lists
        var dgs = alt.filter(function (g) { return g.dragonRole; });
        var optLists = dgs.map(function (g) {
          if (g.dragonRole === 'matching') return [DRAGON_OF[sa[ROLE[g.color]]]];
          if (g.dragonRole === 'opposite') { var own = DRAGON_OF[sa[ROLE[firstSuitRole(alt)]]]; return ALLD.filter(function (d) { return d !== own; }); }
          if (g.dragonRole === 'matching-or-opposite' || g.dragonRole === 'any') return ALLD.slice();
          if (g.dragonRole === 'match-middle') { var mid = middleNumber(alt, ni); var rgroup = groupOfNumber(alt, ni, mid); return rgroup ? [DRAGON_OF[sa[ROLE[rgroup.color]]]] : ALLD.slice(); }
          if (g.dragonRole === 'three-dragons') { return [g.soap ? 'DW' : DRAGON_OF[sa[ROLE[g.color]] || (g.color === 'green' ? 'B' : g.color === 'red' ? 'C' : 'D')]]; }
          if (g.dragonRole === 'two-dragons') return ALLD.slice();
          return ALLD.slice();
        });
        var combos = dgs.length ? product(optLists) : [[]];
        if (dgs.length && dgs[0].dragonRole === 'two-dragons') combos = combos.filter(function (c) { return new Set(c).size === c.length; });
        combos.forEach(function (combo) {
          var acc = {}; var di = 0; var ok = true;
          alt.forEach(function (g) {
            if (g.dragonRole) { var t = combo[di++]; add(acc, t, g.tiles.length); }
            else if (g.composite) { var n = mapDigit('1', ni); var suit = sa[ROLE[g.color]]; add(acc, n + suit, 1); add(acc, DRAGON_OF[suit], 1); }
            else if (isFlower(g)) add(acc, 'FL', g.tiles.length);
            else if (isWind(g)) { for (var i = 0; i < g.tiles.length; i++) add(acc, 'W' + g.tiles[i], 1); }
            else { for (var j = 0; j < g.tiles.length; j++) { var ch = g.tiles[j]; var d = mapDigit(ch, ni); if (d === '0') add(acc, 'DW', 1); else add(acc, d + sa[ROLE[g.color]], 1); } }
          });
          var groups = Object.keys(acc).map(function (tile) { return { tile: tile, count: acc[tile], jokerable: acc[tile] >= 3 && !def.c }; });
          // S&P concealed pairs/singles never jokerable; for others jokerable if count>=3
          if (def.c) groups.forEach(function (gg) { gg.jokerable = false; });
          var total = groups.reduce(function (s, x) { return s + x.count; }, 0);
          if (total !== 14) { ok = false; }
          if (!ok) return;
          var key = groups.map(function (x) { return x.tile + ':' + x.count; }).sort().join('|');
          if (seen[key]) return; seen[key] = 1;
          out.push({ section: def.s, name: def.id, groups: groups });
        });
      });
    });
    return out;
  }
  function add(acc, t, c) { acc[t] = (acc[t] || 0) + c; }
  function firstSuitRole(alt) { for (var i = 0; i < alt.length; i++) if (isNumGroup(alt[i]) && !isWind(alt[i]) && !isFlower(alt[i]) && alt[i].color !== 'black') return ROLE[alt[i].color]; return 0; }
  function middleNumber(alt, ni) { var ds = []; alt.forEach(function (g) { if (isNumGroup(g) && !isWind(g) && !isFlower(g)) for (var i = 0; i < g.tiles.length; i++) { var ch = g.tiles[i]; if (ch >= '1' && ch <= '9') ds.push(+mapDigit(ch, ni)); } }); ds = ds.filter(function (v, i) { return ds.indexOf(v) === i; }).sort(function (a, b) { return a - b; }); return ds[Math.floor((ds.length - 1) / 2)]; }
  function groupOfNumber(alt, ni, num) { for (var i = 0; i < alt.length; i++) { var g = alt[i]; if (isNumGroup(g) && !isWind(g) && !isFlower(g) && g.color !== 'black') for (var j = 0; j < g.tiles.length; j++) if (+mapDigit(g.tiles[j], ni) === num) return g; } return null; }

  function expandCard(payload) {
    var targets = [];
    payload.hands.forEach(function (h) {
      var def = { s: h.s, id: h.id, p: h.p, c: !!h.c };
      // special pick-from-set hands
      if (h.id === '13579-4' || h.id === '369-5') { specialPick(def, h, targets); return; }
      h.A.forEach(function (alt) { expandAlt(def, alt).forEach(function (t) { targets.push(t); }); });
    });
    return targets;
  }
  // "Pair X, Kongs Match Pair": pick N from set; pair+2 kongs of N (3 suits); singles = set\{N}
  function specialPick(def, h, targets) {
    var set = h.id === '13579-4' ? [1, 3, 5, 7, 9] : [3, 6, 9];
    set.forEach(function (N) {
      injections([0, 1, 2]).forEach(function (sa) {
        var acc = {};
        var _fl=0;(h.A[0]||[]).forEach(function(g){if(g.tiles[0]==="F")_fl+=g.tiles.length;});if(_fl)add(acc,"FL",_fl); add(acc, N + sa[0], 2);                  // pair in suit A
        set.filter(function (x) { return x !== N; }).forEach(function (x) { add(acc, x + sa[0], 1); }); // remaining singles in suit A
        add(acc, N + sa[1], 4); add(acc, N + sa[2], 4); // matching kongs in B,C
        var groups = Object.keys(acc).map(function (t) { return { tile: t, count: acc[t], jokerable: acc[t] >= 3 }; });
        var total = groups.reduce(function (s, x) { return s + x.count; }, 0);
        if (total !== 14) return;
        var key = groups.map(function (x) { return x.tile + ':' + x.count; }).sort().join('|');
        targets.push({ section: def.s, name: def.id, groups: groups, _k: key });
      });
    });
  }
  root.CardInterp = { expandCard: expandCard };
})(typeof window !== 'undefined' ? window : this);
