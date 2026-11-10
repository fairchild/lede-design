import * as React from 'react';
import { OnboardingFlow, type OnboardingData } from '@lede/flows/onboarding';
import { Button } from '@lede/button';

/** An uncontrolled flow whose Finish stays pending until one of its buttons settles it, or throws when asked to. */
function SlowFinish() {
  const [asks, setAsks] = React.useState(0);
  const settle = React.useRef<{ finish: () => void; refuse: (reason: unknown) => void }>(null);
  const throwNext = React.useRef(false);
  const onComplete = (_: OnboardingData) => {
    if (throwNext.current) { throwNext.current = false; throw new Error('The form couldn’t be sent.'); }
    return slowSave();
  };
  const slowSave = () => new Promise<void>((resolve, reject) => {
    setAsks((n) => n + 1);
    settle.current = { finish: resolve, refuse: reject };
  });
  return (
    <section aria-label="Slow finish" className="docs-section">
      <div className="docs-demo">
        <Button onClick={() => settle.current?.finish()}>Finish save</Button>
        <Button onClick={() => settle.current?.refuse(new Error('The server is busy. Try again in a minute.'))}>Refuse save</Button>
        <Button onClick={() => settle.current?.refuse(undefined)}>Refuse, no reason</Button>
        <Button onClick={() => { throwNext.current = true; }}>Throw on the next Finish</Button>
        <p className="docs-notice">Saves asked for: {asks}</p>
      </div>
      <OnboardingFlow productName="Daybook" onComplete={onComplete} doneHref="#" defaultValue={{ name: 'Ada Lovelace', email: 'ada@example.com' }} />
    </section>
  );
}

/** A controlled flow whose step can change while its save is pending, as the browser's Back can change it. */
function ControlledFinish() {
  const [step, setStep] = React.useState(0);
  const settle = React.useRef<() => void>(null);
  const onComplete = (_: OnboardingData) => new Promise<void>((resolve) => { settle.current = resolve; });
  return (
    <section aria-label="Controlled finish" className="docs-section">
      <div className="docs-demo">
        <Button onClick={() => settle.current?.()}>Finish save</Button>
        <Button onClick={() => setStep(1)}>Show Preferences</Button>
        <p className="docs-notice">Step asked for: {step}</p>
      </div>
      <OnboardingFlow productName="Daybook" step={step} onStepChange={setStep} onComplete={onComplete} doneHref="#" defaultValue={{ name: 'Grace Hopper', email: 'grace@example.com' }} />
    </section>
  );
}

/** A controlled flow asked for Review before it has an account, as a URL can ask. */
function HeldStep() {
  const [step, setStep] = React.useState(2);
  return (
    <section aria-label="Held step" className="docs-section">
      <p className="docs-notice">Step asked for: {step}</p>
      <OnboardingFlow productName="Daybook" step={step} onStepChange={setStep} onComplete={() => {}} doneHref="#" />
    </section>
  );
}

/**
 * Test fixtures for what the demo can't show: an uncontrolled flow with a slow, refused or throwing Finish, a
 * controlled step that waits for an account, and a controlled step that changes while a save is pending. Not linked from the navigation, and not in a11y.spec's ROUTES because two flows mean two
 * h1s. tests/onboarding-flow.spec.ts drives it.
 */
export function OnboardingFixtures() {
  return (
    <>
      <SlowFinish />
      <HeldStep />
      <ControlledFinish />
    </>
  );
}
