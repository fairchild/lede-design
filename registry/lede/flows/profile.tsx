import * as React from 'react';
import { flushSync } from 'react-dom';
import { PageHeader } from '../blocks/page-header';
import { FormSection } from '../blocks/form-section';
import { TextField } from '../text-field';
import { ListGroup, ListRow } from '../list';
import { Avatar } from '../avatar';
import { Button } from '../button';

export interface Profile {
  name: string;
  email: string;
  /** Job title, shown under the name. */
  role?: string;
  /** Where they're based. */
  location?: string;
  /** A sentence or two, up to 160 characters. */
  bio?: string;
  /** Picture URL. Initials show without one. */
  avatarUrl?: string;
}
export interface ProfileFlowProps {
  value: Profile;
  /**
   * Saves the edits. A returned promise keeps the form read-only until it settles. If it rejects, the edits stay and
   * an inline error shows the rejection's message when it's an `Error` with one, or asks the person to try again.
   * Throw an `Error` worded for the person: a fetch failure's own message, such as "Failed to fetch", shows as it is.
   */
  onSave: (next: Profile) => void | Promise<void>;
  /** Back link, such as `{ href: '/settings', label: 'Settings' }`. */
  back?: { href: string; label: string };
}

const TEXT = ['name', 'email', 'role', 'location', 'bio'] as const;
type Draft = Profile & Record<(typeof TEXT)[number], string>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BIO_MAX = 160;
const OPTIONAL = { role: 'a role', location: 'a location', bio: 'a short bio' } as const;
const RETRY = 'Your changes weren’t saved. Your edits are still here, so try again.';
/** "a, b and c", with no serial comma. */
const listed = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join(''));

/** The line under the name: what's left to add. A complete profile has nothing to say here. */
function describeProfile(p: Profile) {
  const missing = (Object.keys(OPTIONAL) as (keyof typeof OPTIONAL)[]).filter((k) => !p[k]).map((k) => OPTIONAL[k]);
  return missing.length ? `Add ${listed(missing)} to complete your profile` : undefined;
}

/** Every text field trimmed, with a field left out as empty. */
function clean(p: Profile) {
  const next = { ...p } as Draft;
  for (const k of TEXT) next[k] = (p[k] ?? '').trim();
  return next;
}

function validate(p: Draft) {
  const errors: { name?: string; email?: string; bio?: string } = {};
  if (!p.name) errors.name = 'Enter your name.';
  if (!EMAIL.test(p.email)) errors.email = 'Enter a complete email address, like name@example.com.';
  if (p.bio.length > BIO_MAX) errors.bio = `Shorten your bio to ${BIO_MAX} characters. It’s ${p.bio.length} now.`;
  return errors;
}

/**
 * Hero flow: who this is, then the details, with editing one button away on the same page. A native `<form>`
 * (Enter saves), with errors that say how to fix them and focus moved in and back out. A save is announced through a
 * status region that is already in the page. A failed save keeps the form open with the person's edits.
 */
export function ProfileFlow({ value, onSave, back }: ProfileFlowProps) {
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<ReturnType<typeof validate>>({});
  const [save, setSave] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [failure, setFailure] = React.useState(RETRY);
  const saving = save === 'saving';
  const id = React.useId();
  const field = (k: (typeof TEXT)[number]) => ({
    value: draft?.[k] ?? '',
    readOnly: saving,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.currentTarget.value;
      setDraft((d) => d && { ...d, [k]: v });
    },
  });
  const formRef = React.useRef<HTMLFormElement>(null);
  const editRef = React.useRef<HTMLButtonElement>(null);
  // Focus that was in the form leaves with it, so it goes back to Edit profile; focus anywhere else stays put. The
  // status changes after that move, so a screen reader says it after the button and doesn't cut it off.
  const close = (next: typeof save) => {
    const hadFocus = formRef.current?.contains(document.activeElement);
    flushSync(() => { setDraft(null); setErrors({}); setSave('idle'); });
    if (hadFocus) editRef.current?.focus();
    setSave(next);
  };

  // Escape on the form is its own while it's open, and the back link waits: it cancels when nothing changed, and
  // otherwise leaves the edits alone, so a stray press never throws away typing.
  const escape = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const saved = clean(value);
    if (draft && !saving && TEXT.every((k) => draft[k] === saved[k])) close('idle');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || saving) return;
    const next = clean(draft);
    const found = validate(next);
    setErrors(found);
    const first = (['name', 'email', 'bio'] as const).find((k) => found[k]);
    if (first) { setSave('idle'); document.getElementById(`${id}-${first}`)?.focus(); return; }
    setSave('saving');
    try {
      await onSave(next);
      close('saved');
    } catch (error) {
      setFailure((error instanceof Error && error.message.trim()) || RETRY);
      setSave('failed');
    }
  };

  return (
    <div className="ld-flow ld-flow-narrow">
      <PageHeader
        title={value.name}
        summary={<>{value.role ? <span className="ld-profile-role">{value.role}</span> : null}{describeProfile(value)}</>}
        leading={<Avatar name={value.name} src={value.avatarUrl} size="lg" />}
        back={back}
        backOnEscape={!draft}
        actions={draft ? undefined : (
          <Button ref={editRef} onClick={() => { setDraft(clean(value)); setSave('idle'); }}>Edit profile</Button>
        )}
      />
      <div className="ld-profile-status" role="status">
        {saving ? <span className="ld-sr-only">Saving…</span> : null}
        {save === 'saved' ? <span className="ld-status ld-status-positive"><span className="ld-status-dot" />Profile saved</span> : null}
      </div>
      {draft ? (
        <form ref={formRef} aria-label="Edit profile" aria-busy={saving || undefined} noValidate onSubmit={submit} onKeyDown={escape}>
          <FormSection legend="About you" description="Name and email are required.">
            <TextField id={`${id}-name`} label="Name" autoComplete="name" autoFocus enterKeyHint="done" {...field('name')} error={errors.name} required />
            <TextField label="Role" autoComplete="organization-title" enterKeyHint="done" {...field('role')} />
            <TextField id={`${id}-email`} label="Email" type="email" autoComplete="email" enterKeyHint="done" {...field('email')} error={errors.email} required />
            <TextField label="Location" autoComplete="address-level2" enterKeyHint="done" {...field('location')} />
            <TextField id={`${id}-bio`} label="Short bio" rows={3} {...field('bio')} error={errors.bio} hint={`Up to ${BIO_MAX} characters.`} />
          </FormSection>
          {save === 'failed' ? <p className="ld-profile-error" role="alert">{failure}</p> : null}
          <div className="ld-flow-actions">
            <Button variant="plain" disabled={saving} onClick={() => close('idle')}>Cancel</Button>
            <Button variant="filled" size="lg" type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </form>
      ) : (
        <ListGroup title="Details" className="ld-profile-details">
          <ListRow title="Email" subtitle={value.email} />
          <ListRow title="Location" subtitle={value.location || 'Not added'} />
          <ListRow title="Short bio" subtitle={value.bio || 'Not added'} />
        </ListGroup>
      )}
    </div>
  );
}
