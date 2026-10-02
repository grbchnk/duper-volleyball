import test from 'node:test';
import assert from 'node:assert/strict';
import {InputBuffer} from '../src/input.js';

function controller(){
  return{connected:true,mapping:'standard',buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};
}

test('DualSense face buttons, shoulders, and d-pad map to game actions',()=>{
  const pad=controller(),input=new InputBuffer(()=>[pad]);
  pad.buttons[2].pressed=true;pad.buttons[3].pressed=true;pad.buttons[1].pressed=true;pad.buttons[5].pressed=true;pad.buttons[4].pressed=true;pad.buttons[12].pressed=true;
  input.poll();const state=input.read();
  assert.equal(state.low,true);assert.equal(state.loft,true);assert.equal(state.drive,true);assert.equal(state.block,true);assert.equal(state.switch,true);assert.equal(state.jump,true);
  pad.buttons[6].value=.8;input.poll();assert.equal(input.read().up,true);assert.equal(input.read().jump,false);
});

test('left stick uses a dead zone and analog movement is clamped',()=>{
  const pad=controller(),input=new InputBuffer(()=>[pad]);
  pad.axes[0]=.17;input.poll();assert.equal(input.read().axis,0);
  pad.axes[0]=.59;input.poll();assert.equal(input.read().axis,.5);
  pad.axes[0]=1;input.down('ArrowRight');input.poll();assert.equal(input.read().axis,1);
});

test('Options pauses on a new press and held actions clear until release',()=>{
  const pad=controller(),input=new InputBuffer(()=>[pad]);
  pad.buttons[9].pressed=true;pad.buttons[2].pressed=true;input.poll();
  assert.equal(input.read().pausePressed,true);assert.equal(input.read().low,true);
  input.poll();assert.equal(input.read().pausePressed,false);
  input.clear();assert.equal(input.read().low,false);
  pad.buttons[2].pressed=false;pad.buttons[9].pressed=false;input.poll();
  pad.buttons[2].pressed=true;input.poll();assert.equal(input.read().low,true);
});

test('Cross confirm is reported once for starting from the menu',()=>{
  const pad=controller(),input=new InputBuffer(()=>[pad]);
  pad.buttons[0].pressed=true;input.poll();assert.equal(input.read().confirmPressed,true);
  input.poll();assert.equal(input.read().confirmPressed,false);
});