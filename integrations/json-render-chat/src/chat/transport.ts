import { DefaultChatTransport, type ChatTransport } from 'ai';
import type { AppMessage } from './app-message';
import { MockChatTransport } from './mock-transport';

/**
 * The one switch between the scripted replies and a real backend. With `VITE_CHAT_API` set, such as `/api/chat`, the
 * chat posts there with the AI SDK's own transport. Without it, the mock answers in the browser.
 */
export const chatApi = import.meta.env.VITE_CHAT_API as string | undefined;

export const transport: ChatTransport<AppMessage> = chatApi ? new DefaultChatTransport<AppMessage>({ api: chatApi }) : new MockChatTransport();
