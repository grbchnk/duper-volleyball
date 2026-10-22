// Keep each settings page short: one group is visible at a time.
export function mountSettingGroups(parent, sections) {
  if (sections.length < 2) return;
  const order = [
    'Мяч',
    'Движение',
    'Прыжок',
    'Подготовка удара',
    'Помощь направлению',
    'Блок',
    'Бросок за мячом',
    'Размер и форма',
    'Движение рук',
    'Плавность анимации',
  ];
  const rank = (section) => {
    const index = order.indexOf(section.querySelector('h3').textContent);
    return index < 0 ? 99 : index;
  };
  sections.sort((a, b) => rank(a) - rank(b));
  const tabs = document.createElement('nav');
  tabs.className = 'settings-tabs settings-group-tabs';
  tabs.setAttribute('aria-label', 'Группы настроек');
  parent.prepend(tabs);
  for (const [index, section] of sections.entries()) {
    const heading = section.querySelector('h3');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = heading.textContent;
    button.dataset.settingGroup = heading.textContent;
    button.setAttribute('aria-pressed', String(index === 0));
    section.hidden = index !== 0;
    button.onclick = () => {
      sections.forEach((item) => (item.hidden = item !== section));
      [...tabs.children].forEach((item) =>
        item.setAttribute('aria-pressed', String(item === button)),
      );
      const content = parent.closest('.dialog-content');
      if (content) content.scrollTop = 0;
    };
    tabs.append(button);
  }
}
