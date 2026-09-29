export class Sound {
  constructor() { this.enabled = false; this.context = null; }
  async enable() {
    this.context ||= new (window.AudioContext || window.webkitAudioContext)();
    await this.context.resume(); this.enabled = true;
  }
  play(event) {
    if (!this.enabled || !this.context) return;
    const ctx = this.context, now = ctx.currentTime;
    const tone = (frequency, duration, delay = 0, type = 'triangle') => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type=type; o.frequency.setValueAtTime(frequency,now+delay);
      if (event.type === 'hit') o.frequency.exponentialRampToValueAtTime(frequency * .35,now+delay+duration);
      g.gain.setValueAtTime(0,now+delay);g.gain.linearRampToValueAtTime(.09,now+delay+.006);g.gain.exponentialRampToValueAtTime(.001,now+delay+duration);
      o.connect(g);g.connect(ctx.destination);o.start(now+delay);o.stop(now+delay+duration+.01);
      o.onended=()=>{o.disconnect();g.disconnect();};
    };
    if(event.type==='hit')tone({low:220,loft:560,drive:340}[event.kind]||390,event.kind==='drive'?.07:.12);
    if(event.type==='block')tone(170,.15,0,'square');
    if(event.type==='net')tone(90,.12);
    if(event.type==='point'){tone(740,.11);tone(990,.22,.13);}
    if(event.type==='serve-ready')tone(1100,.13);
  }
}
