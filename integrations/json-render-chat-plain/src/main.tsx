import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Chat } from './chat/Chat';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Chat /></StrictMode>);
