// Sample content for the workbench layout: a small project, one open file and a short conversation about it.
const RETRY = `export interface RetryOptions {
  /** Tries in total, counting the first. */
  maxAttempts?: number;
  /** The wait before the second try, in ms. Each later wait doubles. */
  baseDelay?: number;
  /** Stops waiting and rethrows when it aborts. */
  signal?: AbortSignal;
  /** Called after each failure. A returned number replaces the next wait. */
  onError?: (error: unknown, attempt: number) => number | void;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

/** Runs a task until it succeeds or the tries run out. */
export async function retry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelay = 200, signal, onError } = options;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= maxAttempts || signal?.aborted) throw error;
      const delay = onError?.(error, attempt) ?? baseDelay * 2 ** (attempt - 1);
      await wait(delay, signal);
    }
  }
}

/** Reads the seconds a server asks for, when it names any. */
export function retryAfter(response: Response): number | undefined {
  const seconds = Number(response.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}`;

const UPLOAD = `import { retry, retryAfter } from './retry';

export async function upload(file: File, url: string, signal?: AbortSignal) {
  const response = await retry(async () => {
    const result = await fetch(url, { method: 'PUT', body: file, signal });
    if (!result.ok) throw result;
    return result;
  }, {
    signal,
    onError: (error) => (error instanceof Response ? retryAfter(error) : undefined),
  });
  return response.json();
}`;

const INDEX = `export { retry, retryAfter } from './retry';
export type { RetryOptions } from './retry';
export { upload } from './upload';`;

const TEST = `import { expect, test } from 'vitest';
import { retry } from '../src/retry';

test('stops after the last try and rethrows', async () => {
  let tries = 0;
  const task = async () => {
    tries += 1;
    throw new Error('offline');
  };
  await expect(retry(task, { baseDelay: 0 })).rejects.toThrow('offline');
  expect(tries).toBe(3);
});`;

const README = `# Sample project

A small upload helper with retries.

## Use it

Call \`upload(file, url)\`. It tries three times, and waits longer before each try.
A server that sends \`Retry-After\` sets the wait instead.

## Test it

Run \`npm test\`.`;

const PACKAGE = `{
  "name": "sample-project",
  "version": "0.1.0",
  "type": "module",
  "scripts": { "test": "vitest run" }
}`;

export interface SampleFile { path: string; name: string; folder: string; language: string; lines: string[] }

const file = (path: string, language: string, text: string): SampleFile => {
  const parts = path.split('/');
  return { path, name: parts.at(-1)!, folder: parts.slice(0, -1).join('/'), language, lines: text.split('\n') };
};

export const SAMPLE_FILES: SampleFile[] = [
  file('src/retry.ts', 'TypeScript', RETRY),
  file('src/upload.ts', 'TypeScript', UPLOAD),
  file('src/index.ts', 'TypeScript', INDEX),
  file('tests/retry.test.ts', 'TypeScript', TEST),
  file('README.md', 'Markdown', README),
  file('package.json', 'JSON', PACKAGE),
];

export interface ChatMessage { id: number; from: 'you' | 'assistant'; text: string }

export const SAMPLE_CHAT: ChatMessage[] = [
  { id: 1, from: 'you', text: 'Why does the upload give up after three tries?' },
  { id: 2, from: 'assistant', text: 'retry() stops at maxAttempts, which defaults to 3. The waits double from 200 ms, so the third try starts about 600 ms after the first.' },
  { id: 3, from: 'you', text: 'Does it wait longer when the server asks it to?' },
  { id: 4, from: 'assistant', text: 'Yes. upload() passes retryAfter() as onError, and a returned number replaces the next wait. Without a Retry-After header it goes back to doubling.' },
];
