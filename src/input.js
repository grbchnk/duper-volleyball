// Physical key codes: Russian/English keyboard layouts have identical controls.
export class InputBuffer {
  constructor(){this.held=new Set();this.pressed=new Set();}
  down(code,repeat=false){this.held.add(code);if(!repeat)this.pressed.add(code);}
  up(code){this.held.delete(code);}
  clear(){this.held.clear();this.pressed.clear();}
  read(){
    const has=(...keys)=>keys.some(k=>this.held.has(k)||this.pressed.has(k));
    const modifier=has('ShiftLeft','ShiftRight');
    return{axis:Number(has('ArrowRight'))-Number(has('ArrowLeft')),up:modifier&&has('ArrowUp'),down:modifier&&has('ArrowDown'),low:has('KeyA'),loft:has('KeyW'),drive:has('KeyD'),block:has('KeyS'),jump:has('Space')||(!modifier&&has('ArrowUp')),dive:!modifier&&has('ArrowDown'),switch:has('Tab','KeyQ'),select:has('Digit3','KeyE')?3:has('Digit2')?2:has('Digit1')?1:0};
  }
  consume(){this.pressed.clear();}
}
export const GAME_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','Tab','KeyQ','Digit1','Digit2','Digit3','KeyE'];
