import { PageHeader } from '@lede/blocks/page-header';
import { RouterLink } from '@/router-link';

export interface Choice {
  /** What the reader is building, in their words. */
  need: string;
  /** The registry item that answers it. */
  item: string;
  /** What to import, as the docs page titles it. */
  title: string;
  /** Where it's shown: a docs section or a Daybook screen. */
  href: string;
  /** Why it fits, or what to use beside it. */
  note: string;
}

export const CHOICES: Array<{ id: string; title: string; choices: Choice[] }> = [
  {
    id: 'structure', title: 'The page',
    choices: [
      { need: 'An app with a few places, each a whole screen', item: 'app-shell', title: 'AppShell', href: '/blocks#b-shell', note: 'A left bar on wide screens and a floating bar on narrow ones. Most apps start here.' },
      { need: 'Several things in view at once, such as files, an editor and a chat', item: 'workbench-shell', title: 'WorkbenchShell', href: '/blocks#b-workbench', note: 'Three panels under a top bar. Side panels resize and collapse.' },
      { need: 'A list beside the item it opens, such as messages', item: 'master-detail', title: 'MasterDetail', href: '/blocks#b-md', note: 'Two named regions inside AppShell’s page. The route says which item is open.' },
      { need: 'A screen’s title, its one-line summary and a way back', item: 'page-header', title: 'PageHeader', href: '/blocks#b-header', note: 'Every screen has one. Its h1 takes focus when the screen opens.' },
    ],
  },
  {
    id: 'content', title: 'Showing things',
    choices: [
      { need: 'A short list of things to open or switch, such as settings', item: 'list', title: 'ListGroup & ListRow', href: '/components#c-list', note: 'Each row is a link, a button or plain text, with its actions in a ••• menu.' },
      { need: 'Many rows to sort, select, search or page through', item: 'data-table', title: 'DataTable', href: '/blocks#b-table', note: 'Turns into cards in a narrow container.' },
      { need: 'Rows that come from a server, a page at a time', item: 'use-server-rows', title: 'useServerRows', href: '/blocks#b-server-rows', note: 'Fetches and caches the pages a server-mode DataTable shows.' },
      { need: 'A small table that doesn’t change', item: 'table', title: 'Table', href: '/components#c-table', note: 'A native table in parts. DataTable builds on it.' },
      { need: 'A number and what it means, linking to more', item: 'summary-card', title: 'SummaryCard', href: '/blocks#b-summary', note: 'A figure, a one-line takeaway and a status in words.' },
      { need: 'Detail that opens when someone asks for it', item: 'disclosure', title: 'Disclosure', href: '/components#c-disc', note: 'Its summary reads while it’s closed, and find-in-page can open it.' },
      { need: 'Related content on one surface', item: 'card', title: 'Card', href: '/components#c-card', note: 'Nested corners stay concentric with the card’s.' },
      { need: 'A list of things that may need a look, worst first', item: 'status-list', title: 'StatusList', href: '/blocks#b-status', note: 'Each row ends in its status in words, and an empty list says nothing needs a look.' },
      { need: 'A status word in a row or a cell, such as Failed or Done', item: 'status-text', title: 'StatusText', href: '/components#c-status', note: 'Colored by its tone, with a dot, so color never carries it alone.' },
      { need: 'A person, with or without a picture', item: 'avatar', title: 'Avatar', href: '/components#c-avatar', note: 'Falls back to initials.' },
      { need: 'A place with nothing in it yet', item: 'empty-state', title: 'EmptyState', href: '/blocks#b-empty', note: 'A heading, one sentence and at most one action.' },
    ],
  },
  {
    id: 'input', title: 'Actions and input',
    choices: [
      { need: 'An action, or a link that looks like one', item: 'button', title: 'Button', href: '/components#c-button', note: 'One filled Button per view, for the main action.' },
      { need: 'One choice from two to five, all in view', item: 'segmented-control', title: 'SegmentedControl', href: '/components#c-seg', note: 'Radio inputs. Use it for a view or a mode, such as Wide and Narrow.' },
      { need: 'A setting that turns on or off at once', item: 'switch', title: 'Switch', href: '/components#c-switch', note: 'For a choice that waits for a Save, use Checkbox.' },
      { need: 'A yes or no in a form, or picking rows', item: 'checkbox', title: 'Checkbox', href: '/components#c-check', note: 'Has a mixed state for “some selected”.' },
      { need: 'Text, a line or several', item: 'text-field', title: 'TextField', href: '/components#c-field', note: 'Its label, hint and error come wired up.' },
      { need: 'A box that filters a list as people type', item: 'search-field', title: 'SearchField', href: '/components#c-search', note: 'Its label is hidden, and Escape or its clear button empties it.' },
      { need: 'Fields that belong together under a name', item: 'form-section', title: 'FormSection', href: '/blocks#b-form', note: 'A fieldset and legend on a card.' },
      { need: 'A form in several steps', item: 'step-indicator', title: 'StepIndicator', href: '/blocks#b-steps', note: 'Shows where the person is. The onboarding flow uses it.' },
      { need: 'Actions on everything selected', item: 'selection-bar', title: 'SelectionBar', href: '/blocks#b-md', note: 'Appears once something is selected and announces the count.' },
      { need: 'Moving between places on a phone, or tools over the content', item: 'glass-bar', title: 'GlassBar & GlassToolbar', href: '/components#c-glass', note: 'AppShell already uses GlassBar on narrow screens.' },
    ],
  },
  {
    id: 'theme', title: 'Theme',
    choices: [
      { need: 'Light, dark, high contrast, accent or density for the app or one part of it', item: 'theme-provider', title: 'ThemeProvider', href: '/components#c-theme', note: 'Wrap the app in one. Every install needs it.' },
      { need: 'Letting people pick an accent color', item: 'accent-picker', title: 'AccentPicker', href: '/blocks#b-accent', note: 'Each swatch has its name beside it.' },
    ],
  },
  {
    id: 'screens', title: 'Whole screens',
    choices: [
      { need: 'A home screen that sums up the day', item: 'daily-brief', title: 'DailyBriefFlow', href: '/app', note: 'Summary cards that link onward, then sections that open in place.' },
      { need: 'An inbox, from the list to the open message', item: 'inbox', title: 'InboxFlow', href: '/app/inbox', note: 'Row actions, a swipe, bulk actions and undo.' },
      { need: 'Sign-up in a few steps', item: 'onboarding', title: 'OnboardingFlow', href: '/app/welcome', note: 'Three steps with inline errors and a review.' },
      { need: 'A person’s profile, edited in place', item: 'profile', title: 'ProfileFlow', href: '/app/profile', note: 'The details, then an edit on the same page.' },
      { need: 'Settings and appearance', item: 'settings', title: 'SettingsFlow, AppearanceFlow', href: '/app/settings', note: 'Grouped settings, each with its value or a switch.' },
      { need: 'A screen that a model writes as its reply', item: 'json-render', title: 'SpecView', href: '/integrations#json-render', note: 'Draws a json-render spec with Lede’s components.' },
    ],
  },
];

export function Choose() {
  return (
    <div className="ld-flow">
      <PageHeader title="Choose a part" summary="What you’re building, and the part of Lede that does it. Each one links to its example." />
      {CHOICES.map((group) => (
        <section key={group.id} aria-labelledby={`choose-${group.id}`} className="docs-section">
          <h2 id={`choose-${group.id}`} className="text-title-3">{group.title}</h2>
          <dl className="docs-regions docs-choices">
            {group.choices.map((c) => (
              <div key={c.need}>
                <dt>{c.need}</dt>
                <dd><RouterLink href={c.href}>{c.title}</RouterLink>. {c.note}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
