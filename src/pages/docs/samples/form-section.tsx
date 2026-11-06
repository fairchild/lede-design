import { FormSection } from '@/components/lede/blocks/form-section';
import { TextField } from '@/components/lede/text-field';

export function ProfileForm({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  return (
    <form action={onSubmit}>
      <FormSection legend="About you" description="We use this on your profile.">
        <TextField label="Name" name="name" autoComplete="name" />
      </FormSection>
    </form>
  );
}
