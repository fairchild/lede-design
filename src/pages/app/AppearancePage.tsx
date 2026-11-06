import { AppearanceFlow } from '@lede/flows/settings';
import { useAppearance } from '@/theme';

export function AppearancePage() {
  const { prefs, setPrefs } = useAppearance();
  return <AppearanceFlow value={prefs} onValueChange={setPrefs} back={{ href: '/app/settings', label: 'Settings' }} />;
}
