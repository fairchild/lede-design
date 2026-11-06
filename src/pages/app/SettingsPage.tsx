import { SettingsFlow, describeAppearance } from '@lede/flows/settings';
import { Avatar } from '@lede/avatar';
import { useAppearance } from '@/theme';
import { useProfile } from '@/profile';
import { dispatch, useDemo, type DemoState } from '@/demo-store';

const DELIVERY: Record<DemoState['brief']['delivery'], string> = { morning: 'Each morning at 8:00 AM', evening: 'Each evening at 6:00 PM' };

export function SettingsPage() {
  const { prefs } = useAppearance();
  const { profile } = useProfile();
  const { brief, sync } = useDemo();
  return (
    <SettingsFlow
      summary={`${describeAppearance(prefs)} · sync ${sync ? 'on' : 'off'}`}
      groups={[
        {
          id: 'profile', title: 'Profile',
          rows: [{ id: 'profile', title: profile.name, subtitle: profile.role, leading: <Avatar name={profile.name} src={profile.avatarUrl} />, href: '/app/profile' }],
        },
        {
          id: 'display', title: 'Display', summary: prefs.scheme === 'auto' ? 'Follows your device' : undefined,
          rows: [{ id: 'appearance', title: 'Appearance', value: describeAppearance(prefs).split(' · ').slice(0, 2).join(' · '), href: '/app/settings/appearance' }],
        },
        {
          id: 'notifications', title: 'Notifications', summary: brief.on ? 'Daily brief on' : 'Daily brief off',
          footer: 'The brief summarizes decisions, meetings and spending once a day.',
          rows: [
            { id: 'brief', title: 'Daily brief', subtitle: brief.on ? DELIVERY[brief.delivery] : undefined, toggle: { checked: brief.on, onCheckedChange: (on) => dispatch({ type: 'brief', on }) } },
          ],
        },
        {
          id: 'account', title: 'Account', summary: sync ? 'Synced' : 'Sync paused',
          footer: 'Turning sync off keeps changes on this device only.',
          rows: [
            { id: 'sync', title: 'Sync across devices', toggle: { checked: sync, onCheckedChange: (on) => dispatch({ type: 'sync', on }) } },
            { id: 'onboarding', title: 'Replay onboarding', href: '/app/welcome' },
          ],
        },
      ]}
    />
  );
}
