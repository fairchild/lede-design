import { DailyBriefFlow } from '@/components/lede/flows/daily-brief';

// Every level leads with its takeaway: the page's summary, each card's figure, each section's summary.
export function Today({ decisions }: { decisions: number }) {
  return (
    <DailyBriefFlow
      title="Today"
      summary={`${decisions} decisions need you · 3 meetings`}
      cards={[
        { title: 'Decisions', figure: String(decisions), summary: 'Both due by Thursday.', status: { tone: 'caution', label: 'Needs you' }, href: '/decisions' },
        { title: 'Meetings', figure: '3', summary: 'First at 10:00 AM, Design review.', status: { tone: 'neutral', label: 'On schedule' } },
      ]}
      sections={[
        {
          id: 'decisions', title: 'Decisions', summary: `${decisions} need you by Thursday`, meta: String(decisions), defaultOpen: true,
          items: [
            { id: 'd1', title: 'Approve Q4 budget', subtitle: 'Finance · due Wednesday', href: '/decisions/d1' },
            { id: 'd2', title: 'Pick a launch date', subtitle: 'Product · due Thursday', href: '/decisions/d2' },
          ],
        },
        {
          id: 'meetings', title: 'Meetings', summary: 'Three today, the first at 10:00 AM', meta: '3',
          items: [{ id: 'e1', title: 'Design review', subtitle: 'Studio · 45 min', value: '10:00 AM' }],
        },
      ]}
    />
  );
}
