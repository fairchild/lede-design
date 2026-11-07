import * as React from 'react';
import { defineRegistry, useActions, useBoundProp, type ComponentRegistry } from '@json-render/react';
import type { ActionBinding } from '@json-render/core';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { ListGroup, ListRow } from '../list';
import { SegmentedControl } from '../segmented-control';
import { Switch } from '../switch';
import { TextField } from '../text-field';
import { EmptyState } from '../blocks/empty-state';
import { FormSection } from '../blocks/form-section';
import { PageHeader } from '../blocks/page-header';
import { SummaryCard } from '../blocks/summary-card';
import { focusLanding } from '../input-modality';
import { catalog } from './catalog';

/**
 * The level of a spec's title. A spec renders below its host page's own h1, so it starts at h2 by default, and a host
 * that puts it under another heading, such as a chat message's author, provides level 3. Sections sit one below.
 */
export const SpecHeadingLevel = React.createContext<2 | 3>(2);
const useLevels = () => {
  const title = React.useContext(SpecHeadingLevel);
  return { title, section: (title + 1) as 3 | 4 };
};

/** The element around a SpecView's screen, where a press looks for the fields its actions read. */
export const SpecRoot = React.createContext<React.RefObject<HTMLElement | null> | null>(null);
/** The `on` bindings of the element being drawn, which defineRegistry's render props leave out. */
const ElementOn = React.createContext<Record<string, ActionBinding | ActionBinding[]> | undefined>(undefined);

/** Every `$state` path a binding's params read, such as `/form` in `{ "values": { "$state": "/form" } }`. */
function statePaths(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (!Array.isArray(value) && typeof (value as { $state?: unknown }).$state === 'string') return [(value as { $state: string }).$state];
  return Object.values(value).flatMap(statePaths);
}

/**
 * An event's emit, held back at the first action that reads a field failing its native check: empty and required,
 * outside its min and max, or not the email or URL its type asks for. The actions before that one run, so a spec can
 * set `/tried` and show its errors, and focus moves to the field. Each field's `name` is the state path it binds.
 */
function useCheckedEmit(emit: (event: string) => void) {
  const root = React.useContext(SpecRoot);
  const on = React.useContext(ElementOn);
  const { execute } = useActions();
  return async (event: string) => {
    const bound = on?.[event];
    const list = bound ? (Array.isArray(bound) ? bound : [bound]) : [];
    const scope: ParentNode = root?.current ?? document;
    const failing = [...scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name]:invalid, textarea[name]:invalid')];
    const reads = (b: ActionBinding) => failing.find((f) => statePaths(b.params).some((p) => f.name === p || f.name.startsWith(`${p}/`)));
    const stop = list.findIndex(reads);
    if (stop < 0) return emit(event);
    for (const b of list.slice(0, stop)) await execute(b);
    reads(list[stop])?.focus();
  };
}

/**
 * Each catalog type drawn by its Lede component. The spec's PageHeader leaves focus where the reader is. PageHeader
 * takes an h1 or h2 only, so a deeper title draws its parts with the same classes.
 */
