import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { test, expect } from '@playwright/test';
import { ThemeProvider, ThemeScope, type ThemeProviderProps } from '../registry/lede/index';

// These run in Node, so they also hold the theme code to rendering with no document.
function nestedStyle(props: ThemeProviderProps) {
  const html = renderToString(h(ThemeProvider, { accent: 'orange', accentForeground: '#111111' }, h(ThemeProvider, props)));
  const style = / style="([^"]*)"/.exec(html.split('<div')[2])?.[1] ?? '';
  return Object.fromEntries([...style.matchAll(/([^:;]+):([^;]*)/g)].map((match) => [match[1], match[2]]));
}

test('A nested accent drops the parent\'s accentForeground', () => {
  expect(nestedStyle({ accent: 'teal' })).toEqual({ '--primary': 'var(--preset-teal)' });
});

test('A nested accentForeground applies to the accent it inherits', () => {
  expect(nestedStyle({ accentForeground: '#222222' })).toEqual({ '--primary': 'var(--preset-orange)', '--primary-foreground': '#222222' });
});

test('Inherited themes and ThemeScope render on a server', () => {
  expect(typeof document).toBe('undefined');
  for (const nested of [{}, { scheme: 'inherit', contrast: 'inherit' }] as ThemeProviderProps[]) {
    const html = renderToString(
      h(ThemeProvider, { scheme: 'dark', contrast: 'high' },
        h(ThemeProvider, nested,
          h(ThemeScope, null, 'content'))),
    );
    expect([...html.matchAll(/data-theme="([^"]*)"/g)].map((match) => match[1])).toEqual(Array(4).fill('dark-hc'));
    expect(html).toContain('>content<');
  }
  expect(renderToString(h(ThemeScope, null, 'content'))).toBe('content');
});
