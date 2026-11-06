import type { InboxMessage } from '@lede/flows/inbox';

const offsiteThread: InboxMessage = {
  id: 'm6', from: 'Priya Raman', subject: 'Team offsite in March: venue, dates and who runs which session',
  preview: 'Agreed: no venue. Two mornings in the fourth-floor training room, March 18 and 19…',
  date: '10:26 AM', datetime: '2026-10-31T10:26', unread: true,
  quote: { from: 'Tomás Herrera', text: 'Room is booked for both mornings, 9:00 AM to 1:00 PM. Finance is fine with lunch for 34 on the team budget.' },
  body: [
    'Thanks, all. Here is where we have landed, so nobody has to read back through the thread.',
    'We are not booking the Riverside center. The offsite stays on March 18 and 19, as two mornings in the fourth-floor training room, and the afternoons are free for people to work with their own teams.',
    'Ari runs the roadmap session at 9:00 AM on Thursday, March 18, and I lead the customer panel at 9:00 AM on Friday, March 19. Lunch is at 1:00 PM on both days, on the team budget.',
    'Dana, could you tell the Riverside center by November 6 that we are releasing the dates? Everyone else, please send me topics for the customer panel by November 20.',
  ],
  thread: [
    {
      from: 'Dana Okafor', preview: 'Proposing March 18 and 19 at the Riverside Conference Center. Four things to settle…',
      date: 'Mon 9:12 AM', datetime: '2026-10-26T09:12',
      body: [
        'Hi all. It is time to plan the March offsite, and I would like the venue booked by the end of next week. Last year’s feedback was clear: people want more time together on the roadmap and less time being presented to, so I have built the two days around that.',
        'My proposal is March 18 and 19 at the Riverside Conference Center. It has a room big enough for all 34 of us and two smaller rooms for breakouts, and it is a 15-minute walk from the station. They are holding the dates until November 6 at no cost.',
        'Four things to settle before I confirm. Do those dates clash with anything on your side? Who wants to run the roadmap session on the first morning? Who can lead the customer panel? And does anyone have access or dietary needs that the venue should know about? You can tell me privately.',
        'Replies by Friday would be great.',
      ],
    },
    {
      from: 'Ari Chen', preview: '18 and 19 work for engineering. I can run the roadmap session.',
      date: 'Mon 10:47 AM', datetime: '2026-10-26T10:47',
      body: ['18 and 19 work for engineering. I can run the roadmap session.'],
    },
    {
      from: 'Priya Raman', preview: 'Dates work, and I can lead the panel. Is the venue step-free, and is this in budget?',
      date: 'Mon 2:05 PM', datetime: '2026-10-26T14:05',
      quote: { from: 'Dana Okafor', text: 'It has a room big enough for all 34 of us and two smaller rooms for breakouts, and it is a 15-minute walk from the station.' },
      body: [
        'The dates work for the people team, and I am happy to lead the customer panel. Two questions about the venue before we commit.',
        'First, is the whole building step-free? Last year we had to move a session at the last minute because the breakout rooms were up a flight of stairs, and I would rather we asked now. Second, is this in next year’s budget or this year’s? The deposit falls in this quarter if we book in November, and I remember finance asking us to check anything over $5,000.',
      ],
    },
    {
      from: 'Tomás Herrera', preview: 'Finance has paused all venue spending until April, so we can’t book the center.',
      date: 'Tue 8:30 AM', datetime: '2026-10-27T08:30',
      quote: { from: 'Priya Raman', text: 'I remember finance asking us to check anything over $5,000.' },
      body: [
        'Glad you asked, and I should have raised this sooner. I checked with finance yesterday afternoon: all venue and travel spending is paused until the new fiscal year starts in April. That covers deposits too, so we can’t book the Riverside center for March, whichever budget it would come from.',
        'There are two ways forward. We can move the offsite to late April or May, when the money is available, but by then the roadmap will be set, which defeats the point of the first morning. Or we can keep the March dates and hold it somewhere that costs nothing.',
        'I would keep the dates. The training room on the fourth floor seats 36, is step-free and is free to book. We would lose the change of scene, but we would keep the timing.',
      ],
    },
    {
      from: 'Dana Okafor', preview: 'That changes things. Keep March. Can it work as two mornings rather than two full days?',
      date: 'Tue 8:52 AM', datetime: '2026-10-27T08:52',
      body: ['That changes things. Keep March. Can it work as two mornings rather than two full days?'],
    },
    {
      from: 'Ari Chen', preview: 'Two mornings suit engineering better anyway. Roadmap first, as planned.',
      date: 'Tue 9:20 AM', datetime: '2026-10-27T09:20',
      body: ['Two mornings suit engineering better anyway. Roadmap first, as planned.'],
    },
    {
      from: 'Tomás Herrera', preview: 'Room is booked for both mornings, 9:00 AM to 1:00 PM. Finance is fine with lunch.',
      date: 'Thu 4:20 PM', datetime: '2026-10-29T16:20',
      body: ['Room is booked for both mornings, 9:00 AM to 1:00 PM. Finance is fine with lunch for 34 on the team budget.'],
    },
  ],
};

