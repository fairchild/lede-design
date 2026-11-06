import { useSyncExternalStore } from 'react';
import type { InboxMessage } from '@lede/flows/inbox';
import type { OnboardingData } from '@lede/flows/onboarding';
import { presets } from '@lede/theme-provider';
import type { Selection } from '@lede/blocks/use-data-table';
import { initialMessages } from '@/data/inbox';
import { allWorkItems, type WorkItem } from '@/data/work-items';

export type Removal = 'archived' | 'deleted';
type Delivery = OnboardingData['delivery'];
/** `Selection` as JSON: its sets become arrays. */
type StoredSelection = { kind: 'ids'; ids: string[] } | { kind: 'all-matching'; except: string[] };
/** Onboarding's steps before Done: Account, Preferences and Review. */
export type OnboardingStep = 0 | 1 | 2;

/** What a visitor has changed in the demo, kept as IDs and choices: the content stays in `src/data`. */
export interface DemoState {
  /** `removed` is in batches, newest last, so Undo takes back one action and the list keeps the sample's order. */
  inbox: { read: string[]; removed: { ids: string[]; how: Removal }[] };
  brief: { on: boolean; delivery: Delivery };
  sync: boolean;
  /** Work's archives and selection; its sort and page are in the URL. */
  work: { archived: string[]; selection: StoredSelection };
  /**
   * Onboarding's answers while they're being given, and whether it was ever finished. `reached` is the furthest step
   * the draft allows. An answer that doesn't read back from storage comes from the profile, Settings and appearance.
   */
  onboarding: { draft?: { answers: Partial<OnboardingData>; reached: OnboardingStep }; finished: boolean };
}

export type DemoAction =
  | { type: 'inbox/open'; id: string }
  | { type: 'inbox/remove'; ids: string[]; how: Removal }
  /** Takes back the last removal. */
  | { type: 'inbox/undo' }
  | { type: 'brief'; on?: boolean; delivery?: Delivery }
  | { type: 'sync'; on: boolean }
  | { type: 'work/select'; selection: Selection }
  | { type: 'work/archived'; ids: string[] }
  /** The answers changed on `step`. Steps after it wait for Continue again, which checks them. */
  | { type: 'onboarding/edit'; answers: Partial<OnboardingData>; step: OnboardingStep }
  /** Continue checked the answers and moved on to `step`. */
  | { type: 'onboarding/next'; answers: Partial<OnboardingData>; step: OnboardingStep }
  /** Finish drops the draft: the answers now live in the profile, Settings and appearance. */
  | { type: 'onboarding/finish' }
  /** Cancel drops the draft and keeps whether onboarding was finished before. */
  | { type: 'onboarding/leave' };

export const initialState: DemoState = {
  inbox: { read: [], removed: [] },
  brief: { on: true, delivery: 'morning' },
  sync: true,
  work: { archived: [], selection: { kind: 'ids', ids: [] } },
  onboarding: { finished: false },
};

const MESSAGES = new Set(initialMessages.map((m) => m.id));
const WORK = new Set(allWorkItems.map((w) => w.id));
const removedIds = (s: DemoState) => new Set(s.inbox.removed.flatMap((r) => r.ids));
const keepIn = (sel: StoredSelection, keep: (id: string) => boolean): StoredSelection =>
  sel.kind === 'ids' ? { kind: 'ids', ids: sel.ids.filter(keep) } : { kind: 'all-matching', except: sel.except.filter(keep) };

/** Only IDs the sample data knows are kept, so stored state can't name a message or a work item that doesn't exist. */
export function reduce(s: DemoState, a: DemoAction): DemoState {
  switch (a.type) {
    case 'inbox/open':
      return MESSAGES.has(a.id) && !s.inbox.read.includes(a.id) ? { ...s, inbox: { ...s.inbox, read: [...s.inbox.read, a.id] } } : s;
    case 'inbox/remove': {
      const gone = removedIds(s);
      const ids = [...new Set(a.ids)].filter((id) => MESSAGES.has(id) && !gone.has(id));
      return ids.length ? { ...s, inbox: { ...s.inbox, removed: [...s.inbox.removed, { ids, how: a.how }] } } : s;
    }
    case 'inbox/undo':
      return s.inbox.removed.length ? { ...s, inbox: { ...s.inbox, removed: s.inbox.removed.slice(0, -1) } } : s;
    case 'brief':
      return { ...s, brief: { on: a.on ?? s.brief.on, delivery: a.delivery ?? s.brief.delivery } };
    case 'sync':
      return { ...s, sync: a.on };
    case 'work/select': {
      const gone = new Set(s.work.archived);
      const sel: StoredSelection = a.selection.kind === 'ids'
        ? { kind: 'ids', ids: [...a.selection.ids] }
        : { kind: 'all-matching', except: [...a.selection.except] };
      return { ...s, work: { ...s.work, selection: keepIn(sel, (id) => WORK.has(id) && !gone.has(id)) } };
    }
    case 'work/archived': {
      const ids = [...new Set(a.ids)].filter((id) => WORK.has(id) && !s.work.archived.includes(id));
      // An archived item leaves the selection too, wherever it was archived from.
      return ids.length ? { ...s, work: { archived: [...s.work.archived, ...ids], selection: keepIn(s.work.selection, (id) => !ids.includes(id)) } } : s;
    }
    case 'onboarding/edit':
      return { ...s, onboarding: { ...s.onboarding, draft: { answers: a.answers, reached: a.step } } };
    case 'onboarding/next': {
      const reached = Math.max(s.onboarding.draft?.reached ?? 0, a.step) as OnboardingStep;
      return { ...s, onboarding: { ...s.onboarding, draft: { answers: a.answers, reached } } };
    }
    case 'onboarding/finish':
      return { ...s, onboarding: { finished: true } };
    case 'onboarding/leave':
      return s.onboarding.draft ? { ...s, onboarding: { finished: s.onboarding.finished } } : s;
  }
}

