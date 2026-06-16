/* tilefaces.js — faithful American Mahjong tile faces as inline SVG.
 * One source of truth for charleston-lab-v3.html and app.mobile.html.
 * API:  TileFaces.svg(code, {w,h})  -> '<svg>…</svg>' string
 *       TileFaces.node(code, opts)  -> <span class="mjt"> wrapping the svg
 * Codes: suited '<n>B|C|D' (1..9); winds 'WN'|'WE'|'WW'|'WS';
 *        dragons 'DG'|'DR'|'DW'; flower 'FL'; joker 'JK'.
 * See TILE_GLYPH_SPEC.md for the design rationale. */
(function (root) {
  'use strict';
  var COL = {
    bam: '#2f7d44', crak: '#b83227', dot: '#2660a4', wind: '#3a3470',
    soap: '#2660a4', flower: '#c2780a', joker: '#8a3ea0', ink: '#241f1a',
    body: '#fbf7ee', edge: '#d8cdb8', cream: '#fffdf8'
  };
  var VB_W = 100, VB_H = 132; // internal coordinate space (1:1.32)
  var PAD = 16;               // inner drawing inset
  function box() { return { x: PAD, y: PAD, w: VB_W - 2 * PAD, h: VB_H - 2 * PAD }; }
  function P(nx, ny) { var b = box(); return [b.x + nx * b.w, b.y + ny * b.h]; }

  // ---- a single coin "ring" (dot) ----------------------------------------
  function ring(nx, ny, r, color) {
    var c = P(nx, ny), R = r * box().w;
    return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + R + '" fill="' + color +
      '"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + (R * 0.46) + '" fill="' + COL.cream +
      '"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + (R * 0.16) + '" fill="' + color + '"/>';
  }
  // ---- a single bamboo stick --------------------------------------------
  function stick(nx, ny, hN, color) {
    var c = P(nx, ny), b = box(), w = 0.13 * b.w, h = hN * b.h,
      x = c[0] - w / 2, y = c[1] - h / 2;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) +
      '" fill="' + color + '"/>' +
      '<rect x="' + x + '" y="' + (c[1] - h * 0.06) + '" width="' + w + '" height="' + (h * 0.12) +
      '" fill="' + COL.cream + '" opacity="0.65"/>' +
      '<circle cx="' + c[0] + '" cy="' + (y + h * 0.16) + '" r="' + (w * 0.36) + '" fill="' + COL.cream + '" opacity="0.8"/>';
  }
  // ---- the 1 Bam bird ----------------------------------------------------
  function bird() {
    var g = COL.bam, r = COL.crak, c = P(0.5, 0.52);
    return '<g transform="translate(' + c[0] + ',' + c[1] + ')">' +
      '<ellipse cx="0" cy="6" rx="17" ry="22" fill="' + g + '"/>' +            // body
      '<circle cx="0" cy="-20" r="11" fill="' + g + '"/>' +                     // head
      '<path d="M -3 -28 Q 0 -40 8 -34 Q 4 -26 -2 -26 Z" fill="' + r + '"/>' +  // crest
      '<path d="M 9 -20 L 22 -17 L 9 -13 Z" fill="' + COL.flower + '"/>' +      // beak
      '<circle cx="4" cy="-21" r="2.2" fill="' + COL.ink + '"/>' +              // eye
      '<path d="M -2 22 Q -22 30 -28 18 Q -16 20 -4 12 Z" fill="' + r + '"/>' + // tail
      '<path d="M -10 4 Q -20 0 -16 12 Q -8 12 -6 8 Z" fill="' + COL.cream + '" opacity="0.55"/>' +
      '</g>';
  }
  // ---- character glyphs --------------------------------------------------
  var CJK = "'Songti SC','STSong','SimSun','Noto Serif CJK SC','Hiragino Mincho ProN','Yu Mincho','MS Mincho',serif";
  function bigChar(ch, color, sub, subcolor) {
    var out = '<text x="' + (VB_W / 2) + '" y="' + (sub ? 64 : 80) + '" text-anchor="middle" ' +
      'font-family="' + CJK + '" font-weight="700" font-size="' + (sub ? 58 : 78) + '" fill="' + color + '">' + ch + '</text>';
    if (sub) out += '<text x="' + (VB_W / 2) + '" y="' + 118 + '" text-anchor="middle" font-family="sans-serif" ' +
      'font-weight="700" font-size="26" fill="' + subcolor + '">' + sub + '</text>';
    return out;
  }

  // ---- layouts (normalized centers) -------------------------------------
  var DOT = {
    1: [[0.5, 0.5, 0.34]],
    2: [[0.5, 0.27], [0.5, 0.73]],
    3: [[0.26, 0.24], [0.5, 0.5], [0.74, 0.76]],
    4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
    5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.32, 0.22], [0.68, 0.22], [0.32, 0.5], [0.68, 0.5], [0.32, 0.78], [0.68, 0.78]],
    7: [[0.28, 0.16], [0.5, 0.29], [0.72, 0.42], [0.32, 0.66], [0.68, 0.66], [0.32, 0.86], [0.68, 0.86]],
    8: [[0.32, 0.16], [0.68, 0.16], [0.32, 0.39], [0.68, 0.39], [0.32, 0.61], [0.68, 0.61], [0.32, 0.84], [0.68, 0.84]],
    9: [[0.26, 0.26], [0.5, 0.26], [0.74, 0.26], [0.26, 0.5], [0.5, 0.5], [0.74, 0.5], [0.26, 0.74], [0.5, 0.74], [0.74, 0.74]]
  };
  var BAM = {
    2: [[0.35, 0.5], [0.65, 0.5]],
    3: [[0.5, 0.26], [0.33, 0.72], [0.67, 0.72]],
    4: [[0.32, 0.3], [0.68, 0.3], [0.32, 0.7], [0.68, 0.7]],
    5: [[0.3, 0.28], [0.7, 0.28], [0.5, 0.5], [0.3, 0.72], [0.7, 0.72]],
    6: [[0.32, 0.24], [0.68, 0.24], [0.32, 0.5], [0.68, 0.5], [0.32, 0.76], [0.68, 0.76]],
    7: [[0.5, 0.17], [0.32, 0.5], [0.68, 0.5], [0.32, 0.74], [0.68, 0.74], [0.32, 0.26], [0.68, 0.26]],
    8: [[0.3, 0.18], [0.7, 0.18], [0.34, 0.4], [0.66, 0.4], [0.34, 0.62], [0.66, 0.62], [0.3, 0.84], [0.7, 0.84]],
    9: [[0.26, 0.26], [0.5, 0.26], [0.74, 0.26], [0.26, 0.5], [0.5, 0.5], [0.74, 0.5], [0.26, 0.74], [0.5, 0.74], [0.74, 0.74]]
  };
  // red-accent stick indices (per spec): 5 center, 7 top, 9 center column
  var BAM_RED = { 5: [2], 7: [0], 9: [1, 4, 7] };
  // red-accent dot groups: 9 middle row, 6 lower pair, 7 lower quad
  var DOT_RED = { 9: [3, 4, 5], 6: [4, 5], 7: [3, 4, 5, 6] };

  function dotFace(n) {
    var L = DOT[n], red = DOT_RED[n] || [], out = '';
    var r = n === 1 ? 0.34 : n <= 5 ? 0.17 : 0.135;
    for (var i = 0; i < L.length; i++) {
      var color = red.indexOf(i) >= 0 ? COL.crak : (n === 1 ? COL.crak : COL.dot);
      out += ring(L[i][0], L[i][1], L[i][2] || r, color);
    }
    return out;
  }
  function bamFace(n) {
    if (n === 1) return bird();
    var L = BAM[n], red = BAM_RED[n] || [], out = '';
    var hN = n <= 2 ? 0.62 : n <= 6 ? 0.4 : 0.3;
    for (var i = 0; i < L.length; i++)
      out += stick(L[i][0], L[i][1], hN, red.indexOf(i) >= 0 ? COL.crak : COL.bam);
    return out;
  }

  function inner(code) {
    if (code === 'JK') return '<g transform="translate(' + (VB_W / 2) + ',' + (VB_H / 2) + ') rotate(-90)">' +
      '<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" ' +
      'font-weight="800" font-size="30" letter-spacing="1" fill="' + COL.joker + '">JOKER</text></g>';
    if (code === 'FL') {
      var c = P(0.5, 0.5), o = '';
      for (var k = 0; k < 5; k++) {
        var a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        o += '<ellipse cx="' + (c[0] + Math.cos(a) * 17) + '" cy="' + (c[1] + Math.sin(a) * 17) +
          '" rx="11" ry="17" fill="' + COL.flower + '" transform="rotate(' + (a * 180 / Math.PI + 90) +
          ' ' + (c[0] + Math.cos(a) * 17) + ' ' + (c[1] + Math.sin(a) * 17) + ')"/>';
      }
      return o + '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="9" fill="' + COL.crak + '"/>';
    }
    if (code === 'DR') return bigChar('中', COL.crak);
    if (code === 'DG') return bigChar('發', COL.bam);
    if (code === 'DW') { // soap: blue frame, faint 0
      var b = box();
      return '<rect x="' + (b.x + 6) + '" y="' + (b.y + 14) + '" width="' + (b.w - 12) + '" height="' + (b.h - 28) +
        '" rx="6" fill="none" stroke="' + COL.dot + '" stroke-width="5"/>' +
        '<text x="' + (VB_W / 2) + '" y="' + (VB_H / 2 + 12) + '" text-anchor="middle" font-family="sans-serif" ' +
        'font-weight="700" font-size="30" fill="' + COL.dot + '" opacity="0.5">0</text>';
    }
    if (code[0] === 'W') {
      var ch = { N: '北', E: '東', W: '西', S: '南' }[code[1]] || code[1];
      return bigChar(ch, COL.wind, code[1], COL.wind);
    }
    var n = parseInt(code[0], 10), suit = code[1];
    if (suit === 'C') return bigChar(n + '', COL.dot, '萬', COL.crak);
    if (suit === 'B') return bamFace(n);
    if (suit === 'D') return dotFace(n);
    return '';
  }

  function svg(code, opts) {
    opts = opts || {};
    var w = opts.w || 44, h = opts.h || Math.round(w * 1.32);
    return '<svg class="mjt-svg" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" width="' + w + '" height="' + h +
      '" role="img" aria-label="' + label(code) + '">' +
      '<rect x="1.5" y="1.5" width="' + (VB_W - 3) + '" height="' + (VB_H - 3) + '" rx="11" fill="' + COL.body +
      '" stroke="' + COL.edge + '" stroke-width="2"/>' +
      '<rect x="5" y="5" width="' + (VB_W - 10) + '" height="' + (VB_H - 10) + '" rx="8" fill="none" stroke="' +
      COL.cream + '" stroke-width="2"/>' + inner(code) + '</svg>';
  }
  function label(code) {
    if (code === 'JK') return 'Joker'; if (code === 'FL') return 'Flower';
    if (code === 'DR') return 'Red dragon'; if (code === 'DG') return 'Green dragon';
    if (code === 'DW') return 'White dragon (soap / zero)';
    if (code[0] === 'W') return ({ N: 'North', E: 'East', W: 'West', S: 'South' }[code[1]] || code[1]) + ' wind';
    return code[0] + ' ' + ({ B: 'Bam', C: 'Crak', D: 'Dot' }[code[1]] || '');
  }
  function node(code, opts) {
    var s = document.createElement('span');
    s.className = 'mjt' + (opts && opts.cls ? ' ' + opts.cls : '');
    s.title = label(code); s.innerHTML = svg(code, opts);
    return s;
  }
  root.TileFaces = { svg: svg, node: node, label: label, COL: COL };
})(typeof window !== 'undefined' ? window : this);
