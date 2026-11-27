// An empty InboxFlow says so once: "No messages" below, and no "All read · 0 messages" in the header above it.
import { test, expect } from '@playwright/test';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { InboxFlow } from '../registry/lede/flows/inbox';

test('an empty inbox has no header summary, only its empty state', ({ isMobile }) => {
  test.skip(isMobile, 'Server rendering: one project is enough.');
  const html = renderToString(h(InboxFlow, { messages: [], hrefFor: (id: string) => `/m/${id}`, listHref: '/m', onArchive: () => {}, onDelete: () => {} }));
  expect(html).toContain('No messages');
  expect(html).not.toContain('All read');
});
