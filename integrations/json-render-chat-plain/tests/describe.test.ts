import { expect, test } from 'vitest';
import type { Spec } from '@json-render/core';
import { describe } from '../src/chat/describe';
import signup from '../src/chat/replies/signup.json';
import week from '../src/chat/replies/week.json';
import inbox from '../src/chat/replies/inbox.json';

test('a literal param picks the element, and its title names it', () => {
  expect(describe(inbox as Spec, 'submit', { form: 'message', values: { to: 'grace@example.com', text: 'Hi' } })).toBe('You pressed Send.');
});

test('a param bound to state arrives as its value, and of a field and a button that send one form, the button names it', () => {
  expect(describe(signup as Spec, 'submit', { form: 'signup', values: { name: 'Ada Lovelace' } }, 'wrong')).toBe('You pressed Create account.');
});

test('a control whose label isn’t literal takes the name of the control that ran it', () => {
  expect(describe(week as Spec, 'archive', { id: 'venue-review' }, 'Venue review')).toBe('You archived Venue review.');
});
