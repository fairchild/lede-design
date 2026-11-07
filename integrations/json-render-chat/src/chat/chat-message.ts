import type { UIMessage } from 'ai';

// The message shape from Lede's planned Chat block, cut to the parts this sketch draws. The block will own it; until
// then this file maps AI SDK messages onto it, so the sketch reads data the way the block will.

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

export type ChatPart = { type: 'text'; text: string; streaming?: boolean } | { type: 'data'; name: string; data: unknown };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: readonly ChatPart[];
  author?: string;
  ending?: { kind: 'stopped' } | { kind: 'failed'; message: string };
}

export function toChatMessage(message: UIMessage, live: boolean): ChatMessage {
  const parts: ChatPart[] = [];
  for (const part of message.parts) {
    if (part.type === 'text') parts.push({ type: 'text', text: part.text, streaming: live && part.state === 'streaming' });
    else if (part.type.startsWith('data-')) parts.push({ type: 'data', name: part.type.slice(5), data: (part as { data: unknown }).data });
  }
  return { id: message.id, role: message.role === 'user' ? 'user' : 'assistant', parts };
}
