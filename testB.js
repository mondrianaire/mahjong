const E = require('./engine.js');
const D = require('./dealer.js');
const P = require('./policies.js');
const S = require('./score.js');
const PLAY = require('./play.js');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok: ' : '  FAIL: ') + m); if (!c) fails++; };

console.log('== Phase 3: scorer + objective modes ==');
const rack = ['1B','2B','3B','3B','4B','5B','6B','2B','7C','9D','WN','DR','JK'];
ok(S.objScore(rack,'WINS') > 0, 'WINS objScore positive');
ok(S.objScore(rack,'POINTS') > S.objScore(rack,'WINS'), 'POINTS objScore scales up by V (>WINS)');
const blW = S.bestLine(rack,'WINS'), blP = S.bestLine(rack,'POINTS');
ok(!!blW.key && !!blP.key, 'bestLine returns a line for each objective');

console.log('== Phase 3: policy zoo produces distinguishable passes ==');
const rng = D.mulberry32(42);
const policies = [P.winsFlexible, P.pointsChaser, P.naivePolicy, P.randomPolicy(rng)];
const view = seat => ({ seat, ownRack: D.deal(5).racks[seat], observations: [], publicState: {} });
const deal5 = D.deal(5);
const passes = policies.map(p => p.selectPass({ seat:0, ownRack: deal5.racks[0].slice(), observations: [], publicState:{} }));
passes.forEach((p,i)=>console.log('   '+policies[i].name+': '+p.join(' ')));
const distinct = new Set(passes.map(p=>p.slice().sort().join(','))).size;
ok(distinct >= 2, 'policies differ on the same rack ('+distinct+' distinct passes)');
ok(passes.every(p=>!p.includes('JK')&&p.length===3), 'every pass is 3 tiles, no jokers');

console.log('== Phase 4: multi-agent MC with calling (200 games) ==');
const t0 = Date.now();
let wins=0, wall=0, secCount={}, winnerJok=[], loserJok=[], timeouts=0;
const N=200;
for (let s=0;s<N;s++){
  const ch = D.runCharleston([P.winsFlexible,P.winsFlexible,P.naivePolicy,P.randomPolicy(D.mulberry32(s*7+1))], {seed:s+1});
  const g = PLAY.playGame(ch,'WINS');
  if (g.timeout) timeouts++;
  if (g.wallGame) wall++; else { wins++; secCount[g.section]=(secCount[g.section]||0)+1; winnerJok.push(g.winnerJokers); }
}
const dt=((Date.now()-t0)/1000).toFixed(1);
console.log('  '+N+' games in '+dt+'s | wins '+wins+' wall '+wall+' timeouts '+timeouts);
console.log('  win-or-mahjong rate: '+(100*wins/N).toFixed(1)+'%  (anchor ~89%, simplified policy)');
console.log('  winning sections:', Object.entries(secCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join('  '));
const avgWJ = winnerJok.reduce((a,b)=>a+b,0)/Math.max(1,winnerJok.length);
console.log('  avg jokers held by winners: '+avgWJ.toFixed(2));
ok(wins>0, 'at least some games are won (engine reaches mahjong)');
ok(timeouts===0, 'no games hit the turn cap (loop terminates)');
// pair-hardness normative direction: S&P should be rare among wins vs Consec
const sp=secCount['S&P']||0, consec=secCount['Consec']||0;
console.log('  pair-hardness check: S&P wins='+sp+'  Consec wins='+consec);
ok(sp <= consec, 'normative: Singles&Pairs not more common than Consecutive Run');

console.log(fails ? '\n'+fails+' FAILURES' : '\nWAVE B PASS');
process.exit(fails?1:0);
