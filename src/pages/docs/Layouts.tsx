import * as React from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { SegmentedControl } from '@lede/segmented-control';
import { Button } from '@lede/button';
import { CodeExample } from './CodeExample';

interface Layout {
  id: string;
  title: string;
  block: string;
  /** The registry item. */
  item: string;
  purpose: React.ReactNode;
  /** What each region is, as [element, what it does]. */
  regions: Array<[string, React.ReactNode]>;
  /** A full page of its own, shown in a preview frame. */
  route?: string;
  /** Where to see a layout that has no page of its own. */
  example?: { href: string; label: string };
}

export const LAYOUTS: Layout[] = [
  {
    id: 'sidebar', title: 'Full page with left bar', block: 'AppShell', item: 'app-shell', route: '/layouts/sidebar',
    purpose: 'One left bar and one page that scrolls beside it. Pick it for an app with three to five places, where each place is a whole screen.',
    regions: [
      ['<nav>', 'The left bar holds the app’s places. It stays full height and in place while the page scrolls, and its footer sits at the bottom.'],
      ['<main>', 'The page, which takes all the width the bar leaves. The document scrolls, so the browser’s own scrolling, find and restore all work.'],
      ['<nav> below 900px at the default text size', 'The same places move to a floating bar. Only one of the two is exposed at a time.'],
    ],
  },
  {
    id: 'workbench', title: 'Three panels with top bar', block: 'WorkbenchShell', item: 'workbench-shell', route: '/layouts/workbench',
    purpose: 'A top bar over three panels that fill the window, as in a code editor. Pick it when people keep several things in view while they work: what they can open, what they have open and what helps them with it.',
    regions: [
      ['<header>', <>The top bar holds the screen’s <code>{'<h1>'}</code>, its actions and a toggle for each side panel.</>],
      ['<nav>', 'The start panel, on the left, for what can be opened. It resizes and collapses, and scrolls on its own. The layout is left-to-right only.'],
      ['<main>', 'The center panel keeps a usable width whatever the side panels do, and scrolls on its own. The page itself never scrolls.'],
      ['<aside>', 'The end panel, on the right, for what supports the work. It resizes and collapses, and scrolls on its own.'],
      ['role="separator"', 'Each divider is a window splitter: drag it, or focus it and use the arrow keys, Home and End. Enter collapses and restores its panel.'],
      ['<fieldset> below 1100px at the default text size', <>One panel shows at a time, chosen with a segmented control, and following a link in the start panel shows the center panel. The toggles and dividers leave, and the hidden panels are <code>display: none</code>.</>],
    ],
  },
  {
    id: 'list-detail', title: 'List and detail', block: 'MasterDetail', item: 'master-detail',
    example: { href: '/app/inbox/m1', label: 'See it in the demo inbox' },
    purpose: 'A list beside the item it opens, set inside a page, usually AppShell’s. Pick it when people work through a set of items one at a time, such as messages or tasks.',
    regions: [
      ['<section> list', 'A named region. On narrow screens it shows until an item is opened.'],
      ['<section> detail', 'A named region. On narrow screens it replaces the list, and Back returns to the list because the selection is in the route.'],
    ],
  },
];

const VIEWS = { wide: { width: 1280, height: 800 }, narrow: { width: 390, height: 720 } };
type View = keyof typeof VIEWS;
const SITE_IS_NARROW = '(width < 56.25em)';

/**
 * A real full-page route in a frame, because a full page can't nest in this page's landmarks. A frame also has its
 * own viewport, so the layout's media queries fire at the chosen width. A wide frame scales down to fit the column.
 */
function LayoutPreview({ title, route }: { title: string; route: string }) {
  const [view, setView] = React.useState<View>(() => (window.matchMedia(SITE_IS_NARROW).matches ? 'narrow' : 'wide'));
  const [room, setRoom] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const stage = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = stage.current!;
    const measure = () => setRoom(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { width, height } = VIEWS[view];
  const scale = Math.min(1, room / width);
  return (
    <div className="docs-preview">
      <SegmentedControl label={`${title}: preview width`} options={[{ value: 'wide', label: 'Wide' }, { value: 'narrow', label: 'Narrow' }]} value={view} onValueChange={(v) => setView(v as View)} />
      <div ref={stage} className="docs-preview-stage" style={{ height: height * scale }}>
        <iframe
          className="docs-preview-frame"
          src={`${import.meta.env.BASE_URL}${route.slice(1)}`}
          title={`${title}: live preview`}
          width={width}
          height={height}
          loading="lazy"
          data-loaded={loaded || undefined}
          onLoad={() => setLoaded(true)}
          style={{ left: (room - width * scale) / 2, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}

export function Layouts() {
  return (
    <div className="ld-flow">
      <PageHeader title="Layouts" summary={`${LAYOUTS.length} page structures, each one a block you can install.`} />
      {LAYOUTS.map((layout) => (
        <section key={layout.id} id={layout.id} aria-labelledby={`${layout.id}-title`} className="docs-section">
          <h2 id={`${layout.id}-title`} className="text-title-3">{layout.title}</h2>
          <p className="docs-intro">{layout.purpose}</p>
          {layout.route ? <LayoutPreview title={layout.title} route={layout.route} /> : null}
          <h3 className="docs-subhead">Regions</h3>
          <dl className="docs-regions">
            {layout.regions.map(([element, role]) => <div key={element}><dt><code>{element}</code></dt><dd>{role}</dd></div>)}
          </dl>
          <CodeExample label={`Install ${layout.block}`} language="shell" code={`npx shadcn@latest add @lede/${layout.item}`} defaultOpen />
          <p className="docs-actions">
            {layout.route
              ? <Button variant="tinted" href={layout.route} aria-label={`Open full page: ${layout.title}`}>Open full page</Button>
              : <Button variant="tinted" href={layout.example!.href}>{layout.example!.label}</Button>}
          </p>
        </section>
      ))}
    </div>
  );
}
