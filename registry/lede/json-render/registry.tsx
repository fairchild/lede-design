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

type Field = HTMLInputElement | HTMLTextAreaElement;
interface Checks {
  /** Each field whose check held back an action, by name, with the browser's message for what it needs. */
  shown: ReadonlyMap<string, string>;
  show: (fields: Field[]) => void;
  /** Called on a field's input: a field that now passes drops its error, and one that still fails keeps it. */
  recheck: (name: string, valid: boolean, message: string) => void;
}
const Checked = React.createContext<Checks | null>(null);

/** Holds which fields show their error. SpecView puts it around each screen. */
export function FieldChecks({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = React.useState<ReadonlyMap<string, string>>(new Map());
  const checks = React.useMemo<Checks>(() => ({
    shown,
    show: (fields) => setShown((prev) => new Map([...prev, ...fields.map((f) => [f.name, f.validationMessage] as const)])),
    recheck: (name, valid, message) => setShown((prev) => {
      if (!prev.has(name) || (!valid && prev.get(name) === message)) return prev;
      const next = new Map(prev);
      if (valid) next.delete(name);
      else next.set(name, message);
      return next;
    }),
  }), [shown]);
  return <Checked.Provider value={checks}>{children}</Checked.Provider>;
}

/** A field's error, shown once its check holds back an action: the spec's `error`, or the browser's message without one. */
function useFieldError(name: string | undefined, error: string | undefined) {
  const checks = React.useContext(Checked);
  const message = name === undefined ? undefined : checks?.shown.get(name);
  return { error: message === undefined ? undefined : error || message, recheck: checks?.recheck };
}

/**
 * An event's emit, held back at the first action that reads a field failing its native check: empty and required,
 * outside its min and max, or not the email or URL its type asks for. The actions before that one run. Each field it
 * reads that fails shows its error, and focus moves to the first. Each field's `name` is the state path it binds.
 */
function useCheckedEmit(emit: (event: string) => void) {
  const root = React.useContext(SpecRoot);
  const on = React.useContext(ElementOn);
  const checks = React.useContext(Checked);
  const { execute } = useActions();
  return async (event: string) => {
    const bound = on?.[event];
    const list = bound ? (Array.isArray(bound) ? bound : [bound]) : [];
    const scope: ParentNode = root?.current ?? document;
    const failing = [...scope.querySelectorAll<Field>('input[name]:invalid, textarea[name]:invalid')];
    const reads = (b: ActionBinding) => failing.filter((f) => statePaths(b.params).some((p) => f.name === p || f.name.startsWith(`${p}/`)));
    const stop = list.findIndex((b) => reads(b).length > 0);
    if (stop < 0) return emit(event);
    for (const b of list.slice(0, stop)) await execute(b);
    const held = reads(list[stop]);
    checks?.show(held);
    held[0]?.focus();
  };
}

/**
 * Each catalog type drawn by its Lede component. The spec's PageHeader leaves focus where the reader is. PageHeader
 * takes an h1 or h2 only, so a deeper title draws its parts with the same classes, its title focusable as PageHeader's
 * is, so focus can land there.
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
              <H tabIndex={-1} className="text-title-2 ld-page-title">{props.title}</H>
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
      return (
        <ListRow
          title={props.title}
          subtitle={props.subtitle}
          value={props.value}
          chevron={props.chevron}
          onClick={press.bound ? () => press.emit() : undefined}
          trailing={checked === undefined ? undefined : (
            <Switch aria-label={props.title} checked={checked} onCheckedChange={(next) => { setChecked(next); emit('change'); }} />
          )}
          actions={props.actions?.map((a) => ({ label: a.label, tone: a.tone, onSelect: () => emit(a.event) }))}
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
      const { error, recheck } = useFieldError(bindings?.value, props.error);
      return (
        <TextField
          label={props.label}
          type={props.type}
          placeholder={props.placeholder}
          hint={props.hint}
          error={error}
          required={props.required}
          min={props.min}
          max={props.max}
          name={bindings?.value}
          rows={props.rows}
          value={value ?? ''}
          // A number field keeps a number in state, so a condition's gt and lt compare it.
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const input = e.currentTarget;
            if (bindings?.value) recheck?.(bindings.value, input.validity.valid, input.validationMessage);
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
      const { error, recheck } = useFieldError(bindings?.checked, props.error);
      const errorId = React.useId();
      return (
        <div className="ld-field" data-invalid={error ? '' : undefined}>
          {/* Lede's Checkbox is the box alone. Its label sits in a column of its own, so a long one wraps beside the box. */}
          <label className="ld-checkbox-field">
            <Checkbox
              checked={!!checked}
              disabled={props.disabled}
              required={props.required}
              name={bindings?.checked}
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                const input = e.currentTarget;
                if (bindings?.checked) recheck?.(bindings.checked, input.validity.valid, input.validationMessage);
                setChecked(input.checked);
                emit('change');
              }}
            />
            <span className="ld-checkbox-label">{props.label}</span>
          </label>
          {error ? <p id={errorId} className="ld-field-hint">{error}</p> : null}
        </div>
      );
    },
    SegmentedControl: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      const errorId = React.useId();
      const { error, recheck } = useFieldError(bindings?.value, props.error);
      // Lede's SegmentedControl names its group with a hidden legend, for a screen where a heading beside it says what
      // it picks. A model's screen may have none, so the label shows here too, hidden from assistive tech, which
      // reads the legend. An error shows under it, as a TextField's does.
      return (
        <div className="ld-field" data-invalid={error ? '' : undefined}>
          <p className="ld-field-label" aria-hidden="true">{props.label}</p>
          <SegmentedControl
            label={props.label}
            options={props.options}
            value={value}
            name={bindings?.value}
            required={props.required}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={!!error}
            onValueChange={(next) => { if (bindings?.value) recheck?.(bindings.value, true, ''); setValue(next); emit('change'); }}
          />
          {error ? <p id={errorId} className="ld-field-hint">{error}</p> : null}
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

/** The page's action log listens here: each catalog action a spec runs, with its params. */
export const actions = new EventTarget();
export type ActionEvent = CustomEvent<{ name: string; params: unknown }>;
const report = (name: string, params: unknown) => { actions.dispatchEvent(new CustomEvent('action', { detail: { name, params } })); };
