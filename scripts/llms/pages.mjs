// The docs pages that have a Markdown build, and how one renders to static HTML in Node.
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** Each docs route, the module and export that render it, and what `llms.txt` says it holds. */
export const PAGES = [
  { route: '/', module: 'Overview', title: 'Overview and install', about: 'what Lede is, what a project needs, the install steps, the limits and the principles' },
  { route: '/foundations', module: 'Foundations', title: 'Foundations', about: 'every token, with its value in each theme, shape or density and its use' },
  { route: '/components', module: 'Components', title: 'Components', about: 'the primitives, each with its install command, code and import line' },
  { route: '/blocks', module: 'Blocks', title: 'Blocks', about: 'the larger parts of a screen, each with its install command, code and import line' },
  { route: '/blocks/data-table', module: 'DataTablePage', title: 'Data table', about: 'DataTable and `useServerRows`: client and server mode, search, states and narrow containers' },
  { route: '/layouts', module: 'Layouts', title: 'Layouts', about: 'the page layouts AppShell, WorkbenchShell and MasterDetail, and their regions' },
  { route: '/choose', module: 'Choose', title: 'Choose a part', about: 'what you’re building, and the component, block or flow that does it' },
  { route: '/decisions', module: 'Decisions', title: 'Decisions', about: 'how Lede is built, what each decision costs and what checks it' },
  { route: '/integrations', module: 'Integrations', title: 'Integrations', about: 'Lede in Claude, and json-render drawing Lede screens from JSON' },
];

/**
 * A docs page's static HTML, as React renders it in Node inside the providers the pages read: the router at the page's
 * route, the site's appearance and its links. With `twin`, the Markdown build's context is set, so live examples are
 * left out; without it, the markup is the site's own.
 * @param {(id: string) => Promise<Record<string, any>>} load a Vite server's `ssrLoadModule`
 */
export async function renderPage(load, page, twin = null) {
  const [{ MemoryRouter }, { AppearanceRoot }, { LinkProvider }, { RouterLink }, { TwinContext }, module] = await Promise.all([
    load('react-router'),
    load('/src/theme.tsx'),
    load('/registry/lede/link.tsx'),
    load('/src/router-link.tsx'),
    load('/src/pages/docs/twin.tsx'),
    load(`/src/pages/docs/${page.module}.tsx`),
  ]);
  const tree = h(TwinContext.Provider, { value: twin }, h(module[page.module]));
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [page.route] }, h(AppearanceRoot, null, h(LinkProvider, { component: RouterLink }, tree))));
}
