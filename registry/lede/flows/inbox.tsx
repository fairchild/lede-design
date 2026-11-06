import * as React from 'react';
import { flushSync } from 'react-dom';
import { announce } from '@react-aria/live-announcer';
import { PageHeader, useBackOnEscape } from '../blocks/page-header';
import { MasterDetail, useStackedPanes } from '../blocks/master-detail';
import { SelectionBar, formatCount, type Noun } from '../blocks/selection-bar';
import { EmptyState } from '../blocks/empty-state';
import { ListGroup, ListRow } from '../list';
import { Disclosure } from '../disclosure';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { useLinkComponent } from '../link';
import { focusLanding } from '../input-modality';

export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  preview: string;
  /** Display date, such as "9:41 AM" or "Tue". */
  date: string;
  /** Machine-readable date for `<time>`. */
  datetime: string;
  unread?: boolean;
  body: string[];
  /** The passage this message replies to, shown above its body. */
  quote?: { from: string; text: string };
  /** The earlier messages of a conversation, oldest first. `from`, `preview`, `date` and `body` above are the latest. */
  thread?: InboxReply[];
}
/** An earlier message in a conversation. */
export type InboxReply = Pick<InboxMessage, 'from' | 'preview' | 'date' | 'datetime' | 'quote' | 'body'>;

/** The outcome of the last action, such as “Archived 2 messages.” with an Undo. */
export interface InboxNotice {
  /** Names this notice. A new `id` is a new line, announced even when its text repeats; the same `id` stays put. */
  id: string | number;
  text: string;
  /**
   * At most one. Focus moves to the first message `onSelect` puts back in the list, in the commit that renders it, else
   * to the list's heading when the button leaves. Until then it stays on the button, unless the person moves it.
   */
  action?: { label: string; onSelect: () => void };
}

export interface InboxFlowProps {
  messages: InboxMessage[];
  /** The open message, from the route. */
  selectedId?: string;
  hrefFor: (id: string) => string;
  /** Where Back goes on narrow screens. */
  listHref: string;
  onArchive: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onReply?: (id: string) => void;
  /** Shown under the header and announced politely. The flow never dismisses it: pass `undefined` to clear it. */
  notice?: InboxNotice;
  /**
   * What the detail says when `selectedId` names no message in `messages`, such as one archived since its link was made.
   * Pass it once `messages` has loaded. Without it, an unknown `selectedId` reads as nothing selected.
   */
  notFound?: { title: string; description?: string };
  /** A BCP 47 tag, such as `'en-US'`, for every count the flow shows, the selection's included. Default: the browser's locale. */
  locale?: string;
}

const MESSAGE: Noun = { one: 'message', other: 'messages' };
const PERSON: Noun = { one: 'person', other: 'people' };

/**
 * Hero flow: list → detail. Rows summarize a message (sender, subject, first line, date and the size of a thread),
 * and the detail opens on its own URL. A thread is a Disclosure per message, newest first, with only the latest open.
 * Row actions follow progressive disclosure: a ••• menu (revealed on hover and focus, always shown on a touch
 * screen), a swipe on touch and the same actions on the opened message. Bulk actions appear only after "Select".
 */
