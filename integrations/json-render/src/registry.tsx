import * as React from 'react';
import { defineRegistry, useBoundProp } from '@json-render/react';
import { Button } from '@/components/lede/button';
import { Checkbox } from '@/components/lede/checkbox';
import { ListGroup, ListRow } from '@/components/lede/list';
import { SegmentedControl } from '@/components/lede/segmented-control';
import { Switch } from '@/components/lede/switch';
import { TextField } from '@/components/lede/text-field';
import { EmptyState } from '@/components/lede/blocks/empty-state';
import { FormSection } from '@/components/lede/blocks/form-section';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { SummaryCard } from '@/components/lede/blocks/summary-card';
import { focusLanding } from '@/components/lede/input-modality';
import { catalog } from './catalog';

type Level = 2 | 3 | 4 | 5 | 6;

/**
 * The level of a spec's title. A spec renders below its host page's own h1, so it starts at h2 by default, and a host
 * that puts it under another heading, such as a chat message's author, provides a deeper level. Sections sit one below.
 */
export const SpecHeadingLevel = React.createContext<2 | 3 | 4 | 5>(2);
const useLevels = () => {
  const title = React.useContext(SpecHeadingLevel);
  return { title, section: (title + 1) as Level };
};

/**
 * Each catalog type drawn by its Lede component. The spec's PageHeader leaves focus where the reader is. PageHeader
 * takes an h1 or h2 only, so a deeper title draws its parts with the same classes.
 */
export const { registry, handlers } = defineRegistry(catalog, {
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
    Button: ({ props, emit }) => (
      <Button variant={props.variant} tone={props.tone} size={props.size} block={props.block} disabled={props.disabled} onClick={() => emit('press')}>
        {props.label}
      </Button>
    ),
    TextField: ({ props, bindings }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      return (
        <TextField
          label={props.label}
          type={props.type}
          placeholder={props.placeholder}
          hint={props.hint}
          error={props.error}
          required={props.required}
          rows={props.rows}
          value={value ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.currentTarget.value)}
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
        <label className="jr-check">
          <Checkbox checked={!!checked} disabled={props.disabled} onChange={(e) => { setChecked(e.currentTarget.checked); emit('change'); }} />
          <span>{props.label}</span>
        </label>
      );
    },
    SegmentedControl: ({ props, bindings, emit }) => {
      const [value, setValue] = useBoundProp(props.value, bindings?.value);
      return <SegmentedControl label={props.label} options={props.options} value={value} onValueChange={(next) => { setValue(next); emit('change'); }} />;
    },
    FormSection: ({ props, children }) => <FormSection legend={props.legend} description={props.description}>{children}</FormSection>,
    EmptyState: ({ props, slots }) => (
      <EmptyState title={props.title} description={props.description} action={slots?.action} headingLevel={Math.min(useLevels().section, 3) as 2 | 3} />
    ),
    SummaryCard: ({ props }) => (
      <SummaryCard title={props.title} summary={props.summary} figure={props.figure} status={props.status} headingLevel={Math.min(useLevels().section, 4) as 3 | 4} />
    ),
  },
  actions: {
    open: async (params) => report('open', params),
    archive: async (params) => report('archive', params),
    submit: async (params) => report('submit', params),
  },
});

/**
 * A row action can hide its own row, through a `visible` condition. Focus then moves to the next row, or the one
 * before it, or the screen's title, so it never falls to `<body>`.
 */
function keepFocus(rowKey: string) {
  const row = document.querySelector(`[data-row-id="${CSS.escape(rowKey)}"]`);
  const sibling = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>('.ld-row-target');
  const title = row?.closest('.ld-flow')?.querySelector<HTMLElement>('h2, h3, h4, h5');
  setTimeout(() => { if (!row?.isConnected && (document.activeElement === document.body || !document.activeElement)) focusLanding(sibling ?? title); }, 50);
}

/** The page's action log listens here: each catalog action a spec runs, with its params. */
export const actions = new EventTarget();
export type ActionEvent = CustomEvent<{ name: string; params: unknown }>;
const report = (name: string, params: unknown) => { actions.dispatchEvent(new CustomEvent('action', { detail: { name, params } })); };
