// Original short chiptune cues: pulse/triangle oscillators and stepped noise.
export function soundCue(event){
 const p=Math.max(0,Math.min(1,event.power??.5)),gain=.07+p*.055;
 const note=(frequency,duration,delay=0,type='square',end=frequency,volume=gain)=>({frequency,duration,delay,type,end,volume});
 if(event.type==='hit'){
  const cue=event.kind==='loft'
   ?[note(520+p*240,.065,0,'triangle',880+p*260),note(1040+p*480,.055,.018,'square',780,.025+p*.025)]
   :event.kind==='low'
    ?[note(190+p*90,.085,0,'triangle',90),note(650,.025,0,'noise',200,.025+p*.035)]
    :[note(340+p*240,.065,0,'square',75),note(1800,.045,0,'noise',200,.035+p*.05)];
  if(event.serve)cue.push(note(880,.04,.06,'triangle',440,.035));
  return cue;
 }
 if(event.type==='block')return [note(240,.09,0,'square',110),note(1000,.035,0,'noise',300,.05)];
 if(event.type==='net')return [note(85,.11,0,'triangle',45,.07)];
 if(event.type==='jump')return [note(150,.055,0,'square',310,.025)];
 if(event.type==='toss'||event.type==='feed')return [note(660,.035,0,'triangle',880,.035)];
 if(event.type==='test-miss')return [note(120,.05,0,'triangle',70,.035)];
 if(event.type==='serve-ready')return [note(660,.06,0,'square',660,.04),note(880,.07,.08,'square',880,.04)];
 if(event.type==='point')return (event.winner===0?[523,659,784]:[392,330,262]).map((f,i)=>note(f,.09+i*.025,i*.095,'square',f,.055));
 return [];
}
export class Sound {
 constructor(){this.enabled=false;this.muted=false;this.context=null;this.master=null;}
 async enable(){
  this.context ||= new (window.AudioContext||window.webkitAudioContext)();
  if(!this.master){this.master=this.context.createGain();this.master.gain.value=.55;this.master.connect(this.context.destination);}
  await this.context.resume();this.enabled=true;this.muted=false;this.master.gain.setValueAtTime(.55,this.context.currentTime);
 }
 disable(){this.enabled=false;this.muted=true;if(this.master)this.master.gain.setValueAtTime(0,this.context.currentTime);}
 play(event){
  if(!this.enabled||!this.context)return;
  const ctx=this.context,now=ctx.currentTime;
  for(const n of soundCue(event)){
   const start=now+n.delay,g=ctx.createGain();let source;
   if(n.type==='noise'){
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*n.duration),ctx.sampleRate),data=buffer.getChannelData(0);
    let seed=731,value=0;
    for(let i=0;i<data.length;i++){if(i%8===0){seed=(Math.imul(seed,1664525)+1013904223)>>>0;value=seed/2147483648-1;}data[i]=value;}
    source=ctx.createBufferSource();source.buffer=buffer;
   }else{
    source=ctx.createOscillator();source.type=n.type;source.frequency.setValueAtTime(n.frequency,start);
    // Discrete pitch steps give the descending attacks a small 8-bit crunch.
    for(let i=1;i<=5;i++)source.frequency.setValueAtTime(n.frequency*(n.end/n.frequency)**(i/5),start+n.duration*i/5);
   }
   g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(n.volume,start+.003);
   g.gain.exponentialRampToValueAtTime(.0001,start+n.duration);
   source.connect(g);g.connect(this.master);source.start(start);source.stop(start+n.duration+.01);
   source.onended=()=>{source.disconnect();g.disconnect();};
  }
 }
}