export function InboxFlow(props: InboxFlowProps) {
  const [selecting, setSelecting] = React.useState(false);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  // A message that leaves the list leaves the selection, wherever it was removed from, so the bar counts only those here.
  const present = new Set(props.messages.map((m) => m.id));
  if ([...picked].some((id) => !present.has(id))) setPicked(new Set([...picked].filter((id) => present.has(id))));
  const unread = props.messages.filter((m) => m.unread).length;
  const selected = props.messages.find((m) => m.id === props.selectedId) ?? null;
  const missing = !selected && props.selectedId ? props.notFound : undefined;
  const num = (count: number) => count.toLocaleString(props.locale);
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  const finish = () => { setSelecting(false); setPicked(new Set()); };
  // Each notice is spoken once per new `id`, on mount too, after the focus move its action makes. The
  // announcer's text leaves after a second, as DataTable's sort announcement does, so browse mode doesn't meet it again.
  const spokenId = React.useRef<InboxNotice['id']>(undefined);
  React.useEffect(() => {
    const n = props.notice;
    if (!n || spokenId.current === n.id) return;
    spokenId.current = n.id;
    announce([n.text, n.action?.label].filter(Boolean).join(' '), 'polite', 1000);
  }, [props.notice?.id]);
  // The control that fired a row, bulk or open-message action leaves with its message, so focus keeps the reader's
  // place: the row after the first message removed, the one before when none is after it, the list's heading when
  // nothing is left. The notice above the list stays in view while it's up, and its Undo comes before every row in tab order.
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const selectRef = React.useRef<HTMLButtonElement>(null);
  const toHeading = () => {
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'nearest' });
  };
  const rowLink = (id: string) => headingRef.current?.closest('.ld-md-list')?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"] .ld-row-primary`);
  const toRow = (row: HTMLElement) => {
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'nearest' });
    // A route change's scroll to the top comes in a later commit, so the row scrolls again once that's done.
    requestAnimationFrame(() => { if (document.activeElement === row) row.scrollIntoView({ block: 'nearest' }); });
  };
  const toPlace = (order: string[], removed: string[]) => () => {
    const from = Math.min(...removed.map((id) => order.indexOf(id)).filter((i) => i >= 0));
    const kept = (ids: string[]) => ids.filter((id) => !removed.includes(id)).map(rowLink).find(Boolean);
    const after = kept(order.slice(from));
    const before = kept(order.slice(0, from).reverse());
    const row = after ?? before;
    if (row) toRow(row); else toHeading();
  };
  const order = props.messages.map((m) => m.id);
  // An Undo lands on the first message it brought back, in the commit that renders it. One that renders later keeps
  // focus on its button and waits, until the message is back or the button leaves, unless the person moves on first.
  const toRestored = (button: HTMLButtonElement) => {
    let held: Element | null | undefined;
    return () => {
      const at = document.activeElement;
      if (held !== undefined && at !== held && at !== document.body) return false;
      const back = headingRef.current?.closest('.ld-md-list')?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [];
      const row = [...back].find((r) => !order.includes(r.dataset.rowId!))?.querySelector<HTMLElement>('.ld-row-primary');
      if (row) toRow(row); else if (button.isConnected) { held = at; return true; } else toHeading();
      return false;
    };
  };
  // An action's result renders at once, and focus moves in the commit that takes the action's control away, before a
  // frame can show focus on <body>. A landing that returns `true` is still waiting, and tries again on the next commit.
  const landing = React.useRef<(() => boolean | void) | null>(null);
  const land = () => { const to = landing.current; landing.current = null; if (to?.()) landing.current = to; };
  React.useLayoutEffect(land);
  const act = (run: () => void, to: () => boolean | void) => {
    landing.current = to;
    flushSync(run);
    land();
  };
  const removeFromList = (remove: (ids: string[]) => void, ids: string[]) => act(() => remove(ids), toPlace(order, ids));
  const toSelect = () => selectRef.current?.focus();
  const firstCheck = () => headingRef.current?.closest('.ld-md-list')?.querySelector<HTMLInputElement>('.ld-checkbox-input')?.focus();
  // Escape backs out one layer: selection mode first, onto Select, then the open message, by its back link.
  const backRef = React.useRef<HTMLAnchorElement>(null);
  useBackOnEscape(selecting ? () => act(finish, toSelect) : selected || missing ? () => backRef.current?.click() : undefined);
  // Closing a message, by its back link or the browser's Back, returns focus to its row: the reader's place in the list.
  // In the commit that takes the detail away, and only when focus left with it, so a reader already elsewhere stays.
  const open = React.useRef(props.selectedId);
  React.useLayoutEffect(() => {
    const closed = open.current;
    open.current = props.selectedId;
    if (!closed || props.selectedId || !document.hasFocus()) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && active.checkVisibility()) return;
    const row = headingRef.current?.closest('.ld-md-list')?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(closed)}"] .ld-row-primary`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  }, [props.selectedId]);

  // Side by side, the open message's row links to the URL already shown, so nothing remounts and its title wouldn't
  // take focus. Activating that row moves focus to the title, as opening any other message does.
  React.useEffect(() => {
    const pane = headingRef.current?.closest<HTMLElement>('.ld-md-list');
    if (!pane) return undefined;
    const reopen = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const row = e.target instanceof Element ? e.target.closest('.ld-row-primary[aria-current="page"]') : null;
      if (row) focusLanding(pane.closest('.ld-md')?.querySelector<HTMLElement>('.ld-md-detail .ld-message-title'));
    };
    pane.addEventListener('click', reopen);
    return () => pane.removeEventListener('click', reopen);
  }, []);

  const list = (
    <>
      <PageHeader
        title="Inbox"
        summary={unread ? `${num(unread)} unread of ${num(props.messages.length)}` : `All read · ${formatCount(props.messages.length, MESSAGE, props.locale)}`}
        // An open message or a not-found detail takes focus with its own title, in either layout.
        focusOnMount={!selected && !missing}
        headingRef={headingRef}
        actions={
          <Button ref={selectRef} variant="gray" size="sm" onClick={() => (selecting ? finish() : act(() => setSelecting(true), firstCheck))}>
            {selecting ? 'Done' : 'Select'}
          </Button>
        }
      />
      <Notice notice={props.notice} onUse={(button, onSelect) => act(onSelect, toRestored(button))} />
      {props.messages.length === 0 ? (
        <EmptyState title="No messages" description="New messages land here." />
      ) : (
        <ListGroup title="Messages" summary={unread ? `${num(unread)} unread` : 'All read'}>
          {props.messages.map((m) => {
            const title = (
              <>
                {m.unread ? <span className="ld-sr-only">Unread: </span> : null}
                {m.subject}
              </>
            );
            return (
              <ListRow
                key={m.id}
                rowKey={m.id}
                className="ld-inbox-row"
                title={title}
                subtitle={`${m.from} · ${m.preview}`}
                value={<RowDate message={m} locale={props.locale} />}
                leading={m.unread ? <span className="ld-unread-dot" /> : <span />}
                href={selecting ? undefined : props.hrefFor(m.id)}
                current={m.id === props.selectedId}
                chevron={!selecting}
                actionsLabel={m.subject}
                trailing={
                  selecting ? (
                    <Checkbox
                      aria-label={`Select “${m.subject}” from ${m.from}`}
                      checked={picked.has(m.id)}
                      onChange={(e) => toggle(m.id, e.currentTarget.checked)}
                    />
                  ) : undefined
                }
                actions={
                  selecting
                    ? undefined
                    : [
                        { label: 'Archive', tone: 'neutral', onSelect: () => removeFromList(props.onArchive, [m.id]) },
                        { label: 'Delete', tone: 'critical', onSelect: () => removeFromList(props.onDelete, [m.id]) },
                      ]
                }
              />
            );
          })}
        </ListGroup>
      )}
      <SelectionBar
        count={picked.size}
        noun={MESSAGE}
        locale={props.locale}
        // Selection mode ends, so the checkboxes that focus came from leave too: focus returns to Select.
        onClear={() => act(finish, toSelect)}
        actions={[
          { label: 'Archive', onSelect: () => act(() => { props.onArchive([...picked]); finish(); }, toPlace(order, [...picked])) },
          { label: 'Delete', tone: 'critical', onSelect: () => act(() => { props.onDelete([...picked]); finish(); }, toPlace(order, [...picked])) },
        ]}
      />
    </>
  );

  const detail = selected ? (
    <MessageDetail key={selected.id} backRef={backRef} message={selected} href={props.hrefFor(selected.id)} listHref={props.listHref} onArchive={(ids) => removeFromList(props.onArchive, ids)} onDelete={(ids) => removeFromList(props.onDelete, ids)} onReply={props.onReply} locale={props.locale} />
  ) : missing ? (
    <MissingMessage key={props.selectedId} {...missing} backRef={backRef} listHref={props.listHref} />
  ) : null;

  return (
    <MasterDetail
      listLabel="Inbox"
      detailLabel="Open message"
      list={list}
      detail={detail}
      empty={<EmptyState title="Nothing open" description="Choose a message to read it here." headingLevel={2} />}
    />
  );
}

