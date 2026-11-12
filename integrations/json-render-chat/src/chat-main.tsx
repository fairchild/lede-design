import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Chat } from './chat/Chat';
import './styles.css';

// The chat on its own, as step 5 of the README renders it in an app: chat.html, which tests/chat.e2e.ts drives.
createRoot(document.getElementById('root')!).render(<StrictMode><Chat /></StrictMode>);
