/* M0 — promise-based main-thread client for the compute worker.
 * The PWA imports this; heavy ops resolve asynchronously without blocking the UI.
 *   const c = createComputeClient('compute.worker.js');
 *   const ranking = await c.choosePass(rack, 'WINS', { seeds: 40 });
 */
export function createComputeClient(workerUrl) {
  const w = new Worker(workerUrl);
  let nextId = 1; const pending = new Map();
  w.onmessage = e => {
    const { id, ok, result, error } = e.data || {};
    const p = pending.get(id); if (!p) return; pending.delete(id);
    ok ? p.resolve(result) : p.reject(new Error(error));
  };
  w.onerror = err => { for (const p of pending.values()) p.reject(err); pending.clear(); };
  const call = (op, args) => new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); w.postMessage({ id, op, args }); });
  return {
    choosePass: (rack, objective, opts) => call('choosePass', { rack, objective, opts }),
    gradePass: (rack, pass, objective, opts) => call('gradePass', { rack, pass, objective, opts }),
    advise: (rack, objective, opts) => call('advise', { rack, objective, opts }),
    predictP: rack => call('predictP', { rack }),
    shortlist: (rack, objective) => call('shortlist', { rack, objective }),
    terminate: () => w.terminate(),
  };
}