/** The notice as the eye reads it. The flow announces it through the live announcer, which no pane can hide. */
function Notice({ notice, onUse }: { notice?: InboxNotice; onUse: (button: HTMLButtonElement, onSelect: () => void) => void }) {
  if (!notice) return null;
  const { action } = notice;
  return (
    <p key={notice.id} className="ld-inbox-notice">
      <span>{notice.text}</span>
      {action ? <Button variant="plain" onClick={(e) => onUse(e.currentTarget, action.onSelect)}>{action.label}</Button> : null}
    </p>
  );
}

/** The row's date, and under it the size of a thread: a figure on a capsule, spelled out for assistive tech. */
function RowDate({ message: m, locale }: { message: InboxMessage; locale?: string }) {
  const size = (m.thread?.length ?? 0) + 1;
  return (
    <span className="ld-inbox-date">
      <time dateTime={m.datetime}>{m.date}</time>
      {size > 1 ? <span className="ld-inbox-count">{size.toLocaleString(locale)}<span className="ld-sr-only"> messages</span></span> : null}
    </span>
  );
}

function BackToList({ href, backRef }: { href: string; backRef: React.Ref<HTMLAnchorElement> }) {
  const Link = useLinkComponent();
  return (
    <Link ref={backRef} className="ld-back ld-md-back" href={href}>
      <svg viewBox="0 0 8 14" width="8" height="14" fill="none" aria-hidden="true">
        <path d="M6.5 1.5 1.5 7l5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Inbox
    </Link>
  );
}

