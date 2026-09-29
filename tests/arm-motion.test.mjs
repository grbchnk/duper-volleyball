import test from 'node:test';
import assert from 'node:assert/strict';
import {ARM_STYLES} from '../src/arms.js';
import {expressivePose} from '../src/arm-motion.js';
import {DEFAULTS,FIXED_DT,sanitizeConfig} from '../src/config.js';
import {Match} from '../src/engine.js';
import {Renderer} from '../src/renderer.js';
import {jumpProfile} from '../src/motion.js';
const pose=(extra={})=>expressivePose({spec:ARM_STYLES.whip,config:DEFAULTS,kind:'drive',...extra});
// Canvas DOMPoint exposes inherited getters, not enumerable own x/y properties.
class CanvasPoint{#x;#y;constructor(x,y){this.#x=x;this.#y=y;}get x(){return this.#x;}get y(){return this.#y;}}

test('a Canvas DOMPoint produces finite spike targets and preserves its exact coordinates',()=>{
 const point=new CanvasPoint(13,-43);assert.deepEqual({...point},{});
 for(const age of [0,.03,.13,.27,.5]){
  const p=pose({swing:{hit:true,age,power:1},contactPoint:point});
  for(const v of [...p.wrists,...p.elbows])assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));
  if(age===0)assert.deepEqual(p.wrists[1],{x:13,y:-43});
 }
});

