import * as React from 'react';
import { Button } from '@lede/button';
import { Card } from '@lede/card';
import { Checkbox } from '@lede/checkbox';
import { GlassBar } from '@lede/glass-bar';
import { Switch } from '@lede/switch';
import { PageHeader, useBackOnEscape } from '@lede/blocks/page-header';
import { StepIndicator } from '@lede/blocks/step-indicator';

const PICTURE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect width="1" height="1" fill="gray"/%3E%3C/svg%3E';

/**
 * A form with a Switch and a native checkbox beside it, which counts its submit button's clicks and the form's submits.
 * `submit` is a Submit button, enabled or disabled, an image button, or none. `fields` is how many text fields it has.
 */
function SwitchForm({ title, submit = 'button', fields = 0 }: { title: string; submit?: 'button' | 'disabled' | 'image' | 'none'; fields?: number }) {
  const [submits, setSubmits] = React.useState(0);
  const [clicks, setClicks] = React.useState(0);
  const click = () => setClicks((n) => n + 1);
  return (
    <section aria-label={title} className="docs-section">
      <form onSubmit={(e) => { e.preventDefault(); setSubmits((n) => n + 1); }}>
        {Array.from({ length: fields }, (_, i) => <input key={i} type="text" aria-label={`Field ${i + 1}`} />)}
        <Switch name="brief" label="Daily brief" />
        <label><input type="checkbox" /> Native checkbox</label>
        {submit === 'button' || submit === 'disabled' ? <Button type="submit" disabled={submit === 'disabled'} onClick={click}>Submit</Button> : null}
        {submit === 'image' ? <input type="image" src={PICTURE} alt="Submit" width={24} height={24} onClick={click} /> : null}
      </form>
      <p>Submits: {submits} · Clicks: {clicks}</p>
    </section>
  );
}

/** A layer inside the screen that backs out on Escape before the screen's back link. */
function InnerLayer() {
  const [open, setOpen] = React.useState(false);
  const opener = React.useRef<HTMLButtonElement>(null);
  useBackOnEscape(open ? () => { setOpen(false); opener.current?.focus(); } : undefined);
  return (
    <section aria-label="Inner layer" className="docs-section">
      <Button ref={opener} variant="gray" onClick={() => setOpen(true)}>Open the inner layer</Button>
      {open ? <p>The inner layer is open.</p> : null}
    </section>
  );
}

/** A Checkbox whose ref callback returns a cleanup, for React 19. */
function CheckboxRef() {
  const [shown, setShown] = React.useState(true);
  const [cleanups, setCleanups] = React.useState(0);
  const ref = React.useCallback((el: HTMLInputElement | null) => {
    if (!el) return undefined;
    return () => setCleanups((n) => n + 1);
  }, []);
  return (
    <section aria-label="Checkbox ref" className="docs-section">
      {shown ? <label><Checkbox ref={ref} /> Pick me</label> : null}
      <Button variant="gray" onClick={() => setShown((s) => !s)}>Toggle the checkbox</Button>
      <p>Ref cleanups: {cleanups}</p>
    </section>
  );
}

/** Primitives and small blocks in the states their specs drive. Not linked from the navigation. */
export function PrimitivesFixtures() {
  return (
    <div className="ld-flow">
      <PageHeader title="Primitives fixtures" summary="Small primitives and blocks in the states the automated tests drive." back={{ href: '/fixtures/page-header', label: 'Page header fixtures' }} />
      <section aria-label="Glass card" className="docs-section">
        <div style={{ padding: 24, background: 'repeating-linear-gradient(45deg, var(--primary) 0 12px, var(--background) 12px 24px)' }}>
          <Card surface="glass" padding="md" data-testid="glass">A glass card over stripes.</Card>
        </div>
        <Card padding="md" data-testid="plain">A plain card.</Card>
      </section>
      <SwitchForm title="Switch with a Submit button" />
      <SwitchForm title="Switch with a disabled Submit button" submit="disabled" />
      <SwitchForm title="Switch with an image Submit button" submit="image" />
      <SwitchForm title="Switch alone, no Submit button" submit="none" />
      <SwitchForm title="Switch and one text field, no Submit button" submit="none" fields={1} />
      <SwitchForm title="Switch and two text fields, no Submit button" submit="none" fields={2} />
      <section aria-label="Links with no value" className="docs-section">
        <GlassBar aria-label="Places" items={[{ value: 'other', label: 'Other page', href: '/fixtures/page-header' }, { value: 'here', label: 'This page', href: '/fixtures/primitives' }]} />
      </section>
      <section aria-label="Steps" className="docs-section">
        <StepIndicator steps={['Account', 'Preferences', 'Review']} current={1} />
      </section>
      <InnerLayer />
      <CheckboxRef />
    </div>
  );
}
