export type Language = 'tsx' | 'shell' | 'css';
type TokenKind = 'comment' | 'string' | 'keyword' | 'tag';
interface Token { text: string; kind?: TokenKind }

const QUOTED = String.raw`'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"`;
const BACKTICKED = String.raw`\`(?:\\[\s\S]|[^\`\\])*\``;
const KEYWORDS = 'as|async|await|boolean|break|case|catch|class|const|continue|default|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|interface|let|new|null|number|of|return|string|switch|throw|true|try|type|typeof|undefined|void|while';

// The groups name the kinds. In tsx a tag is a name right after `<` or `</`, which also catches generics such as useState<View>.
const RULES: Record<Language, RegExp> = {
  tsx: new RegExp(
    [
      String.raw`(?<comment>\/\/.*|\/\*[\s\S]*?\*\/)`,
      `(?<string>${QUOTED}|${BACKTICKED})`,
      String.raw`(?<=<\/?)(?<tag>[A-Za-z][\w.]*)`,
      String.raw`(?<![\w$.])(?<keyword>${KEYWORDS})(?![\w$])`,
    ].join('|'),
    'g',
  ),
  shell: new RegExp(
    [
      String.raw`(?<comment>(?<!\S)#.*)`,
      `(?<string>${QUOTED})`,
      String.raw`(?<keyword>^[\w./-]+)`,
      String.raw`(?<!\S)(?<tag>--?[\w-]+)`,
    ].join('|'),
    'gm',
  ),
  css: new RegExp(
    [
      String.raw`(?<comment>\/\*[\s\S]*?\*\/)`,
      `(?<string>${QUOTED})`,
      String.raw`(?<keyword>@[\w-]+)`,
    ].join('|'),
    'g',
  ),
};

/** Splits code into colored runs. Runs are slices of `code` in order, so joining them gives `code` back. */
export function tokenize(code: string, language: Language): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  for (const match of code.matchAll(RULES[language])) {
    if (match.index > at) tokens.push({ text: code.slice(at, match.index) });
    const kind = Object.keys(match.groups!).find((name) => match.groups![name] !== undefined) as TokenKind;
    tokens.push({ text: match[0], kind });
    at = match.index + match[0].length;
  }
  if (at < code.length) tokens.push({ text: code.slice(at) });
  return tokens;
}
