import type { TableView } from '@lede/blocks/use-data-table';
import type { ServerRowsRequest, ServerRowsResponse, ServerCountRequest } from '@lede/blocks/use-server-rows';

export type WorkStatus = 'Open' | 'In progress' | 'Blocked' | 'Done';
export interface WorkItem {
  id: string;
  title: string;
  status: WorkStatus;
  assignee: { name: string };
  /** ISO date, YYYY-MM-DD. */
  due: string;
  /** In US dollars. */
  amount: number;
  /** Locked items can't be archived: shows a disabled action with its reason. */
  locked?: boolean;
  /** The server refuses to archive this item: every time, or only the first time. */
  archiveFails?: 'always' | 'once';
  /** Set by the page, never the server: an archive of this row is in flight. */
  archiving?: boolean;
}

/**
 * The demo's today. Due dates are read against it ("due tomorrow", "3 days overdue"), so the demo reads the same on any
 * day. The hand-written items are due around it; the rest come after them.
 */
export const DEMO_TODAY = '2026-11-02';

type Row = [title: string, assignee: string, status: WorkStatus, due: string, amount: number, flags?: Pick<WorkItem, 'locked' | 'archiveFails'>];
const LOCKED = { locked: true };
/**
 * Fifty items an operations team might track, each with its cost, as WI-1001 to WI-1050. Their due dates come before
 * every generated item's, so the Work page's first page (soonest due first) is all of them, each title once. Rows 5 and
 * 6 of that order are the two the server refuses to archive: one is linked to an open approval, every time; the other
 * times out the first time.
 */
