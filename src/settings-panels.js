// One layout and one navigation registry for every settings surface.
export const SETTINGS_PANELS = [
  ['Настройки', 'match-settings-dialog', 'Матч и управление'],
  ['Настройки', 'physics-dialog', 'Физика и помощь'],
  ['Настройки', 'shots-dialog', 'Приёмы и подачи'],
  ['Настройки', 'audio-dialog', 'Звук'],
  ['Настройки', 'settings-dialog', 'Сохранить / загрузить'],
  ['Внешний вид', 'team-dialog', 'Моя команда'],
  ['Внешний вид', 'graphics-dialog', 'Мяч и графика'],
  ['Внешний вид', 'appearance-dialog', 'Руки и анимация'],
  ['Внешний вид', 'ambience-dialog', 'Арены'],
  ['Лаборатория', 'arms-dialog', 'Просмотр движений'],
  ['Обучение', 'help-dialog', 'Управление и обучение'],
];

export function mountSettingsPanel(dialog, open, close) {
  if (dialog.dataset.panelMounted) return;
  dialog.dataset.panelMounted = 'true';
  dialog.classList.add('settings-panel');
  const header = dialog.querySelector('.dialog-top');
  const content = document.createElement('div');
  content.className = 'dialog-content';
  content.append(...[...dialog.childNodes].filter((node) => node !== header));
  const navigation = document.createElement('nav');
  navigation.className = 'settings-nav';
  navigation.setAttribute('aria-label', 'Разделы');
  const select = document.createElement('select');
  select.className = 'settings-section-select';
  select.setAttribute('aria-label', 'Раздел');
  let lastGroup;
  let optionGroup;
  for (const [group, id, title] of SETTINGS_PANELS) {
    if (group !== lastGroup) {
      const label = document.createElement('strong');
      label.textContent = group;
      navigation.append(label);
      optionGroup = document.createElement('optgroup');
      optionGroup.label = group;
      select.append(optionGroup);
      lastGroup = group;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = title;
    button.dataset.target = id;
    if (id === dialog.id) button.setAttribute('aria-current', 'page');
    button.onclick = () => open(id);
    navigation.append(button);
    optionGroup.append(new Option(title, id, false, id === dialog.id));
  }
  select.onchange = () => open(select.value);
  dialog.replaceChildren(header, select, navigation, content);
  header.querySelector('.close').onclick = () => dialog.close();
  let backdropPress = false;
  const outside = (event) => {
    const r = dialog.getBoundingClientRect();
    return (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    );
  };
  dialog.addEventListener('pointerdown', (e) => {
    backdropPress = e.target === dialog && outside(e);
  });
  dialog.addEventListener('click', (e) => {
    if (backdropPress && e.target === dialog && outside(e)) dialog.close();
    backdropPress = false;
  });
  dialog.addEventListener('close', () => close(dialog));
}