const VERSION = 1;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const record = (v: unknown) => (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strings = (v: unknown) => list(v).filter((x): x is string => typeof x === 'string');
/** Typed tables, so adding a value to the union fails the typecheck here. */
const oneOf = <T extends string>(values: Record<T, true>) => (v: unknown): v is T => typeof v === 'string' && Object.hasOwn(values, v);
const isRemoval = oneOf<Removal>({ archived: true, deleted: true });
const isDelivery = oneOf<Delivery>({ morning: true, evening: true });
const isStep = (v: unknown): v is OnboardingStep => v === 0 || v === 1 || v === 2;
const ANSWERS: { [K in keyof OnboardingData]: (v: unknown) => boolean } = {
  name: (v) => typeof v === 'string',
  email: (v) => typeof v === 'string',
  accent: (v) => (presets as readonly unknown[]).includes(v),
  dailyBrief: (v) => typeof v === 'boolean',
  delivery: isDelivery,
};
/** The stored answers that are onboarding's own and have the right type. */
const answers = (v: unknown): Partial<OnboardingData> =>
  Object.fromEntries(Object.entries(record(v)).filter(([k, x]) => Object.hasOwn(ANSWERS, k) && ANSWERS[k as keyof OnboardingData](x)));

/** Storage can hold anything, so each stored field is checked and replayed through `reduce`; the rest is the sample's. */
export function parse(raw: unknown): DemoState {
  const stored = record(raw);
  if (stored.version !== VERSION) return initialState;
  const inbox = record(stored.inbox);
  const brief = record(stored.brief);
  const work = record(stored.work);
  const sel = record(work.selection);
  const onboarding = record(stored.onboarding);
  const draft = record(onboarding.draft);
  const actions: DemoAction[] = [
    ...strings(inbox.read).map((id): DemoAction => ({ type: 'inbox/open', id })),
    ...list(inbox.removed).map(record).flatMap((r): DemoAction[] => (isRemoval(r.how) ? [{ type: 'inbox/remove', ids: strings(r.ids), how: r.how }] : [])),
    { type: 'brief', on: typeof brief.on === 'boolean' ? brief.on : undefined, delivery: isDelivery(brief.delivery) ? brief.delivery : undefined },
    ...(typeof stored.sync === 'boolean' ? [{ type: 'sync', on: stored.sync } as const] : []),
    { type: 'work/archived', ids: strings(work.archived) },
    ...(sel.kind === 'ids' ? [{ type: 'work/select', selection: { kind: 'ids', ids: new Set(strings(sel.ids)) } } as const] : []),
    // Without its list of exceptions, "all matching" would select everything.
    ...(sel.kind === 'all-matching' && Array.isArray(sel.except) ? [{ type: 'work/select', selection: { kind: 'all-matching', except: new Set(strings(sel.except)) } } as const] : []),
    // Finish first, since it drops the draft: a replay after a finish has both.
    ...(onboarding.finished === true ? [{ type: 'onboarding/finish' } as const] : []),
    ...(isRecord(onboarding.draft) ? [{ type: 'onboarding/edit', answers: answers(draft.answers), step: isStep(draft.reached) ? draft.reached : 0 } as const] : []),
  ];
  return actions.reduce(reduce, initialState);
}

/** The sample messages, less the removed ones, with each opened one read. */
export function inboxMessages(s: DemoState): InboxMessage[] {
  const gone = removedIds(s);
  return initialMessages.filter((m) => !gone.has(m.id)).map((m) => (m.unread && s.inbox.read.includes(m.id) ? { ...m, unread: false } : m));
}

/** The sample work items, less the archived ones. */
export function workItems(s: DemoState): WorkItem[] {
  const gone = new Set(s.work.archived);
  return allWorkItems.filter((w) => !gone.has(w.id));
}

export function workSelection(s: DemoState): Selection {
  const sel = s.work.selection;
  return sel.kind === 'ids' ? { kind: 'ids', ids: new Set(sel.ids) } : { kind: 'all-matching', except: new Set(sel.except) };
}

// One store for the tab's session: a reload keeps it, and a new tab starts from the sample data, so a link into the
// demo opened in a new tab finds its message.
const KEY = 'lede:demo';

function load(): DemoState {
  try {
    return parse(JSON.parse(sessionStorage.getItem(KEY) ?? 'null'));
  } catch {
    return initialState;
  }
}

let state = load();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function dispatch(action: DemoAction) {
  const next = reduce(state, action);
  if (next === state) return;
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...state })); } catch { /* storage unavailable: keep in memory */ }
  listeners.forEach((listener) => listener());
}

/** The state now, for code that runs outside a render: a module, or a callback after an await. */
export const getDemo = () => state;
export const useDemo = () => useSyncExternalStore(subscribe, getDemo);
