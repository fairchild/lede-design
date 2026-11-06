import * as React from 'react';
import type { Profile } from '@lede/flows/profile';
import { person } from '@/data/profile';

const KEY = 'lede:profile';

const FIELDS: Record<keyof Profile, true> = { name: true, email: true, role: true, location: true, bio: true, avatarUrl: true };

/** Storage can hold anything, so a field is kept only when it is one of the profile's own and holds text. */
function load(): Profile {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return person;
    return { ...person, ...Object.fromEntries(Object.entries(stored).filter(([k, v]) => Object.hasOwn(FIELDS, k) && typeof v === 'string')) };
  } catch {
    return person;
  }
}

const Ctx = React.createContext<{ profile: Profile; saveProfile: (p: Profile) => Promise<void> } | null>(null);

/** The demo's signed-in person, remembered per browser. Settings and the sidebar show what the profile saves. */
export function ProfileRoot({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<Profile>(load);
  const saveProfile = React.useCallback(async (p: Profile) => {
    // The demo has no server, so being offline is how its save fails, and how to see the failed state.
    if (!navigator.onLine) throw new Error('You’re offline. Your edits are still here, so save again once you’re back online.');
    setProfile(p);
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable: keep in memory */ }
  }, []);
  return <Ctx.Provider value={{ profile, saveProfile }}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useProfile must be used inside <ProfileRoot>');
  return v;
}
