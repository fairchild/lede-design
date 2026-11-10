import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { useMove } from '@react-aria/interactions';
import { cn } from './cn';
import { focusLanding } from './input-modality';
import { useLinkComponent } from './link';
import { ThemeScope } from './theme-provider';
import type { ToneSubset } from './tone';

export interface ListGroupProps {
  /** The group's heading: a real heading, `<h2>` by default, that names the section. */
  title?: React.ReactNode;
  /**
   * The group's one-line takeaway beside the heading, such as "2 on" or "All up to date". It moves under the heading
   * when the two don't fit.
   */
  summary?: React.ReactNode;
  footer?: React.ReactNode;
  /** Heading level for `title`. Default 2. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** ListRow elements. */
  children?: React.ReactNode;
  className?: string;
}

/** A `<section>`, a heading and a `<ul>`. The heading names the section for assistive tech. */
export function ListGroup(props: ListGroupProps) {
  const id = React.useId();
  const H = `h${props.headingLevel ?? 2}` as 'h2';
  const title = props.title;
  return (
    <section className={cn('ld-list', props.className)} aria-labelledby={title ? id : undefined}>
      {title || props.summary ? (
        <header className="ld-list-header">
          {title ? <H id={id} className="ld-list-title">{title}</H> : <span />}
          {props.summary ? <p className="ld-list-summary">{props.summary}</p> : null}
        </header>
      ) : null}
      <ul className="ld-list-body">{props.children}</ul>
      {props.footer ? <p className="ld-list-footer">{props.footer}</p> : null}
    </section>
  );
}

const TABBABLE = ':is(a[href], button, input, select, textarea, [tabindex]):not(:disabled, [tabindex="-1"])';
/** Where focus goes in a row: its link or button, else its first control. The swipe actions sit outside `.ld-row`. */
const rowTarget = (row: Element) =>
  row.querySelector<HTMLElement>('.ld-row-target') ?? row.querySelector<HTMLElement>(`.ld-row ${TABBABLE}`);
const hasFocus = () => {
  const at = document.activeElement as HTMLElement | null;
  return !!at && at !== document.body && at.isConnected && at.checkVisibility();
};
const moveTo = (el: HTMLElement) => {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest' });
};

/**
 * Notes the reader's place before a row action runs, and returns what keeps it when the action takes the row away:
 * the next row, else the one before, else the group's heading, else the next visible control in reading order. A
 * parent that moved focus itself, as InboxFlow does, keeps its choice, and so does one that took the whole group away,
 * as a navigation does.
 */
