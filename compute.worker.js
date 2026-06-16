/* Compute Worker (M0) — runs the only heavy ops off the main thread so mobile stays at 60fps.
 * Protocol:  main → { id, op, args }   →   worker → { id, ok, result|error }
 * `handleMessage` is exported so it can be unit-tested in Node without a real Worker.
 */
const CH = require('./charleston2.js');
const CAL = require('./calibrated.js');
const TA = require('./tileAdvice.js');
const S = require('./score.js');

// strip the large per-seed `vals` arrays before sending results across the worker boundary
function slimChoose(r) {
  return {
    policyVersion: r.policyVersion, seeds: r.seeds,
    best: { pass: r.best.pass, V: r.best.V },
    results: r.results.map(x => ({
      pass: x.pass, V: +x.V.toFixed(5), evLoss: +x.evLoss.toFixed(5),
      percentile: Math.round(x.percentile),
      deadHeatWithBest: !!x.deadHeatWithBest,
      separated: !!(x.vsBest && x.vsBest.separated),
    })),
  };
}

function handleMessage(msg) {
  const { id, op, args } = msg || {};
  try {
    let result;
    switch (op) {
      case 'choosePass': result = slimChoose(CH.choosePass(args.rack, args.objective, args.opts)); break;
      case 'gradePass': { const g = CH.gradePass(args.rack, args.pass, args.objective, args.opts); result = { V: +g.V.toFixed(5), evLoss: +g.evLoss.toFixed(5), percentile: Math.round(g.percentile), best: g.best, deadHeat: !!g.deadHeat, policyVersion: g.policyVersion }; break; }
      case 'advise': result = TA.advise(args.rack, args.objective, null, args.opts || {}); break;
      case 'predictP': result = CAL.predictP(args.rack); break;
      case 'shortlist': { const sl = S.shortlist(args.rack, args.objective); result = { best: sl.best, cand: sl.cand.slice(0, 8).map(c => ({ section: c.target.section, name: c.target.name, d: c.d })) }; break; }
      default: throw new Error('unknown op: ' + op);
    }
    return { id, ok: true, result };
  } catch (e) { return { id, ok: false, error: String((e && e.message) || e) }; }
}

// wire to the Web Worker runtime when present (no-op in Node)
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('message', e => self.postMessage(handleMessage(e.data)));
}

module.exports = { handleMessage, slimChoose };
