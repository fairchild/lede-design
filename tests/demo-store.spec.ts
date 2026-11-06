// The demo store's reducer and its reading of storage, in Node with no browser. tests/demo-state.spec.ts drives the pages.
import { test, expect } from '@playwright/test';
import { initialState, inboxMessages, parse, reduce, workItems, workSelection, type DemoAction, type DemoState } from '../src/demo-store';

const run = (...actions: DemoAction[]) => actions.reduce(reduce, initialState);
const stored = (s: DemoState) => JSON.parse(JSON.stringify({ version: 1, ...s }));
const ids = (s: DemoState) => inboxMessages(s).map((m) => m.id);
const unread = (s: DemoState) => inboxMessages(s).filter((m) => m.unread).map((m) => m.id);

test('the sample inbox: six messages, five unread, newest first', () => {
  expect(ids(initialState)).toEqual(['m6', 'm5', 'm1', 'm2', 'm3', 'm4']);
  expect(unread(initialState)).toEqual(['m6', 'm5', 'm1', 'm2', 'm3']);
});

test('opening a message marks it read once, and an unknown ID changes nothing', () => {
  const s = run({ type: 'inbox/open', id: 'm1' });
  expect(unread(s)).toEqual(['m6', 'm5', 'm2', 'm3']);
  expect(reduce(s, { type: 'inbox/open', id: 'm1' })).toBe(s);
  expect(reduce(s, { type: 'inbox/open', id: 'nope' })).toBe(s);
});

test('archiving and deleting remove messages in batches, and the rest keep the sample’s order', () => {
  const s = run(
    { type: 'inbox/remove', ids: ['m2', 'm4'], how: 'archived' },
    { type: 'inbox/remove', ids: ['m5', 'm5', 'nope'], how: 'deleted' },
  );
  expect(s.inbox.removed).toEqual([{ ids: ['m2', 'm4'], how: 'archived' }, { ids: ['m5'], how: 'deleted' }]);
  expect(ids(s)).toEqual(['m6', 'm1', 'm3']);
  // Removing what's already gone, or nothing the sample knows, adds no batch.
  expect(reduce(s, { type: 'inbox/remove', ids: ['m2', 'nope'], how: 'deleted' })).toBe(s);
});

test('Undo takes back the last removal, and the messages return to their places in the sample’s order', () => {
  const s = run(
    { type: 'inbox/open', id: 'm2' },
    { type: 'inbox/remove', ids: ['m2', 'm4'], how: 'archived' },
    { type: 'inbox/remove', ids: ['m6'], how: 'deleted' },
  );
  const once = reduce(s, { type: 'inbox/undo' });
  expect(once.inbox.removed).toEqual([{ ids: ['m2', 'm4'], how: 'archived' }]);
  expect(ids(once)).toEqual(['m6', 'm5', 'm1', 'm3']);
  const twice = reduce(once, { type: 'inbox/undo' });
  expect(ids(twice)).toEqual(ids(initialState));
  // What was read stays read: Undo takes back the removal, and only the removal.
  expect(unread(twice)).toEqual(['m6', 'm5', 'm1', 'm3']);
  // With nothing left to take back, Undo changes nothing.
  expect(reduce(twice, { type: 'inbox/undo' })).toBe(twice);
  expect(reduce(initialState, { type: 'inbox/undo' })).toBe(initialState);
});

test('stored removals read back as batches in their order, so Undo after a reload takes back the last one', () => {
  const s = parse({
    version: 1,
    inbox: { read: [], removed: [{ ids: ['m1', 'nope'], how: 'archived' }, 'junk', { ids: ['m3'], how: 'deleted' }, { ids: ['nope'], how: 'deleted' }, { ids: ['m4'], how: 'archived' }] },
  });
  expect(s.inbox.removed).toEqual([{ ids: ['m1'], how: 'archived' }, { ids: ['m3'], how: 'deleted' }, { ids: ['m4'], how: 'archived' }]);
  expect(reduce(s, { type: 'inbox/undo' }).inbox.removed).toEqual([{ ids: ['m1'], how: 'archived' }, { ids: ['m3'], how: 'deleted' }]);
  // A batch whose IDs are all unknown or already removed is dropped, so Undo never takes back nothing.
  expect(parse({ version: 1, inbox: { removed: [{ ids: ['m1'], how: 'archived' }, { ids: ['m1', 'nope'], how: 'deleted' }] } }).inbox.removed)
    .toEqual([{ ids: ['m1'], how: 'archived' }]);
});

test('Settings’ toggles and onboarding’s delivery time change only their own field', () => {
  const s = run({ type: 'brief', on: false }, { type: 'sync', on: false });
  expect(s.brief).toEqual({ on: false, delivery: 'morning' });
  expect(s.sync).toBe(false);
  expect(reduce(s, { type: 'brief', delivery: 'evening' }).brief).toEqual({ on: false, delivery: 'evening' });
  expect(reduce(s, { type: 'brief', on: true, delivery: 'evening' }).brief).toEqual({ on: true, delivery: 'evening' });
});