const HANDWRITTEN: Row[] = [
  ['Renew the Figma team licenses', 'Ada Okafor', 'Open', '2026-11-09', 5760],
  ['Write the migration guide for teams moving from the old reporting dashboard to the new analytics workspace', 'Fatima Noor', 'In progress', '2026-10-28', 4200],
  ['Replace the meeting room displays', 'Dana Ruiz', 'Open', '2026-11-18', 3480],
  ['Book the March offsite venue', 'Dana Ruiz', 'Blocked', '2026-10-21', 9200],
  ['Pay the October cloud hosting invoice', 'Eli Haddad', 'Done', '2026-10-31', 14312.47, LOCKED],
  ['Renew the cleaning contract', 'Dana Ruiz', 'In progress', '2026-11-30', 18600],
  ['Order laptops for the January hires', 'Ben Lindqvist', 'Open', '2026-11-25', 11940],
  ['Commission illustrations for the spring campaign', 'Ada Okafor', 'In progress', '2026-12-04', 6000],
  ['Renew the SOC 2 audit engagement', 'Eli Haddad', 'Blocked', '2026-11-06', 24500, LOCKED],
  ['Print banners for the Lisbon trade show', 'Gus Pereira', 'Done', '2026-10-14', 1240],
  ['Upgrade the support desk plan', 'Chen Wei', 'Open', '2026-11-12', 2388],
  ['Fix the leak in the second-floor kitchen', 'Dana Ruiz', 'Done', '2026-10-10', 860],
  ['Sign the courier contract for the new warehouse', 'Dana Ruiz', 'Open', '2026-12-09', 7450],
  ['Recruit ten participants for the onboarding study', 'Fatima Noor', 'In progress', '2026-11-04', 1500],
  ['Buy devices for accessibility testing', 'Chen Wei', 'Done', '2026-10-23', 2140],
  ['Translate the help center into Portuguese', 'Gus Pereira', 'Open', '2026-12-16', 5300],
  ['Renew the domain names and certificates', 'Ben Lindqvist', 'Open', '2026-10-12', 412],
  ['Reimburse travel for the September customer visits', 'Eli Haddad', 'In progress', '2026-10-07', 3186.2],
  ['Replace the office Wi-Fi access points', 'Ben Lindqvist', 'Blocked', '2026-11-16', 4920],
  ['Review the catering contract before it renews', 'Hana Sato', 'Open', '2026-11-20', 12000],
  ['Set up the payment provider trial', 'Chen Wei', 'Blocked', '2026-11-10', 990],
  ['Film the product walkthrough videos', 'Ada Okafor', 'Open', '2026-12-02', 8500],
  ['Order standing desks for the design team', 'Dana Ruiz', 'In progress', '2026-11-02', 5640],
  ['Pay the Q3 legal review invoice', 'Eli Haddad', 'Open', '2026-10-30', 7825, LOCKED],
  ['Close out the Q3 vendor audit', 'Eli Haddad', 'Done', '2026-10-09', 3600, { archiveFails: 'always' }],
  ['Send the September freelancer invoices', 'Hana Sato', 'Done', '2026-10-09', 2950, { archiveFails: 'once' }],
  ['Renew the user research panel', 'Fatima Noor', 'Open', '2026-12-01', 3900],
  ['Run the annual fire safety inspection', 'Dana Ruiz', 'Done', '2026-10-16', 650],
  ['Buy a second load-testing license', 'Chen Wei', 'Open', '2026-12-11', 1800],
  ['Organize the team holiday dinner', 'Hana Sato', 'In progress', '2026-12-08', 2720],
  ['Hire a contract QA tester for the 3.0 release', 'Ben Lindqvist', 'Blocked', '2026-10-26', 9600],
  ['Replace the boardroom projector', 'Dana Ruiz', 'In progress', '2026-10-19', 1150],
  ['Renew the analytics platform license', 'Chen Wei', 'In progress', '2026-11-27', 16800, LOCKED],
  ['Pay the pricing consultant’s final invoice', 'Eli Haddad', 'Blocked', '2026-11-13', 8800],
  ['Restock the first-aid kits', 'Dana Ruiz', 'Done', '2026-10-05', 186.4],
  ['Upgrade the CI build machines', 'Ben Lindqvist', 'Open', '2026-12-14', 6240],
  ['Sponsor the local accessibility meetup', 'Ada Okafor', 'Done', '2026-10-27', 500],
  ['Renew the error monitoring plan', 'Chen Wei', 'Open', '2026-11-23', 3120],
  ['Book flights for the Lisbon trade show team', 'Gus Pereira', 'Done', '2026-10-08', 2874.6],
  ['Survey customers about the new invoices page', 'Fatima Noor', 'Open', '2026-12-18', 750],
  ['Replace the worn carpet in reception', 'Dana Ruiz', 'Open', '2026-12-10', 3350],
  ['Pay the payroll bureau’s September fee', 'Eli Haddad', 'Done', '2026-10-06', 1420],
  ['Buy noise-canceling headphones for support', 'Gus Pereira', 'In progress', '2026-11-11', 1680],
  ['Renew the password manager business plan', 'Ben Lindqvist', 'Open', '2026-11-19', 1920, LOCKED],
  ['Refresh the brand photography', 'Ada Okafor', 'Open', '2026-12-15', 7200],
  ['Install bike racks in the parking lot', 'Dana Ruiz', 'Blocked', '2026-11-26', 2300],
  ['Renew the office insurance policy', 'Eli Haddad', 'In progress', '2026-11-30', 8940, LOCKED],
  ['Run a usability test of the mobile checkout', 'Fatima Noor', 'In progress', '2026-11-17', 1200],
  ['Upgrade the video conferencing rooms', 'Chen Wei', 'Open', '2026-12-03', 4650],
  ['Pay the annual software escrow fee', 'Eli Haddad', 'Open', '2026-12-17', 2500],
];

/**
 * Work that comes around again (invoices, restocks, servicing, top-ups, hires), each with a typical cost: the items
 * after the first fifty draw their titles from here, never from the one-off hand-written tasks. There are more titles
 * than items in a page, so no fifty items in a row share one.
 */
