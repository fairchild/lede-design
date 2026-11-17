import { useState } from 'react';
import { Page } from '@/components/lede/blocks/page';
import { ProfileFlow, type Profile } from '@/components/lede/flows/profile';

// A flow brings no gutter of its own: put it in Page, or in AppShell's main region.
export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({ name: 'Ada Lovelace', email: 'ada@example.com' });
  return (
    <Page render={<main />} width="narrow">
      <ProfileFlow value={profile} onSave={setProfile} back={{ href: '/settings', label: 'Settings' }} />
    </Page>
  );
}
