import * as React from 'react';
import { ProfileFlow, type Profile } from '@lede/flows/profile';
import { Button } from '@lede/button';

/** A flow whose save stays pending until one of its buttons settles it. */
function Fixture({ label, initial }: { label: string; initial: Profile }) {
  const [value, setValue] = React.useState(initial);
  const [saves, setSaves] = React.useState(0);
  const settle = React.useRef<{ finish: () => void; refuse: (reason: unknown) => void }>(null);
  const onSave = (next: Profile) => new Promise<void>((resolve, reject) => {
    setSaves((n) => n + 1);
    settle.current = { finish: () => { setValue(next); resolve(); }, refuse: reject };
  });
  return (
    <section aria-label={label} className="docs-section">
      <div className="docs-demo">
        <Button onClick={() => settle.current?.finish()}>Finish save</Button>
        <Button onClick={() => settle.current?.refuse(new Error('The server is busy. Try again in a minute.'))}>Refuse save</Button>
        <Button onClick={() => settle.current?.refuse(undefined)}>Refuse, no reason</Button>
        <Button onClick={() => settle.current?.refuse(new Error('   '))}>Refuse, blank reason</Button>
        <Button onClick={() => settle.current?.refuse(new Error(`Couldn't reach https://example.com/${'a'.repeat(180)}`))}>Refuse, long reason</Button>
        <p className="docs-notice">Saves asked for: {saves}</p>
      </div>
      <ProfileFlow value={value} onSave={onSave} />
    </section>
  );
}

/**
 * Test fixtures for what the demo can't show: a slow save, a refusal with and without a reason, and two flows on one
 * page. Not linked from the navigation, and not in a11y.spec's ROUTES because two flows mean two h1s.
 * tests/profile.spec.ts drives it.
 */
export function ProfileFixtures() {
  return (
    <>
      <Fixture label="Slow save" initial={{ name: 'Chen Wei', email: 'chen@example.com', role: 'Analyst', location: 'Lisbon', bio: 'Runs the numbers.' }} />
      <Fixture label="Second flow" initial={{ name: 'Ben Lindqvist', email: 'ben@example.com' }} />
    </>
  );
}
