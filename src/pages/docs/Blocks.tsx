import * as React from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { SummaryCard } from '@lede/blocks/summary-card';
import { StatusList } from '@lede/blocks/status-list';
import { Page, Stack } from '@lede/blocks/page';
import { ListGroup, ListRow } from '@lede/list';
import { FormSection } from '@lede/blocks/form-section';
import { StepIndicator } from '@lede/blocks/step-indicator';
import { EmptyState } from '@lede/blocks/empty-state';
import { AccentPicker } from '@lede/blocks/accent-picker';
import { TextField } from '@lede/text-field';
import { Avatar } from '@lede/avatar';
import { Button } from '@lede/button';
import type { Preset } from '@lede/theme-provider';
import { useAppearance } from '@/theme';
import { Usage } from './Usage';
import { Live } from './twin';

function Block({ id, item, title, summary, children }: { id: string; item: string | string[]; title: string; summary: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="docs-section">
      <h2 id={id} className="text-title-3">{title}</h2>
      <p className="docs-intro">{summary}</p>
      {children}
      <Usage title={title} items={typeof item === 'string' ? [item] : item} />
    </section>
  );
}

export function Blocks() {
  const [accent, setAccent] = React.useState<Preset | undefined>(useAppearance().prefs.accent);
  return (
    <div className="ld-flow">
      <PageHeader title="Blocks" summary="The larger parts of a screen, page layouts among them, each one a registry item. Daybook, the demo app, is built from them." />
      <p className="docs-intro">Blocks that say words of their own, such as a skip link or “Load more”, say them in English. Each takes a <code>labels</code> prop to replace any of them, and exports its defaults, such as <code>dataTableLabels</code>.</p>
      <Block id="b-shell" item="app-shell" title="AppShell" summary={<>A page layout: a skip link, one primary <code>{'<nav>'}</code> and a <code>{'<main>'}</code>, where the nav is a sidebar on wide screens and a floating GlassBar on narrow ones.<Live> This page is inside one.</Live></>}>
        <Button variant="tinted" href="/layouts#sidebar">See it in Layouts</Button>
      </Block>
      <Block id="b-workbench" item="workbench-shell" title="WorkbenchShell" summary="A top bar over three panels that fill the window, for tools where people keep several things in view. Side panels collapse and resize, and narrow screens show one panel at a time.">
        <Button variant="tinted" href="/layouts#workbench">See it in Layouts</Button>
      </Block>
      <Block id="b-header" item="page-header" title="PageHeader" summary={<>A screen’s <code>{'<h1>'}</code> and its one-line summary, with an optional back link, actions and a picture in <code>leading</code>, which <code>leadingLink</code> makes a link, such as an app’s mark that goes home. The heading takes focus on mount, unless <code>focusOnMount</code> is <code>false</code> or something else in the same commit, such as a restore on Back, moved focus inside its <code>{'<main>'}</code>.</>}>
        <Live><div className="docs-demo" style={{ display: 'block' }}>
          <PageHeader headingLevel={2} focusOnMount={false} title="Inbox" summary="3 unread of 4" back={{ href: '/app', label: 'Today' }} actions={<Button size="sm">Select</Button>} />
          <PageHeader headingLevel={2} focusOnMount={false} title="Hana Sato" summary="Product lead" leading={<Avatar name="Hana Sato" size="lg" />} />
        </div></Live>
      </Block>
      <Block id="b-summary" item="summary-card" title="SummaryCard" summary={<>An <code>{'<article>'}</code> whose heading is a link that covers the card, with a figure, a one-line takeaway and a status in words.</>}>
        <Live><ul className="ld-summary-grid">
          <li><SummaryCard title="Decisions" figure="2" summary="Both due by Thursday." status={{ tone: 'caution', label: 'Needs you' }} href="/app" /></li>
          <li><SummaryCard title="Spending" figure="$420" summary="Under budget this month." status={{ tone: 'positive', label: 'On track' }} /></li>
          <li><SummaryCard title="Uptime" figure="99.2%" summary="One incident on Tuesday." status={{ tone: 'critical', label: 'Below target' }} /></li>
        </ul></Live>
      </Block>
      <Block id="b-form" item="form-section" title="FormSection" summary={<>A native <code>{'<fieldset>'}</code> and <code>{'<legend>'}</code> on a card surface, grouping and naming related fields.</>}>
        <Live><FormSection legend="About you" description="We use this on your profile.">
          <TextField label="Name" autoComplete="name" />
        </FormSection></Live>
      </Block>
      <Block id="b-accent" item="accent-picker" title="AccentPicker" summary="Native radio inputs for ThemeProvider’s accent presets, each with a swatch and a visible name, so color never carries the choice alone.">
        <Live><FormSection legend="Accent" group={false}><AccentPicker label="Accent" value={accent} onValueChange={setAccent} /></FormSection></Live>
      </Block>
      <Block id="b-steps" item="step-indicator" title="StepIndicator" summary={<>An <code>{'<ol>'}</code> of steps that marks the current one with <code>aria-current="step"</code>. Narrow screens show only its summary, such as “Step 2 of 3 · Preferences”.</>}>
        <Live><div className="docs-demo"><StepIndicator steps={['Account', 'Preferences', 'Review']} current={1} /></div></Live>
      </Block>
      <Block id="b-page" item="page" title="Page & Stack" summary="Page is a page’s box for an app without AppShell: a gutter, a widest width and the space between its sections. Stack puts its children one under another, with one gap between each.">
        <Live><div className="docs-page-demo">
          <Page width="narrow" render={<section aria-label="A narrow page" />}>
            <PageHeader headingLevel={3} focusOnMount={false} title="Hosts" summary="1 needs a look" />
            <Stack gap="sm">
              <p className="text-subheadline text-muted-foreground">Checked 2 minutes ago.</p>
              <ListGroup title="Sorted by name" headingLevel={4}>
                <ListRow title="api-iad-1" value="Up to date" />
                <ListRow title="edge-sfo-2" value="Failed" />
              </ListGroup>
            </Stack>
          </Page>
        </div></Live>
        <p className="docs-intro docs-note">
          The gap is <code>"lg"</code> between a page’s sections, <code>"md"</code> between related things and{' '}
          <code>"sm"</code> between parts of one thing. Each child’s own top and bottom margins give way to it, so a
          PageHeader, a paragraph and a list space alike. Inside AppShell, which has its own gutter, pass{' '}
          <code>inset={'{false}'}</code>.
        </p>
      </Block>
      <Block id="b-status" item="status-list" title="StatusList" summary="A list of items that may need a look, worst first, each ending in its status in words. When nothing is listed it says so, in place of an empty list.">
        <Live><div className="docs-demo-col">
          <StatusList
            headingLevel={3}
            title="Needs attention"
            summary="1 failed of 3"
            items={[
              { id: 'cache-lhr-1', title: 'cache-lhr-1', subtitle: 'Last checked Nov 2, so its state may have drifted', tone: 'neutral', status: 'Not checked lately' },
              { id: 'edge-sfo-2', title: 'edge-sfo-2', subtitle: 'The deploy failed on the health check, so traffic stays on the previous version', tone: 'critical', status: 'Failed' },
              { id: 'api-iad-1', title: 'api-iad-1', subtitle: 'The plan has 3 changes to apply', tone: 'caution', status: 'Would change' },
            ]}
          />
          <StatusList headingLevel={3} title="Needs attention later" items={[]} />
        </div></Live>
      </Block>
      <Block id="b-empty" item="empty-state" title="EmptyState" summary={<>A quiet <code>{'<section>'}</code> for a place with nothing in it: a heading, one sentence and at most one action.</>}>
        <Live><div className="docs-demo" style={{ display: 'block' }}>
          <EmptyState headingLevel={3} title="No messages" description="New messages land here." action={<Button variant="tinted" href="/app/inbox">Open demo inbox</Button>} />
        </div></Live>
      </Block>
      <Block id="b-table" item="data-table" title="DataTable" summary={<>A <code>{'<table>'}</code> with sorting, selection up to every matching row, row links, row actions and paging, plus loading, empty, error and stale states and optional cards for narrow containers. In server mode it shows the rows you fetch, and <code>useServerRows</code> can fetch and cache them for you.</>}>
        <Button variant="tinted" href="/blocks/data-table">Data table guide and examples</Button>
      </Block>
      <Block id="b-server-rows" item="use-server-rows" title="useServerRows" summary={<>A hook that fetches a server-mode DataTable’s rows page by page for its <code>view</code>, caches them and counts the total. Spread what it returns onto the DataTable.</>}>
        <Button variant="tinted" href="/blocks/data-table#dt-server">Server-mode guide and code</Button>
      </Block>
      <Block id="b-md" item={['master-detail', 'selection-bar']} title="MasterDetail & SelectionBar" summary="MasterDetail shows a list and its detail as two named regions, side by side on wide screens and one at a time on narrow ones. SelectionBar’s bulk actions appear on glass once something is selected.">
        <Button variant="tinted" href="/app/inbox/m1">See them in the demo inbox</Button>
      </Block>
    </div>
  );
}
