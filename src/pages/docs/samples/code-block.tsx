import { CodeBlock } from '@/components/lede/code-block';

const LOG = '\x1b[2m9:41:02\x1b[0m Building edge-sfo-2\n\x1b[2m9:41:07\x1b[0m \x1b[32m✓\x1b[0m Image pushed\n\x1b[2m9:41:38\x1b[0m \x1b[31m✗ Health check timed out after 30 seconds\x1b[0m';

export function DeployLog() {
  return <CodeBlock title="Deploy log" ansi follow>{LOG}</CodeBlock>;
}
