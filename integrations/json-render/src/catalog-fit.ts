import type { JSXElementConstructor } from 'react';
import type { z } from 'zod';
import type { Button } from '@/components/lede/button';
import type { Checkbox } from '@/components/lede/checkbox';
import type { ListGroup, ListRow } from '@/components/lede/list';
import type { SegmentedControl } from '@/components/lede/segmented-control';
import type { Switch } from '@/components/lede/switch';
import type { TextField } from '@/components/lede/text-field';
import type { EmptyState } from '@/components/lede/blocks/empty-state';
import type { FormSection } from '@/components/lede/blocks/form-section';
import type { PageHeader } from '@/components/lede/blocks/page-header';
import type { SummaryCard } from '@/components/lede/blocks/summary-card';
import type { catalog } from '@/components/lede/json-render/catalog';

// A typecheck, not a runtime test: `tsc --noEmit` fails when a catalog entry lets a model set a prop its Lede
// component doesn't take, or a value the component's type doesn't allow. The error names the entry and the prop.

type Entries = typeof catalog.data.components;
type Name = keyof Entries;
type Props<K extends Name> = z.infer<Entries[K]['props']>;

/** The Lede component behind each entry. Screen is this page's own stacking `<div>`, so it has none. */
interface Lede {
  Screen: null;
  PageHeader: typeof PageHeader;
  ListGroup: typeof ListGroup;
  ListRow: typeof ListRow;
  Button: typeof Button;
  TextField: typeof TextField;
  Switch: typeof Switch;
  Checkbox: typeof Checkbox;
  SegmentedControl: typeof SegmentedControl;
  FormSection: typeof FormSection;
  EmptyState: typeof EmptyState;
  SummaryCard: typeof SummaryCard;
}

/** Props the registry reads and turns into something else, such as a Button's `label`, which becomes its children. */
interface Adapted {
  ListRow: 'checked';
  Button: 'label';
  Checkbox: 'label';
}

// TextField's props are a union (an input or a textarea), so a prop counts when any member takes it.
type Accepted<K extends Name> = Lede[K] extends JSXElementConstructor<infer P> ? P : Record<never, never>;
type KeysOf<T> = T extends unknown ? keyof T : never;
type ValueOf<T, P> = T extends unknown ? (P extends keyof T ? T[P] : never) : never;
type Own<K extends Name> = Exclude<keyof Props<K>, K extends keyof Adapted ? Adapted[K] : never>;
type Unknown<K extends Name> = Exclude<Own<K>, KeysOf<Accepted<K>>>;
type Mistyped<K extends Name> = {
  [P in Own<K> & KeysOf<Accepted<K>>]: Props<K>[P] extends ValueOf<Accepted<K>, P> ? never : P;
}[Own<K> & KeysOf<Accepted<K>>];
type Fit<K extends Name> = Lede[K] extends null ? true : [Unknown<K>, Mistyped<K>] extends [never, never]
  ? true
  : { unknownProps: Unknown<K>; mistypedProps: Mistyped<K> };

export const fit: { [K in Name]: Fit<K> } = {
  Screen: true,
  PageHeader: true,
  ListGroup: true,
  ListRow: true,
  Button: true,
  TextField: true,
  Switch: true,
  Checkbox: true,
  SegmentedControl: true,
  FormSection: true,
  EmptyState: true,
  SummaryCard: true,
};