const RECURRING: Array<[title: string, amount: number]> = [
  ['Pay the coworking desk invoice for the Porto team', 2400],
  ['Pay the translation agency invoice', 3410],
  ['Pay the cloud backup invoice', 2215.8],
  ['Pay the courier invoices for the warehouse', 1980],
  ['Pay the website hosting invoice', 1140.5],
  ['Pay the freelance copywriter’s invoice', 2600],
  ['Pay the recruiting agency placement fee', 9750],
  ['Pay the user interview incentives', 900],
  ['Pay the cleaning service invoice', 1550],
  ['Pay the security guard service invoice', 4200],
  ['Pay the IT support retainer', 3800],
  ['Pay the bookkeeping service invoice', 1250],
  ['Pay the payroll provider’s monthly fee', 1420],
  ['Pay the parking garage invoice', 1680],
  ['Pay the event photographer’s invoice', 1350],
  ['Pay the warehouse lease', 12500],
  ['Pay the warehouse electricity bill', 2140],
  ['Pay the office internet bill', 460],
  ['Pay the field team’s phone plan', 780],
  ['Pay the legal retainer', 5000],
  ['Pay the external accountant’s invoice', 2900],
  ['Pay the design contractor’s invoice', 4400],
  ['Pay the travel agency invoice', 6300],
  ['Restock the office kitchen', 640],
  ['Restock printer paper and toner', 380],
  ['Restock the cleaning supplies', 310],
  ['Order spare batteries for the scanners', 280],
  ['Order shipping boxes for the warehouse', 920],
  ['Order safety gear for the warehouse team', 1260],
  ['Order business cards for new hires', 310],
  ['Order laptops for upcoming hires', 9800],
  ['Order welcome kits for new hires', 1150],
  ['Buy design tool seats for new designers', 2160],
  ['Add CRM seats for new sales hires', 2800],
  ['Add support desk seats for new agents', 1150],
  ['Service the office air conditioning', 1100],
  ['Service the warehouse forklifts', 2300],
  ['Service the delivery vans', 3400],
  ['Service the coffee machines', 380],
  ['Test the fire alarms', 450],
  ['Inspect the warehouse racking', 1600],
  ['Replace the water filters', 260],
  ['Clean the server room air filters', 220],
  ['Run a phishing awareness training', 2800],
  ['Book training for new team leads', 4200],
  ['Run the customer satisfaction survey', 2100],
  ['Run a round of usability tests', 1200],
  ['Recruit participants for the next research round', 1500],
  ['Commission illustrations for the blog', 1800],
  ['Commission product photos for new listings', 2600],
  ['Translate the latest help articles', 1900],
  ['Move old design files to cold storage', 340],
  ['Buy conference tickets for the platform team', 5400],
  ['Book travel for customer visits', 3900],
  ['Top up the SMS sending credits', 1500],
  ['Top up the transcription minutes', 960],
  ['Top up the stock photo credits', 1188],
  ['Top up the postage meter', 600],
  ['Buy gift cards for the referral program', 1000],
  ['Order gifts for the customer advisory board', 1400],
  ['Print brochures for the next trade show', 1240],
  ['Book a booth at the next trade show', 7400],
  ['Sponsor a community meetup', 500],
  ['Pay the monthly software subscriptions', 4860],
];
/** Days the office is closed: nothing comes due on them. */
const CLOSED = new Set(['2026-12-25', '2027-01-01']);

// Deterministic: the same items on every load, so screenshots and tests are stable.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
const PEOPLE = ['Ada Okafor', 'Ben Lindqvist', 'Chen Wei', 'Dana Ruiz', 'Eli Haddad', 'Fatima Noor', 'Gus Pereira', 'Hana Sato'];
const STATUSES: WorkStatus[] = ['Open', 'In progress', 'Blocked', 'Done'];
/** Later work is mostly not started yet: each status up to its cumulative share. */
const LATER: Array<[WorkStatus, number]> = [['Open', 0.7], ['In progress', 0.92], ['Blocked', 0.95], ['Done', 1]];
const laterStatus = (at: number) => LATER.find(([, share]) => at < share)![0];

/** Fifty items in a row never share a title: a page of Work, or of the guide's examples, lists each once. */
const APART = 50;

/** Working days from December 21, 2026, as ISO dates: weekdays the office is open. */
function* workingDays() {
  for (let day = Date.UTC(2026, 11, 21); ; day += 86_400_000) {
    const date = new Date(day);
    const iso = date.toISOString().slice(0, 10);
    if (date.getUTCDay() % 6 !== 0 && !CLOSED.has(iso)) yield iso;
  }
}

