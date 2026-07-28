/**
 * "Video-game feel": suppress browser behaviors that betray a web page (context menu,
 * middle-button autoscroll, file drop, Tab traversal, focus sticking on buttons).
 * Installed once at startup, before render. Input fields are an exception where appropriate.
 */

const isEditableTarget = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

export function installGameFeelGuards(): void {
  // RMB — shield in a match and "not web" in the menu: suppress the browser context menu everywhere.
  document.addEventListener('contextmenu', e => e.preventDefault())
  // Middle button — otherwise the autoscroll "compass" pops up over the game.
  document.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault() })
  // A file dropped onto the window navigates the browser away from the game page.
  document.addEventListener('dragover', e => e.preventDefault())
  document.addEventListener('drop', e => e.preventDefault())
  // Tab traversal of focus-outlined buttons isn't for a shooter. Inside input fields Tab still works.
  document.addEventListener('keydown', e => { if (e.key === 'Tab' && !isEditableTarget(e.target)) e.preventDefault() })
  // A mouse-clicked button must not stay focused: otherwise Space/Enter (jump in a match!)
  // would "press" it again — e.g. START in the room.
  document.addEventListener('click', () => {
    const el = document.activeElement
    if (el instanceof HTMLElement && el.tagName === 'BUTTON') el.blur()
  })
}
