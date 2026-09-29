import {SKINS} from './sprites.js';
import { Match, EMPTY_INPUT } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { DEFAULTS, FIXED_DT, LIMITS, TEAMS, sanitizeConfig } from './config.js';
import { InputBuffer, GAME_KEYS } from './input.js';
import { GUIDE_HTML } from './guide.js';
import { SHOTS } from './moves.js';
import { createArmLab } from './arm-lab.js';
const $=id=>document.getElementById(id),storageKey='super-volley-club.config.v2';
let config={...DEFAULTS};try{const data=localStorage.getItem(storageKey);if(data)config=sanitizeConfig(JSON.parse(data));}catch{}
const match=new Match(config),renderer=new Renderer($('game')),sound=new Sound(),input=new InputBuffer();
let teams=[TEAMS[0],TEAMS[1]],started=false,paused=false,modalWasPaused=false,accumulator=0,previousTime=performance.now(),lastUI=0,toastTimer;
const modalOpen=()=>!!document.querySelector('dialog[open]');
function clearActions(){input.clear();match.charge=null;match.pending=null;match.aimPreview=null;match.previousInput={...EMPTY_INPUT};}
window.addEventListener('keydown',e=>{
  if(e.target?.matches('input,select,textarea,[contenteditable]')||modalOpen())return;
  if(e.code==='KeyR'&&started&&match.mode==='practice'&&!e.target?.closest('button,a')){e.preventDefault();if(!e.repeat)repeatDrill();return;}
  if(e.code==='Enter'||e.code==='Escape'){
    if(e.target?.closest('button,a'))return;e.preventDefault();if(!e.repeat){if(!started)startGame();else togglePause();}return;
  }
  if(GAME_KEYS.includes(e.code)){if(e.target?.closest('button,a'))return;e.preventDefault();if(started&&!paused)input.down(e.code,e.repeat);}
});
window.addEventListener('keyup',e=>input.up(e.code));
window.addEventListener('blur',()=>{clearActions();if(started&&!paused&&!modalOpen())setPaused(true);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearActions();if(started)setPaused(true);}});
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(config));}catch{}}
function applyConfig(next){config=sanitizeConfig(next);match.updateConfig(config);syncSettings();persist();}
const physicsFields={
 gravity:['Гравитация',.01,'м/с²','Мяч и игроки'],drag:['Сопротивление воздуха',.001,'','Мяч и игроки'],restitution:['Упругость сетки',.01,'','Мяч и игроки'],playerSpeed:['Скорость бега',.1,'м/с','Мяч и игроки'],jumpSpeed:['Высота прыжка: импульс',.1,'м/с','Мяч и игроки'],hitPower:['Сила контакта',.05,'×','Мяч и игроки'],
 releaseWindow:['Допуск после отпускания',.01,'с','Точность и замах','0 — строго в момент отпускания. Больше — проще попасть по мячу.'],chargeSeconds:['Время набора силы',.01,'с','Точность и замах'],maxHold:['Предельное удержание',.01,'с','Точность и замах','После лимита замах отменяется. Не меньше времени полного заряда + 0.05 с.'],chargeMove:['Бег при подготовке',.05,'×','Точность и замах'],
 jumpWindup:['Приседание до отталкивания',.005,'с','Фазы прыжка'],jumpRise:['Длительность подъёма',.01,'×','Фазы прыжка'],jumpHang:['Пауза на вершине',.005,'с','Фазы прыжка'],jumpFall:['Длительность падения',.01,'×','Фазы прыжка'],
 blockWindow:['Рабочее окно блока',.01,'с','Блок','Только возле вершины прыжка. В середине окна блок сильнее, по краям — смягчение.'],blockReach:['Досягаемость рук блока',.01,'м','Блок'],blockCooldown:['Восстановление блока',.05,'с','Блок'],blockDeflect:['Скорость отскока от блока',.05,'×','Блок'],
 armScale:['Размер рук',.05,'×','Внешний вид рук','Меняет позу и толщину, но не игровые зоны контакта.'],armSpring:['Упругость кистей',.05,'×','Внешний вид рук'],armBend:['Выраженность локтей',.05,'×','Внешний вид рук'],armWindup:['Быстрая подготовка',.005,'с','Анимация рук','Только движение рук. Не добавляет задержку к игровому касанию.'],armPowerMotion:['Влияние силы на замах',.05,'×','Анимация рук'],armJumpMotion:['Взмах рук в прыжке',.05,'×','Анимация рук'],diveSpeed:['Скорость броска',.1,'м/с','Бросок за мячом'],diveLift:['Высота броска: импульс',.1,'м/с','Бросок за мячом'],diveRecovery:['Подъём после падения',.01,'с','Бросок за мячом'],divePower:['Сила приёма в броске',.01,'×','Бросок за мячом'],targetScore:['Очков до победы в сете',1,'','Счёт'],
};
const drawArmLab=createArmLab($('arms-dialog'),()=>config);
function formatPhysics(key,value){return value.toFixed(key==='targetScore'?0:physicsFields[key][1]<.01?3:2)+' '+physicsFields[key][2];}
function syncSettings(){
  $('preview-skin').value=config.skin;
  document.querySelectorAll('[data-skin]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.skin===config.skin)));
  $('speed').value=config.gameSpeed;$('speed-value').textContent=config.gameSpeed.toFixed(2)+'×';$('assist').checked=config.assist;$('trajectory').checked=config.trajectory;$('difficulty').value=config.difficulty;$('scoring').value=config.scoring;
  for(const key of Object.keys(physicsFields)){const el=$('physics-'+key);if(el){el.value=config[key];$('value-'+key).textContent=formatPhysics(key,config[key]);}}
}
function setPaused(value){paused=value;clearActions();accumulator=0;$('pause-overlay').hidden=!value||!started||match.phase==='finished'||modalOpen();$('pause').textContent=value?'▶':'Ⅱ';$('pause').setAttribute('aria-label',value?'Продолжить':'Пауза');}
function togglePause(){if(started&&match.phase!=='finished')setPaused(!paused);}
function startGame(mode='match'){
  teams=[TEAMS.find(t=>t.id===$('home-team').value),TEAMS.find(t=>t.id===$('away-team').value)];match.reset(mode);if(mode==='practice')match.startDrill($('drill').value);
  started=true;setPaused(false);$('start-overlay').hidden=true;$('finish-overlay').hidden=true;$('practice-panel').hidden=mode!=='practice';
  for(const key of ['match','practice','demo'])$(key+'-mode').classList.toggle('active',mode===key);
  document.querySelector('.game-column').scrollIntoView({block:'start'});$('game').focus({preventScroll:true});updateUI();
}
function updateUI(){
  const phase=match.teamPhases[0],action=match.charge||match.pending,percent=Math.round((action?.power||0)*100);
  $('phase-pill').textContent=match.phase==='serve'||match.phase==='serve-motion'?'ПОДАЧА':phase==='attack'?'АТАКА':'ЗАЩИТА';$('phase-pill').classList.toggle('defense',phase==='defense');
  $('charge-label').textContent=match.charge?`${SHOTS[match.charge.kind].name} · до срыва ${Math.max(0,config.maxHold-match.charge.age).toFixed(2)} с`:match.pending?'Короткий допуск…':match.chargeLock?'Отпусти кнопку для нового приёма':'Зажмите A, W или D';
  $('charge-value').textContent=percent+'%';$('power-fill').style.width=percent+'%';$('power-fill').style.background=percent>88?'#d78e76':'#88a481';
  $('touch-count').textContent=match.touches[0]+' / 3';$('rule-label').textContent=`ТЕМП ${config.gameSpeed.toFixed(2)}×`;
  let title='Выбери подачу',hint='A — снизу, W — планирующая, D — в прыжке. Начните с 45–55% силы, затем отпустите.',key='A';
  if(match.mode==='demo'){title='Смотрим и учимся';hint='Здесь обе команды играют сами. В «Матче» вы командуете каждым приёмом, в том числе броском за мячом.';key='▶';}
  else if(['point','set-end'].includes(match.phase)){title=match.notice;hint=match.mode==='practice'?'Сейчас повторим упражнение. Кнопка «Повторить мяч» запускает его сразу.':match.pointReason;key='✿';}
  else if(match.phase==='finished'){title='Какой матч!';hint='Попробуйте новую комбинацию или измените характер физики.';key='✿';}
  else if(match.active(0).recovery>0){title='Поднимаемся';hint='После нырка игроку нужно встать. Tab — выбрать другого свободного игрока.';key='Tab';}
  else if(match.active().diving){title=match.active().diveArmed?'Руки готовы к приёму':'Приём выполнен';hint='Направление броска зафиксировано. Мяч должен попасть в предплечья; A нажимать не нужно.';key='↓';}
  else if(match.charge){title=match.contactWindow?'Отпусти сейчас!':SHOTS[match.charge.kind].name;hint='←/→ — бег и направление, Shift + ↑/↓ — выше/ниже. Отпустите у мяча; руки уже готовы.';key=SHOTS[match.charge.kind].key;}
  else if(match.phase==='rally'&&phase==='defense'){title='Сохрани мяч';hint='A — снизу. W — сверху. D — удар. S — один блокирующий. ↑ — прыжок, ↓ + ←/→ — бросок с приёмом.';key='A';}
  else if(match.phase==='rally'){title='Построй атаку';hint='3 выбирает нападающего у сетки. Затем ↑, короткий заряд D и отпускание у мяча. 1/2/3 — выбор игроков.';key='3';}
  else if(match.phase==='serve-motion'){title='Подаём!';hint='Контакт разрешён вашим отпусканием. Дальше подающий сам за мячом не побежит.';key='↗';}
  $('action-title').textContent=title;$('action-hint').textContent=hint;$('action-key').textContent=key;$('assist-status').textContent=match.assistLabel;
  document.querySelectorAll('[data-phase]').forEach(el=>el.classList.toggle('current',el.dataset.phase===phase));
  const score=`${teams[0].short} ${match.score[0]} : ${match.score[1]} ${teams[1].short}`;
  $('status').textContent=!started?'Ваш первый розыгрыш уже ждёт':paused?'Маленькая пауза':`${score} · ${title}`;
  $('game').setAttribute('aria-label',`${score}. ${title}. ${hint}`);$('game').dataset.phase=match.phase;$('game').dataset.contacts=match.contacts;$('game').dataset.charge=percent;
  if(match.phase==='finished'){$('finish-overlay').hidden=false;const winner=match.sets[0]>match.sets[1]?0:1;$('winner-label').textContent=winner===0?'ПОБЕДА!':'ОТЛИЧНАЯ ИГРА';$('final-score').textContent=match.sets.join(' : ');$('final-detail').textContent=`${teams[winner].name} · ${match.rallies} розыгрышей`;}
}
function frame(time){
  const elapsed=Math.min(.1,(time-previousTime)/1000);previousTime=time;
  if(started&&!paused&&!modalOpen()){accumulator+=elapsed*config.gameSpeed;while(accumulator>=FIXED_DT){match.tick(FIXED_DT,input.read());input.consume();accumulator-=FIXED_DT;for(const event of match.events.splice(0)){renderer.effect(event,match);sound.play(event);}}}
  renderer.draw(match,teams,paused||modalOpen()?0:elapsed);drawArmLab(elapsed);if(time-lastUI>65){updateUI();lastUI=time;}requestAnimationFrame(frame);
}
for(const id of ['home-team','away-team'])for(const team of TEAMS){const option=document.createElement('option');option.value=team.id;option.textContent=team.name;$(id).append(option);}
for(const [id,spec] of Object.entries(SKINS)){
  const button=document.createElement('button');button.className='skin-choice';button.dataset.skin=id;button.title=spec.description;
  const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;canvas.setAttribute('aria-hidden','true');
  const previewMatch=new Match({...config,skin:id});previewMatch.selected[0]=-1;previewMatch.time=0;
  const previewRenderer=new Renderer(canvas);previewRenderer.spriteScale=1.9;previewRenderer.project=()=>({x:50,y:90});previewRenderer.ctx.fillStyle='#f5f6ed';previewRenderer.ctx.fillRect(0,0,100,100);previewRenderer.drawPlayer(previewMatch.players[0],TEAMS[0],previewMatch,0);
  const label=document.createElement('span');label.textContent=spec.name;button.append(canvas,label);button.onclick=()=>applyConfig({...config,skin:id});$('skin-cards').append(button);
  const option=document.createElement('option');option.value=id;option.textContent=spec.name;$('preview-skin').append(option);
}
$('preview-skin').onchange=e=>applyConfig({...config,skin:e.target.value});
$('home-team').value=teams[0].id;$('away-team').value=teams[1].id;
$('arms-button').onclick=()=>openDialog('arms-dialog');
$('start').onclick=$('new-match').onclick=$('rematch').onclick=()=>startGame();
for(const mode of ['match','practice','demo'])$(mode+'-mode').onclick=()=>startGame(mode);
function repeatDrill(){clearActions();match.startDrill($('drill').value);setPaused(false);$('game').focus({preventScroll:true});}
$('drill').onchange=$('repeat-drill').onclick=repeatDrill;
$('pause').onclick=()=>{togglePause();$('game').focus({preventScroll:true});};$('resume').onclick=()=>{setPaused(false);$('game').focus({preventScroll:true});};
$('sound').onclick=async()=>{try{if(sound.enabled)sound.enabled=false;else await sound.enable();$('sound').textContent=sound.enabled?'♫':'♪';$('sound').setAttribute('aria-label',sound.enabled?'Выключить звук':'Включить звук');}catch{toast('Звук недоступен в этом окне браузера.');}$('game').focus({preventScroll:true});};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arena').requestFullscreen();}catch{toast('Откройте игру в обычном браузере для полного экрана.');}$('game').focus({preventScroll:true});};
function openDialog(id){modalWasPaused=paused;clearActions();$(id).showModal();$('pause-overlay').hidden=true;}
$('help-button').onclick=$('combos-button').onclick=()=>openDialog('help-dialog');$('physics-button').onclick=()=>openDialog('physics-dialog');$('guide-content').innerHTML=GUIDE_HTML;
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{setPaused(modalWasPaused);$('game').focus({preventScroll:true});});}
$('speed').oninput=e=>applyConfig({...config,gameSpeed:Number(e.target.value)});
for(const key of ['assist','trajectory'])$(key).onchange=e=>applyConfig({...config,[key]:e.target.checked});
$('difficulty').onchange=e=>applyConfig({...config,difficulty:e.target.value});$('scoring').onchange=e=>applyConfig({...config,scoring:e.target.value});
let lastPhysicsGroup;
for(const [key,[label,step,,group,hint]]of Object.entries(physicsFields)){if(group!==lastPhysicsGroup){const heading=document.createElement('h3');heading.className='physics-group';heading.textContent=group;$('physics-controls').append(heading);lastPhysicsGroup=group;}const div=document.createElement('div'),lab=document.createElement('label');lab.className='slider-label';lab.htmlFor='physics-'+key;lab.append(document.createTextNode(label));const out=document.createElement('output');out.id='value-'+key;lab.append(out);const slider=document.createElement('input');slider.type='range';slider.id='physics-'+key;slider.min=LIMITS[key][0];slider.max=LIMITS[key][1];slider.step=step;slider.oninput=()=>applyConfig({...config,[key]:Number(slider.value)});div.append(lab,slider);if(hint){const note=document.createElement('small');note.textContent=hint;div.append(note);}$('physics-controls').append(div);}
$('reset-physics').onclick=()=>{applyConfig(DEFAULTS);$('config-message').textContent='Уютный темп и базовая физика восстановлены.';};
$('export-config').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:2,config},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='volley-club-v2.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('config-message').textContent='Настройки готовы к скачиванию.';};
$('import-config').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>50000)throw new Error('слишком большой файл');const data=JSON.parse(await file.text());if(data.version!==undefined&&data.version!==2)throw new Error('нужны настройки версии 02');const candidate=data.config??data;if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||!Object.keys(DEFAULTS).some(k=>k in candidate))throw new Error('в файле нет настроек');applyConfig(candidate);$('config-message').textContent='Настройки загружены и проверены.';}catch(err){$('config-message').textContent='Не удалось загрузить: '+err.message;}e.target.value='';};
syncSettings();updateUI();requestAnimationFrame(frame);
if(new URLSearchParams(location.search).get('view')==='arms')openDialog('arms-dialog');
