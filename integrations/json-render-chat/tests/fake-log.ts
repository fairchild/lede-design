import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The file the fake Anthropic appends each request body to, which a test reads to see what the model was sent. */
export const fakeLog = join(tmpdir(), 'lede-chat-fake-anthropic.log');
