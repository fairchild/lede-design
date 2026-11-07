import type { Spec } from '@json-render/core';
import settings from '../specs/settings.json';
import inbox from '../specs/inbox.json';
import signup from '../specs/signup.json';
import recipe from '../specs/recipe.json';
import empty from '../specs/empty.json';
import invalid from '../specs/invalid.json';

/** The recorded specs, by the name the picker shows. The last one is wrong on purpose. */
export const specs = {
  Settings: settings,
  Inbox: inbox,
  'Sign-up form': signup,
  Recipe: recipe,
  'Empty state': empty,
  'Invalid spec': invalid,
} as Record<string, Spec> as Record<'Settings' | 'Inbox' | 'Sign-up form' | 'Recipe' | 'Empty state' | 'Invalid spec', Spec>;

export type SpecName = keyof typeof specs;
