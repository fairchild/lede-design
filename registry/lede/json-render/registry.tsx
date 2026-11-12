import * as React from 'react';
import { defineRegistry, useActions, useBoundProp, useRepeatScope, type ComponentRegistry } from '@json-render/react';
import type { ActionBinding, Spec } from '@json-render/core';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { ListGroup, ListRow } from '../list';
import { SegmentedControl } from '../segmented-control';
import { Switch } from '../switch';
import { TextField } from '../text-field';
import { EmptyState } from '../blocks/empty-state';
import { FormSection } from '../blocks/form-section';
import { PageHeader, useBackOnEscape } from '../blocks/page-header';
import { focusLanding } from '../input-modality';
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
/** The drawn element's key in the spec, with its item's index inside a repeat: a name that outlives a remount. */
const ElementId = React.createContext('');

interface Drill {
  /** The element whose press came last, by `ElementId`. A detail View's PageHeader takes it as the control that opened it. */
  pressed: React.RefObject<string | null>;
  /** The control that opened a detail on its way out, which takes focus as it draws again. */
  returnTo: React.RefObject<string | null>;
  /** Focus is inside this screen, so its Escape belongs to the open detail. */
  within: boolean;
}
const DrillContext = React.createContext<Drill | null>(null);
/**
 * Each element's key in the spec a SpecView draws. json-render hands a component a copy of its element with the props
 * resolved, and the copy keeps the element's own `children` and `on`, so those find the key.
 */
export const SpecKeys = React.createContext<ReadonlyMap<unknown, string>>(new Map());
export const specKeys = (spec: Spec | null): ReadonlyMap<unknown, string> =>
  new Map(Object.entries(spec?.elements ?? {}).flatMap(([key, el]) => [el.children, el.on].filter(Boolean).map((part) => [part, key] as const)));

/**
 * Opening an item in place: a press notes the control that made it, the detail's title takes focus when it shows, and
 * Back returns focus to that control. SpecView puts it around each screen. Escape backs out of a detail only while
 * focus is inside its screen, so it never reaches the page around it or another screen.
 */
export function DrillScope({ children }: { children: React.ReactNode }) {
  const root = React.useContext(SpecRoot);
  const pressed = React.useRef<string | null>(null);
  const returnTo = React.useRef<string | null>(null);
  const [within, setWithin] = React.useState(false);
  React.useEffect(() => {
    const el = root?.current;
    if (!el) return;
    const update = () => setWithin(el.contains(document.activeElement));
    el.addEventListener('focusin', update);
    el.addEventListener('focusout', update);
    document.addEventListener('focusin', update);
    return () => {
      el.removeEventListener('focusin', update);
      el.removeEventListener('focusout', update);
      document.removeEventListener('focusin', update);
    };
  }, [root]);
  const drill = React.useMemo(() => ({ pressed, returnTo, within }), [within]);
  return <DrillContext.Provider value={drill}>{children}</DrillContext.Provider>;
}

/**
 * The control a press came from, for the detail it opens to hand focus back to. When Back takes the detail away, the
 * control takes focus in the commit that draws it again, before a frame can show focus on `<body>`.
 */
function usePress() {
  const drill = React.useContext(DrillContext);
  const root = React.useContext(SpecRoot);
  const id = React.useContext(ElementId);
  React.useLayoutEffect(() => {
    if (!drill || drill.returnTo.current !== id) return;
    drill.returnTo.current = null;
    focusLanding(root?.current && controlFor(root.current, id));
  }, []);
  return { id, note: () => { if (drill) drill.pressed.current = id; } };
}
const controlFor = (scope: ParentNode, id: string) =>
  scope.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"] .ld-row-target, [data-jr-id="${CSS.escape(id)}"]`);

/**
 * A detail View's header. When it shows because a press took the list away, its title takes focus. Its back button,
 * or Escape while focus is in the screen, emits “back”, and once the list is back focus returns to the control that
 * opened the detail, or to the screen's title when that control is gone.
 */