/**
 * The detail's title takes focus when it opens, in either layout, so a link to a message lands on that message. Stacked
 * on a narrow screen, the detail is the whole screen, so its title is the `<h1>`. Focus moves before the next frame, so
 * none paints focus on `<body>`. A switch of layout swaps the heading's element, so the new one takes focus only when
 * focus left with the old one, or sits in the pane the switch hid.
 */
function useDetailTitle() {
  const stacked = useStackedPanes();
  const ref = React.useRef<HTMLHeadingElement>(null);
  const opened = React.useRef(false);
  React.useLayoutEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const lost = !active || active === document.body || !active.checkVisibility();
    if ((!opened.current || lost) && document.hasFocus()) focusLanding(ref.current);
    opened.current = true;
  }, [stacked]);
  return { Title: stacked ? 'h1' as const : 'h2' as const, ref, stacked };
}

/** The detail for an ID with no message. */
function MissingMessage({ title, description, listHref, backRef }: NonNullable<InboxFlowProps['notFound']> & { listHref: string; backRef: React.Ref<HTMLAnchorElement> }) {
  const { Title, ref } = useDetailTitle();
  return (
    <>
      <BackToList href={listHref} backRef={backRef} />
      <section className="ld-empty">
        <Title ref={ref} tabIndex={-1} className="text-title-3 ld-empty-title ld-message-title">{title}</Title>
        {description ? <p className="ld-empty-text">{description}</p> : null}
      </section>
    </>
  );
}