test('whip is the only style; old saves migrate while preserving physics and animation tuning',()=>{
 assert.deepEqual(Object.keys(ARM_STYLES),['whip']);assert.equal(DEFAULTS.armStyle,'whip');
 for(const armStyle of ['classic','compact','soft','mittens','volley','windmill','propeller','whip']){
  const c=sanitizeConfig(JSON.parse(JSON.stringify({...DEFAULTS,armStyle,armWindup:.12,armFlourish:1,gravity:12})));
  assert.equal(c.armStyle,'whip');assert.equal(c.armWindup,.12);assert.equal(c.gravity,12);assert.equal('armFlourish' in c,false);
 }
});
test('charge deepens the windup, release accents it and contact reaches the ball immediately',()=>{
 const weak=pose({charge:{age:.12,power:.2}}),strong=pose({charge:{age:.12,power:1}});
 assert.ok(strong.wrists[1].x<weak.wrists[1].x);
 assert.ok(pose({swing:{power:1,age:.03,hit:false}}).wrists[1].x<strong.wrists[1].x);
 const hit=pose({swing:{power:1,age:0,hit:true},contactPoint:{x:13,y:-43}});
 assert.equal(hit.snap,true);assert.deepEqual(hit.wrists[1],{x:13,y:-43});
 const soft=pose({swing:{power:.2,age:.12,hit:true}}),hard=pose({swing:{power:1,age:.12,hit:true}});
 assert.ok(hard.wrists[1].y>soft.wrists[1].y);
});
test('all wrists, elbows and palm angles return to the same rest pose after hit or miss, at every size and power',()=>{
 for(const armScale of [.65,1,1.3])for(const power of [.08,.5,1])for(const kind of ['low','loft','drive'])for(const hit of [true,false]){
  const config={...DEFAULTS,armScale},rest=pose({config,kind:null});
  const returned=pose({config,kind,swing:{hit,power,age:.5},contactPoint:{x:25,y:-45}});
  assert.deepEqual(returned.wrists,rest.wrists);assert.deepEqual(returned.elbows,rest.elbows);assert.equal(returned.cup,0);assert.equal(returned.stage,'Покой');assert.equal(returned.power,rest.power);
 }
});
test('overhead cup and wide elbows blend away during recovery rather than sticking until the marker expires',()=>{
 const ready=pose({kind:'loft',charge:{power:1,age:.1}});
 assert.equal(ready.cup,1);assert.ok(ready.elbows[0].x<ready.wrists[0].x);assert.ok(ready.elbows[1].x>ready.wrists[1].x);
 const recovering=pose({kind:'loft',swing:{power:1,age:.27,hit:true}});
 assert.ok(recovering.cup>0&&recovering.cup<1);
 assert.notDeepEqual(recovering.elbows,ready.elbows);
});
test('a spike sweeps downward and returns without an extended hold; recovery blends into the jump pose',()=>{
 const stroke=pose({swing:{hit:true,power:1,age:.13},contactPoint:{x:24,y:-44}});
 assert.ok(stroke.wrists[1].x<27);assert.ok(stroke.wrists[1].y>-20);
 const profile=jumpProfile(DEFAULTS),jump={profile,time:profile.windup+profile.rise};
 assert.deepEqual(pose({kind:'drive',jump,swing:{hit:true,power:1,age:.5}}).wrists,pose({kind:null,jump}).wrists);
 const up=pose({kind:null,jump}),early=pose({kind:null,jump:{profile,time:.04}});
 assert.ok(up.wrists[0].y<early.wrists[0].y-15);
});
test('renderer anchors a contact to the player once, then both joints settle at 30/60/120 FPS',()=>{
 for(const fps of [30,60,120]){
  let offset=0;
  const ctx=new Proxy({getTransform:()=>({inverse:()=>({transformPoint:p=>new CanvasPoint(p.x-offset,p.y)})})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const renderer=Object.create(Renderer.prototype);renderer.ctx=ctx;renderer.armRigs=new Map();renderer.project=(x,y)=>({x,y});
  const m=new Match(),p=m.players[0];m.phase='rally';p.armSwing={kind:'drive',power:1,age:0,hit:true,at:1,x:13,y:-43};
  renderer.drawArms(p,m,1/fps,0);const rig=renderer.armRigs.get(p.id);
  assert.deepEqual(rig.contactPoint,{x:13,y:-43});assert.equal(rig.wrists[1].x,13);
  offset=100;
  for(let frame=1;frame<fps*2;frame++){p.armSwing.age=frame/fps;renderer.drawArms(p,m,1/fps,0);}
  assert.deepEqual(rig.contactPoint,{x:13,y:-43});
  const rest=pose({kind:null});
  for(const key of ['wrists','elbows'])for(let i=0;i<2;i++){assert.ok(Math.abs(rig[key][i].x-rest[key][i].x)<.02);assert.ok(Math.abs(rig[key][i].y-rest[key][i].y)<.02);}
  p.armSwing={kind:'loft',power:.6,age:0,hit:true,at:2,x:110,y:-41};renderer.drawArms(p,m,1/fps,0);assert.deepEqual(rig.contactPoint,{x:10,y:-41});
 }
});
test('animation tuning does not delay contacts, change flight or create additional hits',()=>{
 let baseline;
 for(const armPowerMotion of [0,1.5]){
  const m=new Match({...DEFAULTS,armPowerMotion});m.startDrill('set');Object.assign(m.ball,{x:-3.7,y:2.1,vy:0});m.tick(FIXED_DT,{loft:true});m.tick();
  assert.equal(m.contacts,1);const result=[m.ball.x,m.ball.y,m.ball.vx,m.ball.vy];if(baseline)assert.deepEqual(result,baseline);else baseline=result;
  for(let i=0;i<95;i++)m.tick();assert.equal(m.players[1].armSwing,null);assert.equal(m.contacts,1);
 }
});

test('jump wrists stay on opposite sides throughout push-off and ascent',()=>{
 const profile=jumpProfile(DEFAULTS);
 for(let time=0;time<profile.windup+profile.rise;time+=.01){
  const p=pose({kind:null,jump:{profile,time}});
  assert.ok(p.wrists[0].x<0&&p.wrists[1].x>0);
  assert.ok(Math.abs(p.wrists[0].x+p.wrists[1].x)<3);
 }
});

test('forward rescue reaches horizontally as the body rotates; recovery palms meet the floor',()=>{
 for(const bodyTilt of [.2,.55,1.05,1.38]){
  const p=pose({kind:'low',diving:true,diveForward:true,bodyTilt,charge:{age:.2,power:.2}});
  for(let i=0;i<2;i++){
   const x=p.wrists[i].x-(i?3:-3),y=p.wrists[i].y+20;
   assert.ok(Math.abs(x*Math.sin(bodyTilt)+y*Math.cos(bodyTilt))<1e-8);
   assert.ok(x*Math.cos(bodyTilt)-y*Math.sin(bodyTilt)>24);
  }
 }
 for(const bodyTilt of [1.49,1.05,.65]){
  const bodyOffsetY=5,p=pose({bodyTilt,bodyOffsetY,recoveryPose:{progress:.3}});
  for(const w of p.wrists)assert.ok(Math.abs(w.x*Math.sin(bodyTilt)+(w.y+bodyOffsetY)*Math.cos(bodyTilt)-5*Math.sin(bodyTilt))<1e-8);
 }
});
