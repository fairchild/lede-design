import { useState } from 'react';
import { Switch } from '@/components/lede/switch';

export function WifiSetting() {
  const [on, setOn] = useState(true);
  return <Switch label="Wi-Fi" checked={on} onCheckedChange={setOn} />;
}