function MessageBody({ quote, body }: Pick<InboxMessage, 'quote' | 'body'>) {
  return (
    <div className="ld-prose">
      {quote ? (
        <figure className="ld-quote">
          <figcaption>{quote.from} wrote</figcaption>
          <blockquote>{quote.text}</blockquote>
        </figure>
      ) : null}
      {body.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

/** One message of a thread. `defaultOpen` is fixed at mount, so a newer reply arriving doesn't ask this one to close. */
function ThreadMessage({ message: c, headingLevel, latest }: { message: InboxReply; headingLevel: 2 | 3; latest: boolean }) {
  const [defaultOpen] = React.useState(latest);
  return (
    <Disclosure
      variant="plain"
      headingLevel={headingLevel}
      defaultOpen={defaultOpen}
      title={c.from}
      summary={c.preview}
      meta={<time dateTime={c.datetime}>{c.date}</time>}
    >
      <MessageBody quote={c.quote} body={c.body} />
    </Disclosure>
  );
}

type MessageDetailProps = Pick<InboxFlowProps, 'listHref' | 'onArchive' | 'onDelete' | 'onReply' | 'locale'> & {
  message: InboxMessage;
  href: string;
  backRef: React.Ref<HTMLAnchorElement>;
};

/** Where each open was left, side by side. Outside the flow, because going elsewhere in the app unmounts it. */
const scrollTops = new Map<string, number>();
const historyEntry = () => (globalThis as { navigation?: { currentEntry?: { id: string } | null } }).navigation?.currentEntry?.id;

/** The open message. It is keyed by message, so its place and open replies don't carry over to the next one. */
function MessageDetail({ message: m, href, backRef, listHref, onArchive, onDelete, onReply, locale }: MessageDetailProps) {
  const { Title, ref: titleRef, stacked } = useDetailTitle();

  // Side by side, the text scrolls inside the pane. Only then is it a named, focusable region, so keyboards can scroll it.
  const bodyRef = React.useRef<HTMLDivElement>(null);
  // A place belongs to a history entry, so Back returns to it and a fresh open starts at the top. The URL keeps apart
  // messages on one entry. Without the Navigation API the URL is all there is, so reopening returns to the place too.
  const [place] = React.useState(() => `${historyEntry() ?? ''} ${href}`);
  const [scrolls, setScrolls] = React.useState(false);
  React.useLayoutEffect(() => {
    const box = bodyRef.current;
    if (!box?.firstElementChild) return undefined;
    const measure = () => setScrolls(box.scrollHeight > box.clientHeight + 1);
    measure();
    box.scrollTop = scrollTops.get(place) ?? 0;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(box.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const replies = m.thread ?? [];
  const conversation = [m, ...[...replies].reverse()];
  const people = new Set(conversation.map((c) => c.from)).size;
  // Replies have no id. The count separates two from one sender in one minute; newest first, older history can't shift it.
  const seen = new Map<string, number>();
  const keyFor = (c: InboxReply) => {
    const key = `${c.datetime}|${c.from}`;
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    return `${key}|${occurrence}`;
  };
  return (
    <article className="ld-message" aria-labelledby={`msg-${m.id}`}>
      <div className="ld-message-bar">
        <BackToList href={listHref} backRef={backRef} />
        <div className="ld-message-actions">
          {onReply ? <Button variant="tinted" size="sm" onClick={() => onReply(m.id)}>Reply</Button> : null}
          <Button variant="gray" size="sm" onClick={() => onArchive([m.id])}>Archive</Button>
          <Button variant="gray" size="sm" tone="critical" onClick={() => onDelete([m.id])}>Delete</Button>
        </div>
      </div>
      <header className="ld-message-header">
        <Title ref={titleRef} tabIndex={-1} id={`msg-${m.id}`} className="text-title-2 ld-message-title">{m.subject}</Title>
        <p className="ld-message-meta">
          {replies.length ? `${formatCount(conversation.length, MESSAGE, locale)} · ${formatCount(people, PERSON, locale)} · last from ` : 'From '}
          <strong>{m.from}</strong> · <time dateTime={m.datetime}>{m.date}</time>
        </p>
      </header>
      <div ref={bodyRef} className="ld-message-body" onScroll={(e) => scrollTops.set(place, e.currentTarget.scrollTop)} {...(scrolls ? { role: 'region', tabIndex: 0, 'aria-label': 'Message text' } : {})}>
        {replies.length ? (
          <section className="ld-thread" aria-label="Messages, newest first">
            {conversation.map((c, i) => (
              <ThreadMessage key={keyFor(c)} message={c} headingLevel={stacked ? 2 : 3} latest={i === 0} />
            ))}
          </section>
        ) : (
          <MessageBody quote={m.quote} body={m.body} />
        )}
      </div>
    </article>
  );
}
