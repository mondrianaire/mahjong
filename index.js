/* Charleston Engine — public API barrel (M0).
 * Re-exports the tested CommonJS modules under namespaces. esbuild bundles this into
 * dist/charleston-engine.esm.js for the PWA. Heavy ops also run in compute.worker.js.
 */
const engine = require('./engine.js');
const kernel = require('./kernel.js');
const cardMeta = require('./card-meta.js');
const score = require('./score.js');
const charleston2 = require('./charleston2.js');
const divergence = require('./divergence.js');
const observer = require('./observer.js');
const direction = require('./direction.js');
const tileAdvice = require('./tileAdvice.js');
const calibrated = require('./calibrated.js');
const dealer = require('./dealer.js');
const policies = require('./policies.js');
const ledger = require('./ledger.js');
const session = require('./session.js');
const stats = require('./stats.js');

module.exports = {
  engine, kernel, cardMeta, score, charleston2, divergence, observer,
  direction, tileAdvice, calibrated, dealer, policies, ledger, session, stats,
  // convenience top-level
  fullPool: engine.fullPool,
  buildTargets: engine.buildTargets,
  newSession: session.newSession,
  compass: direction.compass,
  advise: tileAdvice.advise,
  predictP: calibrated.predictP,
  detectDivergence: divergence.detect,
  version: '1.0.0',
  rolloutPolicy: stats.ROLLOUT_POLICY,
};
