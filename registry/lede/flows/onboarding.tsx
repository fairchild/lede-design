import * as React from 'react';
import { flushSync } from 'react-dom';
import { announce } from '@react-aria/live-announcer';
import { PageHeader } from '../blocks/page-header';
import { FormSection } from '../blocks/form-section';
import { StepIndicator } from '../blocks/step-indicator';
import { AccentPicker } from '../blocks/accent-picker';
import { TextField } from '../text-field';
import { Switch } from '../switch';
import { SegmentedControl } from '../segmented-control';
import { ListGroup, ListRow } from '../list';
import { Button } from '../button';
import type { Preset } from '../theme-provider';

export interface OnboardingData {
  name: string;
  email: string;
  accent: Preset;
  dailyBrief: boolean;
  delivery: 'morning' | 'evening';
}
export interface OnboardingFlowProps {
  /** Product name used in copy. */
  productName: string;
  /** Controlled step, from 0 to 3, where 3 is done, such as one read from the URL. Uncontrolled when omitted. */
  step?: number;
  onStepChange?: (step: number) => void;
  /** Called with each accent as it's chosen, so the page can preview it. */
  onAccentPreview?: (accent: Preset) => void;
  /**
   * Saves the answers when the person presses Finish. Return the save's promise: Review stays up, with Finish pending,
   * until it settles. It resolves to the done step, and a rejection or a throw stays on Review with an inline error
   * that shows the message when it's an `Error` with one, or asks the person to try again. A save that settles after
   * the step changed, such as by the browser's Back, moves nothing. A callback that returns nothing asks for the done
   * step at once, and Finish stays spent until the step changes, so a controlled `step` that stays on Review leaves it
   * pending.
   */
  onComplete: (data: OnboardingData) => void | Promise<void>;
  /** Where "Get started" goes after finishing. */
  doneHref: string;
  /** The answers the flow starts from, read once on mount. */
  defaultValue?: Partial<OnboardingData>;
  /**
   * Called with all the answers after each change. It isn't called on mount. To keep the answers, such as across a
   * reload, store them and pass them back as `defaultValue`.
   */
  onValueChange?: (value: OnboardingData) => void;
  /**
   * Arriving at Account puts the cursor in its first field that needs input. Default `true`. Pass `false` when the
   * person's last input was a touch: there the on-screen keyboard would cover the step before it's read, so the step
   * lands on its h1. A Review row still opens the field it names.
   */
  focusFields?: boolean;
}

/** What a Review row asked to change: the step it opens lands on that control. */
type Ask = 'name' | 'email' | 'accent' | 'brief';