test('Work’s selection keeps only work items that exist and aren’t archived', () => {
  const s = run(
    { type: 'work/archived', ids: ['WI-1003'] },
    { type: 'work/select', selection: { kind: 'ids', ids: new Set(['WI-1001', 'WI-1003', 'WI-9999']) } },
  );
  expect(s.work.selection).toEqual({ kind: 'ids', ids: ['WI-1001'] });
  const all = reduce(s, { type: 'work/select', selection: { kind: 'all-matching', except: new Set(['WI-1002', 'nope']) } });
  expect(all.work.selection).toEqual({ kind: 'all-matching', except: ['WI-1002'] });
  expect(workSelection(all)).toEqual({ kind: 'all-matching', except: new Set(['WI-1002']) });
});

test('an archived work item is kept once, leaves the list and leaves the selection', () => {
  const s = run(
    { type: 'work/select', selection: { kind: 'ids', ids: new Set(['WI-1001', 'WI-1002']) } },
    { type: 'work/archived', ids: ['WI-1001', 'WI-1001', 'WI-9999'] },
  );
  expect(s.work).toEqual({ archived: ['WI-1001'], selection: { kind: 'ids', ids: ['WI-1002'] } });
  expect(workItems(s).map((w) => w.id)).not.toContain('WI-1001');
  expect(workItems(s)).toHaveLength(workItems(initialState).length - 1);
  // Archiving what's already archived, or nothing the sample knows, changes nothing.
  expect(reduce(s, { type: 'work/archived', ids: ['WI-1001', 'nope'] })).toBe(s);
  expect(reduce(s, { type: 'work/archived', ids: [] })).toBe(s);
  // Unticked rows of "all matching" that are archived leave its exceptions.
  const all = run({ type: 'work/select', selection: { kind: 'all-matching', except: new Set(['WI-1004', 'WI-1005']) } }, { type: 'work/archived', ids: ['WI-1004'] });
  expect(all.work.selection).toEqual({ kind: 'all-matching', except: ['WI-1005'] });
});

test('stored state reads back as it was saved', () => {
  const s = run(
    { type: 'inbox/open', id: 'm1' },
    { type: 'inbox/remove', ids: ['m2'], how: 'archived' },
    { type: 'brief', on: false, delivery: 'evening' },
    { type: 'sync', on: false },
    { type: 'work/archived', ids: ['WI-1001'] },
    { type: 'work/select', selection: { kind: 'ids', ids: new Set(['WI-1002']) } },
  );
  expect(parse(stored(s))).toEqual(s);
  const all = run({ type: 'work/select', selection: { kind: 'all-matching', except: new Set(['WI-1002']) } });
  expect(parse(stored(all))).toEqual(all);
});

test('a state saved before Work was in the store reads with Work’s defaults', () => {
  const before = { version: 1, inbox: { read: ['m1'], removed: [] }, brief: { on: true, delivery: 'morning' }, sync: false };
  expect(parse(before)).toEqual({ ...initialState, inbox: { read: ['m1'], removed: [] }, sync: false });
});

test('storage that isn’t this version’s state reads as the sample', () => {
  for (const junk of [null, 5, '{}', [1], {}, { version: 2, sync: false }, { ...stored(run({ type: 'sync', on: false })), version: '1' }]) {
    expect(parse(junk), JSON.stringify(junk)).toEqual(initialState);
  }
});

test('each stored field is kept only when it has the right type, a known ID or an allowed value', () => {
  const s = parse({
    version: 1,
    inbox: {
      read: ['m1', 'nope', 5, null, 'm1'],
      removed: [null, 5, { ids: ['m2', 'nope'], how: 'archived' }, { ids: ['m3'], how: 'shredded' }, { ids: ['m6'], how: 'constructor' }, { ids: 'm4', how: 'deleted' }, { ids: ['m2', 'm5'], how: 'deleted' }],
    },
    brief: { on: 'yes', delivery: 'noon' },
    sync: null,
  });
  expect(s).toEqual({ ...initialState, inbox: { read: ['m1'], removed: [{ ids: ['m2'], how: 'archived' }, { ids: ['m5'], how: 'deleted' }] } });
  expect(parse({ version: 1, inbox: [], brief: { delivery: 'evening' }, sync: false })).toEqual({ ...initialState, brief: { on: true, delivery: 'evening' }, sync: false });
  // A name every object inherits isn't an allowed value.
  expect(parse({ version: 1, brief: { delivery: 'toString' } }).brief.delivery).toBe('morning');
});

test('Work’s stored fields are kept only when they name work items, and a selection only when its kind is known', () => {
  const s = parse({ version: 1, work: { archived: ['WI-1001', 'WI-9999', 5, null], selection: { kind: 'ids', ids: ['WI-1001', 'WI-1002', 7] } } });
  expect(s.work).toEqual({ archived: ['WI-1001'], selection: { kind: 'ids', ids: ['WI-1002'] } });
  for (const selection of [null, 5, [], { kind: 'some', ids: ['WI-1002'] }, { kind: 'ids', ids: 'WI-1002' }, { kind: 'all-matching', ids: ['WI-1002'] }, { kind: 'all-matching', except: 'WI-1002' }]) {
    expect(parse({ version: 1, work: { archived: 'WI-1001', selection } }).work, JSON.stringify(selection)).toEqual(initialState.work);
  }
});

