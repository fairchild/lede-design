import * as React from 'react';
import { Button } from '@lede/button';
import { PageHeader } from '@lede/blocks/page-header';

/**
 * A screen that replaces itself under a control that stays: the button keeps focus as each new screen's PageHeader
 * mounts, and the heading still takes it, for tests/focus-table.ts. Not linked from the navigation.
 */
export function PageHeaderFixtures() {
  const [screen, setScreen] = React.useState(1);
  return (
    <div className="ld-flow">
      <PageHeader key={screen} title={screen === 1 ? 'Page header fixtures' : `Screen ${screen}`} summary="A screen that mounts under a control that keeps focus, for the automated tests." />
      <Button variant="gray" onClick={() => setScreen((n) => n + 1)}>Show the next screen</Button>
    </div>
  );
}
