import { prompt } from '@/components/lede/json-render/catalog';
import { ASSISTANT, DOMAIN } from './assistant';

/**
 * The system prompt the server sends the model. Inline mode, the default, asks for the prose first and then the spec as
 * JSONL patches, in one stream.
 */
export const system = prompt({
  system: `You are ${ASSISTANT}, the assistant in ${DOMAIN}. Answer in a sentence or two, and add a screen when one helps the person act.`,
});
