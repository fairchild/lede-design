import { createSpecStreamCompiler, type Spec } from '@json-render/core';
import { toPatches } from '@/components/lede/json-render/patches';

export { toPatches };

/**
 * Replays a spec through json-render's stream compiler, in chunks that split each line in two, the way network
 * chunks fall. Calls `onSpec` each time a patch completes.
 */
export async function replay(spec: Spec, onSpec: (spec: Spec, done: number, total: number) => void, signal: AbortSignal, delay = 160) {
  const compiler = createSpecStreamCompiler<Spec>({ root: '', elements: {} });
  const lines = toPatches(spec);
  for (const [i, line] of lines.entries()) {
    const half = Math.ceil(line.length / 2);
    for (const chunk of [line.slice(0, half), line.slice(half)]) {
      await new Promise((resolve) => setTimeout(resolve, delay / 2));
      if (signal.aborted) return;
      const { result, newPatches } = compiler.push(chunk);
      if (newPatches.length) onSpec(result, i + 1, lines.length);
    }
  }
}
