import { useState } from 'react';
import { SettingsFlow } from '@/components/lede/flows/settings';

// Each group leads with its state in words; a row is a link to a deeper page or a switch.
export function Settings() {
  const [sync, setSync] = useState(true);
  return (
    <SettingsFlow
      summary={`Light · sync ${sync ? 'on' : 'off'}`}
      groups={[
        { id: 'display', title: 'Display', rows: [{ id: 'appearance', title: 'Appearance', value: 'Light', href: '/settings/appearance' }] },
        {
          id: 'account', title: 'Account', summary: sync ? 'Synced' : 'Sync paused',
          footer: 'Turning sync off keeps changes on this device only.',
          rows: [{ id: 'sync', title: 'Sync across devices', toggle: { checked: sync, onCheckedChange: setSync } }],
        },
      ]}
    />
  );
}
