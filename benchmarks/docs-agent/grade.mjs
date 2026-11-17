// The grader: a second opinion beside the scripted checks, never in place of them. Sonnet reads a run's screenshots
// against a fixed rubric three times, blind: the screenshots are copied to a folder of their own under neutral names,
// and the grader is told nothing of which model built the app. Each criterion's score is the median of the passes.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isolatedArgs, isolatedEnv } from './agent.mjs';

export const GRADER = 'claude-sonnet-5-5';
export const CRITERIA = ['task', 'hierarchy', 'consistency', 'spacing', 'phone'];
const SHOTS = [
  ['desktop.png', 'the first screen on a 1280 by 800 desktop'],
  ['desktop-after.png', 'the same desktop after a script clicked through the task, such as choosing a row or pressing Save'],
  ['phone.png', 'the first screen on a 390 by 844 phone'],
  ['phone-after.png', 'the phone after a script did the same'],
  ['dark.png', 'the first screen with the system in dark mode'],
];

const prompt = (taskText, shots) => `You are grading a screen someone built. Read each image with the Read tool, then score it.

What they were asked to build:
<task>
${taskText}
</task>

The images, all in this folder:
${shots.map(([file, what]) => `- ${file}: ${what}`).join('\n')}

Score each criterion from 1 to 5, where 1 is poor, 3 is acceptable and 5 is excellent. Judge only what the images show.
- task: does the screen do what the task asks, with all the content it names?
- hierarchy: is it clear what the screen is about and what matters most, from headings, weight and order?
- consistency: do rows, controls, spacing and alignment follow one pattern, with no stray indents or mismatched parts?
- spacing: is there a margin at the window's edges, room between parts, and no clipped, cramped or overflowing content?
- phone: does the phone screen work on its own terms, with nothing cut off or squeezed?

Reply with JSON only, no other text: {"task": n, "hierarchy": n, "consistency": n, "spacing": n, "phone": n, "note": "one sentence on the biggest problem"}`;

const median = (values) => {
  const sorted = values.filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Grades one run's screenshots, `passes` times. */
export function grade(runDir, taskText, { passes = 3 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lede-bench-grade-'));
  const shots = SHOTS.filter(([file]) => existsSync(join(runDir, file)));
  shots.forEach(([file]) => copyFileSync(join(runDir, file), join(dir, file)));
  const task = taskText.replace(/\{\{DOCS\}\}\/llms\.txt/g, "Lede's llms.txt");
  const results = [];
  let cost = 0;
  // A pass whose reply isn't the JSON asked for is tried once more.
  for (let i = 0; results.filter((r) => !r.error).length < passes && shots.length && i < passes + 2; i++) {
    const env = isolatedEnv();
    const run = spawnSync('claude', ['-p', prompt(task, shots), '--model', GRADER, '--output-format', 'json', '--tools', 'Read', '--permission-mode', 'bypassPermissions', '--max-budget-usd', '1', ...isolatedArgs(env)], { cwd: dir, env, encoding: 'utf8', timeout: 300_000 });
    rmSync(env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
    try {
      const out = JSON.parse(run.stdout);
      cost += out.total_cost_usd ?? 0;
      const json = JSON.parse(String(out.result).match(/\{[\s\S]*\}/)[0]);
      results.push(json);
    } catch {
      results.push({ error: String((() => { try { return JSON.parse(run.stdout).result; } catch { return run.stdout || run.stderr; } })() ?? '').slice(0, 300) });
    }
  }
  rmSync(dir, { recursive: true, force: true });
  const scores = Object.fromEntries(CRITERIA.map((c) => [c, median(results.map((r) => r[c]))]));
  const known = Object.values(scores).filter((v) => v != null);
  return {
    grader: GRADER,
    passes: results,
    scores,
    mean: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null,
    costUsd: cost,
  };
}