function keepPlace(li: HTMLLIElement) {
  const rows = [...(li.parentElement?.children ?? [])];
  const at = rows.indexOf(li);
  const near = [...rows.slice(at + 1), ...rows.slice(0, at).reverse()];
  const group = li.closest('.ld-list') ?? li.parentElement!;
  const heading = group.querySelector<HTMLElement>('.ld-list-title');
  const following = [...document.querySelectorAll<HTMLElement>(TABBABLE)]
    .filter((el) => !group.contains(el) && !!(group.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
  return () => {
    if (li.isConnected || !group.isConnected || hasFocus()) return;
    const row = near.filter((r) => r.isConnected).map(rowTarget).find(Boolean);
    if (row) return moveTo(row);
    if (heading?.isConnected) {
      heading.tabIndex = -1;
      focusLanding(heading);
      heading.scrollIntoView({ block: 'nearest' });
    } else {
      const next = following.find((el) => el.isConnected && el.checkVisibility());
      if (next) moveTo(next);
    }
  };
}

/** The place the latest row action noted. An action on another row replaces it. */
let latestPlace: (() => void) | null = null;

export interface RowAction {
  label: string;
  /** Default `'primary'`. `'critical'` for destructive actions. */
  tone?: ToneSubset<'primary' | 'neutral' | 'critical'>;
  onSelect?: () => void;
  /** The action isn't available now. It stays visible, so people learn it exists. */
  disabled?: boolean;
  /** Why it is disabled, shown with the action, such as "Only the owner can archive". */
  disabledReason?: string;
}
export interface ListRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Trailing secondary value, such as "On". */
  value?: React.ReactNode;
  /** A 30px leading slot (`--size-leading`): an icon tile (`span.ld-tile`) or an Avatar. It is hidden from assistive tech. */
  leading?: React.ReactNode;
  /**
   * A leading control, such as a selection Checkbox. It is exposed and sits above the row's link target. Beside a
   * Checkbox, the line between rows starts where the title does; another control keeps the leading slot's inset.
   */
  control?: React.ReactNode;
  /** Trailing control, such as a Switch. Leave `href` and `onClick` unset with it, since interactive elements don't nest. */
  trailing?: React.ReactNode;
  /** Navigates: the row renders a real `<a>`. */
  href?: string;
  /** The row's `href` is the page being shown, such as the open message. Adds `aria-current="page"`. */
  current?: boolean;
  /** Acts in place: the row renders a real `<button>`. Use `href` for navigation. With `href`, it runs on the link's click too. */
  onClick?: (e: React.MouseEvent) => void;
  /** Disclosure chevron. Default `true` when `href` or `onClick` is set. */
  chevron?: boolean;
  /** Up to three actions: a ••• menu, revealed on hover and focus and always shown on a touch screen, and a touch swipe. Every action must also exist one level deeper. */
  actions?: RowAction[];
  /** The touch swipe shortcut for actions. Default `true`. The ••• menu is always there. */
  swipe?: boolean;
  /** Show the ••• button at rest. Default `false`, which reveals it on hover and focus, and always on a touch screen. */
  actionsVisible?: boolean;
  /** Names the row on its ••• button when `title` is not a plain string. */
  actionsLabel?: string;
  /** Written to `data-row-id`, so a parent can find the row again, such as to move focus to it. */
  rowKey?: string;
  /** Controlled swipe reveal. */
  actionsOpen?: boolean;
  onActionsOpenChange?: (open: boolean) => void;
  className?: string;
}

/** An action's narrowest width, as in the CSS; the swipe distance before the actions are measured. */
const ACTION_W = 76;
/** Base UI menu items for row actions; disabled ones stay listed, with their reason. */
export function RowActionItems({ actions, onAction }: { actions: RowAction[]; onAction?: (run: () => void) => void }) {
  return (
    <>
      {actions.map((a, i) => (
        <Menu.Item
          key={i}
          disabled={a.disabled}
          className={cn('ld-menu-item', a.tone === 'critical' && 'ld-menu-item-critical', a.disabledReason && 'ld-menu-item-reason')}
          onClick={() => (onAction ? onAction(() => a.onSelect?.()) : a.onSelect?.())}
        >
          <span>{a.label}</span>
          {a.disabled && a.disabledReason ? <span className="ld-menu-item-hint">{a.disabledReason}</span> : null}
        </Menu.Item>
      ))}
    </>
  );
}

const Chevron = () => (
  <svg className="ld-row-chevron" viewBox="0 0 8 14" fill="none" aria-hidden="true">
    <path d="M1.5 1.5 6.5 7l-5 5.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Dots = () => (
  <svg viewBox="0 0 20 20" width={20} height={20} fill="currentColor" aria-hidden="true">
    <circle cx={4} cy={10} r={1.6} /><circle cx={10} cy={10} r={1.6} /><circle cx={16} cy={10} r={1.6} />
  </svg>
);

/**
 * An `<li>` whose primary target is a real `<a>` (`href`) or `<button>` (`onClick`). The swipe is a touch and pen
 * shortcut, through React Aria's `useMove`. An action that removes its row moves focus to the next row, else the one
 * before, else the group's heading. A parent that moves focus itself after removing a row does it in a layout effect
 * or inside `flushSync`, so its move comes first and the row leaves it there.
 */
export function ListRow(props: ListRowProps) {
  const Link = useLinkComponent();
  const actions = props.actions ?? [];
  const swipeable = actions.length > 0 && props.swipe !== false;
  // The swipe distance is the actions' width, which grows with their labels' text size, so it's measured. It's 0 when
  // the actions don't fit the row, and then the row doesn't open.
  const [full, setFull] = React.useState(actions.length * ACTION_W);
  const labels = actions.map((a) => a.label).join('\n');
  const [innerOpen, setInnerOpen] = React.useState(false);
  const wantsOpen = props.actionsOpen ?? innerOpen;
  const open = wantsOpen && full > 0;
  const setOpen = (v: boolean) => { if (props.actionsOpen === undefined) setInnerOpen(v); props.onActionsOpenChange?.(v); };
  // A row whose actions stop fitting closes, as a tap away would, so it doesn't reopen when they fit again.
  React.useEffect(() => { if (full === 0 && wantsOpen) setOpen(false); }, [full, wantsOpen]);
  const [dx, setDx] = React.useState<number | null>(null);
  const g = React.useRef({ active: false, base: 0, acc: 0, moved: false });
  const actionsRef = React.useRef<HTMLDivElement>(null);
  // `inert` takes the hidden swipe buttons out of the tab order. It's set on the element, since React 18 and 19 treat
  // an `inert` prop differently.
  // A swipe action that leaves its row in place closes the actions, so focus moves from its button to the row first.
  React.useLayoutEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    if (!open && el.contains(document.activeElement)) {
      const to = el.parentElement && rowTarget(el.parentElement);
      if (to) to.focus({ preventScroll: true });
    }
    el.inert = !open;
  }, [open]);
  // An action that takes its row away keeps the reader's place, once the row has left and the parent has had its turn.
  const liRef = React.useRef<HTMLLIElement>(null);
  const place = React.useRef<(() => void) | null>(null);
  // The place holds until the row leaves, so a row a server removes later keeps it too. The next action on any row
  // replaces it.
  const act = (run: () => void) => {
    const keep = liRef.current && keepPlace(liRef.current);
    place.current = latestPlace = keep;
    run();
    keep?.();
  };
  React.useLayoutEffect(() => () => {
    const keep = place.current;
    if (keep && keep === latestPlace) { latestPlace = null; queueMicrotask(keep); }
  }, []);
  // Fit the actions to the row: labels grow with the text, then `tight` holds them at the default size, then `menu`
  // closes the row and leaves them to the ••• menu. Re-fit when a label, the text size or the row's width changes.
  React.useLayoutEffect(() => {
    const el = actionsRef.current;
    const row = el?.parentElement;
    if (!el || !row) return undefined;
    const fits = () => el.scrollWidth <= row.clientWidth && [...el.children].every((a) => a.scrollHeight <= a.clientHeight + 1);
    const measure = () => {
      delete el.dataset.fit;
      for (const fit of ['tight', 'menu']) { if (fits()) break; el.dataset.fit = fit; }
      setFull(el.dataset.fit === 'menu' ? 0 : el.offsetWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); });
    for (const n of [el, row, ...el.children]) ro.observe(n);
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, [swipeable, labels]);

  const { moveProps } = useMove({
    onMoveStart(e) {
      const s = g.current;
      s.active = swipeable && full > 0 && (e.pointerType === 'touch' || e.pointerType === 'pen');
      s.base = open ? -full : 0; s.acc = 0; s.moved = false;
    },
    onMove(e) {
      const s = g.current;
      if (!s.active) return;
      s.acc += e.deltaX;
      if (Math.abs(s.acc) > 6) s.moved = true;
      const overshoot = Math.min(full + 24, actionsRef.current?.parentElement?.clientWidth ?? full);
      setDx(Math.max(-overshoot, Math.min(0, s.base + s.acc)));
    },
    onMoveEnd() {
      const s = g.current;
      if (!s.active) return;
      s.active = false;
      setOpen(s.base + s.acc < -full / 2);
      setDx(null);
      if (s.moved) setTimeout(() => { s.moved = false; }, 0);
    },
  });
  // The swipe is touch and pen only: mouse and keyboard never reach `useMove` (arrow keys stay with the browser,
  // and mouse presses go straight to links, buttons and the ••• menu).
  const mp = moveProps as React.HTMLAttributes<HTMLElement>;
  // React events from the ••• menu bubble to the row through its portal: a press there isn't on the row. A press on
  // the row can start a swipe wherever it lands, so `useMove` gets an event it can't stop or cancel: canceled, the
  // press would never reach the ••• and the menu's outside press would never close it.
  const inRow = (e: React.SyntheticEvent) => e.target instanceof Element && e.currentTarget.contains(e.target);
  const press = <E extends React.SyntheticEvent>(e: E): E =>
    Object.create(e, { stopPropagation: { value() {} }, preventDefault: { value() {} } });
  const pointerMove = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => { if (e.pointerType !== 'mouse' && inRow(e)) mp.onPointerDown?.(press(e)); },
  };

  const x = dx ?? (open ? -full : 0);
  const rowName = props.actionsLabel ?? (typeof props.title === 'string' ? props.title : null);
  const showChevron = props.chevron ?? !!(props.href || props.onClick);
  const content = (
    <>
      {props.leading ? <span className="ld-row-leading" aria-hidden="true">{props.leading}</span> : null}
      <span className="ld-row-main">
        <span className="ld-row-title">{props.title}</span>
        {props.subtitle ? <span className="ld-row-subtitle">{props.subtitle}</span> : null}
      </span>
      {props.value != null ? <span className="ld-row-value">{props.value}</span> : null}
    </>
  );
  const primary = props.href ? (
    <Link className="ld-row-primary ld-row-target" href={props.href} aria-current={props.current ? 'page' : undefined} onClick={props.onClick}>{content}</Link>
  ) : props.onClick ? (
    <button type="button" className="ld-row-primary ld-row-target" onClick={props.onClick}>{content}</button>
  ) : (
    <span className="ld-row-primary">{content}</span>
  );

  return (
    <li
      className={cn(
        'ld-row-wrap', !!(props.leading || props.control) && 'ld-row-lead', open && 'ld-row-open',
        (open || dx != null) && 'ld-row-revealed', props.actionsVisible && 'ld-row-actions-visible', props.className,
      )}
      data-row-id={props.rowKey}
      ref={liRef}
    >
      {swipeable ? (
        <div ref={actionsRef} className="ld-row-actions" aria-hidden={!open}>
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              disabled={a.disabled}
              className={cn('ld-row-action', a.tone === 'critical' && 'ld-row-action-critical', a.tone === 'neutral' && 'ld-row-action-neutral')}
              onClick={() => { setOpen(false); act(() => a.onSelect?.()); }}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={cn('ld-row', dx != null && 'ld-row-dragging')}
        {...(swipeable ? pointerMove : {})}
        style={swipeable ? { transform: `translateX(${x}px)` } : undefined}
        onClickCapture={(e) => {
          if (g.current.moved) { e.preventDefault(); e.stopPropagation(); return; }
          if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        }}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) setOpen(false); }}
      >
        {props.control ? <span className="ld-row-control">{props.control}</span> : null}
        {primary}
        {props.trailing ? <span className="ld-row-trailing">{props.trailing}</span> : null}
        {actions.length ? (
          <Menu.Root>
            <Menu.Trigger className="ld-row-more" aria-label={rowName ? `More actions for ${rowName}` : 'More actions'}>
              <Dots />
            </Menu.Trigger>
            <Menu.Portal>
              <ThemeScope>
                <Menu.Positioner className="ld-menu-positioner" sideOffset={6} align="end">
                  <Menu.Popup className="ld-menu">
                    <RowActionItems actions={actions} onAction={act} />
                  </Menu.Popup>
                </Menu.Positioner>
              </ThemeScope>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
        {showChevron ? <Chevron /> : null}
      </div>
    </li>
  );
}
