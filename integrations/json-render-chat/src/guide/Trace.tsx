import * as React from 'react';
import { SPEC_DATA_PART_TYPE } from '@json-render/core';
import { Disclosure } from '@/components/lede/disclosure';
import type { TraceProps } from '../chat/Chat';
import { chatApi } from '../chat/transport';
import { system } from '../chat/system';
import { Code } from './markdown';

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const and = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const json = (value: unknown) => JSON.stringify(value, null, 2);

/** The wire for one reply, closed at first: its summary counts the patches and actions, and opening it shows each. */
export function Trace(props: TraceProps) {
  const { message, ran, held, live } = props;
  // Its parts draw only while it's open: closed, a reply carries no copy of its spec for find-in-page to land on, and
  // each streamed chunk costs an earlier reply one count.
  const [open, setOpen] = React.useState(false);
  const patches = message.parts.reduce((n, p) => n + (p.type === SPEC_DATA_PART_TYPE ? 1 : 0), 0);
  const did = [ran.length ? `${count(ran.length, 'action')} ran` : '', held.length ? `${count(held.length, 'action')} held back` : ''].filter(Boolean);
  const summary = patches
    ? `${count(patches, 'patch', 'patches')} built its screen${live ? ' so far' : ''}.${did.length ? ` ${did.join(', and ')}.` : ''}`
    : 'Words only, with no screen.';
  return (
    <Disclosure title="How this reply was made" summary={summary} className="jrc-trace" open={open} onOpenChange={setOpen}>
      {open ? <Parts {...props} /> : null}
    </Disclosure>
  );
}

/** What the model received, what it streamed, the spec it built and what its screen did since. */
function Parts({ message, spec, asked, state, ran, held }: TraceProps) {
  const id = React.useId();
  const text = message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('').trim();
  const patches = message.parts.flatMap((p) => (p.type === SPEC_DATA_PART_TYPE ? [p.data.type === 'patch' ? p.data.patch : p.data] : []));
  const sent = Object.keys(asked?.screens ?? {}).length;
  return (
    <>
      <section aria-labelledby={`${id}-received`}>
        <h4 id={`${id}-received`}>What the model received</h4>
        <p>
          {chatApi
            ? `This went to ${chatApi}. The server sends the model the system prompt, then the conversation with each earlier screen written back as its patches and the state below.`
            : 'Here a script in the browser answers, so no model saw this. With VITE_CHAT_API set, the server sends the model the system prompt, then the conversation with each earlier screen written back as its patches and the state below.'}
        </p>
        {asked ? <Code label="Your words" code={asked.text} /> : null}
        {sent ? <Code label={`The state of ${count(sent, 'earlier screen')}, sent as screens`} code={json(asked?.screens)} /> : <p>No earlier screen had state to send.</p>}
        <p>
          The system prompt comes first: {count(system.length, 'character')}, written by the catalog’s prompt().{' '}
          <a href="#/prompt">Read the system prompt</a>
        </p>
      </section>
      <section aria-labelledby={`${id}-streamed`}>
        <h4 id={`${id}-streamed`}>What it streamed</h4>
        <Code label="Text" code={text || '(none)'} />
        {patches.length ? <Code label={`${count(patches.length, 'patch', 'patches')}, in the order they arrived`} code={patches.map((p) => JSON.stringify(p)).join('\n')} /> : null}
      </section>
      {spec ? (
        <section aria-labelledby={`${id}-built`}>
          <h4 id={`${id}-built`}>What it built</h4>
          <Code label="The spec" code={json(spec)} />
          {state ? <Code label="The screen’s state now" code={json(state)} /> : null}
        </section>
      ) : null}
      {spec ? (
        <section aria-labelledby={`${id}-did`}>
          <h4 id={`${id}-did`}>What the screen did</h4>
          {ran.length || held.length ? (
            <ul className="jrc-trace-actions" aria-label="Actions">
              {ran.map((a, i) => <li key={`r${i}`}><code>{a.name}</code> ran with <code>{JSON.stringify(a.params)}</code></li>)}
              {held.map((h, i) => (
                <li key={`h${i}`}><code>{h.action}</code> was held back by {and(h.fields.map((f) => `${f.name} (“${f.message}”)`))}.</li>
              ))}
            </ul>
          ) : (
            <p>No action has run yet. Typing and switching change the state above.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
