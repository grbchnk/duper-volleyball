import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/engine.js';
import {DEFAULTS,FIXED_DT} from '../src/config.js';
import {expressivePose} from '../src/arm-motion.js';
import {ARM_STYLES} from '../src/arms.js';
import {WIN_EMOTIONS,LOSE_EMOTIONS,EMOTIONS,activeEmotion} from '../src/emotions.js';
import {playerFrame} from '../src/sprites.js';
const pose=extra=>expressivePose({spec:ARM_STYLES.whip,config:DEFAULTS,...extra});
test('contact follow-through matches outgoing velocity, direction and short reach for either hand',()=>{
 for(const kind of ['low','loft','drive'])for(const hand of [0,1])for(const localVelocity of [{x:100,y:-60},{x:-200,y:80}]){
  const point={x:7,y:-30},args={kind,localVelocity,contactPoint:point};
  const sample=age=>pose({...args,swing:{serve:true,hand,hit:true,age,power:1}});
  const a=sample(0),b=sample(.01),c=sample(.06);
  assert.deepEqual(a.wrists[hand],point);
  assert.ok(Math.abs(b.wrists[hand].x-point.x-localVelocity.x*.01)<1e-8);
  assert.ok(Math.abs(b.wrists[hand].y-point.y-localVelocity.y*.01)<1e-8);
  assert.ok(Math.hypot(c.wrists[hand].x-point.x,c.wrists[hand].y-point.y)<=5.00001);
  assert.deepEqual(sample(.6).wrists,pose({kind:null}).wrists);
 }
});
test('both serve hands share the same compact preparation target and leave the other arm relaxed',()=>{
 for(const kind of ['low','loft']){
  const a=pose({kind,serve:{kind,hand:0,age:.6,power:1}}),b=pose({kind,serve:{kind,hand:1,age:.6,power:1}});
  assert.deepEqual(a.wrists[0],b.wrists[1]);assert.ok(Math.abs(a.wrists[0].x)<=10);
  assert.ok(a.wrists[1].y>-20&&b.wrists[0].y>-20);
 }
 const block=pose({kind:'block',block:true});assert.equal(block.wrists[1].x-block.wrists[0].x,13);
});
test('serve hand is randomly chosen once and cosmetic randomness never changes gameplay RNG',()=>{
 const m=new Match(),hands=new Set();
 for(let i=0;i<24;i++){
  m.startServe();const seed=m.seed;m.beginServe({kind:i%2?'low':'loft',power:.5,aim:{axis:1}});assert.equal(m.seed,seed);
  const hand=m.serveAction.hand;hands.add(hand);m.executeServe();assert.equal(m.players[0].armSwing.hand,hand);
 }
 assert.deepEqual([...hands].sort(),[0,1]);
});
test('winners and losers react differently, airborne reactions wait, new serve clears them',()=>{
 const m=new Match(),seed=m.seed;m.phase='rally';m.jump(m.players[0]);m.point(0,'TEST');
 assert.equal(m.seed,seed);
 for(const p of m.players)assert.ok((p.team===0?WIN_EMOTIONS:LOSE_EMOTIONS).includes(p.emotion.kind));
 assert.equal(activeEmotion(m.players[0]),null);
 for(let i=0;i<120;i++)m.tick(FIXED_DT);
 assert.ok(activeEmotion(m.players[0]));assert.ok(Object.hasOwn(EMOTIONS,playerFrame(m.players[0],m).state));
 m.startServe();assert.ok(m.players.every(p=>p.emotion===null));
});
test('final-point reactions continue ticking after the match ends and do not change score',()=>{
 const m=new Match();m.point(0,'TEST');m.phase='finished';const score=[...m.score],p=m.players[0];
 for(let i=0;i<40;i++)m.tick();assert.ok(p.emotion.age>0);assert.deepEqual(m.score,score);
 for(let i=0;i<240;i++)m.tick();assert.equal(p.emotion,null);
});
test('shrug lifts shoulders only, and every emotion returns its hands to rest',()=>{
 const rest=pose({kind:null});
 const shrug=pose({kind:null,emotion:{kind:'shrug',age:.5,duration:2},shoulderLift:-4});
 for(let i=0;i<2;i++){assert.equal(shrug.shoulders[i].y,rest.shoulders[i].y-4);assert.equal(shrug.wrists[i].x,rest.wrists[i].x);assert.equal(shrug.wrists[i].y,rest.wrists[i].y-4);}
 for(const kind of Object.keys(EMOTIONS)){assert.deepEqual(pose({emotion:{kind,age:2,duration:2}}).wrists,rest.wrists);}
});