/**
 * The hand-written items, then more for Work's later pages and the guide's server and 500-row examples: recurring work,
 * two or three due each working day in ID order, mostly not started, and a cost within a quarter of the title's usual
 * one.
 */
function generate(n: number): WorkItem[] {
  const r = rng(42);
  const written = HANDWRITTEN.map(([title, name, status, due, amount, flags], i): WorkItem => ({
    id: `WI-${1001 + i}`, title, status, assignee: { name }, due, amount, ...flags,
  }));
  const picked: string[] = [];
  const days = workingDays();
  let due = '';
  const more = Array.from({ length: n - written.length }, (_, i): WorkItem => {
    const open = RECURRING.filter(([title]) => !picked.slice(-APART).includes(title));
    const [title, amount] = open[Math.floor(r() * open.length)];
    picked.push(title);
    // Three come due one working day and two the next.
    if (i % 5 === 0 || i % 5 === 3) due = days.next().value!;
    return {
      id: `WI-${1001 + written.length + i}`,
      title,
      status: laterStatus(r()),
      assignee: { name: PEOPLE[Math.floor(r() * PEOPLE.length)] },
      due,
      amount: Math.round(amount * (75 + r() * 50)) / 100,
      locked: r() < 0.1,
    };
  });
  return [...written, ...more];
}

/** The data table guide's "500 rows" option. Work and the guide's server examples use the first 310. */
export const bigWorkItems: readonly WorkItem[] = generate(500);
export const allWorkItems: readonly WorkItem[] = bigWorkItems.slice(0, 310);

