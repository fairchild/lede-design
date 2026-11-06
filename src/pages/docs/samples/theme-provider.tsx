import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/lede/theme-provider';

// Wrap the app once. A nested ThemeProvider rethemes a subtree and inherits what it leaves unset.
export function App({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider surface="grouped" accent="blue">
      {children}
      <ThemeProvider scheme="dark" accent="orange">
        <p>Dark and orange, whatever the page uses.</p>
      </ThemeProvider>
    </ThemeProvider>
  );
}
