// A tiny set of original outline icons (24px grid, 1.8 stroke, round caps), drawn in currentColor.
// Always decorative: callers put them next to a visible label or give the control an aria-label.
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
export const IconSun = () => (<svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></svg>);
export const IconInbox = () => (<svg {...base}><path d="M4 13h4l1.5 2.5h5L16 13h4M5 6h14l1 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z" /></svg>);
export const IconGear = () => (<svg {...base}><circle cx="12" cy="12" r="3" /><path d="M10.5 5.6 10.7 3.1h2.6l.2 2.5a6.6 6.6 0 0 1 2 .8l1.9-1.6 1.8 1.8-1.6 1.9a6.6 6.6 0 0 1 .8 2l2.5.2v2.6l-2.5.2a6.6 6.6 0 0 1-.8 2l1.6 1.9-1.8 1.8-1.9-1.6a6.6 6.6 0 0 1-2 .8l-.2 2.5h-2.6l-.2-2.5a6.6 6.6 0 0 1-2-.8l-1.9 1.6-1.8-1.8 1.6-1.9a6.6 6.6 0 0 1-.8-2l-2.5-.2v-2.6l2.5-.2a6.6 6.6 0 0 1 .8-2L4.8 6.6l1.8-1.8 1.9 1.6a6.6 6.6 0 0 1 2-.8z" /></svg>);
export const IconBook = () => (<svg {...base}><path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2zM5 20a2 2 0 0 0 2 1h12" /></svg>);
export const IconSwatch = () => (<svg {...base}><circle cx="8" cy="8" r="4" /><circle cx="16" cy="9" r="3" /><circle cx="11" cy="16" r="4" /></svg>);
export const IconBlocks = () => (<svg {...base}><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></svg>);
export const IconLayers = () => (<svg {...base}><path d="m12 4 8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4" /></svg>);
export const IconTable = () => (<svg {...base}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" /></svg>);
export const IconLayout = () => (<svg {...base}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></svg>);
export const IconPeople = () => (<svg {...base}><circle cx="9" cy="9" r="3.5" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15.5 5.8a3.5 3.5 0 0 1 0 6.4M17 15a5.5 5.5 0 0 1 3.5 4" /></svg>);
export const IconClock = () => (<svg {...base}><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></svg>);
export const IconFile = () => (<svg {...base}><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM14 3.5V8h4" /></svg>);
export const IconFolder = () => (<svg {...base}><path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5V17a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17z" /></svg>);