/** Due dates parse as local dates, so "Nov 3" means Nov 3 wherever the reader is. */
export const dueDate = (item: WorkItem) => new Date(`${item.due}T00:00:00`);

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });
const SORT_KEYS: Record<string, (w: WorkItem) => string | number> = {
  id: (w) => Number(w.id.slice(3)),
  title: (w) => w.title,
  status: (w) => STATUSES.indexOf(w.status),
  assignee: (w) => w.assignee.name,
  due: (w) => w.due,
  amount: (w) => w.amount,
};
/** What a real server does with the view: sort by its key, ties broken by ID. */
export function applyView(items: readonly WorkItem[], view: TableView): WorkItem[] {
  // The docs' search puts its term in view.filter.q: titles that contain it, ignoring case.
  const q = typeof view.filter?.q === 'string' ? view.filter.q.trim().toLocaleLowerCase('en-US') : '';
  if (q) items = items.filter((i) => i.title.toLocaleLowerCase('en-US').includes(q));
  const s = view.sort[0];
  const key = s && SORT_KEYS[s.columnId];
  if (!key) return [...items];
  const dir = s.direction === 'descending' ? -1 : 1;
  return [...items].sort((a, b) => {
    const x = key(a), y = key(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
    return c !== 0 ? c * dir : Number(a.id.slice(3)) - Number(b.id.slice(3));
  });
}

export interface ArchiveFailure {
  id: string;
  title: string;
  /** Why the server refused, in its words. */
  reason: string;
  /** What the person can do about it. */
  next: string;
}
export interface ArchiveResult {
  archived: string[];
  /** Kept because they're locked. */
  locked: string[];
  failed: ArchiveFailure[];
}
export const REFUSALS: Record<NonNullable<WorkItem['archiveFails']>, Pick<ArchiveFailure, 'reason' | 'next'>> = {
  always: { reason: 'This item is linked to an open approval.', next: 'Close the approval, then try again.' },
  once: { reason: 'The server couldn’t save this item in time.', next: 'Try again.' },
};

export type LogEntry = { id: number; text: string; status: 'pending' | 'done' | 'canceled' | 'failed' };

/**
 * A fake server with latency. Rows arrive with a lower-bound total ({atLeast}); the exact count arrives later from
 * a slower endpoint. Requests honor their AbortSignal and are logged, so the docs can show cancellation.
 */
export function createWorkServer(options: { latency?: number; countLatency?: number; items?: readonly WorkItem[] } = {}) {
  const latency = options.latency ?? 450;
  const countLatency = options.countLatency ?? 1600;
  let items = [...(options.items ?? allWorkItems)];
  let failNext = false;
  let nextId = 1;
  let log: LogEntry[] = [];
  const listeners = new Set<() => void>();
  const emit = () => { for (const fn of listeners) fn(); };
  const record = (text: string) => {
    const entry: LogEntry = { id: nextId++, text, status: 'pending' };
    log = [entry, ...log].slice(0, 8);
    emit();
    return (status: LogEntry['status']) => {
      log = log.map((e) => (e.id === entry.id ? { ...e, status } : e));
      emit();
    };
  };
  const wait = <T,>(ms: number, signal: AbortSignal, done: (s: LogEntry['status']) => void, fn: () => T, canFail = true) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        if (canFail && failNext) {
          failNext = false;
          done('failed');
          reject(new Error('The server didn’t answer in time.'));
          return;
        }
        done('done');
        resolve(fn());
      }, ms);
      const abort = () => {
        clearTimeout(t);
        done('canceled');
        reject(new DOMException('Request canceled', 'AbortError'));
      };
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  const describe = (view: TableView) =>
    (view.sort[0] ? `${view.sort[0].columnId} ${view.sort[0].direction}` : 'unsorted') +
    (typeof view.filter?.q === 'string' && view.filter.q ? `, “${view.filter.q}”` : '');

  return {
    fetchRows(req: ServerRowsRequest): Promise<ServerRowsResponse<WorkItem>> {
      const done = record(`Rows ${req.offset + 1}–${req.offset + req.limit}, ${describe(req.view)}`);
      return wait(latency, req.signal, done, () => {
        const sorted = applyView(items, req.view);
        const rows = sorted.slice(req.offset, req.offset + req.limit);
        const end = req.offset + rows.length;
        // Like many databases, the server only promises a lower bound until the count query finishes.
        return { rows, total: end >= sorted.length ? sorted.length : { atLeast: Math.min(sorted.length, end + req.limit) } };
      });
    },
    fetchCount(req: ServerCountRequest): Promise<number> {
      const done = record(`Exact count, ${describe(req.view)}`);
      // Counts never consume an armed failure: it is meant for the next rows request, whatever finishes first.
      return wait(countLatency, req.signal, done, () => applyView(items, req.view).length, false);
    },
    /** The next rows or archive request fails, once. Count requests are unaffected. */
    failNextRequest() { failNext = true; },
    /**
     * Archives the matching items, like a POST: the targets are fixed when it's sent, and the answer comes after the
     * latency. Each target is archived, kept because it's locked, or refused with a reason.
     */
    async archive(ids: (id: string) => boolean): Promise<ArchiveResult> {
      const sent = new Set(items.filter((w) => ids(w.id)).map((w) => w.id));
      const settle = record(`Archive ${sent.size === 1 ? [...sent][0] : `${sent.size} items`}`);
      await new Promise((resolve) => setTimeout(resolve, latency));
      if (failNext) {
        failNext = false;
        settle('failed');
        throw new Error('The server didn’t answer in time.');
      }
      const targets = items.filter((w) => sent.has(w.id));
      const locked = targets.filter((w) => w.locked);
      const refused = targets.filter((w) => !w.locked && w.archiveFails);
      const archived = targets.filter((w) => !w.locked && !w.archiveFails);
      items = items
        .filter((w) => !archived.includes(w))
        .map((w) => (refused.includes(w) && w.archiveFails === 'once' ? { ...w, archiveFails: undefined } : w));
      settle(refused.length ? 'failed' : 'done');
      return {
        archived: archived.map((w) => w.id),
        locked: locked.map((w) => w.id),
        failed: refused.map((w) => ({ id: w.id, title: w.title, ...REFUSALS[w.archiveFails!] })),
      };
    },
    /** How many items match. */
    count(ids: (id: string) => boolean) { return items.filter((w) => ids(w.id)).length; },
    get(id: string) { return items.find((w) => w.id === id); },
    /** The items that match, for a page summary a real app would ask its API for. */
    where(match: (w: WorkItem) => boolean) { return items.filter(match); },
    get size() { return items.length; },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getLog() { return log; },
  };
}
export type WorkServer = ReturnType<typeof createWorkServer>;
