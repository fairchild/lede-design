import { StepIndicator } from '@/components/lede/blocks/step-indicator';

export function SetupProgress({ step }: { step: number }) {
  return <StepIndicator steps={['Account', 'Preferences', 'Review']} current={step} />;
}
