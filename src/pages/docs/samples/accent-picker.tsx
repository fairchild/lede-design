import { useState } from 'react';
import { AccentPicker } from '@/components/lede/blocks/accent-picker';
import { FormSection } from '@/components/lede/blocks/form-section';
import { ThemeProvider, type Preset } from '@/components/lede/theme-provider';

export function AccentSetting() {
  const [accent, setAccent] = useState<Preset>('blue');
  return (
    <ThemeProvider accent={accent}>
      <FormSection legend="Accent">
        <AccentPicker value={accent} onValueChange={setAccent} />
      </FormSection>
    </ThemeProvider>
  );
}
