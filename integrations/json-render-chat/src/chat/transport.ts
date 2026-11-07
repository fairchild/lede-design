import { DefaultChatTransport, type ChatTransport, type UIMessage } from 'ai';
import { MockChatTransport } from './mock-transport';

/**
 * The one switch between the scripted replies and a real backend. With `VITE_CHAT_API` set, such as `/api/chat`, the
 * chat posts there with the AI SDK's own transport. Without it, the mock answers in the browser.
 */
export const chatApi = import.meta.env.VITE_CHAT_API as string | undefined;

export const transport: ChatTransport<UIMessage> = chatApi ? new DefaultChatTransport({ api: chatApi }) : new MockChatTransport();
