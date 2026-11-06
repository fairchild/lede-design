import * as React from 'react';
import { useLocation } from 'react-router';
import { AppShell } from '@lede/blocks/app-shell';
import { DataTable } from '@lede/blocks/data-table';
import { defineColumns } from '@lede/blocks/use-data-table';
import { PageHeader } from '@lede/blocks/page-header';
import { SummaryCard } from '@lede/blocks/summary-card';
import { ListGroup, ListRow } from '@lede/list';
import { PROJECT_TONE, WORKSPACE_ACTIVITY, WORKSPACE_PEOPLE, WORKSPACE_PROJECTS, WORKSPACE_STATS, WORKSPACE_SUMMARY, type Project } from '@/data/workspace';
import { IconBook, IconClock, IconPeople, IconTable } from '@/icons';
import { RouterLink } from '@/router-link';
import { Status } from '@/work-columns';
import { EMBEDDED } from './embedded';

// Each href names a focusable target below, so following it moves focus there along with the view.
const NAV = [
  { value: 'overview', label: 'Overview', href: '#overview', icon: <IconBook /> },
  { value: 'projects', label: 'Projects', href: '#projects', icon: <IconTable /> },
  { value: 'people', label: 'People', href: '#people', icon: <IconPeople /> },
  { value: 'activity', label: 'Activity', href: '#activity', icon: <IconClock /> },
];
const NOUN = { one: 'project', other: 'projects' };
const projectColumns = defineColumns<Project>([
  { id: 'name', label: 'Project', value: (p) => p.name, card: 'title' },
  {
    id: 'status', label: 'Status', value: (p) => p.status, card: 'status',
    cell: (p) => <Status tone={PROJECT_TONE[p.status]}>{p.status}</Status>,
  },
  { id: 'lead', label: 'Lead', value: (p) => p.lead, card: 1 },
  { id: 'due', label: 'Due', value: (p) => new Date(`${p.due}T00:00:00`), card: 2 },
]);

/** AppShell at full size: a left bar and a page long enough to scroll beside it. */
export function SidebarExample() {
  const { hash } = useLocation();
  // A cold load with a hash lands on its section: the browser's own fragment focus runs before the section exists.
  const [target] = React.useState(() => (NAV.some((item) => item.href === hash) && hash !== '#overview' ? hash.slice(1) : undefined));
  React.useLayoutEffect(() => {
    if (target && document.hasFocus()) document.getElementById(target)?.focus({ preventScroll: true });
  }, [target]);
  return (
    <AppShell
      brand="Workspace"
      nav={NAV}
      current={NAV.find((item) => item.href === hash)?.value ?? 'overview'}
      navLabel="Workspace"
      sidebarFooter={EMBEDDED ? undefined : <RouterLink href="/layouts">Back to Layouts</RouterLink>}
    >
      <section id="overview" tabIndex={-1} aria-label="Overview" className="docs-anchor">
        <PageHeader focusOnMount={!target} title="Overview" summary={WORKSPACE_SUMMARY} back={EMBEDDED ? undefined : { href: '/layouts', label: 'Layouts' }} />
      </section>
      <ul className="ld-summary-grid">
        {WORKSPACE_STATS.map((stat) => <li key={stat.title}><SummaryCard headingLevel={2} {...stat} /></li>)}
      </ul>
      <section id="projects" tabIndex={-1} aria-labelledby="projects-title" className="docs-section docs-anchor">
        <h2 id="projects-title" className="text-title-3">Projects</h2>
        <DataTable aria-labelledby="projects-title" noun={NOUN} locale="en-US" columns={projectColumns} rows={WORKSPACE_PROJECTS} getRowId={(p) => p.name} rowHeader="name" narrow="cards" />
      </section>
      <section id="people" tabIndex={-1} aria-labelledby="people-title" className="docs-section docs-anchor">
        <h2 id="people-title" className="text-title-3">People</h2>
        <ul className="ld-summary-grid">
          {WORKSPACE_PEOPLE.map((person) => <li key={person.name}><SummaryCard title={person.name} summary={`${person.role}, ${person.projects} ${person.projects === 1 ? 'project' : 'projects'}`} /></li>)}
        </ul>
      </section>
      <section id="activity" tabIndex={-1} aria-labelledby="activity-title" className="docs-section docs-anchor">
        <h2 id="activity-title" className="text-title-3">Activity</h2>
        <p className="docs-intro">Last 7 days</p>
        <ListGroup>
          {WORKSPACE_ACTIVITY.map((event) => <ListRow key={event.title} title={event.title} subtitle={event.when} />)}
        </ListGroup>
      </section>
    </AppShell>
  );
}
