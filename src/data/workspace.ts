import type { StatusTone } from '@lede/blocks/summary-card';
import { DEMO_TODAY } from './work-items';

// Sample content for the left bar layout: a workspace overview, long enough to scroll, on the demo's today (a Monday).

export type ProjectStatus = 'Not started' | 'On track' | 'At risk' | 'Blocked';
export interface Project { name: string; lead: string; status: ProjectStatus; /** ISO date, YYYY-MM-DD. */ due: string }
export const PROJECT_TONE: Record<ProjectStatus, StatusTone> = { 'Not started': 'neutral', 'On track': 'positive', 'At risk': 'caution', Blocked: 'critical' };

export const WORKSPACE_PROJECTS: Project[] = [
  { name: 'Q1 pricing review', lead: 'Eli Haddad', status: 'Blocked', due: '2026-11-03' },
  { name: 'Mobile app 3.0', lead: 'Chen Wei', status: 'At risk', due: '2026-11-04' },
  { name: 'Data retention policy', lead: 'Dana Ruiz', status: 'On track', due: '2026-11-04' },
  { name: 'Billing migration', lead: 'Ben Lindqvist', status: 'Blocked', due: '2026-11-05' },
  { name: 'Warehouse move', lead: 'Dana Ruiz', status: 'On track', due: '2026-11-06' },
  { name: 'Expense tool rollout', lead: 'Eli Haddad', status: 'On track', due: '2026-11-13' },
  { name: 'Customer portal redesign', lead: 'Ada Okafor', status: 'On track', due: '2026-11-20' },
  { name: 'Onboarding research', lead: 'Fatima Noor', status: 'On track', due: '2026-11-27' },
  { name: 'Design system adoption', lead: 'Ada Okafor', status: 'Not started', due: '2026-12-04' },
  { name: 'Help center rewrite', lead: 'Ada Okafor', status: 'Not started', due: '2026-12-11' },
  { name: 'Annual security audit', lead: 'Ben Lindqvist', status: 'On track', due: '2026-12-18' },
  { name: 'Partner API', lead: 'Chen Wei', status: 'Not started', due: '2027-01-15' },
];

/** "a, b and c", with no serial comma, as the docs write lists. */
const listed = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join(''));
const withStatus = (projects: Project[], status: ProjectStatus) => projects.filter((p) => p.status === status);
const blocked = withStatus(WORKSPACE_PROJECTS, 'Blocked');
/** The last day of the demo's week, the Sunday six days after its Monday. */
export const WEEK_END = new Date(Date.parse(DEMO_TODAY) + 6 * 86_400_000).toISOString().slice(0, 10);
const dueThisWeek = WORKSPACE_PROJECTS.filter((p) => p.due <= WEEK_END);
const notStarted = withStatus(WORKSPACE_PROJECTS, 'Not started');
/** The projects due this week that aren't on track, worst first: "2 blocked and 1 at risk." */
const offTrack = (['Blocked', 'At risk', 'Not started'] as const)
  .map((status) => [status, withStatus(dueThisWeek, status).length] as const)
  .filter(([, n]) => n > 0)
  .map(([status, n]) => `${n} ${status.toLowerCase()}`);
const NEEDS_YOU = { tone: 'caution', label: 'Needs you' } as const;

export const WORKSPACE_SUMMARY = `${WORKSPACE_PROJECTS.length} open projects, ${blocked.length} blocked`;
export const WORKSPACE_STATS: Array<{ title: string; figure: string; summary: string; status: { tone: StatusTone; label: string } }> = [
  { title: 'Open projects', figure: String(WORKSPACE_PROJECTS.length), summary: `${notStarted.length} not started yet.`, status: { tone: 'neutral', label: 'Steady' } },
  {
    title: 'Due this week', figure: String(dueThisWeek.length),
    summary: offTrack.length ? `${listed(offTrack)}.` : 'All on track.',
    status: offTrack.length ? NEEDS_YOU : { tone: 'positive', label: 'On track' },
  },
  {
    title: 'Blocked', figure: String(blocked.length),
    summary: blocked.length ? `${listed(blocked.map((p) => p.name))}.` : 'Nothing is blocked.',
    status: blocked.length ? NEEDS_YOU : { tone: 'positive', label: 'Clear' },
  },
  { title: 'Reviews', figure: '7', summary: '2 are older than a week.', status: { tone: 'caution', label: 'Slowing' } },
];

export const WORKSPACE_PEOPLE = [
  { name: 'Ada Okafor', role: 'Design', projects: 4 },
  { name: 'Ben Lindqvist', role: 'Engineering', projects: 3 },
  { name: 'Chen Wei', role: 'Engineering', projects: 5 },
  { name: 'Dana Ruiz', role: 'Operations', projects: 2 },
  { name: 'Eli Haddad', role: 'Finance', projects: 3 },
  { name: 'Fatima Noor', role: 'Research', projects: 1 },
];

export const WORKSPACE_ACTIVITY = [
  { title: 'Dana Ruiz sent Data retention policy for review', when: '20 minutes ago' },
  { title: 'Chen Wei moved two Mobile app 3.0 screens to the next release', when: '1 hour ago' },
  { title: 'Ada Okafor shared new Customer portal screens', when: '2 hours ago' },
  { title: 'Eli Haddad paused Q1 pricing review until the board decides', when: 'Friday' },
  { title: 'Fatima Noor added six interviews to Onboarding research', when: 'Friday' },
  { title: 'Ben Lindqvist marked Billing migration blocked until a payment provider is chosen', when: 'Thursday' },
  { title: 'Ada Okafor set a start date for Help center rewrite', when: 'Thursday' },
  { title: 'Dana Ruiz booked the movers for Warehouse move', when: 'Tuesday' },
];
