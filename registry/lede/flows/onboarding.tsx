import * as React from 'react';
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
  onComplete: (data: OnboardingData) => void;
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
  const [errors, setErrors] = React.useState<{ name?: string; email?: string }>({});
  const set = <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => {
    const next = { ...data, [k]: v };
    setData(next);
    props.onValueChange?.(next);
  };
  // A controlled step can arrive from a URL with no account details yet; later steps wait for a valid account.
  const accountDone = !!data.name.trim() && EMAIL.test(data.email.trim());
  const step = accountDone ? (props.step ?? inner) : 0;
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

  const submitAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!data.name.trim()) next.name = 'Enter the name you want people to see.';
    if (!EMAIL.test(data.email.trim())) next.email = 'Enter a complete email address, like name@example.com.';
    setErrors(next);
    if (Object.keys(next).length === 0) go(1);
    else (document.getElementById(next.name ? 'onb-name' : 'onb-email') as HTMLInputElement | null)?.focus();
  };

  return (
    <div ref={root} className="ld-flow ld-flow-narrow">
      <StepIndicator steps={STEPS} current={step} />
      {step === 0 ? (
        <form key="s0" aria-labelledby={titleId} noValidate onSubmit={submitAccount}>
          <PageHeader title={<span id={titleId}>Create your account</span>} summary="Two details, then you’re in." />
          <FormSection legend="About you">
            <TextField id="onb-name" label="Name" autoComplete="name" enterKeyHint="next" value={data.name} onChange={(e) => set('name', e.currentTarget.value)} error={errors.name} required />
            <TextField id="onb-email" label="Email" type="email" autoComplete="email" inputMode="email" enterKeyHint="next" value={data.email} onChange={(e) => set('email', e.currentTarget.value)} error={errors.email} hint="We’ll send your brief here." required />
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
        <form key="s2" aria-labelledby={titleId} onSubmit={(e) => { e.preventDefault(); props.onComplete(data); go(3); }}>
          <PageHeader title={<span id={titleId}>Review</span>} summary="Check everything, then finish." />
          <ListGroup title="Account" headingLevel={2}>
            <ListRow title="Name" value={data.name} onClick={() => go(0, 'name')} />
            <ListRow title="Email" value={data.email} onClick={() => go(0, 'email')} />
          </ListGroup>
          <div style={{ height: 'var(--space-6)' }} />
          <ListGroup title="Preferences" headingLevel={2}>
            <ListRow title="Accent" value={data.accent[0].toUpperCase() + data.accent.slice(1)} onClick={() => go(1, 'accent')} />
            <ListRow title="Daily brief" value={data.dailyBrief ? `On, ${data.delivery}` : 'Off'} onClick={() => go(1, 'brief')} />
          </ListGroup>
          <div className="ld-flow-actions" style={{ marginTop: 'var(--space-6)' }}>
            <Button variant="plain" onClick={() => go(1)}>Back</Button>
            <Button variant="filled" size="lg" type="submit">Finish</Button>
          </div>
        </form>
      )}
    </div>
  );
}
