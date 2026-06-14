/**
 * «Ощущение видеоигры»: глушим браузерные поведения, выдающие веб-страницу (контекстное меню,
 * автоскролл средней кнопкой, дроп файла, Tab-обход, залипание фокуса на кнопках).
 * Ставится один раз при старте, до рендера. Поля ввода — исключение, где уместно.
 */

const isEditableTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

export function installGameFeelGuards(): void {
  // ПКМ — щит в матче и «не веб» в меню: браузерное контекстное меню глушим всюду.
  document.addEventListener('contextmenu', e => e.preventDefault())
  // Средняя кнопка — иначе поверх игры запускается «компас» автоскролла.
  document.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault() })
  // Файл, уроненный на окно, уводит браузер со страницы игры.
  document.addEventListener('dragover', e => e.preventDefault())
  document.addEventListener('drop', e => e.preventDefault())
  // Tab-обход кнопок с обводкой фокуса — не для шутера. Внутри полей ввода Tab живёт.
  document.addEventListener('keydown', e => { if (e.key === 'Tab' && !isEditableTarget(e.target)) e.preventDefault() })
  // Кликнутая мышью кнопка не должна оставаться в фокусе: иначе Space/Enter (прыжок в матче!)
  // «нажмёт» её повторно — например, НАЧАТЬ в комнате.
  document.addEventListener('click', () => {
    const el = document.activeElement
    if (el instanceof HTMLElement && el.tagName === 'BUTTON') el.blur()
  })
}
