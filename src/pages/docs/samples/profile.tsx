import { ProfileFlow, type Profile } from '@/components/lede/flows/profile';

// Saving resolves or rejects; a rejection keeps the edits and shows why.
export function ProfilePage({ profile, onSave }: { profile: Profile; onSave: (next: Profile) => Promise<void> }) {
  return <ProfileFlow value={profile} onSave={onSave} back={{ href: '/settings', label: 'Settings' }} />;
}
