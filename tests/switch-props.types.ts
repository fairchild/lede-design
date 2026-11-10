// Switch's public type is native <span> attributes and the Base UI props Lede names, so no Base UI type crosses Lede's
// boundary. `npm run typecheck` checks this file; an unused @ts-expect-error fails it.
import type { SwitchProps } from '../registry/lede/switch';

// @ts-expect-error `render` is Base UI's, and Lede doesn't name it.
const render: SwitchProps = { render: undefined };
// @ts-expect-error `nativeButton` is Base UI's, and Lede doesn't name it.
const nativeButton: SwitchProps = { nativeButton: false };

export const named: SwitchProps[] = [
  { checked: true, defaultChecked: false, disabled: false, readOnly: true, name: 'n', value: 'on', uncheckedValue: 'off' },
  { required: true, form: 'f', id: 'i', inputRef: { current: null }, 'aria-describedby': 'd', 'data-case': 'c' } as SwitchProps,
  render,
  nativeButton,
];
