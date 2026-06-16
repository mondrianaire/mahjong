/* =====================================================================
 * American Mahjongg — Charleston Hand-Strength Engine
 * 2026 NMJL card. Target metric: P(reach mahjong) under a solo model.
 *
 * Tile codes (physical tiles, 152 total):
 *   Numbers : "1B".."9B", "1C".."9C", "1D".."9D"   (4 each = 108)
 *   Dragons : "DG"(green->Bam) "DR"(red->Crak) "DW"(white/soap->Dot) (4 each = 12)
 *   Winds   : "WN" "WE" "WW" "WS"                   (4 each = 16)
 *   Flower  : "FL"                                  (8)
 *   Joker   : "JK"                                  (8)
 *
 * A "target" is one concrete 14-tile winning hand: an array of groups
 *   { tile, count, jokerable }  where jokerable = (count >= 3).
 * A card LINE expands into many targets (number params x suit assignment
 *   x dragon choice). The whole card expands to a flat TARGETS list.
 * ===================================================================== */

(function (root) {
  'use strict';

  const SUITS = ['B', 'C', 'D'];
  const DRAGON_OF = { B: 'DG', C: 'DR', D: 'DW' };        // suit -> matching dragon
  const ALL_DRAGONS = ['DG', 'DR', 'DW'];

  // ---- full physical tile pool (152) -------------------------------------
  function fullPool() {
    const m = new Map();
    for (const s of SUITS) for (let n = 1; n <= 9; n++) m.set(n + s, 4);
    for (const d of ALL_DRAGONS) m.set(d, 4);
    for (const w of ['WN', 'WE', 'WW', 'WS']) m.set(w, 4);
    m.set('FL', 8);
    m.set('JK', 8);
    return m;
  }

  // ---- small combinatorial helpers ---------------------------------------
  function injections(roles, pool) {
    // all injective maps roles[] -> pool[] (distinct). returns array of {role:suit}
    if (roles.length === 0) return [{}];
    const res = [];
    const rec = (i, used, acc) => {
      if (i === roles.length) { res.push(Object.assign({}, acc)); return; }
      for (const s of pool) {
        if (used.has(s)) continue;
        used.add(s); acc[roles[i]] = s;
        rec(i + 1, used, acc);
        used.delete(s); delete acc[roles[i]];
      }
    };
    rec(0, new Set(), {});
    return res;
  }
  function product(arrs) {
    return arrs.reduce((acc, a) => {
      const out = [];
      for (const prev of acc) for (const x of a) out.push(prev.concat([x]));
      return out;
    }, [[]]);
  }

  // ---- group shorthands (pre-suit-assignment) ----------------------------
  const num  = (n, role, c) => ({ k: 'num',  n, role, c });
  const soap = (c)          => ({ k: 'soap', c });            // white dragon as 0
  const wnd  = (w, c)       => ({ k: 'wind', w, c });
  const flw  = (c)          => ({ k: 'flow', c });
  const Dm   = (role, c)    => ({ k: 'drg', mode: 'match', role, c }); // dragon matches role's suit
  const Dopp = (role, c)    => ({ k: 'drg', mode: 'opp',   role, c }); // dragon of a suit != role
  const Dany = (c)          => ({ k: 'drg', mode: 'any',   c });

  // ---- expand one card line into concrete targets ------------------------
  function expandLine(line) {
    const out = [];
    const seen = new Set();
    for (const groups of line.gen()) {
      const roleSet = new Set();
      for (const g of groups) if (g.role != null) roleSet.add(g.role);
      const roles = [...roleSet];

      for (const sa of injections(roles, SUITS)) {
        // resolve dragon choices
        const dragonGroups = groups.filter(g => g.k === 'drg');
        const optsPer = dragonGroups.map(g => {
          if (g.mode === 'match') return [DRAGON_OF[sa[g.role]]];
          if (g.mode === 'opp')   return ALL_DRAGONS.filter(d => d !== DRAGON_OF[sa[g.role]]);
          return ALL_DRAGONS.slice(); // any
        });
        let combos = product(optsPer);
        if (line.dragonDistinct) {
          combos = combos.filter(c => new Set(c).size === c.length);
        }
        if (dragonGroups.length === 0) combos = [[]];

        for (const combo of combos) {
          const concrete = [];
          let di = 0;
          for (const g of groups) {
            let tile;
            if (g.k === 'num') tile = g.n + sa[g.role];
            else if (g.k === 'soap') tile = 'DW';
            else if (g.k === 'wind') tile = 'W' + g.w;
            else if (g.k === 'flow') tile = 'FL';
            else if (g.k === 'drg') tile = combo[di++];
            concrete.push({ tile, count: g.c, jokerable: g.c >= 3 });
          }
          const total = concrete.reduce((s, x) => s + x.count, 0);
          if (total !== 14) throw new Error(`Line ${line.section}/${line.name} sums to ${total}, not 14`);
          const key = concrete.map(x => x.tile + ':' + x.count + (x.jokerable ? 'J' : 'p')).sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ section: line.section, name: line.name, groups: concrete });
        }
      }
    }
    return out;
  }

  // ---- joker-aware coverage ---------------------------------------------
  // returns max number of the target's 14 slots fillable from (poolMap real
  // tiles + `jokers` joker tiles). Non-jokerable groups (pairs/singles) need
  // real tiles; groups of 3+ may use jokers for the remainder.
  function coverage(target, poolMap, jokers) {
    let jk = jokers, filled = 0;
    const local = new Map();
    // sort: non-jokerable first so pairs/singles win real tiles
    const gs = target.groups.slice().sort((a, b) => (a.jokerable ? 1 : 0) - (b.jokerable ? 1 : 0));
    for (const g of gs) {
      let need = g.count;
      const used = local.get(g.tile) || 0;
      const have = (poolMap.get(g.tile) || 0) - used;
      const useReal = Math.min(have, need);
      local.set(g.tile, used + useReal);
      need -= useReal; filled += useReal;
      if (g.jokerable && need > 0) {
        const useJ = Math.min(jk, need);
        jk -= useJ; need -= useJ; filled += useJ;
      }
    }
    return filled;
  }

  // split a 13/14-tile hand (array of tile codes) into {pool:Map(real), jokers:int}
  function handPool(tiles) {
    const m = new Map(); let j = 0;
    for (const t of tiles) {
      if (t === 'JK') { j++; continue; }
      m.set(t, (m.get(t) || 0) + 1);
    }
    return { pool: m, jokers: j };
  }

  function tilesNeeded(target, hp) {
    return 14 - coverage(target, hp.pool, hp.jokers);
  }

  // ======================================================================
  //  THE 2026 CARD
  //  Suit roles: integers 0/1/2. "suits" = number of distinct suits used.
  //  Where the printed card's colour partition is ambiguous from text, a
  //  reasonable partition is chosen and noted with  // ~role-inferred.
  // ======================================================================
  const CARD = [];
  const add = (o) => CARD.push(o);
  const ONCE = function* (groups) { yield groups; };

  // helpers for number schemes
  function* likeNumbers(set, fn) { for (const n of set) yield fn(n); }
  function* consec(len, starts, fn) { for (const s of starts) yield fn(s); }
  const ODD = [1, 3, 5, 7, 9], EVEN = [2, 4, 6, 8], ALL9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  /* ---- Section: 2026 ---- */
  add({ section: '2026', name: 'L1  222 000 2222 6666', suits: 2,
    gen: () => ONCE([num(2,0,3), soap(3), num(2,1,4), num(6,1,4)]) }); // ~role-inferred
  add({ section: '2026', name: 'L2  2026 DDD 2222 DDD (K2/6)', suits: 2,
    gen: function* () {
      for (const k of [2, 6]) {
        // 2,0,2,6 singles (suited 2/6, soap 0); two matching-dragon pungs; kong of k
        yield [num(2,0,1), soap(1), num(2,0,1), num(6,1,1), Dm(0,3), num(k, k===2?0:1, 4), Dm(1,3)]; // ~role-inferred
      }
    }});
  add({ section: '2026', name: 'L3  FFF 2026 222 6666', suits: 3,
    gen: () => ONCE([flw(3), num(2,0,1), soap(1), num(2,0,1), num(6,1,1), num(2,1,3), num(6,2,4)]) }); // ~role-inferred
  add({ section: '2026', name: 'L4  22 00 222 666 NEWS', suits: 2,
    gen: () => ONCE([num(2,0,2), soap(2), num(2,1,3), num(6,1,3), wnd('N',1), wnd('E',1), wnd('W',1), wnd('S',1)]) }); // ~role-inferred

  /* ---- Section: 2468 ---- */
  add({ section: '2468', name: 'L1A 222 444 6666 8888', suits: 1,
    gen: () => ONCE([num(2,0,3), num(4,0,3), num(6,0,4), num(8,0,4)]) });
  add({ section: '2468', name: 'L1B 222 444 6666 8888', suits: 2,
    gen: () => ONCE([num(2,0,3), num(4,0,3), num(6,1,4), num(8,1,4)]) }); // ~role-inferred
  add({ section: '2468', name: 'L2  FF 2222 44 66 8888', suits: 2,
    gen: () => ONCE([flw(2), num(2,0,4), num(4,0,2), num(6,0,2), num(8,1,4)]) }); // ~role-inferred
  add({ section: '2468', name: 'L3  EE 22 444 666 88 WW', suits: 1,
    gen: () => ONCE([wnd('E',2), num(2,0,2), num(4,0,3), num(6,0,3), num(8,0,2), wnd('W',2)]) });
  add({ section: '2468', name: 'L4  2222 DDD 8888 DDD', suits: 2,
    gen: () => ONCE([num(2,0,4), Dm(0,3), num(8,1,4), Dm(1,3)]) });
  add({ section: '2468', name: 'L5  FFF 22 44 666 8888', suits: 1,
    gen: () => ONCE([flw(3), num(2,0,2), num(4,0,2), num(6,0,3), num(8,0,4)]) });
  add({ section: '2468', name: 'L6  2468 KKKK D KKKK D', suits: 3, // Like Kongs 2/4/6/8 w matching D
    gen: function* () {
      for (const k of EVEN)
        yield [num(2,0,1), num(4,0,1), num(6,0,1), num(8,0,1), num(k,1,4), Dm(1,1), num(k,2,4), Dm(2,1)];
    }});
  add({ section: '2468', name: 'L7  FFF 2468 FFF KKKK', suits: 2, // Kong 2/4/6/8
    gen: function* () {
      for (const k of EVEN)
        yield [flw(3), num(2,0,1), num(4,0,1), num(6,0,1), num(8,0,1), flw(3), num(k,1,4)]; // ~role-inferred
    }});
  add({ section: '2468', name: 'L8  FF 246 888 246 888', suits: 2,
    gen: () => ONCE([flw(2), num(2,0,1), num(4,0,1), num(6,0,1), num(8,0,3), num(2,1,1), num(4,1,1), num(6,1,1), num(8,1,3)]) });

  /* ---- Section: Any Like Numbers ---- */
  add({ section: 'Like Nos', name: 'L1  1111 FFFFFF 1111', suits: 2,
    gen: () => [...likeNumbers(ALL9, n => [num(n,0,4), flw(6), num(n,1,4)])] });
  add({ section: 'Like Nos', name: 'L2  NNNN D NNN D NNNN D', suits: 3, // 1111 D 111 D 1111 D matching
    gen: () => [...likeNumbers(ALL9, n => [num(n,0,4), Dm(0,1), num(n,1,3), Dm(1,1), num(n,2,4), Dm(2,1)])] });
  add({ section: 'Like Nos', name: 'L3  FF 1111 11 1111 DD', suits: 3, // any dragon pair
    gen: function* () {
      for (const n of ALL9) for (const d of ALL_DRAGONS)
        yield [flw(2), num(n,0,4), num(n,1,2), num(n,2,4), { k:'drg', mode:'fixed', fixed:d, c:2 }];
    }});

  /* ---- Section: Quints ---- */
  add({ section: 'Quints', name: 'L1  KKKKK KKKK KKKKK', suits: 3, // any like no.
    gen: () => [...likeNumbers(ALL9, n => [num(n,0,5), num(n,1,4), num(n,2,5)])] });
  add({ section: 'Quints', name: 'L2  FF KKKKK MM NNNNN', suits: 1, // any 3 consec
    gen: () => [...consec(3, [1,2,3,4,5,6,7], s => [flw(2), num(s,0,5), num(s+1,0,2), num(s+2,0,5)])] });
  add({ section: 'Quints', name: 'L3  KKKKK MMMMM DDDD', suits: 1, // any 2 nos w opp dragon
    gen: function* () {
      for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++)
        yield [num(a,0,5), num(b,0,5), Dopp(0,4)];
    }});

  /* ---- Section: Consecutive Run ---- */
  add({ section: 'Consec', name: 'L1A 11 222 33 444 5555', suits: 1, // these nos only
    gen: () => ONCE([num(1,0,2), num(2,0,3), num(3,0,2), num(4,0,3), num(5,0,4)]) });
  add({ section: 'Consec', name: 'L1B 55 666 77 888 9999', suits: 1,
    gen: () => ONCE([num(5,0,2), num(6,0,3), num(7,0,2), num(8,0,3), num(9,0,4)]) });
  add({ section: 'Consec', name: 'L2A FFF KKKK MNP QQQQ', suits: 1, // any 5 consec
    gen: () => [...consec(5,[1,2,3,4,5], s => [flw(3), num(s,0,4), num(s+1,0,1), num(s+2,0,1), num(s+3,0,1), num(s+4,0,4)])] });
  add({ section: 'Consec', name: 'L2B FFF KKKK MNP QQQQ', suits: 2,
    gen: () => [...consec(5,[1,2,3,4,5], s => [flw(3), num(s,0,4), num(s+1,0,1), num(s+2,0,1), num(s+3,1,1), num(s+4,1,4)])] }); // ~role-inferred
  add({ section: 'Consec', name: 'L3  KK MM KKK MMM NNNN', suits: 3, // any 3 consec
    gen: () => [...consec(3,[1,2,3,4,5,6,7], s => [num(s,0,2), num(s+1,1,2), num(s,0,3), num(s+1,1,3), num(s+2,2,4)])] });
  add({ section: 'Consec', name: 'L4A KKK MMM NNNN PPPP', suits: 1, // any 4 consec
    gen: () => [...consec(4,[1,2,3,4,5,6], s => [num(s,0,3), num(s+1,0,3), num(s+2,0,4), num(s+3,0,4)])] });
  add({ section: 'Consec', name: 'L4B KKK MMM NNNN PPPP', suits: 2,
    gen: () => [...consec(4,[1,2,3,4,5,6], s => [num(s,0,3), num(s+1,0,3), num(s+2,1,4), num(s+3,1,4)])] }); // ~role-inferred
  add({ section: 'Consec', name: 'L5A FFF KK MM NNN DDDD', suits: 1, // Ds match middle
    gen: () => [...consec(3,[1,2,3,4,5,6,7], s => [flw(3), num(s,0,2), num(s+1,0,2), num(s+2,0,3), Dm(0,4)])] });
  add({ section: 'Consec', name: 'L5B FFF KK MM NNN DDDD', suits: 2,
    gen: () => [...consec(3,[1,2,3,4,5,6,7], s => [flw(3), num(s,0,2), num(s+1,0,2), num(s+2,1,3), Dm(1,4)])] }); // ~role-inferred
  add({ section: 'Consec', name: 'L6  KKKK FFFFFF MMMM', suits: 1, // any 2 consec
    gen: () => [...consec(2,[1,2,3,4,5,6,7,8], s => [num(s,0,4), flw(6), num(s+1,0,4)])] });
  add({ section: 'Consec', name: 'L7A FF KKKK MMMM NNNN', suits: 1, // any 3 consec
    gen: () => [...consec(3,[1,2,3,4,5,6,7], s => [flw(2), num(s,0,4), num(s+1,0,4), num(s+2,0,4)])] });
  add({ section: 'Consec', name: 'L7B FF KKKK MMMM NNNN', suits: 3,
    gen: () => [...consec(3,[1,2,3,4,5,6,7], s => [flw(2), num(s,0,4), num(s+1,1,4), num(s+2,2,4)])] });
  add({ section: 'Consec', name: 'L8  K MM NNN K MM NNN PP', suits: 3, // any 4 consec
    gen: () => [...consec(4,[1,2,3,4,5,6], s => [num(s,0,1), num(s+1,0,2), num(s+2,0,3), num(s,1,1), num(s+1,1,2), num(s+2,1,3), num(s+3,2,2)])] }); // ~role-inferred

  /* ---- Section: 13579 ---- */
  add({ section: '13579', name: 'L1A 11 333 55 777 9999', suits: 1,
    gen: () => ONCE([num(1,0,2), num(3,0,3), num(5,0,2), num(7,0,3), num(9,0,4)]) });
  add({ section: '13579', name: 'L1B 11 333 55 777 9999', suits: 3,
    gen: () => ONCE([num(1,0,2), num(3,0,3), num(5,1,2), num(7,1,3), num(9,2,4)]) }); // ~role-inferred
  add({ section: '13579', name: 'L2A 111 333 3333 5555', suits: 2,
    gen: () => ONCE([num(1,0,3), num(3,0,3), num(3,1,4), num(5,1,4)]) }); // ~role-inferred
  add({ section: '13579', name: 'L2B 555 777 7777 9999', suits: 2,
    gen: () => ONCE([num(5,0,3), num(7,0,3), num(7,1,4), num(9,1,4)]) }); // ~role-inferred
  add({ section: '13579', name: 'L3A NN 1111 33 5555 SS', suits: 1,
    gen: () => ONCE([wnd('N',2), num(1,0,4), num(3,0,2), num(5,0,4), wnd('S',2)]) });
  add({ section: '13579', name: 'L3B NN 5555 77 9999 SS', suits: 1,
    gen: () => ONCE([wnd('N',2), num(5,0,4), num(7,0,2), num(9,0,4), wnd('S',2)]) });
  add({ section: '13579', name: 'L4  113579 KKKK KKKK', suits: 3, // pair any odd, kongs match pair
    gen: function* () {
      for (const p of ODD) {
        const singles = ODD.filter(x => x !== p);
        // pair p (jokerless) + 4 odd singles + two kongs of p
        const g = [num(p,0,2)];
        for (const s of singles) g.push(num(s,0,1));
        g.push(num(p,1,4), num(p,2,4));
        yield g;
      }
    }});
  add({ section: '13579', name: 'L5A FFF 11 33 555 DDDD', suits: 1,
    gen: () => ONCE([flw(3), num(1,0,2), num(3,0,2), num(5,0,3), Dm(0,4)]) });
  add({ section: '13579', name: 'L5B FFF 55 77 999 DDDD', suits: 1,
    gen: () => ONCE([flw(3), num(5,0,2), num(7,0,2), num(9,0,3), Dm(0,4)]) });
  add({ section: '13579', name: 'L6A 11 33 111 333 5555', suits: 3,
    gen: () => ONCE([num(1,0,2), num(3,1,2), num(1,0,3), num(3,1,3), num(5,2,4)]) }); // ~role-inferred
  add({ section: '13579', name: 'L6B 55 77 555 777 9999', suits: 3,
    gen: () => ONCE([num(5,0,2), num(7,1,2), num(5,0,3), num(7,1,3), num(9,2,4)]) }); // ~role-inferred
  add({ section: '13579', name: 'L7A 1111 33 55 77 9999', suits: 1,
    gen: () => ONCE([num(1,0,4), num(3,0,2), num(5,0,2), num(7,0,2), num(9,0,4)]) });
  add({ section: '13579', name: 'L7B 1111 33 55 77 9999', suits: 2,
    gen: () => ONCE([num(1,0,4), num(3,0,2), num(5,0,2), num(7,1,2), num(9,1,4)]) }); // ~role-inferred
  add({ section: '13579', name: 'L8A FF 11 33 55 111 111', suits: 3,
    gen: () => ONCE([flw(2), num(1,0,2), num(3,1,2), num(5,2,2), num(1,0,3), num(1,1,3)]) }); // ~role-inferred
  add({ section: '13579', name: 'L8B FF 55 77 99 555 555', suits: 3,
    gen: () => ONCE([flw(2), num(5,0,2), num(7,1,2), num(9,2,2), num(5,0,3), num(5,1,3)]) }); // ~role-inferred
  add({ section: '13579', name: 'L9  FF 135 777 999 DDD', suits: 1, // opp dragon
    gen: () => ONCE([flw(2), num(1,0,1), num(3,0,1), num(5,0,1), num(7,0,3), num(9,0,3), Dopp(0,3)]) });

  /* ---- Section: Winds-Dragons ---- */
  add({ section: 'W-D', name: 'L1A NNNN EEE WWW SSSS', suits: 0,
    gen: () => ONCE([wnd('N',4), wnd('E',3), wnd('W',3), wnd('S',4)]) });
  add({ section: 'W-D', name: 'L1B NNN EEEE WWWW SSS', suits: 0,
    gen: () => ONCE([wnd('N',3), wnd('E',4), wnd('W',4), wnd('S',3)]) });
  add({ section: 'W-D', name: 'L2  1234 DDD DDD DDDD', suits: 1, dragonDistinct: true, // any 4 consec, any 3 dragons
    gen: () => [...consec(4,[1,2,3,4,5,6], s => [num(s,0,1), num(s+1,0,1), num(s+2,0,1), num(s+3,0,1), Dany(3), Dany(3), Dany(4)])] });
  add({ section: 'W-D', name: 'L3  NNN KKKK KKKK SSS', suits: 2, // any like odd
    gen: () => [...likeNumbers(ODD, n => [wnd('N',3), num(n,0,4), num(n,1,4), wnd('S',3)])] });
  add({ section: 'W-D', name: 'L4  EEE KKKK KKKK WWW', suits: 2, // any like even
    gen: () => [...likeNumbers(EVEN, n => [wnd('E',3), num(n,0,4), num(n,1,4), wnd('W',3)])] });
  add({ section: 'W-D', name: 'L5  FFF WWWW FFF DDDD', suits: 0, // any wind, any dragon
    gen: function* () {
      for (const w of ['N','E','W','S']) for (const d of ALL_DRAGONS)
        yield [flw(3), wnd(w,4), flw(3), { k:'drg', mode:'fixed', fixed:d, c:4 }];
    }});
  add({ section: 'W-D', name: 'L6  1 N 2 EE 3 WWW 4 SSSS', suits: 1, // these nos only
    gen: () => ONCE([num(1,0,1), wnd('N',1), num(2,0,1), wnd('E',2), num(3,0,1), wnd('W',3), num(4,0,1), wnd('S',4)]) });
  add({ section: 'W-D', name: 'L7A FF NNNN SSSS DD DD', suits: 0, dragonDistinct: true,
    gen: () => ONCE([flw(2), wnd('N',4), wnd('S',4), Dany(2), Dany(2)]) });
  add({ section: 'W-D', name: 'L7B FF EEEE WWWW DD DD', suits: 0, dragonDistinct: true,
    gen: () => ONCE([flw(2), wnd('E',4), wnd('W',4), Dany(2), Dany(2)]) });
  add({ section: 'W-D', name: 'L8  NN EEE 2026 WWW SS', suits: 1,
    gen: () => ONCE([wnd('N',2), wnd('E',3), num(2,0,1), soap(1), num(2,0,1), num(6,0,1), wnd('W',3), wnd('S',2)]) });

  /* ---- Section: 369 ---- */
  add({ section: '369', name: 'L1A 333 666 6666 9999', suits: 2,
    gen: () => ONCE([num(3,0,3), num(6,0,3), num(6,1,4), num(9,1,4)]) }); // ~role-inferred
  add({ section: '369', name: 'L1B 333 666 6666 9999', suits: 3,
    gen: () => ONCE([num(3,0,3), num(6,1,3), num(6,1,4), num(9,2,4)]) }); // ~role-inferred
  add({ section: '369', name: 'L2  33 66 333 666 9999', suits: 3,
    gen: () => ONCE([num(3,0,2), num(6,1,2), num(3,0,3), num(6,1,3), num(9,2,4)]) }); // ~role-inferred
  add({ section: '369', name: 'L3A FFF 33 666 99 DDDD', suits: 1, // matching dragon
    gen: () => ONCE([flw(3), num(3,0,2), num(6,0,3), num(9,0,2), Dm(0,4)]) });
  add({ section: '369', name: 'L3B FFF 33 666 99 DDDD', suits: 1, // opp dragon
    gen: () => ONCE([flw(3), num(3,0,2), num(6,0,3), num(9,0,2), Dopp(0,4)]) });
  add({ section: '369', name: 'L4  33 66 666 999 NEWS', suits: 2,
    gen: () => ONCE([num(3,0,2), num(6,0,2), num(6,1,3), num(9,1,3), wnd('N',1), wnd('E',1), wnd('W',1), wnd('S',1)]) }); // ~role-inferred
  add({ section: '369', name: 'L5  FF 3369 KKKK KKKK', suits: 3, // pair 3/6/9, kongs match
    gen: function* () {
      for (const p of [3,6,9]) {
        const singles = [3,6,9].filter(x => x !== p);
        const g = [flw(2), num(p,0,2)];
        for (const s of singles) g.push(num(s,0,1));
        g.push(num(p,1,4), num(p,2,4));
        yield g;
      }
    }});
  add({ section: '369', name: 'L6  FF 333 666 999 369', suits: 2,
    gen: () => ONCE([flw(2), num(3,0,3), num(6,0,3), num(9,0,3), num(3,1,1), num(6,1,1), num(9,1,1)]) }); // ~role-inferred

  /* ---- Section: Singles and Pairs (no jokers anywhere) ---- */
  add({ section: 'S&P', name: 'L1  NN EE WW SS 1D 1D 1D', suits: 3, // like no w matching D
    gen: () => [...likeNumbers(ALL9, n => [wnd('N',2), wnd('E',2), wnd('W',2), wnd('S',2),
        num(n,0,1), Dm(0,1), num(n,1,1), Dm(1,1), num(n,2,1), Dm(2,1)])] });
  add({ section: 'S&P', name: 'L2  2 4 66 88 2 4 66 88 88', suits: 3,
    gen: () => ONCE([num(2,0,1), num(4,0,1), num(6,0,2), num(8,0,2), num(2,1,1), num(4,1,1), num(6,1,2), num(8,1,2), num(8,2,2)]) }); // ~role-inferred
  add({ section: 'S&P', name: 'L3  FF 3369 3669 3699', suits: 3, // each group: pair + 2 singles
    gen: () => ONCE([flw(2),
      num(3,0,2), num(6,0,1), num(9,0,1),   // 3369 -> pair 3
      num(6,1,2), num(3,1,1), num(9,1,1),   // 3669 -> pair 6
      num(9,2,2), num(3,2,1), num(6,2,1)]) }); // 3699 -> pair 9
  add({ section: 'S&P', name: 'L4  11 22 33 44 55 66 77', suits: 1, // any 7 consec
    gen: () => [...consec(7,[1,2,3], s => [num(s,0,2), num(s+1,0,2), num(s+2,0,2), num(s+3,0,2), num(s+4,0,2), num(s+5,0,2), num(s+6,0,2)])] });
  add({ section: 'S&P', name: 'L5  11 357 99 11 357 99', suits: 2,
    gen: () => ONCE([num(1,0,2), num(3,0,1), num(5,0,1), num(7,0,1), num(9,0,2), num(1,1,2), num(3,1,1), num(5,1,1), num(7,1,1), num(9,1,2)]) });
  add({ section: 'S&P', name: 'L6  FF 2026 2026 2026', suits: 3,
    gen: () => ONCE([flw(2),
      num(2,0,1), soap(1), num(2,0,1), num(6,0,1),
      num(2,1,1), soap(1), num(2,1,1), num(6,1,1),
      num(2,2,1), soap(1), num(2,2,1), num(6,2,1)]) });

  // ---- build flat target list ------------------------------------------
  let TARGETS = null, TVER = 0;
  function buildTargets() {
    if (TARGETS) return TARGETS;
    TARGETS = [];
    for (const line of CARD) for (const t of expandLine(line)) TARGETS.push(t);
    return TARGETS;
  }
  // Inject an external, pre-expanded target set (e.g. the decrypted real card),
  // each target { section, name, groups:[{tile,count,jokerable}] } summing to 14.
  // No card data lives here — this only swaps in whatever the caller provides.
  function setTargets(arr) {
    for (const t of arr) { const s = t.groups.reduce((a, g) => a + g.count, 0); if (s !== 14) throw new Error('external target ' + t.name + ' sums to ' + s); }
    TARGETS = arr; TVER++;
  }
  function resetTargets() { TARGETS = null; TVER++; }   // back to the built-in card
  function targetsVersion() { return TVER; }

  // ======================================================================
  //  METRICS + RATING
  // ======================================================================

  // per-line minimum distance + overall nearest targets
  function analyzeStatic(tiles) {
    const hp = handPool(tiles);
    const targets = buildTargets();
    const lineMin = new Map();   // "section/name" -> min tilesNeeded
    let best = 99, bestTargets = [];
    for (const t of targets) {
      const d = tilesNeeded(t, hp);
      const key = t.section + ' | ' + t.name;
      if (d < (lineMin.get(key) ?? 99)) lineMin.set(key, d);
      if (d < best) { best = d; bestTargets = [t]; }
      else if (d === best) bestTargets.push(t);
    }
    return { hp, best, lineMin, bestTargets };
  }

  function suitEntropy(tiles) {
    const c = { B: 0, C: 0, D: 0 }; let tot = 0;
    for (const t of tiles) { const s = t[1]; if (t.length === 2 && SUITS.includes(s) && t[0] >= '1' && t[0] <= '9') { c[t[1]]++; tot++; } }
    if (tot === 0) return 0;
    let h = 0;
    for (const s of SUITS) { const p = c[s] / tot; if (p > 0) h -= p * Math.log2(p); }
    return h; // 0..log2(3)=1.585
  }

  function structureCounts(tiles) {
    const m = new Map();
    for (const t of tiles) if (t !== 'JK') m.set(t, (m.get(t) || 0) + 1);
    let pairs = 0, pungs = 0;
    for (const v of m.values()) { if (v >= 2) pairs++; if (v >= 3) pungs++; }
    return { pairs, pungs };
  }

  function parity(tiles) {
    let even = 0, odd = 0;
    for (const t of tiles) {
      if (t.length === 2 && SUITS.includes(t[1]) && t[0] >= '1' && t[0] <= '9') {
        (((+t[0]) % 2) === 0 ? even++ : odd++);
      }
    }
    return { even, odd };
  }

  // reachMass = sum over card lines of exp(-LAMBDA * lineDistance). Validated
  // surrogate for MC P(reach mahjong): r=0.89, R^2=0.80 on realistic hands.
  const LAMBDA = 0.8;
  // calibration P ~ A + B*reachMass (OLS on the verification set)
  const CALIB = { A: -0.0324, B: 0.9449 };
  function reachMassFromLineMin(lineMin) {
    let m = 0; for (const d of lineMin.values()) m += Math.exp(-LAMBDA * d); return m;
  }
  function fastP(reachMass) { return Math.max(0, CALIB.A + CALIB.B * reachMass); }

  // reachMass of an arbitrary hand over a fixed candidate target subset
  function reachMassOver(tiles, cand) {
    const hp = handPool(tiles); const lm = new Map();
    for (const t of cand) {
      const d = tilesNeeded(t, hp); const key = t.section + '|' + t.name;
      if (d < (lm.get(key) ?? 99)) lm.set(key, d);
    }
    return reachMassFromLineMin(lm);
  }

  // metric bundle (cheap, for display + Charleston ranking)
  function metrics(tiles) {
    const st = analyzeStatic(tiles);
    const jokers = tiles.filter(t => t === 'JK').length;
    const within = (k) => [...st.lineMin.values()].filter(d => d <= st.best + k).length;
    const reachMass = reachMassFromLineMin(st.lineMin);
    const ent = suitEntropy(tiles);
    const sc = structureCounts(tiles);
    const par = parity(tiles);
    // dead tiles: not required by any near target (best+2)
    const nearReq = new Set();
    for (const t of buildTargets()) {
      if (tilesNeeded(t, st.hp) <= st.best + 2)
        for (const g of t.groups) nearReq.add(g.tile);
    }
    const dead = [];
    for (const t of tiles) if (t !== 'JK' && !nearReq.has(t)) dead.push(t);
    return {
      distance: st.best,
      flexBest: within(0), flex1: within(1), flex2: within(2),
      reachMass: +reachMass.toFixed(4), fastP: +fastP(reachMass).toFixed(4),
      jokers, suitEntropy: +ent.toFixed(3),
      pairs: sc.pairs, pungs: sc.pungs,
      even: par.even, odd: par.odd,
      deadTiles: dead, lineMin: st.lineMin, bestTargets: st.bestTargets,
    };
  }

  // ---- solo Monte Carlo: P(reach mahjong) -------------------------------
  // Model: you hold `tiles` (13). Over K draws from the unseen wall you may
  // keep any tiles that help. P = fraction of trials where SOME candidate
  // target becomes fully coverable from (hand + draws). Candidate targets =
  // those within `cutoff` of the static best (keeps it fast & realistic).
  function monteCarlo(tiles, opts) {
    opts = opts || {};
    const K = opts.draws ?? 16;
    const sims = opts.sims ?? 2500;
    const cutoff = opts.cutoff ?? 6;
    const maxCand = opts.maxCand ?? 300;

    const hp0 = handPool(tiles);
    const targets = buildTargets();
    // shortlist: targets within `cutoff` of best, capped to the `maxCand`
    // nearest (far targets contribute ~0 to P and only slow the sim).
    let cand = [];
    let best = 99;
    for (const t of targets) { const d = tilesNeeded(t, hp0); if (d < best) best = d; t._d = d; }
    for (const t of targets) if (t._d <= best + cutoff) cand.push(t);
    cand.sort((a, b) => a._d - b._d);
    if (cand.length > maxCand) cand = cand.slice(0, maxCand);

    // remaining wall = full pool minus hand
    const wall = [];
    const rem = fullPool();
    for (const t of tiles) rem.set(t, (rem.get(t) || 0) - 1);
    for (const [tile, n] of rem) for (let i = 0; i < n; i++) wall.push(tile);

    let wins = 0;
    for (let s = 0; s < sims; s++) {
      // sample K tiles without replacement (partial Fisher-Yates)
      const w = wall;
      for (let i = 0; i < K; i++) {
        const j = i + Math.floor(Math.random() * (w.length - i));
        const tmp = w[i]; w[i] = w[j]; w[j] = tmp;
      }
      // pool = hand + first K drawn
      const pool = new Map(hp0.pool); let jk = hp0.jokers;
      for (let i = 0; i < K; i++) {
        const t = w[i];
        if (t === 'JK') jk++; else pool.set(t, (pool.get(t) || 0) + 1);
      }
      let won = false;
      for (const t of cand) { if (coverage(t, pool, jk) === 14) { won = true; break; } }
      if (won) wins++;
    }
    return { p: wins / sims, draws: K, sims, candidates: cand.length, best };
  }

  // ---- Charleston v1: which 3 to pass -----------------------------------
  // Rank distinct tiles by marginal usefulness (rise in best-distance if one
  // copy removed); recommend passing the 3 least useful. Never pass a joker.
  function charlestonSuggest(tiles) {
    const base = analyzeStatic(tiles).best;
    const counts = new Map();
    for (const t of tiles) counts.set(t, (counts.get(t) || 0) + 1);
    const scored = [];
    for (const [tile, n] of counts) {
      if (tile === 'JK') { scored.push({ tile, marginal: 99 }); continue; }
      const reduced = tiles.slice();
      reduced.splice(reduced.indexOf(tile), 1);
      const d = analyzeStatic(reduced).best;
      scored.push({ tile, marginal: d - base, copies: n });
    }
    scored.sort((a, b) => a.marginal - b.marginal); // least useful first
    // build a 3-tile pass from least useful, respecting copies
    const pass = [];
    for (const s of scored) {
      let avail = counts.get(s.tile);
      while (avail-- > 0 && pass.length < 3 && s.tile !== 'JK') pass.push(s.tile);
      if (pass.length >= 3) break;
    }
    return { pass: pass.slice(0, 3), ranking: scored };
  }

  // ---- Charleston pass OPTIMIZER (phase 2) ------------------------------
  // For every distinct 3-tile pass, estimate expected post-pass strength by
  // sampling the (unknown) tiles you receive and scoring the resulting 13-tile
  // hand with the validated reachMass surrogate. Returns passes ranked by EV.
  // Models received tiles as uniform-random from the unseen pool (first proper
  // model; a later version can weight by opponents' likely discards).
  function charlestonOptimize(tiles, opts) {
    opts = opts || {};
    const R = opts.received ?? 24;     // received-tile samples per pass
    const candCap = opts.maxCand ?? 220;
    const window = opts.window ?? 4;   // include lines within best+window

    const hp0 = handPool(tiles);
    const targets = buildTargets();
    let best = 99;
    for (const t of targets) { const d = tilesNeeded(t, hp0); t._d = d; if (d < best) best = d; }
    let cand = targets.filter(t => t._d <= best + window).sort((a, b) => a._d - b._d);
    if (cand.length > candCap) cand = cand.slice(0, candCap);

    // unseen pool to draw received tiles from = full minus your 13
    const rem = fullPool();
    for (const t of tiles) rem.set(t, (rem.get(t) || 0) - 1);
    const wall = [];
    for (const [t, c] of rem) for (let i = 0; i < c; i++) wall.push(t);

    const baseRM = reachMassOver(tiles, cand);

    // distinct 3-tile passes (never pass a joker)
    const seen = new Set(); const results = [];
    for (let a = 0; a < 13; a++) for (let b = a + 1; b < 13; b++) for (let c = b + 1; c < 13; c++) {
      const trio = [tiles[a], tiles[b], tiles[c]];
      if (trio.includes('JK')) continue;
      const key = trio.slice().sort().join(',');
      if (seen.has(key)) continue; seen.add(key);
      const baseHand = []; for (let i = 0; i < 13; i++) if (i !== a && i !== b && i !== c) baseHand.push(tiles[i]);
      let sum = 0;
      for (let s = 0; s < R; s++) {
        for (let i = 0; i < 3; i++) { const j = i + ((Math.random() * (wall.length - i)) | 0); const tmp = wall[i]; wall[i] = wall[j]; wall[j] = tmp; }
        sum += reachMassOver(baseHand.concat(wall.slice(0, 3)), cand);
      }
      results.push({ pass: trio, ev: sum / R, keepOnly: reachMassOver(baseHand, cand) });
    }
    results.sort((x, y) => y.ev - x.ev);
    return { best, baseRM, baseP: +fastP(baseRM).toFixed(4), candidates: cand.length, results };
  }

  const API = {
    SUITS, DRAGON_OF, fullPool, CARD, CALIB,
    expandLine, buildTargets, setTargets, resetTargets, targetsVersion, coverage, handPool, tilesNeeded,
    reachMassOver, analyzeStatic, metrics, monteCarlo,
    charlestonSuggest, charlestonOptimize,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MahjonggEngine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
