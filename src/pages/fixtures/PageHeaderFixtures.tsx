import * as React from 'react';
import { Button } from '@lede/button';
import { Switch } from '@lede/switch';
import { PageHeader } from '@lede/blocks/page-header';

/**
 * A screen that replaces itself under a control that stays: the button keeps focus as each new screen's PageHeader
 * mounts, and the heading still takes it. Below it, a detail that opens in place under a level 3 header whose back is
 * a button. Both for tests/focus-table.ts. Not linked from the navigation.
 */
export function PageHeaderFixtures() {
  const [screen, setScreen] = React.useState(1);
  return (
    <div className="ld-flow">
      <PageHeader key={screen} title={screen === 1 ? 'Page header fixtures' : `Screen ${screen}`} summary="A screen that mounts under a control that keeps focus, for the automated tests." />
      <Button variant="gray" onClick={() => setScreen((n) => n + 1)}>Show the next screen</Button>
      <section className="ld-flow-stack" aria-label="A header in a stack">
        <PageHeader headingLevel={2} focusOnMount={false} title="A header in a stack" summary="An inline-level control follows it." />
        <Switch label="Show the stack spacing" />
      </section>
      <DetailInPlace />
    </div>
  );
}

/** A detail that opens inside the page. Its back button, or Escape, closes it, and focus returns to the opener. */
function DetailInPlace() {
  const [open, setOpen] = React.useState(false);
  const opener = React.useRef<HTMLButtonElement>(null);
  const returning = React.useRef(false);
  React.useLayoutEffect(() => {
    if (open || !returning.current) return;
    returning.current = false;
    opener.current?.focus();
  }, [open]);
  const close = () => { returning.current = true; setOpen(false); };
  return (
    <section className="ld-flow-stack" aria-labelledby="detail-in-place">
      <h2 id="detail-in-place" className="text-title-3">A detail inside the page</h2>
      {open ? (
        <PageHeader headingLevel={3} title="Venue for Thursday" summary="It opened in place, under this section’s heading." back={{ label: 'Messages', onClick: close }} backOnEscape />
      ) : (
        <Button ref={opener} variant="gray" onClick={() => setOpen(true)}>Open the detail</Button>
      )}
    </section>
  );
}
