import { useEffect, type ComponentType } from 'react';
import { createBrowserRouter, Outlet, ScrollRestoration, useLocation, useMatches, type Params } from 'react-router';
// From `react-router/dom`, so a navigation can ask for `flushSync`.
import { RouterProvider } from 'react-router/dom';
import { LinkProvider } from '@lede/link';
import { RouterLink } from '@/router-link';
import { AppearanceRoot } from '@/theme';
import { ProfileRoot } from '@/profile';
import { DocsLayout } from '@/pages/docs/DocsLayout';
import { Overview } from '@/pages/docs/Overview';
import { Foundations } from '@/pages/docs/Foundations';
import { Components } from '@/pages/docs/Components';
import { Blocks } from '@/pages/docs/Blocks';
import { Layouts } from '@/pages/docs/Layouts';
import { Decisions } from '@/pages/docs/Decisions';
import { DataTablePage } from '@/pages/docs/DataTablePage';
import { DataTableItemPage } from '@/pages/docs/DataTableItemPage';
import { SidebarExample } from '@/pages/layouts/SidebarExample';
import { WorkbenchExample } from '@/pages/layouts/WorkbenchExample';
import { AppLayout } from '@/pages/app/AppLayout';
import { TodayPage } from '@/pages/app/TodayPage';
import { InboxPage } from '@/pages/app/InboxPage';
import { SettingsPage } from '@/pages/app/SettingsPage';
import { AppearancePage } from '@/pages/app/AppearancePage';
import { ProfilePage } from '@/pages/app/ProfilePage';
import { WelcomePage } from '@/pages/app/WelcomePage';
import { WorkPage, WorkItemPage, server } from '@/pages/app/WorkPage';
import { AppNotFound, NotFound } from '@/pages/NotFound';
import { useFocusRestoration } from '@/focus-restoration';

const WELCOME_TITLES: Record<string, string> = { '': 'Create your account', preferences: 'Make it yours', review: 'Review', done: 'You’re all set' };

/** A route's tab title: fixed, or read from its URL's params. */
type Title = string | ((params: Params) => string);

function useDocumentTitle() {
  const match = useMatches().at(-1);
  const title = (match?.handle as { title?: Title } | undefined)?.title;
  const text = typeof title === 'function' ? title(match!.params) : title;
  useEffect(() => { document.title = text ? `${text} · Lede` : 'Lede'; }, [text]);
}

/** The site's address. Every copy of the site, a preview's included, names the page there. */
const SITE = 'https://lede.cloudcompute.com';

/** Head elements the app adds and keeps up to date, found again by their selector. */
function headElement(selector: string, tag: 'link' | 'meta', attributes: Record<string, string>) {
  const found = document.head.querySelector(selector);
  if (found) return found;
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  return document.head.appendChild(el);
}

/**
 * Names the route as canonical, with `og:url`, as the title follows it. `index.html` has neither: a crawler that runs no
 * script would read a static one as the home page's address on every deep link. A not-found route names no address and
 * asks to stay out of search results, since the server answers every path with the same 200.
 */
function useCanonical() {
  const { pathname } = useLocation();
  const notFound = (useMatches().at(-1)?.handle as { notFound?: boolean } | undefined)?.notFound ?? false;
  useEffect(() => {
    const drop = (selector: string) => document.head.querySelector(selector)?.remove();
    if (notFound) {
      drop('link[rel="canonical"]');
      drop('meta[property="og:url"]');
      headElement('meta[name="robots"]', 'meta', { name: 'robots', content: 'noindex' });
      return;
    }
    drop('meta[name="robots"]');
    const url = `${SITE}${pathname}`;
    headElement('link[rel="canonical"]', 'link', { rel: 'canonical' }).setAttribute('href', url);
    headElement('meta[property="og:url"]', 'meta', { property: 'og:url' }).setAttribute('content', url);
  }, [pathname, notFound]);
}

function Root() {
  useDocumentTitle();
  useCanonical();
  useFocusRestoration();
  return (
    <AppearanceRoot>
      {/* Above the routes, so onboarding, which sits outside the app shell, edits the same person. */}
      <ProfileRoot>
        <LinkProvider component={RouterLink}>
          <Outlet />
          {/* Every full page load has the key "default"; without the pathname, one page's scroll restores on another. */}
          <ScrollRestoration getKey={(l) => (l.key === 'default' ? l.pathname : l.key)} />
        </LinkProvider>
      </ProfileRoot>
    </AppearanceRoot>
  );
}

/**
 * Pages the tests drive. Only the dev server and the build Playwright serves (`--mode fixtures`) have them; every other
 * build leaves them out, chunks included, since they load on demand. The check is on the mode, which `NODE_ENV` doesn't
 * change: `vite build` in a shell with `NODE_ENV=development` still builds in production mode.
 */
const FIXTURES = import.meta.env.MODE === 'development' || import.meta.env.MODE === 'fixtures';
const load = <M,>(module: () => Promise<M>, name: keyof M) => () => module().then((m) => ({ Component: m[name] as ComponentType }));

