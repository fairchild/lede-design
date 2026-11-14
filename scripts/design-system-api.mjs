// Reads each Lede component's own API from its source with the TypeScript compiler: the component's doc comment, and
// for each prop its type as written, whether it's optional, its doc comment, its default (from "Default `x`") and, for
// a union of string literals, the values it takes. Props a component inherits from React's HTML attributes are left
// out. Also emits the declarations, so the design system can ship them as types, and lists what each file exports.
// Used by build-design-system.mjs and by the docs site's reference pages (scripts/llms/).
import ts from 'typescript';
import { resolve } from 'node:path';

const doc = (symbol, checker) => ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
const DEFAULT = /Default:? `([^`]+)`|Default:? (\d+(?:\.\d+)?|true|false)\b/;

/** What an exported name is, for a reader choosing what to import. */
function kindOf(symbol, checker) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  if (target.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) return 'type';
  const declaration = target.valueDeclaration;
  // A React context is callable as its own Provider, so it's told apart by its Provider and Consumer.
  const type = declaration && checker.getTypeOfSymbolAtLocation(target, declaration);
  if (type?.getProperty('Provider') && type.getProperty('Consumer')) return 'context';
  const callable = target.flags & ts.SymbolFlags.Function
    || (declaration && checker.getTypeOfSymbolAtLocation(target, declaration).getCallSignatures().length > 0);
  if (!callable) return target.flags & ts.SymbolFlags.Class ? 'class' : 'constant';
  return /^use[A-Z]/.test(symbol.name) ? 'hook' : /^[A-Z]/.test(symbol.name) ? 'component' : 'function';
}

/**
 * @param {string[]} files repo-relative registry files
 * @returns {{ api: Map<string, object>, declarations: Map<string, string>, exports: Map<string, Array<{ name: string, kind: string, from: string | null }>> }}
 *   `exports` is keyed by file; `from` is the repo-relative file a re-export comes from, else null.
 */
export function readApi(files) {
  const cwd = process.cwd();
  const config = ts.getParsedCommandLineOfConfigFile(resolve(cwd, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const paths = files.map((f) => resolve(cwd, f));
  const program = ts.createProgram(paths, { ...config.options, noEmit: false, declaration: true, emitDeclarationOnly: true });
  const checker = program.getTypeChecker();
  const api = new Map();

  for (const path of paths) {
    const source = program.getSourceFile(path);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) continue;
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      if (!/^[A-Z]/.test(exported.name)) continue;
      const declaration = exported.declarations?.[0];
      if (!declaration || !(ts.isFunctionDeclaration(declaration) || ts.isVariableDeclaration(declaration))) continue;
      const signature = checker.getTypeOfSymbolAtLocation(exported, declaration).getCallSignatures()[0];
      const param = signature?.parameters[0];
      if (!param) continue;
      const propsType = checker.getTypeOfSymbolAtLocation(param, declaration);
      // A union of props (Button's <button> or <a>) lists each branch's own props once.
      const members = propsType.isUnion() ? propsType.types.flatMap((t) => checker.getPropertiesOfType(t)) : checker.getPropertiesOfType(propsType);
      const props = [];
      const seen = new Set();
      for (const member of members) {
        if (seen.has(member.name)) continue;
        const declarations = (member.declarations ?? []).filter((d) => !d.getSourceFile().fileName.includes('node_modules'));
        if (!declarations.length) continue;
        seen.add(member.name);
        const [first] = declarations;
        const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(member, first));
        if (type.flags & ts.TypeFlags.Never) continue; // `href?: never` marks the other branch of a union
        const text = first.type ? first.type.getText().replace(/\s+/g, ' ') : checker.typeToString(type);
        const values = type.isUnion() && type.types.every((t) => t.isStringLiteral()) ? type.types.map((t) => t.value) : null;
        const description = doc(member, checker);
        const match = description.match(DEFAULT);
        props.push({
          name: member.name,
          optional: (member.flags & ts.SymbolFlags.Optional) !== 0,
          type: text,
          values,
          boolean: !!(type.flags & ts.TypeFlags.Boolean) || (type.isUnion() && type.types.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)),
          description,
          default: match ? (match[1] ?? match[2]).replace(/^'(.*)'$/, '$1') : null,
        });
      }
      api.set(exported.name, { name: exported.name, file: path.slice(cwd.length + 1), description: doc(exported, checker), props });
    }
  }

  const exports = new Map();
  for (const path of paths) {
    const source = program.getSourceFile(path);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) continue;
    exports.set(path.slice(cwd.length + 1), checker.getExportsOfModule(moduleSymbol).map((symbol) => {
      const origin = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol).declarations?.[0]?.getSourceFile().fileName : null;
      return { name: symbol.name, kind: kindOf(symbol, checker), from: origin && origin !== path ? origin.slice(cwd.length + 1) : null };
    }));
  }

  const declarations = new Map();
  program.emit(undefined, (fileName, text) => {
    const rel = fileName.replace(/\\/g, '/').match(/registry\/lede\/(.+)\.d\.ts$/)?.[1];
    if (rel) declarations.set(rel, text);
  }, undefined, true);
  return { api, declarations, exports };
}
