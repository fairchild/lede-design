import type * as React from 'react';
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
import { catalog } from './catalog';

/**
 * Each catalog type drawn by its Lede component. A spec renders inside this page's preview, below the page's own h1,
 * so its headings start at h2 and its PageHeader leaves focus where the reader is.
 */
export const { registry, handlers } = defineRegistry(catalog, {
  components: {
    Screen: ({ children }) => <div className="ld-flow ld-flow-stack">{children}</div>,
    PageHeader: ({ props, slots }) => (
      <PageHeader title={props.title} summary={props.summary} actions={slots?.actions} headingLevel={2} focusOnMount={false} />
    ),
    ListGroup: ({ props, children }) => (
      <ListGroup title={props.title} summary={props.summary} footer={props.footer} headingLevel={3}>{children}</ListGroup>
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
    EmptyState: ({ props, slots }) => <EmptyState title={props.title} description={props.description} action={slots?.action} headingLevel={3} />,
    SummaryCard: ({ props }) => <SummaryCard title={props.title} summary={props.summary} figure={props.figure} status={props.status} headingLevel={3} />,
  },
  actions: {
    open: async (params) => report('open', params),
    archive: async (params) => report('archive', params),
    submit: async (params) => report('submit', params),
  },
});

/** The page's action log listens here: each catalog action a spec runs, with its params. */
export const actions = new EventTarget();
export type ActionEvent = CustomEvent<{ name: string; params: unknown }>;
const report = (name: string, params: unknown) => { actions.dispatchEvent(new CustomEvent('action', { detail: { name, params } })); };
