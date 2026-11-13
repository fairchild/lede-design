import { expect, test } from 'vitest';
import type { Spec } from '@json-render/core';
import { describe } from '../src/chat/describe';
import signup from '../src/chat/replies/signup.json';
import week from '../src/chat/replies/week.json';
import inbox from '../src/chat/replies/inbox.json';

test('a literal param picks the element, and its title names it', () => {
  expect(describe(inbox as Spec, 'archive', { id: 'm1' })).toBe('You archived Grace Hopper.');
});

test('a param bound to state arrives as its value, and of a field and a button that send one form, the button names it', () => {
  expect(describe(signup as Spec, 'submit', { form: 'signup', values: { name: 'Ada Lovelace' } }, 'wrong')).toBe('You pressed Create account.');
});

test('a control whose label isn’t literal takes the name of the control that ran it', () => {
  expect(describe(week as Spec, 'archive', { id: 'venue-review' }, 'Venue review')).toBe('You archived Venue review.');
});

test('of two elements that bind one action, the literal params pick the one that ran', () => {
  const row = (title: string, id: string) => ({ type: 'ListRow', props: { title }, on: { press: { action: 'archive', params: { id } } } });
  const spec: Spec = {
    root: 'list',
    elements: { list: { type: 'ListGroup', props: {}, children: ['ada', 'grace'] }, ada: row('Ada Lovelace', 'a1'), grace: row('Grace Hopper', 'g1') },
  };
  expect(describe(spec, 'archive', { id: 'g1' })).toBe('You archived Grace Hopper.');
  expect(describe(spec, 'archive', { id: 'a1' })).toBe('You archived Ada Lovelace.');
});
