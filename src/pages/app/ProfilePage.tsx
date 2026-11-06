import { ProfileFlow } from '@lede/flows/profile';
import { useProfile } from '@/profile';

export function ProfilePage() {
  const { profile, saveProfile } = useProfile();
  return <ProfileFlow value={profile} onSave={saveProfile} back={{ href: '/app/settings', label: 'Settings' }} />;
}
