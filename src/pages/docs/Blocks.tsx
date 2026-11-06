import * as React from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { SummaryCard } from '@lede/blocks/summary-card';
import { FormSection } from '@lede/blocks/form-section';
import { StepIndicator } from '@lede/blocks/step-indicator';
import { EmptyState } from '@lede/blocks/empty-state';
import { AccentPicker } from '@lede/blocks/accent-picker';
import { TextField } from '@lede/text-field';
import { Avatar } from '@lede/avatar';
import { Button } from '@lede/button';
import type { Preset } from '@lede/theme-provider';

function Block({ id, title, summary, children }: { id: string; title: string; summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="docs-section">
      <h2 id={id} className="text-title-3">{title}</h2>
      <p className="docs-intro">{summary}</p>
      {children}
    </section>
  );
}

export function Blocks() {
  const [accent, setAccent] = React.useState<Preset>('teal');
  return (
    <div className="ld-flow">
      <PageHeader title="Blocks" summary="Layouts and the larger parts of a screen, each one a registry item. Daybook, the demo app, is built from them." />
      <Block id="b-shell" title="AppShell" summary={<>A page layout: a skip link, one primary <code>{'<nav>'}</code> and a <code>{'<main>'}</code>, where the nav is a sidebar on wide screens and a floating GlassBar on narrow ones. This page is inside one.</>}>
        <Button variant="tinted" href="/layouts#sidebar">See it in Layouts</Button>
      </Block>
      <Block id="b-workbench" title="WorkbenchShell" summary="A top bar over three panels that fill the window, for tools where people keep several things in view. Side panels collapse and resize, and narrow screens show one panel at a time.">
        <Button variant="tinted" href="/layouts#workbench">See it in Layouts</Button>
      </Block>
      <Block id="b-header" title="PageHeader" summary={<>A screen’s <code>{'<h1>'}</code> and its one-line summary, with an optional back link, actions and a picture in <code>leading</code>. The heading takes focus on mount, unless <code>focusOnMount</code> is <code>false</code> or something else in the same commit, such as a restore on Back, moved focus inside its <code>{'<main>'}</code>.</>}>
        <div className="docs-demo" style={{ display: 'block' }}>
          <PageHeader headingLevel={2} focusOnMount={false} title="Inbox" summary="3 unread of 4" back={{ href: '/app', label: 'Today' }} actions={<Button size="sm">Select</Button>} />
          <PageHeader headingLevel={2} focusOnMount={false} title="Hana Sato" summary="Product lead" leading={<Avatar name="Hana Sato" size="lg" />} />
        </div>
      </Block>
      <Block id="b-summary" title="SummaryCard" summary={<>An <code>{'<article>'}</code> whose heading is a link that covers the card, with a figure, a one-line takeaway and a status in words.</>}>
        <ul className="ld-summary-grid">
          <li><SummaryCard title="Decisions" figure="2" summary="Both due by Thursday." status={{ tone: 'caution', label: 'Needs you' }} href="/app" /></li>
          <li><SummaryCard title="Spending" figure="$420" summary="Under budget this month." status={{ tone: 'positive', label: 'On track' }} /></li>
          <li><SummaryCard title="Uptime" figure="99.2%" summary="One incident on Tuesday." status={{ tone: 'critical', label: 'Below target' }} /></li>
        </ul>
      </Block>
      <Block id="b-form" title="FormSection" summary={<>A native <code>{'<fieldset>'}</code> and <code>{'<legend>'}</code> on a card surface, grouping and naming related fields.</>}>
        <FormSection legend="About you" description="We use this on your profile.">
          <TextField label="Name" autoComplete="name" />
        </FormSection>
      </Block>
      <Block id="b-accent" title="AccentPicker" summary="Native radio inputs for ThemeProvider’s accent presets, each with a swatch and a visible name, so color never carries the choice alone.">
        <FormSection legend="Accent"><AccentPicker value={accent} onValueChange={setAccent} /></FormSection>
      </Block>
      <Block id="b-steps" title="StepIndicator" summary={<>An <code>{'<ol>'}</code> of steps that marks the current one with <code>aria-current="step"</code>. Narrow screens show only its summary, such as “Step 2 of 3 · Preferences”.</>}>
        <div className="docs-demo"><StepIndicator steps={['Account', 'Preferences', 'Review']} current={1} /></div>
      </Block>
      <Block id="b-empty" title="EmptyState" summary={<>A quiet <code>{'<section>'}</code> for a place with nothing in it: a heading, one sentence and at most one action.</>}>
        <div className="docs-demo" style={{ display: 'block' }}>
          <EmptyState headingLevel={3} title="No messages" description="New messages land here." action={<Button variant="tinted" href="/app/inbox">Open demo inbox</Button>} />
        </div>
      </Block>
      <Block id="b-table" title="DataTable" summary={<>A <code>{'<table>'}</code> with sorting, selection up to every matching row, row links, row actions and paging, plus loading, empty, error and stale states and optional cards for narrow containers. In server mode it shows the rows you fetch, and <code>useServerRows</code> can fetch and cache them for you.</>}>
        <Button variant="tinted" href="/blocks/data-table">Data table guide and examples</Button>
      </Block>
      <Block id="b-md" title="MasterDetail & SelectionBar" summary="MasterDetail shows a list and its detail as two named regions, side by side on wide screens and one at a time on narrow ones. SelectionBar’s bulk actions appear on glass once something is selected.">
        <Button variant="tinted" href="/app/inbox/m1">See them in the demo inbox</Button>
      </Block>
    </div>
  );
}
