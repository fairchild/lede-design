// How the harness starts Claude Code with nothing from this machine's setup: an empty config folder, no settings,
// MCP servers, skills or slash commands, and none of the variables a parent Claude Code session passes on.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function isolatedEnv() {
  const env = { ...process.env };
  // A parent session passes its memory, skills, extra folders and effort through these, so they go.
  for (const key of Object.keys(env)) {
    if (key === 'CLAUDECODE' || key === 'CLAUDE_EFFORT' || /^CLAUDE_.*(MEMORY|ADDITIONAL_DIRECTORIES|SYNC_SKILLS|SYNC_PLUGINS|SKILL)/.test(key)) delete env[key];
  }
  env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'lede-bench-config-'));
  return env;
}

export const isolatedArgs = (env) => [
  '--setting-sources', '',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--no-session-persistence',
  ...(env.ANTHROPIC_API_KEY ? ['--bare'] : []),
];
