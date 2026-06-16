const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok: ' : '  FAIL: ') + m); if (!c) fails++; };
const rack = ['1B','2B','3B','3B','4B','5B','6B','2B','7C','9D','WN','DR','JK'];

console.log('== compute.worker dispatch (source) ==');
const W = require('./compute.worker.js');
const r1 = W.handleMessage({ id: 1, op: 'predictP', args: { rack } });
ok(r1.ok && typeof r1.result === 'number', 'predictP op returns a probability (' + (r1.result || 0).toFixed(3) + ')');
const r2 = W.handleMessage({ id: 2, op: 'choosePass', args: { rack, objective: 'WINS', opts: { seeds: 20, topK: 8 } } });
ok(r2.ok && r2.result.results.length > 0 && r2.result.results[0].evLoss === 0, 'choosePass op returns slimmed ranking, best EVloss 0');
ok(!('vals' in r2.result.results[0]), 'heavy per-seed vals stripped from worker payload');
const r3 = W.handleMessage({ id: 3, op: 'gradePass', args: { rack, pass: ['4B','5B','6B'], objective: 'WINS', opts: { seeds: 20 } } });
ok(r3.ok && r3.result.evLoss > 0, 'gradePass op grades a bad pass with positive EV-loss');
const r4 = W.handleMessage({ id: 4, op: 'advise', args: { rack, objective: 'WINS' } });
ok(r4.ok && r4.result.advice.length > 0 && Array.isArray(r4.result.pass), 'advise op returns tile tray + pass');
const r5 = W.handleMessage({ id: 5, op: 'bogus', args: {} });
ok(!r5.ok && /unknown op/.test(r5.error), 'unknown op returns a clean error, not a throw');

console.log('== bundled worker (dist) end-to-end with a fake self ==');
const code = fs.readFileSync('dist/compute.worker.js', 'utf8');
let handler = null; const posted = [];
global.self = { addEventListener: (t, h) => { if (t === 'message') handler = h; }, postMessage: m => posted.push(m) };
eval(code);
ok(typeof handler === 'function', 'bundled worker wired self.onmessage');
handler({ data: { id: 9, op: 'predictP', args: { rack } } });
ok(posted.length === 1 && posted[0].id === 9 && posted[0].ok, 'bundled worker answered a postMessage round-trip');
delete global.self;

console.log('== ESM bundle API surface ==');
import('./dist/charleston-engine.esm.js').then(m => {
  const api = m.default || m;
  for (const ns of ['engine','score','charleston2','direction','tileAdvice','calibrated','session','stats'])
    ok(api[ns], 'ESM exports namespace: ' + ns);
  ok(typeof api.predictP === 'function' && api.predictP(rack) >= 0, 'ESM convenience predictP works');
  ok(api.version === '1.0.0', 'ESM reports version');
  console.log(fails ? '\n' + fails + ' FAILURES' : '\nM0 PASS — engine packaged + worker verified');
  process.exit(fails ? 1 : 0);
});
