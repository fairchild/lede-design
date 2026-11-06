import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '@/app';
import './styles/globals.css';

// A hot update that reaches this module runs it again, and a second `createRoot` on the same element is an error.
const hot = import.meta.hot?.data as { root?: Root } | undefined;
const root = hot?.root ?? createRoot(document.getElementById('root')!);
if (hot) hot.root = root;
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
