import { Match } from './engine.js';
import { Renderer } from './renderer.js';
import { Sound } from './audio.js';
import { DEFAULTS, FIXED_DT, LIMITS, TEAMS, sanitizeConfig } from './config.js';

const $ = id => document.getElementById(id);
const storageKey = 'super-volleyball.reborn.config.v1';
let config = { ...DEFAULTS };
try { const saved = localStorage.getItem(storageKey); if (saved) config = sanitizeConfig(JSON.parse(saved)); } catch { /* Private windows can deny storage. */ }
const match = new Match(config), renderer = new Renderer($('game')), sound = new Sound();
let teams = [TEAMS[0], TEAMS[1]], started = false, paused = false, modalWasPaused = false;
let accumulator = 0, previousTime = performance.now(), lastUI = 0, toastTimer;
const held = new Set();
// Latch short key presses until one simulation tick; fast taps must not vanish
// between animation frames (particularly on high-refresh laptop displays).
const pressed = new Set();
const movement = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const actions = ['KeyJ','KeyK','KeyZ','KeyX','Space'];
const has = (...codes) => codes.some(code => held.has(code) || pressed.has(code));
function readInput() {
  return { axis: Number(has('KeyD','ArrowRight')) - Number(has('KeyA','ArrowLeft')),
    up: has('KeyW','ArrowUp'), down: has('KeyS','ArrowDown'),
    a: has('KeyJ','KeyZ','Space'), b: has('KeyK','KeyX','Space') };
}
const editable = target => target?.matches('input,select,textarea,[contenteditable]');
const modalOpen = () => !!document.querySelector('dialog[open]');
window.addEventListener('keydown', e => {
  if (editable(e.target) || modalOpen()) return;
  if (e.code === 'Enter' || e.code === 'Escape') {
    if (e.target?.closest('button,a')) return;
    e.preventDefault(); if (!e.repeat) { if (!started) startGame(); else togglePause(); } return;
  }
  if ([...movement,...actions].includes(e.code)) {
    if (e.target?.closest('button,a')) return;
    e.preventDefault(); held.add(e.code); if (!e.repeat) pressed.add(e.code);
  }
});
window.addEventListener('keyup', e => held.delete(e.code));
window.addEventListener('blur', () => { held.clear(); pressed.clear(); if (started && !paused && !modalOpen()) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); pressed.clear(); if (started) setPaused(true); } });
function toast(message) { $('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000); }
function persist() { try { localStorage.setItem(storageKey,JSON.stringify(config)); } catch { /* Play remains available without persistence. */ } }
function applyConfig(next) { config=sanitizeConfig(next); match.updateConfig(config); syncSettings(); persist(); }
function syncSettings() {
  $('speed').value=config.gameSpeed; $('speed-value').textContent=config.gameSpeed.toFixed(2)+'×';
  $('assist').checked=config.assist; $('trajectory').checked=config.trajectory;
  $('difficulty').value=config.difficulty; $('scoring').value=config.scoring;
  for (const [key] of Object.entries(physicsFields)) {
    const el=$('physics-'+key); if (el) { el.value=config[key]; $('value-'+key).textContent=formatPhysics(key,config[key]); }
  }
}
function setPaused(value) {
  paused=value; held.clear(); pressed.clear(); accumulator=0;
  $('pause-overlay').hidden=!value || !started || match.phase==='finished' || modalOpen();
  $('pause').textContent=value?'▶':'Ⅱ'; $('pause').setAttribute('aria-label',value?'Продолжить':'Пауза');
}
function togglePause() { if (started && match.phase!=='finished') setPaused(!paused); }
function startGame(mode='match') {
  teams = [TEAMS.find(t=>t.id===$('home-team').value),TEAMS.find(t=>t.id===$('away-team').value)];
  match.reset(mode); renderer.camera=-2.5; started=true; setPaused(false);
  $('start-overlay').hidden=true; $('finish-overlay').hidden=true;
  $('match-mode').classList.toggle('active',mode==='match'); $('demo-mode').classList.toggle('active',mode==='demo');
  $('game').focus({preventScroll:true}); updateUI();
}
function updateUI() {
  $('rule-label').textContent=`ДО ${config.targetScore} · BEST OF 5`;
  let phase=match.phase;
  const theirBall=match.possession===1 || (['serve','toss'].includes(phase) && match.server===1);
  let title='Ваша подача',hint='J — подбросить мяч. Ещё раз J, когда мяч станет красным.',key='J';
  if (match.mode==='demo') {title='Смотрите розыгрыш';hint='Обе команды управляются компьютером. Перейдите в «Матч», чтобы сыграть.';key='▶';}
  else if (['point','set-end'].includes(phase)) {title=match.notice;hint=`${match.pointReason}. Следующая подача: ${teams[match.server].name}.`;key='·';}
  else if (phase==='finished') { title='Матч завершён'; hint='Сыграйте ещё раз или измените параметры физики.'; key='✓'; }
  else if (theirBall) {title='Защита';hint=phase==='serve'||phase==='toss'?'Готовьтесь к приёму. J на красном мяче.':'K — двойной блок. После перелёта мяча — J для приёма.';key='K';}
  else if (phase==='toss') {title=match.contactWindow?'Ударьте сейчас!':'Ловите момент';hint='Ещё раз J, когда мяч покраснеет. Слишком ранний удар меняет траекторию.';}
  else if (phase==='receive') {title='Приём мяча';hint='J — обычная атака. S + J — быстрая. W + J — открытая. A / D — позиция.';}
  else if (phase==='set') {title='Пас связующего';hint='Пас автоматический. K меняет быструю атаку на задержанную, открытую — на атаку из глубины.';key='K';}
  else if (phase==='attack') {title=match.contactWindow?'Ударьте сейчас!':'Готовьтесь к удару';hint='J — удар. W + J — скидка. S + Space — силовой. A / D — ближняя / дальняя цель.';}
  $('action-title').textContent=title;$('action-hint').textContent=hint;$('action-key').textContent=key;
  document.querySelectorAll('[data-phase]').forEach(el=>el.classList.toggle('current',el.dataset.phase===(phase==='toss'?'serve':phase)));
  const score=`${teams[0].short} ${match.score[0]} : ${match.score[1]} ${teams[1].short}`;
  $('status').textContent=!started?'Готовы к первой подаче':paused?'Матч приостановлен':`${score} · ${match.mode==='demo'?'Демонстрация':title}`;
  $('game').setAttribute('aria-label',`${score}. Сеты ${match.sets.join(' : ')}. ${title}. ${hint}`);
  $('game').dataset.phase=match.phase;
  if (match.phase==='finished') {
    $('finish-overlay').hidden=false;
    const winner=match.sets[0]>match.sets[1]?0:1;
    $('winner-label').textContent=winner===0&&match.mode==='match'?'ПОБЕДА!':'МАТЧ ЗАВЕРШЁН';
    $('final-score').textContent=match.sets.join(' : ');
    $('final-detail').textContent=`${teams[winner].name} · ${match.rallies} розыгрышей`;
  }
}
function frame(time) {
  const elapsed=Math.min(.1,(time-previousTime)/1000); previousTime=time;
  if (started && !paused && !modalOpen()) {
    accumulator+=elapsed*config.gameSpeed;
    while(accumulator>=FIXED_DT) {
      match.tick(FIXED_DT,readInput());pressed.clear();accumulator-=FIXED_DT;
      for(const event of match.events.splice(0)){renderer.effect(event,match);sound.play(event);}
    }
  }
  renderer.draw(match,teams,paused?0:elapsed);
  if(time-lastUI>80){updateUI();lastUI=time;}
  requestAnimationFrame(frame);
}
for (const id of ['home-team','away-team']) for (const team of TEAMS) {
  const option=document.createElement('option');option.value=team.id;option.textContent=`${team.short}  /  ${team.name}`;$(id).append(option);
}
$('home-team').value=teams[0].id;$('away-team').value=teams[1].id;
$('start').onclick=()=>startGame();$('new-match').onclick=()=>startGame();$('rematch').onclick=()=>startGame();
$('match-mode').onclick=()=>{if(match.mode!=='match')startGame('match');};$('demo-mode').onclick=()=>startGame('demo');
$('pause').onclick=()=>{togglePause();$('game').focus({preventScroll:true});};$('resume').onclick=()=>{setPaused(false);$('game').focus({preventScroll:true});};
$('sound').onclick=async()=>{
  try{if(sound.enabled)sound.enabled=false;else await sound.enable();$('sound').innerHTML=`♪ <span>Звук ${sound.enabled?'вкл.':'выкл.'}</span>`;$('sound').setAttribute('aria-label',sound.enabled?'Выключить звук':'Включить звук');}
  catch{toast('Браузер не разрешил звук. Попробуйте ещё раз.');}
  $('game').focus({preventScroll:true});
};
$('fullscreen').onclick=async()=>{
  try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arena').requestFullscreen();}catch{toast('Полный экран недоступен в этом окне. Откройте игру в обычном браузере.');}
  $('game').focus({preventScroll:true});
};
function openDialog(id){modalWasPaused=paused;held.clear();pressed.clear();$(id).showModal();$('pause-overlay').hidden=true;}
$('help-button').onclick=$('combos-button').onclick=()=>openDialog('help-dialog');
$('physics-button').onclick=()=>openDialog('physics-dialog');
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('.close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{held.clear();setPaused(modalWasPaused);$('game').focus({preventScroll:true});});
});
$('speed').addEventListener('input',e=>applyConfig({...config,gameSpeed:Number(e.target.value)}));
for(const key of ['assist','trajectory'])$(key).onchange=e=>applyConfig({...config,[key]:e.target.checked});
$('difficulty').onchange=e=>applyConfig({...config,difficulty:e.target.value});
$('scoring').onchange=e=>applyConfig({...config,scoring:e.target.value});

const moveRows=[
  ['Обычная подача','J → J','Подброс → красный мяч'],
  ['Нижняя подача','W + J → J','Направление при подбросе'],
  ['Подача в прыжке','D + J → J','Направление к сетке при подбросе'],
  ['Верхняя подача','A + J → J','Направление от сетки при подбросе'],
  ['Приём / обычная атака','J → J','Приём → красный мяч у нападающего'],
  ['Быстрая атака','S + J → J','Низкий быстрый пас'],
  ['Атака с задержкой','S + J → K → J','K до касания связующего'],
  ['Открытая атака','W + J → J','Высокий пас открытому нападающему'],
  ['Атака из глубины','W + J → K → J','K до касания связующего'],
  ['Скидка со второго','W + J → D + J','Направление к сетке перед пасом'],
  ['Обманный удар','W + J','На красном мяче в атаке'],
  ['Силовой удар *','S + Space','В атаке; Space = J + K'],
  ['Высокая спецподача','W + Space → W + Space','На подбросе и красном мяче; 1 спецподача за сет'],
  ['Силовая спецподача *','W + Space → S + Space','На подбросе и красном мяче; общий лимит спецподач'],
  ['Двойной блок','K','Поймайте момент атаки соперника'],
  ['Пауза / продолжить','Enter / Esc','Во время матча'],
];
for(const row of moveRows){const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('moves-table').append(tr);}
const note=document.createElement('p');note.className='dialog-note';note.textContent='* Силовые приёмы описаны в дополнительных источниках. Их траектории и общий лимит спецподач здесь — приближения; побочный эффект сбивания защитника пока отсутствует.';$('moves-table').closest('.table-wrap').after(note);
const physicsFields={gravity:['Гравитация',.01,'м/с²'],drag:['Сопротивление воздуха',.005,''],restitution:['Упругость сетки',.01,''],playerSpeed:['Скорость перемещения',.1,'м/с'],jumpSpeed:['Импульс прыжка',.1,'м/с'],hitPower:['Сила ударов',.05,'×']};
function formatPhysics(key,value){return value.toFixed(key==='drag'?3:2)+' '+physicsFields[key][2];}
for(const [key,[label,step]] of Object.entries(physicsFields)){
  const div=document.createElement('div');const lab=document.createElement('label');lab.className='slider-label';lab.htmlFor='physics-'+key;lab.append(document.createTextNode(label));
  const output=document.createElement('output');output.id='value-'+key;lab.append(output);
  const input=document.createElement('input');input.type='range';input.id='physics-'+key;input.min=LIMITS[key][0];input.max=LIMITS[key][1];input.step=step;
  input.oninput=()=>applyConfig({...config,[key]:Number(input.value)});div.append(lab,input);$('physics-controls').append(div);
}
$('reset-physics').onclick=()=>{applyConfig(DEFAULTS);$('config-message').textContent='Исходные параметры восстановлены.';};
$('export-config').onclick=()=>{
  const data={version:1,config};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='super-volleyball-physics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('config-message').textContent='Настройки подготовлены к скачиванию.';
};
$('import-config').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>50000)throw new Error('Файл слишком большой');const data=JSON.parse(await file.text());
    if(data.version!==undefined&&data.version!==1)throw new Error('Версия файла не поддерживается');
    const candidate=data.config??data;if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||!Object.keys(DEFAULTS).some(k=>k in candidate))throw new Error('В файле нет настроек игры');
    applyConfig(candidate);$('config-message').textContent='Настройки загружены. Значения проверены по допустимым диапазонам.';
  }catch(err){$('config-message').textContent='Не удалось загрузить: '+err.message;}e.target.value='';
};
syncSettings();updateUI();requestAnimationFrame(frame);
