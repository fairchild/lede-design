import * as React from 'react';
import { PageHeader } from '../blocks/page-header';
import { FormSection } from '../blocks/form-section';
import { AccentPicker } from '../blocks/accent-picker';
import { ListGroup, ListRow } from '../list';
import { Switch } from '../switch';
import { SegmentedControl } from '../segmented-control';
import { Card } from '../card';
import { Button } from '../button';
import type { Preset } from '../theme-provider';

export interface SettingsRow {
  id: string;
  title: string;
  subtitle?: string;
  /** Current value, shown trailing, such as "Automatic". */
  value?: string;
  /** Next level for this setting. */
  href?: string;
  leading?: React.ReactNode;
  /** An instant on/off setting. A row with a toggle has no `href`. */
  toggle?: { checked: boolean; onCheckedChange: (v: boolean) => void };
}
export interface SettingsGroup {
  id: string;
  /** The group's heading. */
  title: string;
  summary?: string;
  footer?: string;
  rows: SettingsRow[];
}
export interface SettingsFlowProps { title?: string; summary?: string; groups: SettingsGroup[]; }

/** Hero flow, level 1: grouped settings. Every row states its current value, so nothing needs opening to be known. */
export function SettingsFlow(props: SettingsFlowProps) {
  return (
    <div className="ld-flow ld-flow-narrow">
      <PageHeader title={props.title ?? 'Settings'} summary={props.summary} />
      <div className="ld-flow-stack">
        {props.groups.map((g) => (
          <ListGroup key={g.id} title={g.title} summary={g.summary} footer={g.footer}>
            {g.rows.map((r) => (
              <ListRow
                key={r.id}
                title={r.title}
                subtitle={r.subtitle}
                value={r.toggle ? undefined : r.value}
                leading={r.leading}
                href={r.toggle ? undefined : r.href}
                trailing={r.toggle ? <Switch aria-label={r.title} checked={r.toggle.checked} onCheckedChange={r.toggle.onCheckedChange} /> : undefined}
              />
            ))}
          </ListGroup>
        ))}
      </div>
    </div>
  );
}

export interface AppearancePrefs {
  scheme: 'auto' | 'light' | 'dark';
  highContrast: boolean;
  accent: Preset;
  shape: 'soft' | 'crisp' | 'square';
  compact: boolean;
  solidGlass: boolean;
}
export interface AppearanceFlowProps {
  value: AppearancePrefs;
  /** Called with the whole new set on each change. */
  onValueChange: (next: AppearancePrefs) => void;
  back?: { href: string; label: string };
}

const SCHEME_LABEL = { auto: 'Automatic', light: 'Light', dark: 'Dark' } as const;
const SHAPE_LABEL = { soft: 'Soft', crisp: 'Crisp', square: 'Square' } as const;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Summary line for the Appearance row and header, such as "Automatic · Blue · Soft corners". */
export function describeAppearance(p: AppearancePrefs) {
  return [SCHEME_LABEL[p.scheme], cap(p.accent), `${SHAPE_LABEL[p.shape]} corners`, p.highContrast ? 'High contrast' : null]
    .filter(Boolean)
    .join(' · ');
}

/** Hero flow, level 2: appearance. Each change applies as it's made, with no Save, and the header states the result. */
export function AppearanceFlow({ value, onValueChange, back }: AppearanceFlowProps) {
  const set = <K extends keyof AppearancePrefs>(k: K, v: AppearancePrefs[K]) => onValueChange({ ...value, [k]: v });
  return (
    <div className="ld-flow ld-flow-narrow">
      <PageHeader title="Appearance" summary={describeAppearance(value)} back={back} />
      <FormSection legend="Preview" description="Every change applies as you make it.">
        {/* A picture of the result: `inert` keeps its controls out of the tab order and the accessibility tree. */}
        <Card surface="muted" padding="md" className="ld-preview-card" inert>
          <Button variant="filled">Continue</Button>
          <Button variant="tinted">Add to list</Button>
          <Switch label="Sync" defaultChecked />
        </Card>
      </FormSection>
      <FormSection legend="Mode">
        <SegmentedControl
          label="Mode"
          block
          options={[{ value: 'auto', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          value={value.scheme}
          onValueChange={(v) => set('scheme', v as AppearancePrefs['scheme'])}
        />
      </FormSection>
      <FormSection legend="Accent" description="Used for buttons, links, selection and focus.">
        <AccentPicker value={value.accent} onValueChange={(v) => set('accent', v)} />
      </FormSection>
      <FormSection legend="Corners">
        <SegmentedControl
          label="Corners"
          block
          options={[{ value: 'soft', label: 'Soft' }, { value: 'crisp', label: 'Crisp' }, { value: 'square', label: 'Square' }]}
          value={value.shape}
          onValueChange={(v) => set('shape', v as AppearancePrefs['shape'])}
        />
      </FormSection>
      <FormSection legend="Accessibility">
        <Switch label="Increase contrast" checked={value.highContrast} onCheckedChange={(v) => set('highContrast', v)} />
        <Switch label="Reduce transparency" checked={value.solidGlass} onCheckedChange={(v) => set('solidGlass', v)} />
        <Switch label="Compact controls" checked={value.compact} onCheckedChange={(v) => set('compact', v)} />
      </FormSection>
    </div>
  );
}
