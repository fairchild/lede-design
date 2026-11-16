import { installGuide, readmeBlocks, type Block } from './readme-install';

const SITE = 'https://lede.cloudcompute.com';
const SKILL = 'https://raw.githubusercontent.com/fairchild/lede-design/main/.claude/skills/lede-design-system/SKILL.md';
/** The README's Limits that stop an install, found by their bold lead. */
const BLOCKING = [/^\*\*Client rendering only\.\*\*/, /^\*\*Install from the registry URL\.\*\*/];

/** README Markdown as plain text: no backticks, bold or link targets. */
const plain = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1');
const firstSentence = (text: string) => text.match(/^.+?[.:](?=\s|$)/)?.[0] ?? text;
const firstText = (blocks: Block[]) => blocks.find((b): b is Extract<Block, { kind: 'text' }> => b.kind === 'text')?.text ?? '';

/**
 * A prompt that a person pastes into a coding agent to set Lede up in their project. It's written from the README's own
 * install steps and Limits, so it changes when they do, and it pins this build's release.
 */
export function agentPrompt(readme: string, version: string) {
  const steps = installGuide(readme).steps.map((step) => `   ${step.number}. ${plain(firstSentence(firstText(step.blocks)))}`);
  const limits = readmeBlocks(readme, 'Limits').flatMap((b) => (b.kind === 'list' ? b.items : []))
    .filter((item) => BLOCKING.some((lead) => lead.test(item)))
    .map((item) => `   - ${plain(item)}`);
  return [
    `Set up Lede ${version}, a design system for React, in this project.`,
    '',
    `1. Read ${SITE}/llms.txt, then the install steps in ${SITE}/overview.md, and follow them in order:`,
    ...steps,
    `2. Add the registry at this exact URL, which pins release ${version}:`,
    `   npx shadcn@latest registry add '@lede=${SITE}/r/v${version}/{name}.json'`,
    '3. Check these limits before you start:',
    ...limits,
    '4. Add a note to AGENTS.md, or CLAUDE.md if the project has one, that says:',
    `   "UI uses Lede ${version}. Before building or changing a screen, read ${SITE}/llms.txt and follow the lede-design-system skill: ${SKILL}"`,
    '5. If a step fails, or the project renders on the server, stop and tell me what happened instead of working around it.',
  ].join('\n');
}
