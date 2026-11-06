import type { DailyBriefFlowProps } from '@lede/flows/daily-brief';

// Sample content for the demo app. Every level states its takeaway first. Today adds the Inbox card from the Inbox's state.
export const brief: Omit<DailyBriefFlowProps, 'actions'> = {
  title: 'Today',
  summary: '2 decisions need you · 3 meetings · on budget',
  cards: [
    { title: 'Decisions', figure: '2', summary: 'Both due by Thursday.', status: { tone: 'caution', label: 'Needs you' }, href: '/app/inbox/m1' },
    { title: 'Meetings', figure: '3', summary: 'First at 10:00 AM, Design review.', status: { tone: 'neutral', label: 'On schedule' }},
    { title: 'Spending', figure: '$1,730', summary: 'Of $2,150 budgeted this month.', status: { tone: 'positive', label: 'On track' }},
  ],
  sections: [
    {
      id: 'decisions', title: 'Decisions', summary: '2 need you by Thursday', meta: '2', defaultOpen: true,
      items: [
        { id: 'd1', title: 'Approve Q4 budget', subtitle: 'Finance · due Wednesday', href: '/app/inbox/m1' },
        { id: 'd2', title: 'Pick a launch date', subtitle: 'Product · due Thursday', href: '/app/inbox/m2' },
      ],
    },
    {
      id: 'meetings', title: 'Meetings', summary: 'Three today, the first at 10:00 AM', meta: '3',
      items: [
        { id: 'e1', title: 'Design review', subtitle: 'Studio · 45 min', value: '10:00 AM' },
        { id: 'e2', title: 'Lunch with Ari', subtitle: 'Café Lark', value: '12:30 PM' },
        { id: 'e3', title: 'Weekly sync', subtitle: 'Video call · 30 min', value: '4:00 PM' },
      ],
    },
    {
      id: 'spending', title: 'Spending', summary: '$420 under the $2,150 budget', meta: '$1,730',
      items: [
        { id: 's1', title: 'Software', value: '$180' },
        { id: 's2', title: 'Travel', value: '$1,240' },
        { id: 's3', title: 'Meals', value: '$310' },
      ],
    },
  ],
};
