import * as React from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { Button } from '@lede/button';
import { SegmentedControl } from '@lede/segmented-control';
import { Switch } from '@lede/switch';
import { TextField } from '@lede/text-field';
import { Avatar } from '@lede/avatar';
import { Card } from '@lede/card';
import { ListGroup, ListRow } from '@lede/list';
import { Disclosure } from '@lede/disclosure';
import { GlassBar, GlassToolbar, GlassToolbarButton, GlassToolbarSeparator } from '@lede/glass-bar';
import { ThemeProvider } from '@lede/theme-provider';
import { CodeExample } from './CodeExample';

const PICTURE = `${import.meta.env.BASE_URL}avatar-sample.svg`;
const ACTIONS = [{ label: 'Archive', tone: 'neutral' as const }, { label: 'Delete', tone: 'critical' as const }];
const THEME_SCOPE_CODE = `<Dialog.Portal>
  <ThemeScope>
    <Dialog.Popup />
  </ThemeScope>
</Dialog.Portal>`;

function Demo({ id, title, summary, children }: { id: string; title: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="docs-section">
      <h2 id={id} className="text-title-3">{title}</h2>
      <p className="docs-intro">{summary}</p>
      {children}
    </section>
  );
}

export function Components() {
  return (
    <div className="ld-flow">
      <PageHeader title="Components" summary="The primitives, each a native element where HTML has one. Base UI handles the interactions HTML can’t." />
      <Demo id="c-button" title="Button" summary={<>A native <code>{'<button>'}</code>, or an <code>{'<a>'}</code> when given <code>href</code>. Of its five variants, <code>"filled"</code> is for the one prominent action in a view.</>}>
        <div className="docs-demo">
          <Button variant="filled">Continue</Button>
          <Button variant="tinted">Add to list</Button>
          <Button>Cancel</Button>
          <Button variant="plain" href="/foundations">Learn more</Button>
          <Button variant="filled" tone="critical">Delete</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Demo>
      <Demo id="c-seg" title="SegmentedControl" summary={<>A native <code>{'<fieldset>'}</code> of radio inputs, with a thumb that slides to the checked option. Arrow keys and form submission come from the browser.</>}>
        <div className="docs-demo"><SegmentedControl label="Range" options={['Day', 'Week', 'Month', 'Year']} defaultValue="Week" /></div>
        <p className="docs-intro docs-note">
          It fits the width its container gives it. When the labels don’t fit side by side, their insets narrow, and then
          each takes a row of its own. An <code>auto</code> grid track that holds it, or a flex item holding it without{' '}
          <code>min-width: 0</code>, gives it its labels’ full width, so it can’t fit: give that track{' '}
          <code>minmax(0, 1fr)</code>, or that item <code>min-width: 0</code>.
        </p>
      </Demo>
      <Demo id="c-switch" title="Switch" summary={<>A Base UI Switch in an enclosing <code>{'<label>'}</code>. Given a <code>name</code>, it submits with a form through a hidden native input.</>}>
        <div className="docs-demo"><Switch label="Wi-Fi" defaultChecked /><Switch label="Bluetooth" /><Switch label="Disabled" disabled defaultChecked /></div>
      </Demo>
      <Demo id="c-field" title="TextField" summary={<>A labeled <code>{'<input>'}</code>, or a <code>{'<textarea>'}</code> when given <code>rows</code>, on Base UI Field. The hint and the error are linked to the input with <code>aria-describedby</code>.</>}>
        <div className="docs-demo docs-demo-col">
          <TextField label="Display name" placeholder="Your name" hint="Shown to people you share with." />
          <TextField label="Email" type="email" defaultValue="name@" error="Enter a complete email address." />
          <TextField label="Short bio" rows={3} hint="Up to 160 characters." />
        </div>
      </Demo>
      <Demo id="c-avatar" title="Avatar" summary={<>An <code>{'<img>'}</code> with alt text, or initials on a tint when there’s no picture or it fails to load. Pass <code>alt=""</code> when the name is already beside it, so it isn’t read twice.</>}>
        <div className="docs-demo">
          <Avatar name="Hana Sato" src={PICTURE} size="lg" />
          <Avatar name="Hana Sato" size="lg" />
          <Avatar name="Ben Lindqvist" src={PICTURE} />
          <Avatar name="Ben Lindqvist" />
        </div>
      </Demo>
      <Demo id="c-card" title="Card" summary={<>A surface for grouped content, rendered as a <code>{'<div>'}</code> or the element you pass to <code>render</code>. A child with the <code>ld-concentric</code> class keeps its corners concentric with the card’s.</>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card render={<article />} padding="sm">
            <div className="ld-concentric bg-primary h-24" />
            <h3 className="text-headline px-2 pt-3 m-0">Concentric by default</h3>
            <p className="text-subheadline text-muted-foreground px-2 pb-1 m-0">Inner radius = <code>--radius-lg</code> − <code>--space-2</code></p>
          </Card>
          <Card padding="md" size="xl">
            <p className="text-title-3 m-0">Storage</p>
            <p className="text-numeral m-0">128</p>
            <p className="text-subheadline text-muted-foreground m-0">GB available</p>
          </Card>
        </div>
      </Demo>
      <Demo id="c-list" title="ListGroup & ListRow" summary={<>ListGroup is a <code>{'<section>'}</code> with a heading and a <code>{'<ul>'}</code> of ListRows, each a link, a button or a static row. A row’s actions sit in a ••• menu, shown on hover or focus and always on a touch screen, and a touch swipe reveals them too.</>}>
        <ListGroup title="Daybook" summary="Sync on" footer="Each link opens its page in the demo app." headingLevel={3}>
          <ListRow title="Appearance" value="Automatic" href="/app/settings/appearance" />
          <ListRow title="Sync across devices" subtitle="Changes reach all your devices" trailing={<Switch aria-label="Sync across devices" defaultChecked />} />
          <ListRow title="Q4 budget needs your approval" subtitle="From Dana Okafor · 9:41 AM" href="/app/inbox/m1" actions={[{ label: 'Archive', tone: 'neutral' }, { label: 'Delete', tone: 'critical' }]} />
        </ListGroup>
      </Demo>
      <Demo id="c-disc" title="Disclosure" summary={<>A <code>{'<section>'}</code> on Base UI Collapsible, whose heading opens and closes its body and whose summary reads while it’s closed. A closed body stays in the page as <code>hidden="until-found"</code>, so find-in-page can open it.</>}>
        <Disclosure title="This week" summary="2 decisions need you by Thursday" meta="2" headingLevel={3}>
          <p className="m-0">Find-in-page can open this panel.</p>
        </Disclosure>
        <Disclosure title="Spending" summary="On track, $420 under budget" headingLevel={3}>
          <p className="m-0">Detail lives here.</p>
        </Disclosure>
      </Demo>
      <Demo id="c-theme" title="ThemeProvider" summary="ThemeProvider sets the scheme, contrast, accent, shape, density and glass (the translucent, blurred material of bars and toolbars) for a subtree. A nested provider inherits each of those it leaves unset except glass, and ThemeScope carries the theme into an overlay’s portal: open a row’s ••• menu in each panel to compare.">
        <div className="docs-demo-col">
          <ListGroup title="Page theme" summary="Set by the site" headingLevel={3}>
            <ListRow title="Weekly summary" subtitle="Follows your appearance settings" actions={ACTIONS} />
          </ListGroup>
          <ThemeProvider className="docs-theme-panel" scheme="dark" accent="orange" accentForeground="var(--background)" shape="square" surface="grouped" tokens={{ popover: 'var(--background)' }}>
            <ListGroup title="Its own theme" summary="Dark, orange, square" headingLevel={3}>
              <ListRow title="Draft proposal" subtitle="Overrides the popover token" actions={ACTIONS} />
            </ListGroup>
            <ThemeProvider className="docs-theme-panel">
              <ListGroup title="Inherited theme" summary="Follows the panel" headingLevel={3}>
                <ListRow title="Shared notes" subtitle="Sets no theme props of its own" actions={ACTIONS} />
              </ListGroup>
              <div><Button variant="filled">Approve</Button></div>
            </ThemeProvider>
          </ThemeProvider>
          <CodeExample label="Theming a local overlay" language="tsx" code={THEME_SCOPE_CODE} defaultOpen />
        </div>
      </Demo>
      <Demo id="c-glass" title="GlassBar & GlassToolbar" summary={<>GlassBar is a <code>{'<nav>'}</code> of links between places that marks the current one with <code>aria-current</code>, and GlassToolbar is a Base UI Toolbar of actions. Both float on glass.</>}>
        <div className="docs-demo" style={{ background: 'linear-gradient(90deg, var(--preset-teal), var(--preset-orange))', justifyContent: 'center' }}>
          <GlassToolbar aria-label="Photo tools">
            <GlassToolbarButton>Select</GlassToolbarButton>
            <GlassToolbarSeparator />
            <GlassToolbarButton>Share</GlassToolbarButton>
          </GlassToolbar>
          <GlassBar aria-label="Example sections" items={[{ value: 'a', label: 'Home' }, { value: 'b', label: 'Library' }, { value: 'c', label: 'Search' }]} defaultValue="b" />
        </div>
      </Demo>
    </div>
  );
}
