import * as React from 'react';
import { SPEC_DATA_PART_TYPE, type Spec } from '@json-render/core';
import { Disclosure } from '@/components/lede/disclosure';
import { specFromParts } from '@/components/lede/json-render/patches';
import type { TraceProps } from '../chat/Chat';
import { chatApi } from '../chat/transport';
import { system } from '../chat/system';
import { Code } from './markdown';

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const and = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
/** What a field shows when its check fails: the spec's `error` on the element bound to that path, if it has one. */
const shownError = (spec: Spec | null, path: string) => {
  const element = Object.values(spec?.elements ?? {}).find((el) => Object.values(el.props ?? {}).some((v) => (v as { $bindState?: string } | null)?.$bindState === path));
  return typeof element?.props?.error === 'string' ? element.props.error : undefined;
};
const json = (value: unknown) => JSON.stringify(value, null, 2);

/** The wire for one reply: what the model received, what it streamed, the spec it built and what its screen did since. */
export function Trace({ message, asked, state, ran, held, live }: TraceProps) {
  const id = React.useId();
  // Its parts draw only while it's open: closed, a reply carries no copy of its spec for find-in-page to land on.
  const [open, setOpen] = React.useState(false);
  const text = message.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('').trim();
  const patches = message.parts.flatMap((p) => (p.type === SPEC_DATA_PART_TYPE ? [p.data.type === 'patch' ? p.data.patch : p.data] : []));
  const spec = specFromParts(message.parts);
  const sent = Object.entries(asked?.screens ?? {});
  const did = [ran.length ? `${count(ran.length, 'action')} ran` : '', held.length ? `${count(held.length, 'action')} held back` : ''].filter(Boolean);
  const summary = patches.length
    ? `${count(patches.length, 'patch', 'patches')} built its screen${live ? ' so far' : ''}.${did.length ? ` ${did.join(', and ')}.` : ''}`
    : 'Words only, with no screen.';

  return (
    <Disclosure title="How this reply was made" summary={summary} className="jrc-trace" open={open} onOpenChange={setOpen}>
      {open ? (
        <>
        <section aria-labelledby={`${id}-received`}>
          <h4 id={`${id}-received`}>What the model received</h4>
          <p>
            {chatApi
              ? `This went to ${chatApi}. The server sends the model the system prompt, then the conversation with each earlier screen written back as its patches and the state below.`
              : 'Here a script in the browser answers, so no model saw this. With VITE_CHAT_API set, the server sends the model the system prompt, then the conversation with each earlier screen written back as its patches and the state below.'}
          </p>
          {asked ? <Code label="Your words" code={asked.text} /> : null}
          {sent.length
            ? <Code label={`The state of ${count(sent.length, 'earlier screen')}, sent as screens`} code={json(asked?.screens)} />
            : <p>No earlier screen had state to send.</p>}
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
                  <li key={`h${i}`}>
                    <code>{h.action}</code> was held back by {and(h.fields.map((f) => `${f.name} (“${shownError(spec, f.name) ?? f.message}”)`))}.
                  </li>
                ))}
              </ul>
            ) : (
              <p>No action has run yet. Typing and switching change the state above.</p>
            )}
          </section>
        ) : null}
        </>
      ) : null}
    </Disclosure>
  );
}
