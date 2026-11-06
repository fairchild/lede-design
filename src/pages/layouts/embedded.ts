/** True inside a docs preview frame. A link back to the docs would nest the docs in the frame, so examples drop it. */
export const EMBEDDED = window.self !== window.top;

if (EMBEDDED) document.documentElement.dataset.embedded = '';
