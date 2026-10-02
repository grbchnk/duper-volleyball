// Cosmetic reactions never consume the gameplay random generator.
export const EMOTIONS = {
 shrug:'Пожатие плечами',sad:'Огорчение',shake:'Качает головой',
 cheer:'Радость',fist:'Победный кулак',clap:'Аплодисменты',
};
export const WIN_EMOTIONS=['cheer','fist','clap'];
export const LOSE_EMOTIONS=['shrug','sad','shake'];
export function activeEmotion(p){
 return p.emotion&&p.emotion.age>=0&&!p.jumpProfile&&!p.diving&&p.recovery<=0?p.emotion:null;
}
export function emotionArms(emotion,base){
 const t=emotion.age,fade=Math.min(1,t/.18,Math.max(0,(emotion.duration-t)/.25));
 const wave=Math.sin(t*12);
 const poses={
  shrug:base,
  sad:[{x:-9,y:-9},{x:10,y:-9}],
  shake:[{x:-9,y:-12},{x:10,y:-12}],
  cheer:[{x:-12,y:-39-wave*2},{x:13,y:-39+wave*2}],
  fist:[{x:-9,y:-12},{x:9,y:-33-wave*3}],
  clap:[{x:-2-Math.abs(wave)*6,y:-25},{x:2+Math.abs(wave)*6,y:-25}],
 };
 return base.map((p,i)=>({x:p.x+(poses[emotion.kind][i].x-p.x)*fade,y:p.y+(poses[emotion.kind][i].y-p.y)*fade}));
}
