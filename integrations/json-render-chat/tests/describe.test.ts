import { expect, test } from 'vitest';
import type { Spec } from '@json-render/core';
import { describe } from '../src/chat/describe';
import signup from '../src/chat/replies/signup.json';
import week from '../src/chat/replies/week.json';
import inbox from '../src/chat/replies/inbox.json';

test('a literal param picks the element, and its title names it', () => {
  expect(describe(inbox as Spec, 'open', { id: 'm1' })).toBe('You opened Grace Hopper.');
});

test('a param bound to state arrives as its value, and of a field and a button that send one form, the button names it', () => {
  expect(describe(signup as Spec, 'submit', { form: 'signup', values: { name: 'Ada Lovelace' } }, 'wrong')).toBe('You pressed Create account.');
});

test('a row drawn by repeat, whose title comes from state, takes the name of the control that ran it', () => {
  expect(describe(week as Spec, 'open', { id: 'venue-review' }, 'Venue review')).toBe('You opened Venue review.');
});