const migrationReview: InboxMessage = {
  id: 'm5', from: 'Joanna Pike',
  subject: 'Records migration review: what shipped, what slipped and the three decisions we need before the January steering meeting',
  preview: 'Phase two finished 11 days late and $18,400 under budget. Three decisions need you by Friday, November 6…',
  date: '9:58 AM', datetime: '2026-10-31T09:58', unread: true,
  body: [
    'Phase two of the records migration is finished. It came in 11 days late and $18,400 under budget, all 412,000 records have moved and the four regional offices have been working in the new system since October 13. Three decisions need you by Friday, November 6, so that they can go to the steering meeting in January. They are set out near the end of this note, so if you have two minutes, read those and stop there.',
    'The rest of this review is for anyone who wants the detail: what we set out to do, how the work went week by week, where the money went, what the quality checks found, what people in the offices told us and what we would change for phase three. It is in that order so you can stop at whichever point you have what you need.',
    'Start with what we set out to do. Phase one, which closed in April, moved the head office and proved the approach. Phase two was meant to repeat that work at a larger scale: move every active client record held by the Northern, Eastern, Central and Coastal offices out of the old document store, retire the shared drives those offices had built around it and train everyone who uses those records day to day.',
    'We agreed three measures of success at the start of the phase, and I have used the same three throughout this review so that nobody has to take my word for how it went. Every active record had to move, with no more than 0.5% needing manual correction afterwards. Offices had to be back to their normal turnaround time within four weeks of their move. And the phase had to finish by October 2 and within the approved budget of $240,000. Two of the three were met in full. The third was met on budget and missed on date, and I come back to why below.',
    'The first nine weeks of the work went to plan. The Northern office moved on August 1 and the Eastern office followed on August 22, each over a single weekend, and both were working normally by the Tuesday after. We had rehearsed both moves twice against a copy of the live data, and the rehearsals caught nearly everything that came up on the day. By the end of August we were two days ahead of the plan and had started to talk about bringing the Central move forward.',
    'We are glad that we did not. The Central office holds about 40% of all the records in scope, and many of its older files were scanned in the early 2000s using a naming pattern that the old system tolerated and the new one does not. The rehearsal in the second week of September flagged 31,000 files that could not be matched to a client. About half of those were fixed by a script in two days. The other half needed someone who knew the clients to look at them, and that work could not be hurried.',
    'On September 11 we moved the Central date back by a week and brought in three people from the records team to help. That pushed the Coastal office into its quarter-end, and its manager asked us to wait until the quarter had closed, which added another week. Those two changes are where the 11 days come from. Neither was a surprise by the time it happened, and both were agreed with the offices concerned, but they are the reason we finished on October 13 and not on October 2.',
    'For reference, here are the dates as they actually fell. The Northern office moved on August 1 and the Eastern office on August 22. The Central date moved back a week on September 11, after the second rehearsal, and that office moved on September 26. The Coastal office moved on October 10, after its quarter-end. Final checks were signed off on October 13, and the old drives were set to read-only the same day.',
    'On money, we were approved for $240,000 and spent $221,600, which leaves $18,400 unspent. That figure hides movements in both directions. Agency time came in $26,000 under plan, because the script work took far less effort than we had estimated. Overtime and weekend cover came in $9,500 over plan, mostly from the extra Central rehearsal. Travel came in $1,900 under plan, because two of the training days moved online.',
    'I would not read the underspend as a sign that the budget was too generous. The saving on agency time came from one lucky finding: most of the file-matching problems turned out to share a pattern. If they had not, we would have used the contingency and more. I recommend that we hand back $10,000 and keep the remaining $8,400 against the open corrections described next.',
    'On quality, every record was checked automatically after its move, comparing the file count, the file size and the client reference against the old system. Those checks flagged 1,130 records, or 0.27% of the total, which is well inside the 0.5% we set as our limit. As of yesterday, 1,034 of them have been corrected and 96 are still open.',
    'The 96 fall into two groups. Sixty-two are records where the client reference is ambiguous because two clients share a name, and the office needs to confirm which is which. The other 34 are records where a file exists in the old system but can’t be read, and we are checking whether a paper copy is held in storage. None of the 96 relates to a live case, and all of them have an owner and a date.',
    'We also sampled 2,000 records by hand, picked at random across the four offices, to check the things a machine can’t: whether documents are filed under the right heading, and whether the dates look sensible. The sample turned up 11 filing errors. All 11 already existed in the old system, so the migration did not cause them, but it did make them easier to find, and the records team will work through that class of error as part of normal housekeeping.',
    'Turning to the offices, we ran a short survey two weeks after each move, and 187 of the 240 people we asked replied. Asked whether the new system was easier to use than the old one, 71% said yes, 18% said it was about the same and 11% said it was harder. Search was the feature people liked most. The most common complaint was that the new system asks for more fields when a record is created, which several people said slows them down at the front desk.',
    'Support requests followed the pattern we expected. We logged 214 in the first week after the Central move and 38 in the fourth week, which is close to the usual level for an office of that size. Turnaround time was back to normal within four weeks at all four offices, although the Central office took the full four weeks to get there.',
    'The comment that came up most often, and the one I would most like us to act on, was about timing. People said the training was good but came too early. Some had their session six weeks before their office moved, and by the time they needed what they had learned, much of it had gone. We can fix that in phase three at no extra cost.',
    'Looking back, there are five things we would do differently. We would run the first rehearsal against the largest office, not the smallest: we left the hardest data until late in the phase, which is why the surprise cost what it did. We would hold training in the two weeks before a move, and keep a drop-in session in the week after. We would agree blackout dates, such as quarter-ends, with every office before the plan is published. We would ask one person in each office to own the data questions from the start, because where that happened, corrections took about half as long. And we would keep the two full rehearsals. They cost money, but nothing else we did saved as much time.',
    'Phase three covers the last two sites, the archive and the legal team. It is smaller than phase two, at about 90,000 records, but it carries three risks that I want to name now.',
    'The first is the archive itself. Many of those files are older than anything we have handled so far, and we should expect the matching rate to be lower than it was at the Central office. The second is people. Two of the five people on the project team move to other work in February, and what they know about the matching scripts is not yet written down. The third is the old system’s support contract, which ends on June 30. If phase three runs past that date we will have to extend it, and the vendor has quoted $3,200 a month.',
    'None of these is a reason to delay. All three are reasons to start in January rather than in April, which brings me to what we need from you.',
    'Here are the three decisions. Please reply to this note by Friday, November 6, with a yes, a no or a question on each. If it is easier to talk them through, I have held 30 minutes in your calendar on Wednesday afternoon.',
    'First, start phase three in January rather than April. This brings the finish to the end of May, a month clear of the support contract ending. It needs the project team to stay together until then, including the two people due to move in February. We recommend yes.',
    'Second, keep the old system read-only for six months after the last move, rather than twelve. That saves $19,200 and means that anyone who needs an old file has to ask for it by the end of November next year. We recommend six months, provided the legal team agrees.',
    'Third, name a permanent owner for data quality. The project team stands down in June, and at the moment nobody owns the checks once it does. We recommend the records team, with one extra half-time post from July, at about $31,000 a year.',
    'Whatever you decide, the next four weeks look much the same. We will close the remaining 96 corrections by November 20, finish writing down how the matching scripts work and publish the full results to all four offices. The Central office has asked for a short session on creating records more quickly, which we will run in the first week of December.',
    'I would also like to thank the records team and the office managers, who gave up more weekends than we had any right to ask for and did so with good humor. I will send their names around separately once this review has gone to the steering group.',
    'Thanks for reading this far. Send me any corrections by Wednesday, and I will update the version that goes to the steering group.',
    'Joanna',
  ],
};

