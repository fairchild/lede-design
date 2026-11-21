import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { focusLanding } from '@lede/input-modality';
import { PageHeader } from '@lede/blocks/page-header';
import { Disclosure } from '@lede/disclosure';
import { Button } from '@lede/button';
import { SegmentedControl } from '@lede/segmented-control';
import { useViewParam } from '@/view-params';
import { RouterLink } from '@/router-link';
import { LAYOUTS, LayoutPreview } from './Layouts';
import { tokenFamilies } from './Foundations';
import { decisionCount } from './Decisions';
import { EXAMPLE_APPS } from './integration-apps';
import registry from '../../../registry.json';
import { version } from '../../../package.json';
import { CodeExample } from './CodeExample';
import { REPO } from './DocsLayout';
import { installGuide, readmeBlocks, type Block } from './readme-install';
import { agentPrompt } from './agent-prompt';
import { Live, useTwin } from './twin';
import readme from '../../../README.md?raw';

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
      <>Anything a finger presses is a capsule, fully round except under ThemeProvider’s <code>shape="square"</code>. A Button whose label wraps is a rounded rectangle.</>,
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

/** Reference screens built from Lede, shown live at the top of Overview. Each is a real route of the site. */
const EXAMPLES = [
  {
    value: 'inbox', label: 'Inbox', title: 'Daybook inbox', route: '/app/inbox/m1',
    summary: 'A left bar of places, a list of messages and the one it opens. It’s the inbox flow inside AppShell, with MasterDetail for the list and the message.',
  },
  {
    value: 'workbench', label: 'Three panels', title: 'Workbench with chat', route: '/layouts/workbench',
    summary: 'Files, the file they open and a chat about it, side by side under a top bar. It’s WorkbenchShell, whose side panels resize and collapse.',
  },
  {
    value: 'today', label: 'Daily brief', title: 'Daybook today', route: '/app',
    summary: 'The day at a glance: what’s next, what’s due and what changed. It’s the daily brief flow, built from summary cards and lists.',
  },
];
const EXAMPLE_VALUES = EXAMPLES.map((e) => e.value);

const COMPONENTS = registry.items.filter((item) => item.type === 'registry:component').length;
const BLOCKS = registry.items.filter((item) => item.categories?.includes('blocks')).length;
// Titles are export names ("InboxFlow"); item names read as words ("daily-brief").
const FLOWS = registry.items.filter((item) => item.categories?.includes('flows')).map((item) => item.name.replaceAll('-', ' '));
/** "a, b and c": Lede's lists have no serial comma, which `Intl.ListFormat('en')` adds. */
const listed = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join(''));
const REGISTRY = `https://lede.cloudcompute.com/r/v${version}/{name}.json`;
const INSTALL_CODE = `npx shadcn@latest registry add '@lede=${REGISTRY}'
npx shadcn@latest add @lede/theme-provider @lede/list`;

const README = `${REPO}#use-it-in-a-shadcn-project`;
const PROMPT = agentPrompt(readme, version);
const GUIDE = installGuide(readme);
const STEPS = GUIDE.steps;
const LIMITS = readmeBlocks(readme, 'Limits');
/** What each step's code shows, in order. A step the README adds later is named by its number. */
const CODE_LABELS: Record<number, string[]> = { 2: ['CSS import'], 3: ['Import a component'], 4: ['Wrap your app', 'React Router adapter'] };
/** What the code after the steps shows, in order: “Start from a new Vite app”. A block the README adds later is “Code”. */
const AFTER_LABELS = ['Create the app', 'vite.config.ts', 'The alias in both tsconfig files', 'Replace src/index.css and run shadcn init', 'Append step 2’s import', 'src/main.tsx', 'src/App.tsx'];

/**
 * README prose as the site writes it: code in `<code>`, bold, links to the repo, and curly quotes outside code. With
 * `here`, a link to a README section, such as `#limits`, stays on this page, which shows that section.
 */
