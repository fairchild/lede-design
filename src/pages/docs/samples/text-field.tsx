import { TextField } from '@/components/lede/text-field';

export function ContactFields({ emailError }: { emailError?: string }) {
  return (
    <>
      <TextField label="Display name" name="name" autoComplete="name" hint="Shown to people you share with." />
      <TextField label="Email" name="email" type="email" autoComplete="email" error={emailError} />
    </>
  );
}
