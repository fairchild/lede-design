// Reads each Lede component's own API from its source with the TypeScript compiler: the component's doc comment, and
// for each prop its type as written, whether it's optional, its doc comment, its default (from "Default `x`") and, for
// a union of string literals, the values it takes. Props a component inherits from React's HTML attributes are left
// out. Also emits the declarations, so the design system can ship them as types. Used by build-design-system.mjs.
import ts from 'typescript';
import { resolve } from 'node:path';

const doc = (symbol, checker) => ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, ' ').trim();
const DEFAULT = /Default:? `([^`]+)`|Default:? (\d+(?:\.\d+)?|true|false)\b/;

/** @param {string[]} files repo-relative registry files @returns {{ api: Map<string, object>, declarations: Map<string, string> }} */
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

  const declarations = new Map();
  program.emit(undefined, (fileName, text) => {
    const rel = fileName.replace(/\\/g, '/').match(/registry\/lede\/(.+)\.d\.ts$/)?.[1];
    if (rel) declarations.set(rel, text);
  }, undefined, true);
  return { api, declarations };
}
