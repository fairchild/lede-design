import * as React from 'react';
import { useNavigate, useParams } from 'react-router';
import { OnboardingFlow, type OnboardingData } from '@lede/flows/onboarding';
import { useBackOnEscape } from '@lede/blocks/page-header';
import { ThemeProvider } from '@lede/theme-provider';
import { useAppearance } from '@/theme';
import { useProfile } from '@/profile';
import { RouterLink } from '@/router-link';
import { dispatch, useDemo, type OnboardingStep } from '@/demo-store';
import { lastInputWasTouch } from '@lede/input-modality';

const STEPS = ['', 'preferences', 'review', 'done'];
const DONE = STEPS.length - 1;
const href = (n: number) => `/app/welcome${STEPS[n] ? `/${STEPS[n]}` : ''}`;
/**
 * Whether the tab has an earlier entry from this app, docs pages included. It reads React Router's `history.state.idx`,
 * which counts from 0 at the last full load of an entry with no history state, so a URL typed into the tab starts it
 * again at 0. Without the field, Cancel pushes `/app`.
 */
const hasEarlierEntry = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

/**
 * Onboarding runs outside the app shell: one task, no navigation competing with it. Each step has its own URL, and the
 * flow is one history entry: its steps replace each other, so the browser's Back leaves the flow and the flow's own
 * Back moves between steps. A replay edits the signed-in person, so it starts from the profile and Settings, and
 * Finish writes the answers back. Until then they're a draft in the demo store, so a reload keeps them.
 */
export function WelcomePage() {
  const { step = '' } = useParams();
  const navigate = useNavigate();
  const { prefs, setPrefs } = useAppearance();
  const { profile, saveProfile } = useProfile();
  const { brief, onboarding: { draft, finished } } = useDemo();
  const data: OnboardingData = {
    name: profile.name, email: profile.email, accent: prefs.accent, dailyBrief: brief.on, delivery: brief.delivery, ...draft?.answers,
  };

  // A URL for a step the draft hasn't reached, or for no step, shows the furthest step there is and takes its URL.
  // Done is there only once Finish has saved, with no draft since.
  const asked = STEPS.indexOf(step);
  const reached = draft?.reached ?? 0;
  const done = finished && !draft;
  const shown = asked >= 0 && (asked <= reached || (asked === DONE && done)) ? asked : done ? DONE : reached;
  React.useEffect(() => {
    if (shown !== asked) navigate(href(shown), { replace: true });
  }, [shown, asked, navigate]);
  const go = (n: number) => navigate(href(n), { replace: true });

  // Counted, so each refusal mounts a new alert and is announced again. It belongs to Review, so any step change clears it.
  const [refusals, setRefusals] = React.useState(0);
  React.useEffect(() => setRefusals(0), [shown]);
  // Only Cancel drops the draft: any other way out, the browser's Back included, keeps it for Forward or a replay. Cancel
  // marks the exit, and the draft goes as the page unmounts, so the flow never shows a step without it on the way out.
  // It goes on `pagehide` too, for a Back that loads the earlier entry as a new document and never unmounts the page.
  // A page the browser restores from its back-forward cache starts unmarked, so its next draft stays.
  const cancelled = React.useRef(false);
  const here = React.useRef(true);
  React.useEffect(() => {
    here.current = true;
    const drop = () => { if (cancelled.current) dispatch({ type: 'onboarding/leave' }); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) cancelled.current = false; };
    window.addEventListener('pagehide', drop);
    window.addEventListener('pageshow', restore);
    return () => {
      here.current = false;
      window.removeEventListener('pagehide', drop);
      window.removeEventListener('pageshow', restore);
      drop();
    };
  }, []);

  // Escape on a step is Cancel, and drops the draft as Cancel does, while the step's answers are as they were when it
  // opened. Once the person changes one, Escape waits, wherever focus is, so a stray press never throws typing away.
  // The finished screen has no Cancel and nothing to back out of.
  const answers = JSON.stringify(data);
  const opened = React.useRef({ shown, answers });
  if (opened.current.shown !== shown) opened.current = { shown, answers };
  const unchanged = answers === opened.current.answers;
  const cancelLink = React.useRef<HTMLAnchorElement>(null);
  useBackOnEscape(shown < DONE && unchanged ? () => cancelLink.current?.click() : undefined);

  // Finish moves on only once the profile saves, and the accent, the brief and the end of the draft save after it, so
  // an offline Finish stays on Review and saves nothing. A Finish whose save succeeds commits all of it, even for a
  // reader who has left by then; only a reader still here moves on to Done.
  const finish = (answers: OnboardingData) => {
    saveProfile({ ...profile, name: answers.name.trim(), email: answers.email.trim() }).then(
      () => {
        setPrefs({ ...prefs, accent: answers.accent });
        dispatch({ type: 'brief', on: answers.dailyBrief, delivery: answers.delivery });
        dispatch({ type: 'onboarding/finish' });
        if (here.current) go(DONE);
      },
      () => setRefusals((n) => n + 1),
    );
  };
  return (
    // The accent being picked shows on this page only, until Finish saves it.
    <ThemeProvider accent={data.accent} glass={prefs.solidGlass ? 'solid' : 'regular'}>
      <main id="main" className="onboarding-main" tabIndex={-1}>
        {shown < DONE ? (
          <div className="docs-onboarding-cancel">
            <RouterLink
              ref={cancelLink}
              className="ld-back"
              href="/app"
              onClick={(event) => {
                // A click that opens a new tab or window leaves this page, and its draft, as they are.
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                cancelled.current = true;
                // The flow is one history entry, so the entry before it is where the reader came from.
                if (hasEarlierEntry()) { event.preventDefault(); navigate(-1); }
              }}
            >
              Cancel
            </RouterLink>
          </div>
        ) : null}
        <OnboardingFlow
          productName="Daybook"
          step={shown}
          // The flow asks for the last step as Finish is pressed; `finish` moves there once the save succeeds.
          onStepChange={(n) => {
            if (n === DONE) return;
            if (n > shown) dispatch({ type: 'onboarding/next', answers: data, step: n as OnboardingStep });
            go(n);
          }}
          onValueChange={(answers) => dispatch({ type: 'onboarding/edit', answers, step: shown as OnboardingStep })}
          onComplete={finish}
          doneHref="/app"
          defaultValue={data}
          // On touch, a step that asks for typing starts at its h1, with the on-screen keyboard down until a tap asks for it.
          focusFields={!lastInputWasTouch()}
        />
        {refusals ? (
          <p key={refusals} className="text-subheadline docs-onboarding-error" role="alert">
            You’re offline. Your answers are still here, so finish again once you’re back online.
          </p>
        ) : null}
      </main>
    </ThemeProvider>
  );
}
