import readme from '../../README.md?raw';
import { PageHeader } from '@/components/lede/blocks/page-header';
import { system } from '../chat/system';
import { CodeBlock, inline, Markdown, parse, section, type Block } from './markdown';

// How it works and Build it draw README.md's own sections. AGENTS.md points at the same steps, so a coding agent and a
// person reading these pages follow one text.

const how = parse(section(readme, 'How it works'));
const agent = parse(section(readme, 'Hand this to your coding agent'));
const build = parse(section(readme, 'Build this in your app'));
const steps = (blocks: Block[]) => blocks.find((b) => b.kind === 'list' && b.ordered);

/** Where each step of the loop shows in Try it: a question to ask, then what to open. */
export const EXAMPLES = [
  { ask: 'How’s my week?', then: 'then open “How this reply was made” to read your words as they were sent.' },
  { ask: 'Show my notification settings', then: 'turn a switch off and ask “turn off push”. The second reply’s account shows the state that went with it.' },
  { ask: 'What’s in my inbox?', then: 'then open “How this reply was made” to read the patches in the order they arrived.' },
  { ask: 'Show my tasks', then: 'then add a task while the list streams in.' },
  { ask: 'Help me sign up', then: 'press Create account with the fields empty. “What the screen did” says why it was held back.' },
];

const SeeIt = ({ n }: { n: number }) => {
  const example = EXAMPLES[n - 1];
  return example ? (
    <p className="jrc-see"><a href={`#/?ask=${encodeURIComponent(example.ask)}`}>Try “{example.ask}”</a>, {example.then}</p>
  ) : null;
};

export function HowItWorks() {
  const [lead, ...rest] = how;
  return (
    <div className="jrc-page">
      <PageHeader title="How it works" summary={lead?.kind === 'p' ? inline(lead.text) : undefined} focusOnMount={false} />
      <div className="ld-prose jrc-md">
        <Markdown blocks={rest} label="How it works" afterStep={(n) => <SeeIt n={n} />} />
      </div>
    </div>
  );
}

export function BuildIt() {
  const count = steps(build)?.kind === 'list' ? (steps(build) as Extract<Block, { kind: 'list' }>).items.length : 0;
  return (
    <div className="jrc-page">
      <PageHeader title="Build it" summary={`Copy the chat into a React app in ${count} steps, or hand them to a coding agent.`} focusOnMount={false} />
      <section aria-labelledby="build-agent" className="ld-prose jrc-md">
        <h2 id="build-agent">Hand this to your coding agent</h2>
        <Markdown blocks={agent} label="Prompt for your coding agent" />
      </section>
      <section aria-labelledby="build-steps" className="ld-prose jrc-md">
        <h2 id="build-steps">Build this in your app</h2>
        <Markdown blocks={build} label="Build this in your app" />
      </section>
    </div>
  );
}

export function SystemPrompt() {
  return (
    <div className="jrc-page">
      <PageHeader
        title="The system prompt"
        summary={`The server sends the model these ${system.length.toLocaleString('en-US')} characters before the conversation. The catalog’s prompt() writes them in src/chat/system.ts.`}
        back={{ href: '#/', label: 'Try it' }}
        focusOnMount={false}
      />
      <CodeBlock code={system} label="The system prompt" />
    </div>
  );
}
