import type { ReactNode } from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { SummaryCard } from '@lede/blocks/summary-card';
import { Disclosure } from '@lede/disclosure';
import { Button } from '@lede/button';
import { LAYOUTS } from './Layouts';
import { tokenFamilies } from './Foundations';
import { decisionCount } from './Decisions';
import registry from '../../../registry.json';
import { version } from '../../../package.json';
import { CodeExample } from './CodeExample';

const PRINCIPLES: Array<{ title: string; summary: string; rules: ReactNode[] }> = [
  {
    title: 'Hierarchy', summary: 'Content leads, and the controls around it stay quiet.',
    rules: [
      'Content sits on flat surfaces, and navigation and tools float above it on glass.',
      'One filled Button per view.',
      'One large title per screen, then title, headline and body.',
    ],
  },
  {
    title: 'Harmony', summary: 'Nested corners are concentric with the ones around them.',
    rules: [
      <>A child’s radius is its parent’s radius less the padding between them. Capsules and circles aside, every radius derives from <code>--radius</code> and <code>--radius-step</code>.</>,
      <>Anything a finger presses is a capsule, fully round except under ThemeProvider’s <code>shape="square"</code>.</>,
      'Motion is physical and brief: about 240ms, with springs for movement.',
    ],
  },
  {
    title: 'Consistency', summary: 'One set of conventions that adapts to every size and setting.',
    rules: [
      'Layouts reflow to fit and keep the same styles at every size.',
      'Lede follows each person’s color scheme, contrast, motion and transparency preferences.',
    ],
  },
  {
    title: 'Progressive disclosure', summary: 'The summary comes first, and detail opens when a person asks for it.',
    rules: [
      'Every screen, section and row leads with its takeaway.',
      'Selecting a header reveals the next level. Nothing opens on its own.',
      'Affordances are quiet and appear at the point of use: on hover, on focus or after opening.',
      'Expert paths, such as a swipe, stay hidden, and each has a visible twin one level deeper.',
    ],
  },
  {
    title: 'Semantic HTML', summary: 'A native element first, then Base UI where HTML can’t do the interaction, then ARIA only for what HTML can’t express.',
    rules: [
      'Navigation is a link, and an action is a button.',
      <>Every region has a name, and every screen has one <code>{'<h1>'}</code>.</>,
      <>Closed panels stay in the page as <code>hidden="until-found"</code>, so find-in-page can open them.</>,
    ],
  },
];

const COMPONENTS = registry.items.filter((item) => item.type === 'registry:component').length;
const BLOCKS = registry.items.filter((item) => item.categories?.includes('blocks')).length;
// Titles are export names ("InboxFlow"); item names read as words ("daily-brief").
const FLOWS = registry.items.filter((item) => item.categories?.includes('flows')).map((item) => item.name.replaceAll('-', ' '));
/** "a, b and c": Lede's lists have no serial comma, which `Intl.ListFormat('en')` adds. */
const listed = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join(''));
// Titles that hold "with" and "and" stay apart when a dot separates them.
const LAYOUT_LINE = LAYOUTS.map((l) => l.title).join(' · ');
const REGISTRY = `https://lede.cloudcompute.com/r/v${version}/{name}.json`;
const INSTALL_CODE = `npx shadcn@latest registry add '@lede=${REGISTRY}'
npx shadcn@latest add @lede/theme-provider @lede/data-table @lede/daily-brief @lede/inbox`;

export function Overview() {
  return (
    <div className="ld-flow">
      <PageHeader title="Lede" summary="A design system for React, installed from a shadcn registry. Every screen, section and row leads with its takeaway, and detail opens on request." />
      <section aria-labelledby="explore" className="docs-section docs-explore">
        <h2 id="explore" className="text-title-3">Explore</h2>
        <ul className="ld-summary-grid">
          <li><SummaryCard title="Foundations" figure={tokenFamilies.count} summary={tokenFamilies.summary} href="/foundations" /></li>
          <li><SummaryCard title="Components" figure={COMPONENTS} summary="Primitives on Base UI and native elements." href="/components" /></li>
          <li><SummaryCard title="Blocks" figure={BLOCKS} summary="Layouts and the larger parts of a screen." href="/blocks" /></li>
          <li><SummaryCard title="Layouts" figure={LAYOUTS.length} summary={LAYOUT_LINE} href="/layouts" /></li>
          <li><SummaryCard title="Demo app" figure={FLOWS.length} summary={`Hero flows, whole screens built from blocks: ${listed(FLOWS)}.`} href="/app" /></li>
          <li><SummaryCard title="Decisions" figure={decisionCount} summary="How Lede is built and what keeps it that way." href="/decisions" /></li>
        </ul>
      </section>
      <section aria-labelledby="principles" className="docs-section">
        <h2 id="principles" className="text-title-3">Principles</h2>
        {PRINCIPLES.map((p) => (
          <Disclosure key={p.title} title={p.title} summary={p.summary} headingLevel={3}>
            <ul className="docs-rules">{p.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </Disclosure>
        ))}
        <p className="docs-actions"><Button variant="tinted" href="/decisions">Decisions: how Lede is built and checked</Button></p>
      </section>
      <section aria-labelledby="install" className="docs-section">
        <h2 id="install" className="text-title-3">Install</h2>
        <p className="docs-intro">Add Lede’s registry to your project, then add the items you need. The registry URL pins version {version}, and a release’s files never change. Each item brings in <code>lede-theme</code> and its other dependencies, and <code>@lede/theme-provider</code> stays in the list because your app wraps in it. Lede renders on the client only, so it suits a Vite app or another client-only React app. The README has the remaining steps.</p>
        <CodeExample label="Install commands" language="shell" code={INSTALL_CODE} defaultOpen />
      </section>
    </div>
  );
}