const ADA = { name: 'Ada Lovelace', email: 'ada@example.com', accent: 'orange', dailyBrief: false, delivery: 'evening' } as const;

test('onboarding’s draft: Continue moves the furthest step on, and an edit brings it back to the step it was made on', () => {
  const s = run({ type: 'onboarding/next', answers: ADA, step: 1 }, { type: 'onboarding/next', answers: ADA, step: 2 });
  expect(s.onboarding).toEqual({ draft: { answers: ADA, reached: 2 }, finished: false });
  // Back to Preferences and on again never takes the draft past where it was.
  expect(reduce(s, { type: 'onboarding/next', answers: ADA, step: 1 }).onboarding.draft?.reached).toBe(2);
  const edited = reduce(s, { type: 'onboarding/edit', answers: { ...ADA, email: 'ada@' }, step: 0 });
  expect(edited.onboarding.draft).toEqual({ answers: { ...ADA, email: 'ada@' }, reached: 0 });
  // A first edit starts a draft on its own step.
  expect(run({ type: 'onboarding/edit', answers: ADA, step: 0 }).onboarding).toEqual({ draft: { answers: ADA, reached: 0 }, finished: false });
});

test('Finish ends the draft and marks onboarding finished; Cancel ends it and leaves finished as it was', () => {
  const drafting = run({ type: 'onboarding/next', answers: ADA, step: 1 });
  const finished = reduce(drafting, { type: 'onboarding/finish' });
  expect(finished.onboarding).toEqual({ finished: true });
  expect(reduce(drafting, { type: 'onboarding/leave' }).onboarding).toEqual({ finished: false });
  // A replay after a finish, left halfway, is still finished.
  const replay = reduce(finished, { type: 'onboarding/edit', answers: ADA, step: 0 });
  expect(reduce(replay, { type: 'onboarding/leave' }).onboarding).toEqual({ finished: true });
  // With no draft, Cancel changes nothing.
  expect(reduce(finished, { type: 'onboarding/leave' })).toBe(finished);
  expect(reduce(initialState, { type: 'onboarding/leave' })).toBe(initialState);
  // Onboarding changes only its own slice.
  expect({ ...finished, onboarding: initialState.onboarding }).toEqual(initialState);
});

test('a stored onboarding draft reads back as it was saved, with or without a finish before it', () => {
  const drafting = run({ type: 'onboarding/next', answers: ADA, step: 2 });
  expect(parse(stored(drafting))).toEqual(drafting);
  const replay = run({ type: 'onboarding/finish' }, { type: 'onboarding/edit', answers: ADA, step: 1 });
  expect(parse(stored(replay))).toEqual(replay);
  expect(parse(stored(run({ type: 'onboarding/finish' })))).toEqual(run({ type: 'onboarding/finish' }));
});

test('a state saved before onboarding was in the store reads with onboarding’s defaults', () => {
  const before = { version: 1, inbox: { read: ['m1'], removed: [] }, brief: { on: false, delivery: 'evening' }, sync: true, work: { archived: [], selection: { kind: 'ids', ids: [] } } };
  expect(parse(before)).toEqual({ ...initialState, inbox: { read: ['m1'], removed: [] }, brief: { on: false, delivery: 'evening' } });
  expect(parse(before).onboarding).toEqual({ finished: false });
});

test('a stored draft keeps each answer that is onboarding’s own and has the right type, and reads an unknown step as Account', () => {
  const s = parse({
    version: 1,
    onboarding: {
      finished: 'yes',
      draft: { answers: { name: 'Ada', email: 5, accent: 'plaid', dailyBrief: 'no', delivery: 'noon', role: 'Admin', constructor: 'x' }, reached: 7 },
    },
  });
  expect(s.onboarding).toEqual({ draft: { answers: { name: 'Ada' }, reached: 0 }, finished: false });
  expect(parse({ version: 1, onboarding: { draft: { answers: { accent: 'teal', dailyBrief: false, delivery: 'evening' }, reached: 2 } } }).onboarding.draft)
    .toEqual({ answers: { accent: 'teal', dailyBrief: false, delivery: 'evening' }, reached: 2 });
  // Something that isn't a draft is no draft, so Done stays reachable after a finish.
  for (const junk of [null, 5, 'draft', [1], true]) {
    expect(parse({ version: 1, onboarding: { finished: true, draft: junk } }).onboarding, JSON.stringify(junk)).toEqual({ finished: true });
  }
  for (const junk of [null, 5, [], 'done']) {
    expect(parse({ version: 1, onboarding: junk }).onboarding, JSON.stringify(junk)).toEqual({ finished: false });
  }
  // A draft with no answers that read back still holds its step; the page fills the answers from the profile.
  expect(parse({ version: 1, onboarding: { draft: { answers: null, reached: 1 } } }).onboarding.draft).toEqual({ answers: {}, reached: 1 });
});
