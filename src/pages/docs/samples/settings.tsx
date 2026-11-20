import { useState } from 'react';
import { Page } from '@/components/lede/blocks/page';
import { SettingsFlow } from '@/components/lede/flows/settings';

// A flow brings no gutter of its own: put it in Page, or in AppShell's main region.
export function SettingsScreen() {
  const [digest, setDigest] = useState(true);
  return (
    <Page render={<main />} width="narrow">
      <SettingsFlow
        title="Settings"
        groups={[
          {
            id: 'notifications',
            title: 'Notifications',
            rows: [
              { id: 'digest', title: 'Daily digest', toggle: { checked: digest, onCheckedChange: setDigest } },
              { id: 'profile', title: 'Profile', value: 'Ada Lovelace', href: '/settings/profile' },
            ],
          },
        ]}
      />
    </Page>
  );
}
