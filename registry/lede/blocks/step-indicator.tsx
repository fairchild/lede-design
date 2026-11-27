import { cn, withLabels } from '../cn';

/** StepIndicator's own words. Override any of them through `labels`; the rest stay English. */
export interface StepIndicatorLabels {
  /** The group's name. */
  group: string;
  /** The one-line summary narrow screens show: `current` counts from 1. */
  summary: (p: { current: number; count: number; step: string }) => string;
  /** Read after a completed step's name. */
  completed: string;
}

export const stepIndicatorLabels: StepIndicatorLabels = {
  group: 'Progress',
  summary: ({ current, count, step }) => `Step ${current} of ${count} · ${step}`,
  completed: '(completed)',
};

export interface StepIndicatorProps {
  /** Step names, in order. */
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Words to use in place of the English defaults in `stepIndicatorLabels`. */
  labels?: Partial<StepIndicatorLabels>;
  className?: string;
}

/**
 * A group named "Progress" holding an ordered list with `aria-current="step"`. Summary first: narrow screens show and
 * read only "Step 2 of 3 · Preferences", and the full list replaces it when there is room.
 */
export function StepIndicator(props: StepIndicatorProps) {
  const l = withLabels(stepIndicatorLabels, props.labels);
  return (
    <div role="group" className={cn('ld-steps', props.className)} aria-label={l.group}>
      <p className="ld-steps-summary">
        {l.summary({ current: props.current + 1, count: props.steps.length, step: props.steps[props.current] })}
      </p>
      <ol className="ld-steps-list">
        {props.steps.map((s, i) => {
          const state = i < props.current ? 'done' : i === props.current ? 'current' : 'upcoming';
          return (
            <li key={s} className="ld-step" data-state={state} aria-current={i === props.current ? 'step' : undefined}>
              <span className="ld-step-mark" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
              <span>{s}</span>
              {state === 'done' ? <span className="ld-sr-only">{` ${l.completed}`}</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
