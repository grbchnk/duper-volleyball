import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/engine.js';
import { awardRally } from '../src/rules.js';
import { DEFAULTS, FIXED_DT } from '../src/config.js';
import { receptionChoice, setChoice, serveChoice } from '../src/moves.js';
const state=(more={})=>({score:[0,0],sets:[0,0],server:0,...more});
test('sideout only scores for the serving team',()=>{
  const s=state();assert.equal(awardRally(s,1,DEFAULTS).scored,false);assert.deepEqual(s.score,[0,0]);assert.equal(s.server,1);
  assert.equal(awardRally(s,1,DEFAULTS).scored,true);assert.deepEqual(s.score,[0,1]);
});
test('15 with a two point lead wins; deuce has hard cap at 17',()=>{
  const a=state({score:[14,13]});assert.equal(awardRally(a,0,DEFAULTS).setWon,true);
  const b=state({score:[14,14]});assert.equal(awardRally(b,0,DEFAULTS).setWon,false);
  const c=state({score:[16,16]});assert.equal(awardRally(c,0,DEFAULTS).setWon,true);assert.deepEqual(c.score,[17,16]);
});
test('fifth set scores every rally, third set win ends the match',()=>{
  const s=state({score:[13,14],sets:[2,2]});const result=awardRally(s,1,DEFAULTS);
  assert.equal(result.scored,true);assert.equal(result.matchWon,true);assert.deepEqual(s.sets,[2,3]);
});
test('manual attack table maps receive and set inputs',()=>{
  assert.equal(receptionChoice({up:true}),'open');assert.equal(receptionChoice({down:true}),'quick');
  assert.equal(setChoice('quick',true),'delayed');assert.equal(setChoice('open',true),'back');assert.equal(setChoice('normal',true),'normal');
  assert.equal(serveChoice({axis:1}),'jump');assert.equal(serveChoice({axis:-1}),'over');assert.equal(serveChoice({up:true,axis:0}),'under');
});
test('four active roles per side, held serve button does not make the second contact',()=>{
  const m=new Match();assert.equal(m.players.length,8);
  assert.deepEqual(m.players.filter(p=>p.team===0).map(p=>p.role),['receiver','setter','quick','open']);
  for(let i=0;i<200;i++)m.tick(FIXED_DT,{a:true});
  assert.equal(m.stats.serves[0],0);assert.equal(m.server,1);assert.equal(m.pointReason,'ОШИБКА ПОДАЧИ');
});
test('separate timed press serves and an opponent receives',()=>{
  const m=new Match();m.tick(FIXED_DT,{a:true});for(let i=0;i<91;i++)m.tick(FIXED_DT,{});
  m.tick(FIXED_DT,{a:true});assert.equal(m.stats.serves[0],1);
  for(let i=0;i<240;i++)m.tick(FIXED_DT,{});assert.ok(m.contacts>0);assert.equal(m.lastTouch,1);
});
test('special serves consume one slot per set, high and diving serves differ',()=>{
  for(const down of [false,true]){
    const m=new Match();m.tick(FIXED_DT,{a:true,b:true,up:true});for(let i=0;i<75;i++)m.tick(FIXED_DT,{});
    m.tick(FIXED_DT,{a:true,b:true,up:!down,down});assert.equal(m.specialUsed[0],true);
    const event=m.events.find(e=>e.type==='hit');assert.equal(event.kind,down?'thunder':'sky');
    assert.equal(m.ball.special,down?'thunder':null);
  }
});
test('double block raises two front players on a single B press',()=>{
  const m=new Match();m.phase='attack';m.possession=1;m.lastTouch=1;m.touches=2;m.ball={x:3,y:5,z:4.5,vx:-3,vy:0,vz:0,spin:0};
  m.tick(FIXED_DT,{b:true});assert.equal(m.players.filter(p=>p.team===0&&p.block>0).length,2);
});
test('long CPU match has receptions, sets, attacks, blocks, points and no invalid state',()=>{
  const m=new Match({...DEFAULTS,targetScore:5},1991);m.reset('demo');
  const kinds=new Set();let pointCount=0;
  for(let i=0;i<120*600&&m.phase!=='finished';i++){
    m.tick(FIXED_DT);
    assert.ok(Number.isFinite(m.ball.x)&&Number.isFinite(m.ball.y));
    assert.ok(m.players.every(p=>Number.isFinite(p.x)&&p.y>=0));
    for(const e of m.events.splice(0)){if(e.kind)kinds.add(e.kind);if(e.type==='point')pointCount++;}
  }
  for(const kind of ['receive','set','normal','open','quick'])assert.ok(kinds.has(kind),kind);
  assert.ok(m.stats.blocks[0]+m.stats.blocks[1]>0);assert.ok(pointCount>10);assert.equal(m.phase,'finished');
});
test('seeded fixed-step simulation is reproducible',()=>{
  const a=new Match(DEFAULTS,42),b=new Match(DEFAULTS,42);a.reset('demo');b.reset('demo');
  for(let i=0;i<3600;i++){a.tick(FIXED_DT);b.tick(FIXED_DT);}assert.deepEqual(a.ball,b.ball);assert.deepEqual(a.score,b.score);
});

// Exercise actual reception -> set -> attack contacts, not only the selector table.
for(const variant of ['normal','quick','open','delayed','back','dump','dink','super']){
  test(`human input completes the ${variant} combination`,()=>{
    const m=new Match();m.phase='receive';m.possession=0;m.lastTouch=1;m.server=1;
    m.ball={x:-6,y:3,z:4.5,vx:-1,vy:-2,vz:0,spin:0,angle:0};
    m.player(0,'receiver').x=-7;
    const hitEvents=[];
    for(let i=0;i<120*8&&!['point','set-end'].includes(m.phase);i++){
      let input={};
      if(m.possession===0){
        if(m.phase==='receive')input={a:true,up:['open','back','dump'].includes(variant),down:['quick','delayed'].includes(variant)};
        if(m.phase==='set')input={b:['delayed','back'].includes(variant),a:variant==='dump',axis:variant==='dump'?1:0};
        if(m.phase==='attack')input={a:true,up:variant==='dink',down:variant==='super',b:variant==='super'};
      }
      m.tick(FIXED_DT,input);
      for(const e of m.events.splice(0))if(e.type==='hit'&&e.team===0)hitEvents.push(e.kind);
      if(hitEvents.includes(variant))break;
    }
    assert.ok(hitEvents.includes('receive'),JSON.stringify(hitEvents));
    if(variant!=='dump')assert.ok(hitEvents.includes('set'),JSON.stringify(hitEvents));
    assert.ok(hitEvents.includes(variant),`${variant}: ${JSON.stringify(hitEvents)}`);
  });
}