const drawn = defineRegistry(catalog, {
  components: {
    Screen: ({ children }) => <div className="ld-flow ld-flow-stack">{children}</div>,
    PageHeader: ({ props, slots }) => {
      const { title } = useLevels();
      if (title === 2) return <PageHeader title={props.title} summary={props.summary} actions={slots?.actions} headingLevel={2} focusOnMount={false} />;
      const H = `h${title}` as 'h3';
      return (
        <header className="ld-page-header">
          <div className="ld-page-header-row">
            <div className="ld-page-header-text">
              <H className="text-title-2 ld-page-title">{props.title}</H>
              {props.summary ? <p className="ld-page-summary">{props.summary}</p> : null}
            </div>
            {slots?.actions ? <div className="ld-page-actions">{slots.actions}</div> : null}
          </div>
        </header>
      );
    },
    ListGroup: ({ props, children }) => (
      <ListGroup title={props.title} summary={props.summary} footer={props.footer} headingLevel={useLevels().section}>{children}</ListGroup>
    ),
    ListRow: ({ props, bindings, emit, on }) => {
      const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked);
      const press = on('press');
      const id = React.useId();
      return (
        <ListRow
          rowKey={id}
          title={props.title}
          subtitle={props.subtitle}
          value={props.value}
          chevron={props.chevron}
          onClick={press.bound ? () => press.emit() : undefined}
          trailing={checked === undefined ? undefined : (
            <Switch aria-label={props.title} checked={checked} onCheckedChange={(next) => { setChecked(next); emit('change'); }} />
          )}
          actions={props.actions?.map((a) => ({ label: a.label, tone: a.tone, onSelect: () => { keepFocus(id); emit(a.event); } }))}
        />
      );
    },
    Button: ({ props, emit }) => {
      const checked = useCheckedEmit(emit);
      return (
        <Button variant={props.variant} tone={props.tone} size={props.size} block={props.block} disabled={props.disabled} onClick={() => checked('press')}>
          {props.label}
        </Button>
      );
    },
    TextField: ({ props, bindings, on, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      const submit = on('submit');
      const checked = useCheckedEmit(emit);
      return (
        <TextField
          label={props.label}
          type={props.type}
          placeholder={props.placeholder}
          hint={props.hint}
          error={props.error}
          required={props.required}
          min={props.min}
          max={props.max}
          name={bindings?.value}
          rows={props.rows}
          value={value ?? ''}
          // A number field keeps a number in state, so a condition's gt and lt compare it.
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const input = e.currentTarget;
            setValue(props.type === 'number' && input.value !== '' ? (input as HTMLInputElement).valueAsNumber : input.value);
          }}
          onKeyDown={submit.bound && !props.rows ? (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void checked('submit'); }
          } : undefined}
        />
      );
    },
    Switch: ({ props, bindings, emit }) => {
      const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked);
      return <Switch label={props.label} disabled={props.disabled} checked={!!checked} onCheckedChange={(next) => { setChecked(next); emit('change'); }} />;
    },
    Checkbox: ({ props, bindings, emit }) => {
      const [checked, setChecked] = useBoundProp(props.checked, bindings?.checked);
      return (
        // Lede's Checkbox is the box alone. Its label sits in a column of its own, so a long one wraps beside the box.
        <label className="ld-checkbox-field">
          <Checkbox checked={!!checked} disabled={props.disabled} required={props.required} name={bindings?.checked} onChange={(e) => { setChecked(e.currentTarget.checked); emit('change'); }} />
          <span className="ld-checkbox-label">{props.label}</span>
        </label>
      );
    },
    SegmentedControl: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      const errorId = React.useId();
      // Lede's SegmentedControl names its group with a hidden legend, for a screen where a heading beside it says what
      // it picks. A model's screen may have none, so the label shows here too, hidden from assistive tech, which
      // reads the legend. An error shows under it, as a TextField's does.
      return (
        <div className="ld-field" data-invalid={props.error ? '' : undefined}>
          <p className="ld-field-label" aria-hidden="true">{props.label}</p>
          <SegmentedControl
            label={props.label}
            options={props.options}
            value={value}
            name={bindings?.value}
            required={props.required}
            aria-describedby={props.error ? errorId : undefined}
            aria-invalid={!!props.error}
            onValueChange={(next) => { setValue(next); emit('change'); }}
          />
          {props.error ? <p id={errorId} className="ld-field-hint">{props.error}</p> : null}
        </div>
      );
    },
    FormSection: ({ props, children }) => <FormSection legend={props.legend} description={props.description}>{children}</FormSection>,
    EmptyState: ({ props, slots }) => (
      <EmptyState title={props.title} description={props.description} action={slots?.action} headingLevel={useLevels().section} />
    ),
    SummaryCard: ({ props }) => (
      <SummaryCard title={props.title} summary={props.summary} figure={props.figure} status={props.status} headingLevel={useLevels().section} />
    ),
  },
  actions: {
    open: async (params) => report('open', params),
    archive: async (params) => report('archive', params),
    submit: async (params) => report('submit', params),
  },
});

/** The registry, each entry given its element's `on` bindings, which `useCheckedEmit` reads. */
export const registry: ComponentRegistry = Object.fromEntries(
  Object.entries(drawn.registry).map(([type, Draw]) => [
    type,
    (ctx: React.ComponentProps<typeof Draw>) => <ElementOn.Provider value={ctx.element.on}><Draw {...ctx} /></ElementOn.Provider>,
  ]),
);
export const { handlers } = drawn;

/**
 * A row action can hide its own row, through a `visible` condition. Focus then moves to the next row, or the one
 * before it, or the screen's title, so it never falls to `<body>`.
 */
function keepFocus(rowKey: string) {
  const row = document.querySelector(`[data-row-id="${CSS.escape(rowKey)}"]`);
  const sibling = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>('.ld-row-target');
  const title = row?.closest('.ld-flow')?.querySelector<HTMLElement>('h2, h3');
  setTimeout(() => { if (!row?.isConnected && (document.activeElement === document.body || !document.activeElement)) focusLanding(sibling ?? title); }, 50);
}

/** The page's action log listens here: each catalog action a spec runs, with its params. */
export const actions = new EventTarget();
export type ActionEvent = CustomEvent<{ name: string; params: unknown }>;
const report = (name: string, params: unknown) => { actions.dispatchEvent(new CustomEvent('action', { detail: { name, params } })); };
