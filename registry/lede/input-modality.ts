// What the person last used to reach the page: keys, a pointer or touch. The browser tracks the same thing for
// `:focus-visible` and doesn't expose it, so these listeners keep a copy, one set per document.

/**
 * Whether the most recent input was a touch: a tap with a finger or a pen. Before any input, a device whose main
 * pointer is coarse counts as touch, so a phone's cold load starts at the h1 too. A screen reached by touch keeps the
 * on-screen keyboard down, so it lands on its h1 and the field is one tap away.
 */
let touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** Whether the most recent input was a key press. Before any input it isn't. */
let keyed = false;

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => { touch = e.pointerType === 'touch' || e.pointerType === 'pen'; keyed = false; }, true);
  document.addEventListener('keydown', () => { touch = false; keyed = true; }, true);
}

export const lastInputWasTouch = () => touch;

/**
 * Focuses a landing target that isn't a control, such as a screen's title, without scrolling. Chromium matches
 * `:focus-visible` on an element that script focuses before any input, as on a cold load, and after a click on a
 * control that keys had focused. So the target asks for no ring unless the most recent input was a key press, and
 * then the browser decides.
 */
export function focusLanding(el: HTMLElement | null | undefined) {
  const options: FocusOptions & { focusVisible?: boolean } = keyed ? { preventScroll: true } : { preventScroll: true, focusVisible: false };
  el?.focus(options);
}
