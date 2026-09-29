import test from 'node:test';
import assert from 'node:assert/strict';
import {ARM_STYLES} from '../src/arms.js';
import {expressivePose} from '../src/arm-motion.js';
import {DEFAULTS,FIXED_DT,sanitizeConfig} from '../src/config.js';
import {Match} from '../src/engine.js';
import {jumpProfile} from '../src/motion.js';
const pose=(style='volley',extra={})=>expressivePose({spec:ARM_STYLES[style],config:DEFAULTS,kind:'drive',...extra});

test('original styles keep their own renderer; new styles and animation settings roundtrip',()=>{
 for(const id of ['classic','compact','soft','mittens'])assert.equal(ARM_STYLES[id].motion,undefined);
 for(const armStyle of ['volley','whip','windmill','propeller']){
  const c=sanitizeConfig(JSON.parse(JSON.stringify({...DEFAULTS,armStyle,armWindup:.12,armFlourish:0,armJumpMotion:1.4})));
  assert.equal(c.armStyle,armStyle);assert.equal(c.armWindup,.12);assert.equal(c.armFlourish,0);assert.equal(c.armJumpMotion,1.4);
 }
});
test('charge deepens the windup, release accents it, and a real contact reaches the ball immediately',()=>{
 const weak=pose('whip',{charge:{age:.12,power:.2}}),strong=pose('whip',{charge:{age:.12,power:1}});
 assert.ok(strong.wrists[1].x<weak.wrists[1].x);
 const release=pose('whip',{swing:{power:1,age:.03,hit:false}});
 assert.ok(release.wrists[1].x<strong.wrists[1].x);
 const hit=pose('whip',{swing:{power:1,age:0,hit:true},contactPoint:{x:13,y:-43}});
 assert.equal(hit.snap,true);assert.deepEqual(hit.wrists[1],{x:13,y:-43});
 const soft=pose('volley',{swing:{power:.2,age:.12,hit:true}}),hard=pose('volley',{swing:{power:1,age:.12,hit:true}});
 assert.ok(hard.wrists[1].y>soft.wrists[1].y);
});
test('comic rotations require a strong successful hit and can be disabled',()=>{
 for(const style of ['windmill','propeller']){
  assert.ok(pose(style,{swing:{power:1,age:.3,hit:true}}).spin>.5);
  assert.equal(pose(style,{swing:{power:.7,age:.3,hit:true}}).spin,0);
  assert.equal(pose(style,{swing:{power:1,age:.3,hit:false}}).spin,0);
  assert.equal(pose(style,{swing:{power:1,age:0,hit:true}}).spin,0);
  assert.equal(pose(style,{swing:{power:1,age:.3,hit:true},config:{...DEFAULTS,armFlourish:0}}).spin,0);
 }
});
test('overhead preparation forms a cup with elbows outside the wrists',()=>{
 for(const style of ['volley','whip','windmill','propeller']){
  const p=pose(style,{kind:'loft',charge:{power:.5,age:.1}});
  assert.equal(p.cup,true);assert.ok(p.wrists.every(w=>w.y<-30));
  assert.ok(p.elbows[0].x<p.wrists[0].x);assert.ok(p.elbows[1].x>p.wrists[1].x);
 }
});
test('jump arms sweep upward and settle on descent; animation amount zero disables this sweep',()=>{
 const profile=jumpProfile(DEFAULTS),early=pose('volley',{kind:null,jump:{profile,time:.04}}),up=pose('volley',{kind:null,jump:{profile,time:profile.windup+profile.rise}}),down=pose('volley',{kind:null,jump:{profile,time:profile.windup+profile.rise+profile.hang+profile.fall}});
 assert.ok(up.wrists[0].y<early.wrists[0].y-15);assert.ok(down.wrists[0].y>up.wrists[0].y+10);
 assert.deepEqual(pose('volley',{kind:null,jump:{profile,time:.2},config:{...DEFAULTS,armJumpMotion:0}}).wrists,pose('volley',{kind:null}).wrists);
});
test('every style has identical manual contact timing and ball flight; cosmetic follow-through cannot hit again',()=>{
 let baseline;
 for(const armStyle of Object.keys(ARM_STYLES)){
  const m=new Match({...DEFAULTS,armStyle});m.startDrill('set');
  Object.assign(m.ball,{x:-3.7,y:2.1,vy:0});m.tick(FIXED_DT,{loft:true});m.tick();
  assert.equal(m.contacts,1);assert.equal(m.active().team,0);
  const striker=m.players[1];assert.equal(striker.armSwing.hit,true);
  const result=[m.ball.x,m.ball.y,m.ball.vx,m.ball.vy,m.contacts];
  if(baseline)assert.deepEqual(result,baseline);else baseline=result;
  for(let i=0;i<95;i++)m.tick();assert.equal(striker.armSwing,null);assert.equal(m.contacts,1);
 }
});
test('all expressive poses remain finite across slider extremes and the full motion cycle',()=>{
 for(const style of ['volley','whip','windmill','propeller'])for(const power of [0,.71,1])for(const scale of [.65,1.3])for(const kind of ['low','loft','drive'])for(let age=0;age<.75;age+=.025){
  const p=pose(style,{kind,swing:{hit:true,power,age},config:{...DEFAULTS,armScale:scale,armBend:1.5,armPowerMotion:1.5,armFlourish:1.5}});
  for(const point of [...p.wrists,...p.elbows])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
 }
});
