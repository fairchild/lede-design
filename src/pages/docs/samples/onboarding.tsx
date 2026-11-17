import { Page } from '@/components/lede/blocks/page';
import { OnboardingFlow, type OnboardingData } from '@/components/lede/flows/onboarding';

// A flow brings no gutter of its own: put it in Page, or in AppShell's main region.
export function WelcomeScreen({ onDone }: { onDone: (data: OnboardingData) => void }) {
  return (
    <Page render={<main />} width="narrow">
      <OnboardingFlow productName="Daybook" onComplete={onDone} doneHref="/" />
    </Page>
  );
}