const routes = () => createBrowserRouter(
  [
    {
      element: <Root />,
      children: [
        {
          element: <DocsLayout />,
          children: [
            { index: true, element: <Overview /> },
            { path: 'foundations', element: <Foundations />, handle: { title: 'Foundations' } },
            { path: 'components', element: <Components />, handle: { title: 'Components' } },
            { path: 'blocks', element: <Blocks />, handle: { title: 'Blocks' } },
            { path: 'blocks/data-table', element: <DataTablePage />, handle: { title: 'Data table' } },
            { path: 'blocks/data-table/items/:id', element: <DataTableItemPage />, handle: { title: 'Work item' } },
            { path: 'layouts', element: <Layouts />, handle: { title: 'Layouts' } },
            { path: 'decisions', element: <Decisions />, handle: { title: 'Decisions' } },
            ...(FIXTURES ? [
              { path: 'fixtures/data-table', lazy: load(() => import('@/pages/fixtures/DataTableFixtures'), 'DataTableFixtures'), handle: { title: 'Data table fixtures' } },
              { path: 'fixtures/data-table-perf', lazy: load(() => import('@/pages/fixtures/DataTablePerf'), 'DataTablePerf'), handle: { title: 'Data table performance' } },
              { path: 'fixtures/work-archive', lazy: load(() => import('@/pages/fixtures/WorkArchiveFixture'), 'WorkArchiveFixture'), handle: { title: 'Work archive fixture' } },
              { path: 'fixtures/profile', lazy: load(() => import('@/pages/fixtures/ProfileFixtures'), 'ProfileFixtures'), handle: { title: 'Profile fixtures' } },
              { path: 'fixtures/segmented-control', lazy: load(() => import('@/pages/fixtures/SegmentedFixtures'), 'SegmentedFixtures'), handle: { title: 'Segmented control fixtures' } },
              { path: 'fixtures/page-header', lazy: load(() => import('@/pages/fixtures/PageHeaderFixtures'), 'PageHeaderFixtures'), handle: { title: 'Page header fixtures' } },
              { path: 'fixtures/list-row', lazy: load(() => import('@/pages/fixtures/ListRowFixtures'), 'ListRowFixtures'), handle: { title: 'List row fixtures' } },
              { path: 'fixtures/list-focus', lazy: load(() => import('@/pages/fixtures/ListFocusFixtures'), 'ListFocusFixtures'), handle: { title: 'List focus fixtures' } },
              { path: 'fixtures/master-detail', lazy: load(() => import('@/pages/fixtures/ListFocusFixtures'), 'MasterDetailFixtures'), handle: { title: 'Master detail fixture' } },
              { path: 'fixtures/table', lazy: load(() => import('@/pages/fixtures/TableFixtures'), 'TableFixtures'), handle: { title: 'Table fixtures' } },
            ] : []),
          ],
        },
        { path: 'layouts/sidebar', element: <SidebarExample />, handle: { title: 'Full page with left bar' } },
        { path: 'layouts/workbench', element: <WorkbenchExample />, handle: { title: 'Three panels with top bar' } },
        ...(FIXTURES ? [
          { path: 'fixtures/workbench-hydrate', lazy: load(() => import('@/pages/fixtures/WorkbenchHydrate'), 'WorkbenchHydrate'), handle: { title: 'Workbench hydration' } },
          { path: 'fixtures/bare-table', lazy: load(() => import('@/pages/fixtures/BareTableFixture'), 'BareTableFixture'), handle: { title: 'A table without a shell' } },
        ] : []),
        {
          path: 'app',
          element: <AppLayout />,
          children: [
            { index: true, element: <TodayPage />, handle: { title: 'Today' } },
            { path: 'inbox', element: <InboxPage />, handle: { title: 'Inbox' } },
            { path: 'inbox/:id', element: <InboxPage />, handle: { title: 'Inbox' } },
            { path: 'work', element: <WorkPage />, handle: { title: 'Work' } },
            // The page's h1: the item's title, or "Not found".
            { path: 'work/:id', element: <WorkItemPage />, handle: { title: ({ id = '' }: Params) => server.get(id)?.title ?? 'Not found' } },
            { path: 'settings', element: <SettingsPage />, handle: { title: 'Settings' } },
            { path: 'settings/appearance', element: <AppearancePage />, handle: { title: 'Appearance' } },
            { path: 'profile', element: <ProfilePage />, handle: { title: 'Profile' } },
            // Inside the app, so a mistyped app address keeps the app around it.
            { path: '*', element: <AppNotFound />, handle: { title: 'Page not found', notFound: true } },
          ],
        },
        ...(FIXTURES ? [{
          element: <AppLayout />,
          children: [{ path: 'fixtures/inbox/:id?', lazy: load(() => import('@/pages/fixtures/InboxFixtures'), 'InboxFixtures'), handle: { title: 'Inbox fixtures' } }],
        }] : []),
        // Each step's h1, so the tab names the step.
        { path: 'app/welcome/:step?', element: <WelcomePage />, handle: { title: ({ step = '' }: Params) => WELCOME_TITLES[step] ?? 'Welcome' } },
        { path: '*', element: <NotFound />, handle: { title: 'Page not found', notFound: true } },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);

// A hot update that reaches this module runs it again, and a new router would remount the app and drop focus to
// `<body>`. The router is made once, and Fast Refresh updates the components it renders. A change to the routes needs
// a manual reload: the kept router serves the old ones until then.
const hot = import.meta.hot?.data as { router?: ReturnType<typeof routes> } | undefined;
const router = hot?.router ?? routes();
if (hot) hot.router = router;

/** The site and the demo app. It exports only this component, so a hot update stops here. */
export function App() {
  return <RouterProvider router={router} />;
}
