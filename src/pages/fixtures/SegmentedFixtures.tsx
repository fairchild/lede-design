import * as React from 'react';
import { Button } from '@lede/button';
import { PageHeader } from '@lede/blocks/page-header';
import { SegmentedControl } from '@lede/segmented-control';
import { ThemeProvider } from '@lede/theme-provider';

const CASES = [
  { title: 'Unequal labels, 288px, compact', width: 288, density: 'compact', block: true, label: 'Filter', options: ['All', 'Unread', 'Archived'], value: 'Unread' },
  { title: 'Unequal labels, 288px, regular', width: 288, density: 'regular', block: true, label: 'Filter', options: ['All', 'Unread', 'Archived'], value: 'Unread' },
  { title: 'A long label, 240px', width: 240, density: 'regular', block: true, label: 'Mode', options: ['Automatic', 'Light', 'Dark'], value: 'Light' },
  { title: 'Inline, 240px', width: 240, density: 'compact', block: false, label: 'Range', options: ['Day', 'Week', 'Month', 'Year'], value: 'Month' },
] as const;

const SETS = [
  [{ value: 'a0', label: 'One' }, { value: 'b0', label: 'Two' }, { value: 'c0', label: 'Three' }],
  [{ value: 'a1', label: 'One' }, { value: 'b1', label: 'Two' }, { value: 'c1', label: 'Three' }],
];

/** The same number of options with new values, then a longer first label under the same value; the checked position stays. */
function Replaced() {
  const [set, setSet] = React.useState(0);
  const [long, setLong] = React.useState(false);
  const [checked, setChecked] = React.useState(1);
  const options = SETS[set].map((o, i) => (i === 0 && long ? { ...o, label: 'The first option' } : o));
  return (
    <section aria-label="Options replaced, 288px" className="docs-section">
      <ThemeProvider density="compact">
        <div style={{ width: 288 }}>
          <SegmentedControl
            block
            label="Replaced"
            options={options}
            value={options[checked].value}
            onValueChange={(v) => setChecked(options.findIndex((o) => o.value === v))}
          />
        </div>
      </ThemeProvider>
      <Button variant="gray" onClick={() => setSet((n) => 1 - n)}>Replace options</Button>
      <Button variant="gray" onClick={() => setLong((l) => !l)}>Lengthen the first label</Button>
    </section>
  );
}

/** Required, with nothing chosen yet: no thumb, an error that describes the group, and radios that fail their check. */
function Unchosen() {
  const [value, setValue] = React.useState('');
  const error = React.useId();
  return (
    <section aria-label="Nothing chosen, required, 240px" className="docs-section">
      <div style={{ width: 240 }}>
        <SegmentedControl
          block
          required
          label="Mode"
          options={['Automatic', 'Light', 'Dark']}
          value={value}
          onValueChange={setValue}
          aria-invalid={!value}
          aria-describedby={value ? undefined : error}
        />
      </div>
      {value ? null : <p id={error}>Choose a mode.</p>}
    </section>
  );
}

/**
 * SegmentedControls with labels of unequal length in narrow boxes, for tests/segmented-control.spec.ts, which also
 * doubles the text size, widens a box, replaces options and starts one with nothing chosen. Not linked from the
 * navigation.
 */
export function SegmentedFixtures() {
  return (
    <div className="ld-flow">
      <PageHeader title="Segmented control fixtures" summary="Unequal labels in narrow boxes, for the automated tests." />
      {CASES.map((c) => (
        <section key={c.title} aria-label={c.title} className="docs-section">
          <ThemeProvider density={c.density}>
            <div style={{ width: c.width }}>
              <SegmentedControl label={c.label} block={c.block} options={[...c.options]} defaultValue={c.value} />
            </div>
          </ThemeProvider>
        </section>
      ))}
      <Replaced />
      <Unchosen />
    </div>
  );
}