function inline(text: string, here = false): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/).map((part, i) => {
    if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**')) return <strong key={i}>{inline(part.slice(2, -2), here)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={i} href={/^https?:/.test(link[2]) ? link[2] : link[2].startsWith('#') ? `${here ? '' : REPO}${link[2]}` : `${REPO}/blob/main/${link[2]}`}>{inline(link[1], here)}</a>;
    return curly(part);
  });
}
const curly = (text: string) => text.replace(/(^|[\s(])"/g, '$1“').replace(/"/g, '”').replace(/'/g, '’');

function StepBlocks({ number, blocks, code }: { number: number; blocks: Block[]; code?: ReactNode }) {
  let n = 0;
  return blocks.map((block, i) => {
    if (block.kind === 'text') return <p key={i}>{inline(block.text)}</p>;
    if (block.kind === 'list') return <ul key={i}>{block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}</ul>;
    // A heading starts the text after the steps, so a step never holds one.
    if (block.kind === 'heading') return null;
    if (code) return <Fragment key={i}>{code}</Fragment>;
    const label = CODE_LABELS[number]?.[n] ?? `Step ${number} code${n ? ` ${n + 1}` : ''}`;
    n += 1;
    return <CodeExample key={i} label={label} language={block.language} code={block.code} defaultOpen />;
  });
}

/**
 * The README's text around the steps, for the docs' Markdown build: what a project needs, how to move to a later release,
 * how to start from a new Vite app and the limits. The site links the README for these. `labels` names the code blocks
 * in order.
 */
function ReadmeBlocks({ blocks, labels = [] }: { blocks: Block[]; labels?: string[] }) {
  let n = 0;
  return blocks.map((block, i) => {
    if (block.kind === 'text') return <p key={i}>{inline(block.text, true)}</p>;
    if (block.kind === 'heading') return <h3 key={i}>{inline(block.text, true)}</h3>;
    if (block.kind === 'list') return <ul key={i}>{block.items.map((item, j) => <li key={j}>{inline(item, true)}</li>)}</ul>;
    const label = labels[n] ?? 'Code';
    n += 1;
    return <CodeExample key={i} label={label} language={block.language} code={block.code} defaultOpen />;
  });
}

/** The setup prompt for a coding agent, with a button that copies it. The Markdown build keeps the prompt and drops the button. */
function AgentPrompt() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 4000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = () => navigator.clipboard.writeText(PROMPT).then(() => setCopied(true), () => setCopied(false));
  return (
    <section aria-labelledby="agent" className="docs-section">
      <h2 id="agent" className="text-title-3">Use with an agent</h2>
      <p className="docs-intro">Paste this prompt into Claude Code, Cursor or another coding agent in your project. It follows the install steps below, pins version {version} and leaves the agent a note on where Lede’s docs are.</p>
      <pre className="docs-code docs-prompt"><code>{PROMPT}</code></pre>
      <Live>
        <p className="docs-actions">
          <Button variant="tinted" onClick={copy}>{copied ? 'Copied' : 'Copy prompt'}</Button>
          <span className="ld-sr-only" role="status">{copied ? 'Prompt copied' : ''}</span>
        </p>
      </Live>
    </section>
  );
}

export function Overview() {
  const twin = useTwin();
  const [shown, setShown] = useViewParam('example', EXAMPLE_VALUES, EXAMPLES[0].value);
  // The site sets each link on a line of its own; the Markdown runs them together, so a colon parts them there.
  const sep = twin ? ': ' : ' ';
  const example = EXAMPLES.find((e) => e.value === shown) ?? EXAMPLES[0];
  const { hash, key } = useLocation();
  const toInstall = hash === '#install';
  // A link to Install lands on its heading in the commit, as PageHeader does with the h1; the scroll waits a frame for
  // the router's own.
  useLayoutEffect(() => { if (toInstall && document.hasFocus()) focusLanding(document.getElementById('install')); }, [toInstall, key]);
  useEffect(() => {
    if (!toInstall) return undefined;
    const frame = requestAnimationFrame(() => document.getElementById('install')?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [toInstall, key]);
  const steps = (
    <ol className="docs-steps">
      {STEPS.map((step) => (
        <li key={step.number}>
          {/* Step 1's code pins this build's version, which the README's copy repeats by hand. */}
          <StepBlocks number={step.number} blocks={step.blocks} code={step.number === 1 ? <CodeExample label="Install commands" language="shell" code={INSTALL_CODE} defaultOpen /> : undefined} />
        </li>
      ))}
    </ol>
  );
  return (
    <div className="ld-flow">
      <PageHeader focusOnMount={!toInstall} title="Lede" summary="A design system for React, installed from a shadcn registry. Every screen, section and row leads with its takeaway, and detail opens on request." />
      <section aria-labelledby="example" className="docs-section">
        <h2 id="example" className="text-title-3">Example</h2>
        <p className="docs-intro">{twin ? 'Three screens built only from Lede, each a page of this site that you can open and use.' : example.summary}</p>
        <Live>
          <LayoutPreview
            title={example.title}
            route={example.route}
            controls={<SegmentedControl label="Example" options={EXAMPLES.map(({ value, label }) => ({ value, label }))} value={example.value} onValueChange={(v) => setShown(v)} />}
          />
          <p className="docs-actions"><Button variant="tinted" href={example.route} aria-label={`Open full page: ${example.title}`}>Open full page</Button></p>
        </Live>
        {twin ? <ul>{EXAMPLES.map((e) => <li key={e.value}><a href={e.route}>{e.title}</a>: {e.summary}</li>)}</ul> : null}
      </section>
      <section aria-labelledby="explore" className="docs-section">
        <h2 id="explore" className="text-title-3">Explore</h2>
        <ul className="docs-index">
          <li><RouterLink href="/choose">Choose a part</RouterLink>{sep}What you’re building, and the component, block or flow that does it.</li>
          <li><RouterLink href="/foundations">Foundations</RouterLink>{sep}{tokenFamilies.summary}</li>
          <li><RouterLink href="/components">Components</RouterLink>{sep}{COMPONENTS} primitives on Base UI and native elements.</li>
          <li><RouterLink href="/blocks">Blocks</RouterLink>{sep}{BLOCKS} layouts and larger parts of a screen.</li>
          <li><RouterLink href="/layouts">Layouts</RouterLink>{sep}{LAYOUTS.length} page structures, each a block you can install.</li>
          <li><RouterLink href="/app">Demo app</RouterLink>{sep}{FLOWS.length} hero flows, whole screens built from blocks: {listed(FLOWS)}.</li>
          <li><RouterLink href="/integrations">Integrations</RouterLink>{sep}{EXAMPLE_APPS.length} example apps for json-render, with Lede screens from JSON specs and in an AI SDK chat.</li>
          <li><RouterLink href="/decisions">Decisions</RouterLink>{sep}{decisionCount} records of how Lede is built and what keeps it that way.</li>
        </ul>
      </section>
      <AgentPrompt />
      <section aria-labelledby="install" className="docs-section">
        <h2 id="install" tabIndex={-1} className="text-title-3 docs-target">Install</h2>
        <p className="docs-intro">Add Lede’s registry to your project, then add the items you need. The registry URL pins version {version}, and a release’s files never change. Lede renders on the client only, so it suits a Vite app or another client-only React app. {twin ? 'What your project needs comes first, then the steps, how to move to a later release, how to start from a new Vite app and the limits.' : <>The <a href={README}>README</a> lists what your project needs, how to move to a later release and how to start from a new Vite app.</>} For a chat whose replies hold Lede screens, follow <a href={`${REPO}/blob/main/integrations/json-render-chat/AGENTS.md`}>the json-render chat recipe</a>.</p>
        {/* The Markdown build adds the README's text around the steps; the site keeps one element here, so its ids stay. */}
        {twin ? (
          <>
            <ReadmeBlocks blocks={GUIDE.before} />
            {steps}
            <ReadmeBlocks blocks={GUIDE.after} labels={AFTER_LABELS} />
            <h3>Limits</h3>
            <ReadmeBlocks blocks={LIMITS} />
          </>
        ) : steps}
      </section>
      <section aria-labelledby="principles" className="docs-section">
        <h2 id="principles" className="text-title-3">Principles</h2>
        {PRINCIPLES.map((p) => (
          <Disclosure key={p.title} title={p.title} summary={p.summary} headingLevel={3}>
            <ul className="docs-rules">{p.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </Disclosure>
        ))}
        <p className="docs-actions"><Button variant="tinted" href="/decisions">Decisions: how Lede is built and checked</Button> <Button variant="gray" href="/looks">Looks: the same principles in other styles</Button></p>
      </section>
    </div>
  );
}