export const initialMessages: InboxMessage[] = [
  offsiteThread,
  migrationReview,
  {
    id: 'm1', from: 'Dana Okafor', subject: 'Q4 budget needs your approval', preview: 'Two line items moved since last week…',
    date: '9:41 AM', datetime: '2026-10-31T09:41', unread: true,
    body: [
      'Two line items moved since last week: travel is up $240 and software is down $60. Net, we are still $420 under the plan.',
      'If this looks right, approve it by Wednesday so finance can close the quarter. Happy to walk through it on a call.',
    ],
  },
  {
    id: 'm2', from: 'Ari Chen', subject: 'Launch date: Tuesday or Thursday?', preview: 'Both work for engineering; marketing prefers…',
    date: '8:15 AM', datetime: '2026-10-31T08:15', unread: true,
    body: ['Both work for engineering. Marketing prefers Thursday for the newsletter. Your call by end of day Thursday.'],
  },
  {
    id: 'm3', from: 'Studio', subject: 'Design review agenda', preview: 'Navigation, the settings flow and…',
    date: 'Yesterday', datetime: '2026-10-30T17:02', unread: true,
    body: ['Agenda: navigation, the settings flow and empty states. Bring one thing you would cut.'],
  },
  {
    id: 'm4', from: 'Billing', subject: 'Your receipt for October', preview: 'Thanks for your payment of $12.00.',
    date: 'Tue', datetime: '2026-10-27T10:00',
    body: ['Thanks for your payment of $12.00. No action needed.'],
  },
];
