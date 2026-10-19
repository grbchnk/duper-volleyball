import { ARENAS, drawArenaBackdrop } from './arenas.js';
import { MUSIC_TRACKS } from './music.js';
export function createAmbienceUI({ config, apply, sound }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'ambience-dialog';
  dialog.innerHTML = `<div class="dialog-top"><h2>Арены</h2><button class="close" aria-label="Закрыть">×</button></div><p>Выберите площадку для матча.</p><div class="arena-choices" role="group" aria-label="Выбор арены"></div>`;
  document.body.append(dialog);
  const audio = document.createElement('dialog');
  audio.id = 'audio-dialog';
  audio.innerHTML = `<div class="dialog-top"><h2>Звук</h2><button class="close" aria-label="Закрыть">×</button></div><section class="music-settings"><label for="music-track">Фоновая мелодия</label><select id="music-track"></select><label class="slider-label" for="music-volume">Громкость музыки <output id="music-volume-value"></output></label><input id="music-volume" type="range" min="0" max="100" step="1"><button id="music-listen" class="secondary">Включить / послушать</button></section>`;
  document.body.append(audio);
  const cards = [];
  const select = audio.querySelector('#music-track');
  const volume = audio.querySelector('#music-volume');
  const out = audio.querySelector('output');
  select.add(new Option('Без музыки', 'off'));
  for (const [id, track] of Object.entries(MUSIC_TRACKS)) select.add(new Option(track.name, id));
  select.onchange = async () => {
    apply({ ...config(), musicTrack: select.value });
    if (select.value !== 'off' && !sound.muted) await sound.enable().catch(() => {});
  };
  volume.oninput = () => apply({ ...config(), musicVolume: Number(volume.value) / 200 });
  audio.querySelector('#music-listen').onclick = async () => {
    await sound.enable();
    apply({
      ...config(),
      soundMuted: false,
      musicTrack: select.value === 'off' ? 'sunset' : select.value,
    });
  };
  function sync() {
    const value = config();
    if (dialog.open)
      cards.forEach(([id, b]) => b.setAttribute('aria-pressed', String(value.arenaTheme === id)));
    if (audio.open) {
      select.value = value.musicTrack;
      volume.value = String(Math.round(value.musicVolume * 200));
      out.textContent = volume.value + '%';
    }
  }
  return {
    sync,
    mount() {
      if (cards.length) return;
      for (const [id, arena] of Object.entries(ARENAS)) {
        const button = document.createElement('button');
        button.className = 'arena-choice';
        button.dataset.arena = id;
        button.setAttribute('aria-label', arena.name);
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 108;
        canvas.setAttribute('aria-hidden', 'true');
        const c = canvas.getContext('2d');
        c.scale(0.2, 0.2);
        drawArenaBackdrop(c, id);
        const label = document.createElement('strong');
        label.textContent = arena.name;
        const caption = document.createElement('small');
        caption.textContent = arena.subtitle;
        button.append(canvas, label, caption);
        button.onclick = () => apply({ ...config(), arenaTheme: id });
        dialog.querySelector('.arena-choices').append(button);
        cards.push([id, button]);
      }
    },
  };
}
