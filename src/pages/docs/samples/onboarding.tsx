import { OnboardingFlow, type OnboardingData } from '@/components/lede/flows/onboarding';

// Three steps and a finished screen. The flow keeps its answers until onComplete, which can reject to stay on Review.
export function Welcome({ onComplete }: { onComplete: (data: OnboardingData) => Promise<void> }) {
  return (
    <main id="main">
      <OnboardingFlow productName="Daybook" doneHref="/" defaultValue={{ name: 'Sam Rivera' }} onComplete={onComplete} />
    </main>
  );
}
