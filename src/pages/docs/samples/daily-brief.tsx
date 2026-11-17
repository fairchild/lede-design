import { Page } from '@/components/lede/blocks/page';
import { DailyBriefFlow } from '@/components/lede/flows/daily-brief';

// A flow brings no gutter of its own: put it in Page, or in AppShell's main region.
export function TodayScreen() {
  return (
    <Page render={<main />}>
      <DailyBriefFlow
        title="Today"
        summary="2 meetings, 1 thing due"
        cards={[{ title: 'Next', summary: 'Design review at 3 PM' }]}
        sections={[
          {
            id: 'due',
            title: 'Due',
            summary: '1 thing',
            items: [{ id: 'q4', title: 'Q4 budget', value: 'Today' }],
          },
        ]}
      />
    </Page>
  );
}