function DetailHeader({ title, summary, back, actions, level, onBack }: {
  title: string; summary?: string; back: { label: string }; actions?: React.ReactNode; level: 2 | 3; onBack: () => void;
}) {
  const drill = React.useContext(DrillContext);
  const root = React.useContext(SpecRoot);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const [openedBy] = React.useState(() => drill?.pressed.current ?? null);
  const leaving = React.useRef(false);
  const goBack = () => {
    leaving.current = true;
    if (drill) drill.returnTo.current = openedBy;
    onBack();
  };
  useBackOnEscape(drill?.within ? goBack : undefined);
  React.useLayoutEffect(() => {
    const scope = root?.current;
    const active = document.activeElement;
    if (!openedBy || !scope || (active && active !== document.body) || controlFor(scope, openedBy)) return;
    focusLanding(heading.current);
  }, []);
  // When the control that opened the detail is gone, such as a row archived from it, the list's title takes focus.
  React.useLayoutEffect(() => () => {
    if (!leaving.current) return;
    queueMicrotask(() => {
      const scope = root?.current;
      if (drill) drill.returnTo.current = null;
      const active = document.activeElement;
      if (!scope || (active && active !== document.body && active.isConnected)) return;
      focusLanding(scope.querySelector<HTMLElement>('.ld-page-title'));
    });
  }, []);
  const H = `h${level}` as 'h2';
  return (
    <header className="ld-page-header">
      <button type="button" className="ld-back" onClick={goBack}>
        <svg viewBox="0 0 8 14" width="8" height="14" fill="none" aria-hidden="true">
          <path d="M6.5 1.5 1.5 7l5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {back.label}
      </button>
      <div className="ld-page-header-row">
        <div className="ld-page-header-text">
          <H ref={heading} tabIndex={-1} className={`${level === 2 ? 'text-large-title' : 'text-title-2'} ld-page-title`}>{title}</H>
          {summary ? <p className="ld-page-summary">{summary}</p> : null}
        </div>
        {actions ? <div className="ld-page-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

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
  /** Each field's own `error` from the spec, by name, which it shows in place of the browser's message. */
  errors: Map<string, string>;
  /** Called when a field's value changes: a field that now passes drops its error, and one that still fails keeps it. */
  recheck: (name: string, valid: boolean, message: string) => void;
}
const Checked = React.createContext<Checks | null>(null);

/** An action held back by fields it reads: the action, and each failing field's name and the error it shows. */
export interface HeldAction {
  action: string;
  fields: Array<{ name: string; message: string }>;
}
/** Where SpecView's `onActionHeld` reaches `useCheckedEmit`. */
export const ActionHeld = React.createContext<((held: HeldAction) => void) | undefined>(undefined);

/** Holds which fields show their error. SpecView puts it around each screen. */
export function FieldChecks({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = React.useState<ReadonlyMap<string, string>>(new Map());
  const [errors] = React.useState(() => new Map<string, string>());
  const checks = React.useMemo<Checks>(() => ({
    shown,
    errors,
    show: (fields) => setShown((prev) => new Map([...prev, ...fields.map((f) => [f.name, f.validationMessage] as const)])),
    recheck: (name, valid, message) => setShown((prev) => {
      if (!prev.has(name) || (!valid && prev.get(name) === message)) return prev;
      const next = new Map(prev);
      if (valid) next.delete(name);
      else next.set(name, message);
      return next;
    }),
  }), [shown, errors]);
  return <Checked.Provider value={checks}>{children}</Checked.Provider>;
}

/**
 * A field's error, shown once its check holds back an action: the spec's `error`, or the browser's message without
 * one. Each change to its value checks it again, whether the person typed it or an action or the stream set it.
 */
function useFieldError(name: string | undefined, error: string | undefined, value: unknown) {
  const checks = React.useContext(Checked);
  const root = React.useContext(SpecRoot);
  const message = name === undefined ? undefined : checks?.shown.get(name);
  const shown = message !== undefined;
  React.useEffect(() => {
    if (name === undefined || !checks) return;
    if (!error) return;
    checks.errors.set(name, error);
    return () => { checks.errors.delete(name); };
  }, [name, error, checks]);
  React.useEffect(() => {
    if (!shown || name === undefined) return;
    const field = (root?.current ?? document).querySelector<Field>(`[name="${CSS.escape(name)}"]`);
    if (field) checks?.recheck(name, field.validity.valid, field.validationMessage);
  }, [value, shown, name, root, checks]);
  return message === undefined ? undefined : error || message;
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
  const report = React.useContext(ActionHeld);
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
    report?.({ action: list[stop].action, fields: held.map((f) => ({ name: f.name, message: checks?.errors.get(f.name) || f.validationMessage })) });
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
    View: ({ children }) => <div className="ld-flow-stack">{children}</div>,
    PageHeader: ({ props, slots, emit }) => {
      const { title } = useLevels();
      if (props.back) return <DetailHeader title={props.title} summary={props.summary} back={props.back} actions={slots?.actions} level={title} onBack={() => emit('back')} />;
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
      const { id, note } = usePress();
      return (
        <ListRow
          rowKey={id}
          title={props.title}
          subtitle={props.subtitle}
          value={props.value}
          // A chevron says the row leads somewhere, so it shows only on a row whose press is bound.
          chevron={press.bound && props.chevron !== false}
          onClick={press.bound ? () => { note(); press.emit(); } : undefined}
          trailing={checked === undefined ? undefined : (
            <Switch aria-label={props.title} checked={checked} onCheckedChange={(next) => { setChecked(next); emit('change'); }} />
          )}
          actions={props.actions?.map((a) => ({ label: a.label, tone: a.tone, onSelect: () => emit(a.event) }))}
        />
      );
    },
    Button: ({ props, emit }) => {
      const checked = useCheckedEmit(emit);
      const { id, note } = usePress();
      return (
        <Button data-jr-id={id} variant={props.variant} tone={props.tone} size={props.size} block={props.block} disabled={props.disabled} onClick={() => { note(); void checked('press'); }}>
          {props.label}
        </Button>
      );
    },
    TextField: ({ props, bindings, on, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      const submit = on('submit');
      const checked = useCheckedEmit(emit);
      const error = useFieldError(bindings?.value, props.error, value);
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
          // Without a step a number field allows whole steps only, so 7.5 would fail; a spec asks for whole numbers with step 1.
          step={props.type === 'number' ? (props.step ?? 'any') : undefined}
          pattern={props.pattern}
          minLength={props.minLength}
          maxLength={props.maxLength}
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
      const error = useFieldError(bindings?.checked, props.error, checked);
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
              onChange={(e) => { setChecked(e.currentTarget.checked); emit('change'); }}
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
      const error = useFieldError(bindings?.value, props.error, value);
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
            onValueChange={(next) => { setValue(next); emit('change'); }}
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
    archive: async (params) => report('archive', params),
    submit: async (params) => report('submit', params),
  },
});

/** The registry, each entry given its element's `on` bindings, which `useCheckedEmit` reads, and its `ElementId`. */
export const registry: ComponentRegistry = Object.fromEntries(
  Object.entries(drawn.registry).map(([type, Draw]) => [
    type,
    function Drawn(ctx: React.ComponentProps<typeof Draw>) {
      const keys = React.useContext(SpecKeys);
      const key = keys.get(ctx.element.children) ?? keys.get(ctx.element.on) ?? type;
      const index = useRepeatScope()?.index;
      return (
        <ElementId.Provider value={index === undefined ? key : `${key}/${index}`}>
          <ElementOn.Provider value={ctx.element.on}><Draw {...ctx} /></ElementOn.Provider>
        </ElementId.Provider>
      );
    },
  ]),
);
export const { handlers } = drawn;

/** The page's action log listens here: each catalog action a spec runs, with its params. */
export const actions = new EventTarget();
export type ActionEvent = CustomEvent<{ name: string; params: unknown }>;
const report = (name: string, params: unknown) => { actions.dispatchEvent(new CustomEvent('action', { detail: { name, params } })); };