const STEPS = ['Account', 'Preferences', 'Review'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETRY = 'Your answers weren’t saved. They’re still here, so try again.';
type Errors = { name?: string; email?: string };

function validate(data: OnboardingData): Errors {
  const errors: Errors = {};
  if (!data.name.trim()) errors.name = 'Enter the name you want people to see.';
  if (!EMAIL.test(data.email.trim())) errors.email = 'Enter a complete email address, like name@example.com.';
  return errors;
}

/**
 * Hero flow: sign-up in three steps. A native `<form>` per step, named by its `<h1>`, so Enter moves on from every step:
 * each lands where the person acts next. Account puts the cursor in its first field that needs input, Preferences
 * lands on the chosen accent, Review on Finish and the last screen on Get started. Errors say how to fix them. Review
 * states every choice so the person decides from the summary, and each of its rows opens the control it names.
 */
export function OnboardingFlow(props: OnboardingFlowProps) {
  const [inner, setInner] = React.useState(0);
  const [ask, setAsk] = React.useState<Ask>();
  const go = (n: number, asked?: Ask) => { setAsk(asked); if (props.step === undefined) setInner(n); props.onStepChange?.(n); };
  const ids = React.useId();
  const titleId = `${ids}-title`;
  const root = React.useRef<HTMLDivElement>(null);
  const [data, setData] = React.useState<OnboardingData>({
    name: '', email: '', accent: 'blue', dailyBrief: true, delivery: 'morning', ...props.defaultValue,
  });
  const [errors, setErrors] = React.useState<Errors>({});
  // A controlled step can arrive from a URL with no account details yet. Later steps wait for a valid account and a
  // Continue, so the step never changes under the person's typing.
  const [held, setHeld] = React.useState(() => Object.keys(validate(data)).length > 0);
  const set = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => {
    const next = { ...data, [k]: v };
    setData(next);
    props.onValueChange?.(next);
    if (k !== 'name' && k !== 'email') return;
    const f = k as keyof Errors;
    const found = validate(next);
    if (found[f]) setHeld(true);
    // A field that has an error checks itself again on each change, so a fix clears it and the message keeps up.
    if (f in errors) setErrors((now) => ({ ...now, [f]: found[f] }));
  };
  const step = held ? 0 : (props.step ?? inner);
  const inputs = React.useRef<Partial<Record<keyof Errors, HTMLInputElement | null>>>({});

  // Finish fires once until its save settles. A save without a promise counts as pending until the step changes. Each
  // step change starts a new run, so a save that settles in an earlier one moves nothing.
  const [finish, setFinish] = React.useState<{ state: 'idle' | 'saving' } | { state: 'failed'; message: string; n: number }>({ state: 'idle' });
  const finishing = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = React.useRef(0);
  React.useEffect(() => { run.current += 1; finishing.current = false; setFinish({ state: 'idle' }); }, [step]);
  const saving = finish.state === 'saving';
  const complete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (finishing.current) return;
    finishing.current = true;
    const pressed = run.current;
    const current = () => mounted.current && run.current === pressed;
    try {
      const saved = props.onComplete(data);
      if (!saved) { go(3); return; }
      setFinish({ state: 'saving' });
      await saved;
      if (current()) go(3);
    } catch (error) {
      if (!current()) return;
      finishing.current = false;
      setFinish((now) => ({ state: 'failed', message: (error instanceof Error && error.message.trim()) || RETRY, n: (now.state === 'failed' ? now.n : 0) + 1 }));
    }
  };
  const typeIn: Ask | undefined = step !== 0 ? undefined
    : ask === 'name' || ask === 'email' ? ask
    : props.focusFields === false ? undefined
    : !data.name.trim() || EMAIL.test(data.email.trim()) ? 'name' : 'email';

  // In the commit that shows a step, before PageHeader's move, which yields to it. Like `autoFocus`, but only while the
  // document has focus, so a step never pulls focus into an embedded frame, and it can reach a link. Only Account's
  // targets are text; the others raise no on-screen keyboard, so they apply on touch too. A target below the first
  // viewport, as Finish can be at large text sizes, gives way to the h1.
  React.useLayoutEffect(() => {
    const target = step === 0 ? typeIn && `input[autocomplete=${typeIn}]`
      : step === 1 ? (ask === 'brief' ? '[role=switch]' : 'input[type=radio]:checked')
      : step === 2 ? 'button[type=submit]'
      : '.ld-flow-actions a';
    const el = target ? root.current?.querySelector<HTMLElement>(target) : null;
    if (!el || !document.hasFocus()) return;
    if (el.getBoundingClientRect().bottom + window.scrollY > window.innerHeight) return;
    el.focus({ preventScroll: true });
  }, [step]);

  if (step >= 3) {
    return (
      <div ref={root} className="ld-flow ld-flow-narrow">
        <PageHeader
          title={<span id={titleId}>{`You’re all set, ${data.name.trim().split(' ')[0]}`}</span>}
          summary={<span id={`${ids}-summary`}>{data.dailyBrief ? `Your first brief arrives tomorrow ${data.delivery}.` : `${props.productName} is ready when you are.`}</span>}
        />
        <div className="ld-flow-actions">
          <Button variant="filled" size="lg" href={props.doneHref} aria-describedby={`${titleId} ${ids}-summary`}>Get started</Button>
        </div>
      </div>
    );
  }

  // The field is invalid and described by its error before focus reaches it, so the move reads the error. Focus already
  // there fires no event, so then the errors are announced instead.
  const submitAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(data);
    const first = (['name', 'email'] as const).find((k) => found[k]);
    if (!first) { setErrors({}); setHeld(false); go(1); return; }
    flushSync(() => setErrors(found));
    const field = inputs.current[first];
    if (field && field === document.activeElement) announce([found.name, found.email].filter(Boolean).join(' '), 'polite', 1000);
    else field?.focus();
  };

  return (
    <div ref={root} className="ld-flow ld-flow-narrow">
      <StepIndicator steps={STEPS} current={step} />
      {step === 0 ? (
        <form key="s0" aria-labelledby={titleId} noValidate onSubmit={submitAccount}>
          <PageHeader title={<span id={titleId}>Create your account</span>} summary="Two details, then you’re in." />
          <FormSection legend="About you">
            <TextField ref={(el) => { inputs.current.name = el; }} label="Name" autoComplete="name" enterKeyHint="next" value={data.name} onChange={(e) => set('name', e.currentTarget.value)} error={errors.name} required />
            <TextField ref={(el) => { inputs.current.email = el; }} label="Email" type="email" autoComplete="email" inputMode="email" enterKeyHint="next" value={data.email} onChange={(e) => set('email', e.currentTarget.value)} error={errors.email} hint="We’ll send your brief here." required />
          </FormSection>
          <div className="ld-flow-actions">
            <Button variant="filled" size="lg" type="submit">Continue</Button>
          </div>
        </form>
      ) : step === 1 ? (
        <form key="s1" aria-labelledby={titleId} onSubmit={(e) => { e.preventDefault(); go(2); }}>
          <PageHeader title={<span id={titleId}>Make it yours</span>} summary="You can change these any time in Settings." />
          <FormSection legend="Accent" description="Used for buttons, links, selection and focus.">
            <AccentPicker value={data.accent} onValueChange={(v) => { set('accent', v); props.onAccentPreview?.(v); }} />
          </FormSection>
          <FormSection legend="Daily brief">
            <Switch label="Send me a daily brief" checked={data.dailyBrief} onCheckedChange={(v) => set('dailyBrief', v)} />
            {data.dailyBrief ? (
              <SegmentedControl
                label="Delivery time"
                block
                options={[{ value: 'morning', label: 'Morning' }, { value: 'evening', label: 'Evening' }]}
                value={data.delivery}
                onValueChange={(v) => set('delivery', v as OnboardingData['delivery'])}
              />
            ) : null}
          </FormSection>
          <div className="ld-flow-actions">
            <Button variant="plain" onClick={() => go(0)}>Back</Button>
            <Button variant="filled" size="lg" type="submit">Continue</Button>
          </div>
        </form>
      ) : (
        <form key="s2" aria-labelledby={titleId} aria-busy={saving || undefined} onSubmit={complete}>
          <PageHeader title={<span id={titleId}>Review</span>} summary="Check everything, then finish." />
          <ListGroup title="Account" headingLevel={2}>
            <ListRow title="Name" value={data.name} onClick={() => { if (!saving) go(0, 'name'); }} />
            <ListRow title="Email" value={data.email} onClick={() => { if (!saving) go(0, 'email'); }} />
          </ListGroup>
          <div style={{ height: 'var(--space-6)' }} />
          <ListGroup title="Preferences" headingLevel={2}>
            <ListRow title="Accent" value={data.accent[0].toUpperCase() + data.accent.slice(1)} onClick={() => { if (!saving) go(1, 'accent'); }} />
            <ListRow title="Daily brief" value={data.dailyBrief ? `On, ${data.delivery}` : 'Off'} onClick={() => { if (!saving) go(1, 'brief'); }} />
          </ListGroup>
          {finish.state === 'failed' ? <p key={finish.n} className="ld-flow-error" role="alert">{finish.message}</p> : null}
          <div className="ld-flow-actions" style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="plain" disabled={saving} onClick={() => go(1)}>Back</Button>
            <Button variant="filled" size="lg" type="submit">{saving ? 'Finishing…' : 'Finish'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
