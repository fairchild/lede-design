import type { Spec } from '@json-render/core';
import settings from '../specs/settings.json';
import inbox from '../specs/inbox.json';
import signup from '../specs/signup.json';
import empty from '../specs/empty.json';

/** The recorded specs: the same four screens as the Lede entry, written in this catalog’s components. */
export const specs = { Settings: settings, Inbox: inbox, 'Sign-up form': signup, 'Empty state': empty } as Record<string, Spec> as Record<
  'Settings' | 'Inbox' | 'Sign-up form' | 'Empty state',
  Spec
>;
