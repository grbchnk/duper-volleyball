import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/engine.js';
import {DEFAULTS,FIXED_DT} from '../src/config.js';
import {expressivePose} from '../src/arm-motion.js';
import {ARM_STYLES} from '../src/arms.js';
import {playerFrame} from '../src/sprites.js';
const ticks=(m,n,input={})=>{for(let i=0;i<n;i++)m.tick(FIXED_DT,input);};
test('serve selection keeps arms and body neutral, permits a long hold, and never auto-hits',()=>{
 const m=new Match();ticks(m,160,{loft:true});assert.equal(m.phase,'serve');assert.ok(m.charge);assert.equal(m.active().armSwing,null);assert.equal(playerFrame(m.active(),m).state,'idle');
 m.tick();ticks(m,220);assert.equal(m.stats.serves[0],0);assert.equal(m.pointReason,'ПОДАЧА: МЯЧ НЕ УДАРЕН');
});
for(const kind of ['low','loft','drive'])test(kind+' has an ideal second press and accepts early/late presses',()=>{
 for(const offset of [-.4,0,.15]){
  const m=new Match();m.beginServe({kind,power:.5,aim:{axis:1}});
  ticks(m,Math.round((m.serveAction.ideal+offset)/FIXED_DT)-1);
  m.tick(FIXED_DT,{low:true});assert.equal(m.phase,'rally');assert.equal(m.stats.serves[0],1);
  assert.equal(m.players[0].armSwing.serve,true);
  if(offset===0){assert.equal(m.players[0].armSwing.power,.5);if(kind==='drive'){assert.ok(m.players[0].y>1);assert.ok(m.players[0].x>-8.5);}}
  else assert.ok(m.players[0].armSwing.power<.5);
  ticks(m,3,{low:true});assert.equal(m.stats.serves[0],1);
 }
});
test('attack phase, preparation and follow-through all reject a block',()=>{
 const m=new Match();m.phase='rally';m.teamPhases[0]='attack';assert.equal(m.requestBlock(0),false);
 m.teamPhases[0]='defense';m.charge={kind:'drive',playerId:0};assert.equal(m.requestBlock(0),false);
 m.charge=null;m.players[0].armSwing={kind:'drive',age:.1};assert.equal(m.requestBlock(0),false);
 m.players[0].armSwing=null;assert.equal(m.requestBlock(0),true);
});
test('serve contact uses one hand and elbow height preserves hand targets',()=>{
 for(const kind of ['low','loft','drive']){
  const args={spec:ARM_STYLES.whip,config:DEFAULTS,kind,swing:{serve:true,hit:true,age:0,power:.5},contactPoint:{x:17,y:-34}};
  const a=expressivePose(args),b=expressivePose({...args,config:{...DEFAULTS,elbowHeight:8}});
  assert.deepEqual(a.wrists[1],args.contactPoint);assert.notDeepEqual(a.wrists[0],args.contactPoint);assert.deepEqual(a.wrists,b.wrists);
  assert.equal(b.elbows[0].y,a.elbows[0].y-8);assert.equal(a.cup,0);
 }
});
