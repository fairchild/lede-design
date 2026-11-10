import { cn } from '../cn';

export interface StepIndicatorProps {
  /** Step names, in order. */
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
}

/**
 * A group named "Progress" holding an ordered list with `aria-current="step"`. Summary first: narrow screens show and
 * read only "Step 2 of 3 · Preferences", and the full list replaces it when there is room.
 */
export function StepIndicator(props: StepIndicatorProps) {
  return (
    <div role="group" className={cn('ld-steps', props.className)} aria-label="Progress">
      <p className="ld-steps-summary">
        Step {props.current + 1} of {props.steps.length} · {props.steps[props.current]}
      </p>
      <ol className="ld-steps-list">
        {props.steps.map((s, i) => {
          const state = i < props.current ? 'done' : i === props.current ? 'current' : 'upcoming';
          return (
            <li key={s} className="ld-step" data-state={state} aria-current={i === props.current ? 'step' : undefined}>
              <span className="ld-step-mark" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
              <span>{s}</span>
              {state === 'done' ? <span className="ld-sr-only"> (completed)</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
