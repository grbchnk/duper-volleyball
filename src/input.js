// Physical key codes: Russian/English keyboard layouts have identical controls.
export class InputBuffer {
  constructor(){this.held=new Set();this.pressed=new Set();}
  down(code,repeat=false){this.held.add(code);if(!repeat)this.pressed.add(code);}
  up(code){this.held.delete(code);}
  clear(){this.held.clear();this.pressed.clear();}
  read(){
    const has=(...keys)=>keys.some(k=>this.held.has(k)||this.pressed.has(k));
    return{axis:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),up:has('KeyW','ArrowUp'),down:has('KeyS','ArrowDown'),low:has('KeyJ','KeyZ'),loft:has('KeyL','KeyC'),drive:has('KeyI','KeyV'),block:has('KeyK','KeyX'),jump:has('Space'),dive:has('ShiftLeft','ShiftRight'),switch:has('KeyQ')};
  }
  consume(){this.pressed.clear();}
}
export const GAME_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyL','KeyI','KeyK','KeyZ','KeyC','KeyV','KeyX','Space','ShiftLeft','ShiftRight','KeyQ'];
