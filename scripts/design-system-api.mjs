// Reads each Lede component's own API from its source with the TypeScript compiler: the component's doc comment, and
// for each prop its type as written, whether it's optional, its doc comment, its default (from "Default `x`") and, for
// a union of string literals, the values it takes. Props a component inherits from React's HTML attributes are left
// out, and `inherits` says where they come from instead. Also emits the declarations, so the design system can ship
// them as types, lists what each file exports and finds the Lede types each prop and each file's declarations name.
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

/** A type written out in full, such as `{ one: string; other: string }`, is shown in place of its name up to this length. */
const SHORT = 80;
/** The inherited attribute a reference page names as an example, the first of these a component takes. */
const EXAMPLES = ['className', 'aria-describedby'];
const printer = ts.createPrinter({ removeComments: true });
const print = (node) => printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).replace(/\s+/g, ' ');
const isTypeDeclaration = (d) => ts.isTypeAliasDeclaration(d) || ts.isInterfaceDeclaration(d) || ts.isEnumDeclaration(d) || ts.isClassDeclaration(d);
const containsTypeQuery = (node) => ts.isTypeQueryNode(node) || !!ts.forEachChild(node, containsTypeQuery);

/** The type alias, interface, enum or class a name refers to, through imports and re-exports. */
function typeDeclarationOf(symbol, checker) {
  const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return target?.declarations?.find(isTypeDeclaration);
}

/** Each element interface of the DOM library, such as `HTMLDivElement`, with the tags that create it. */
function tagsByInterface(program) {
  const tags = new Map();
  for (const file of program.getSourceFiles().filter((f) => /lib\.dom\.d\.ts$/.test(f.fileName))) {
    const map = file.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === 'HTMLElementTagNameMap');
    for (const member of map?.members ?? []) {
      if (!member.type || !member.name || !ts.isStringLiteral(member.name)) continue;
      const name = member.type.getText();
      tags.set(name, [...(tags.get(name) ?? []), member.name.text]);
    }
  }
  return tags;
}

/**
 * @param {string[]} files repo-relative registry files
 * @returns {{ api: Map<string, object>, declarations: Map<string, string>, exports: Map<string, Array<{ name: string, kind: string, from: string | null }>>, types: Map<string, { name: string, file: string, shape: string | null }>, declarationTypes: Map<string, string[]> }}
 *   `exports` is keyed by file; `from` is the repo-relative file a re-export comes from, else null. `types` holds each
 *   registry type a prop or a declaration names, by `file#name`: `shape` is the type written out when it's short, else
 *   null. Each prop's `types` and each file's `declarationTypes` (keyed as `declarations` is) list those keys.
 */
export function readApi(files) {
  const cwd = process.cwd();
  const config = ts.getParsedCommandLineOfConfigFile(resolve(cwd, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const paths = files.map((f) => resolve(cwd, f));
  const options = { ...config.options, noEmit: false, declaration: true, emitDeclarationOnly: true };
  const program = ts.createProgram(paths, options);
  const checker = program.getTypeChecker();
  const api = new Map();
  const inRegistry = (node) => node.getSourceFile().fileName.startsWith(`${cwd}/registry/`);

  const types = new Map();
  /** Adds a registry type to `types` and returns its key; a type from React, the DOM or a package returns null. */
  function record(declaration) {
    if (!declaration?.name || !inRegistry(declaration)) return null;
    const file = declaration.getSourceFile().fileName.slice(cwd.length + 1);
    const key = `${file}#${declaration.name.text}`;
    if (types.has(key)) return key;
    const params = declaration.typeParameters ? `<${declaration.typeParameters.map(print).join(', ')}>` : '';
    let shape = null;
    if (ts.isTypeAliasDeclaration(declaration)) {
      // A type built from a value, such as `(typeof presets)[number]`, reads as what it resolves to.
      shape = containsTypeQuery(declaration.type)
        ? checker.typeToString(checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(declaration.name)), declaration,
          ts.TypeFormatFlags.InTypeAlias | ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType)
        : print(declaration.type);
    } else if (ts.isInterfaceDeclaration(declaration) && !declaration.heritageClauses) {
      shape = `{ ${declaration.members.map(print).join(' ')} }`;
    }
    shape = shape?.replace(/\s+/g, ' ').replace(/;? }/g, ' }') ?? null;
    types.set(key, { name: `${declaration.name.text}${params}`, file, shape: shape && shape.length <= SHORT ? shape : null });
    return key;
  }
  /** The keys of the registry types a type node names. */
  function typesIn(node) {
    const keys = new Set();
    const visit = (n) => {
      if (ts.isTypeReferenceNode(n)) {
        const name = ts.isQualifiedName(n.typeName) ? n.typeName.right : n.typeName;
        const key = record(typeDeclarationOf(checker.getSymbolAtLocation(name), checker));
        if (key) keys.add(key);
      }
      ts.forEachChild(n, visit);
    };
    if (node) visit(node);
    return [...keys];
  }

  const tags = tagsByInterface(program);
  /** The module a name such as `Toolbar` in `typeof Toolbar.Root` is imported from. */
  function moduleOf(name) {
    let left = name;
    while (ts.isQualifiedName(left) || ts.isPropertyAccessExpression(left)) left = ts.isQualifiedName(left) ? left.left : left.expression;
    let node = checker.getSymbolAtLocation(left)?.declarations?.[0];
    while (node && !ts.isImportDeclaration(node)) node = node.parent;
    return node?.moduleSpecifier.text ?? null;
  }
  /**
   * Where a props type's attributes from outside Lede come from, read from how it's written: `{ element }` for an
   * element's attributes (null when the type names no one element, as `HTMLAttributes<HTMLElement>`), with `via` and
   * `module` when a package's type adds props to them, `{ component, module }` for another component's props, and
   * `names` when only some attributes are picked.
   */
  function sourcesOf(node) {
    if (!node) return [];
    if (ts.isParenthesizedTypeNode(node)) return sourcesOf(node.type);
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) return node.types.flatMap(sourcesOf);
    const ref = ts.isTypeReferenceNode(node) ? node.typeName : ts.isExpressionWithTypeArguments(node) ? node.expression : null;
    if (!ref) return [];
    const name = ref.getText().split('.').at(-1);
    const [arg, keys] = node.typeArguments ?? [];
    if (name === 'Omit') return sourcesOf(arg);
    if (name === 'Pick') {
      const names = (keys && ts.isUnionTypeNode(keys) ? keys.types : [keys]).filter((k) => k && ts.isLiteralTypeNode(k)).map((k) => k.literal.text);
      return sourcesOf(arg).map((source) => ({ ...source, names }));
    }
    if (/^ComponentProps(WithRef|WithoutRef)?$/.test(name) && arg) {
      if (ts.isLiteralTypeNode(arg) && ts.isStringLiteral(arg.literal)) {
        // A package's own `ComponentProps`, such as Base UI's `useRender.ComponentProps<'div'>`, adds props of its own.
        const module = ts.isQualifiedName(ref) || ts.isPropertyAccessExpression(ref) ? moduleOf(ref) : null;
        const via = module && module !== 'react' ? ref.getText().split('.').slice(0, -1).join('.') : null;
        return [{ element: arg.literal.text, ...(via ? { via, module } : {}) }];
      }
      if (ts.isTypeQueryNode(arg)) return [{ component: arg.exprName.getText(), module: moduleOf(arg.exprName) }];
    }
    if (/HTMLAttributes$/.test(name)) {
      const found = arg && ts.isTypeReferenceNode(arg) ? tags.get(arg.typeName.getText()) : null;
      return [{ element: found?.length === 1 ? found[0] : null }];
    }
    const declaration = typeDeclarationOf(checker.getSymbolAtLocation(ts.isQualifiedName(ref) ? ref.right : ts.isPropertyAccessExpression(ref) ? ref.name : ref), checker);
    if (!declaration || !inRegistry(declaration)) return [];
    if (ts.isInterfaceDeclaration(declaration)) return (declaration.heritageClauses ?? []).flatMap((c) => c.types.flatMap(sourcesOf));
    return ts.isTypeAliasDeclaration(declaration) ? sourcesOf(declaration.type) : [];
  }

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
      const inherited = new Set();
      const fromPackages = new Set();
      for (const member of members) {
        if (seen.has(member.name)) continue;
        const declarations = (member.declarations ?? []).filter((d) => !d.getSourceFile().fileName.includes('node_modules'));
        if (!declarations.length) {
          if (member.declarations?.length) inherited.add(member.name);
          if (member.declarations?.every((d) => !/[\\/]@types[\\/]react[\\/]/.test(d.getSourceFile().fileName))) fromPackages.add(member.name);
          continue;
        }
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
          types: typesIn(first.type),
        });
      }
      for (const prop of props) inherited.delete(prop.name);
      const from = inherited.size ? sourcesOf(param.valueDeclaration?.type) : [];
      // `inherits`: where the props the table leaves out come from, one of them to name, and the props a package's
      // type adds to an element's attributes (`added`), or null for none.
      const inherits = from.length ? {
        from,
        example: EXAMPLES.find((name) => inherited.has(name)) ?? null,
        added: from.some((source) => source.via) ? [...fromPackages].filter((name) => inherited.has(name)) : [],
      } : null;
      api.set(exported.name, { name: exported.name, file: path.slice(cwd.length + 1), description: doc(exported, checker), props, inherits });
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
  const declarationTypes = new Map();
  program.emit(undefined, (fileName, text, _bom, _onError, sources) => {
    const rel = fileName.replace(/\\/g, '/').match(/registry\/lede\/(.+)\.d\.ts$/)?.[1];
    if (!rel) return;
    declarations.set(rel, text);
    if (sources?.length === 1) declarationTypes.set(rel, importedTypes(text, sources[0].fileName));
  }, undefined, true);

  /**
   * The keys of the registry types a file's declarations bring in from other files. Declaration emit keeps only the
   * imports the declarations use, so these are read from the emitted text, then found in the file they name.
   */
  function importedTypes(text, from) {
    const keys = new Set();
    const add = (specifier, name) => {
      const resolved = ts.resolveModuleName(specifier, from, options, ts.sys).resolvedModule;
      const source = resolved && program.getSourceFile(resolved.resolvedFileName);
      const moduleSymbol = source && checker.getSymbolAtLocation(source);
      const symbol = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((s) => s.name === name);
      const key = record(typeDeclarationOf(symbol, checker));
      if (key) keys.add(key);
    };
    const visit = (node) => {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text : null;
      if (specifier?.startsWith('.')) {
        const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
        if (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) {
          for (const element of bindings.elements) add(specifier, (element.propertyName ?? element.name).text);
        }
      }
      // `import("./x").Name`, which declaration emit writes for a type the source never imported by name.
      if (ts.isImportTypeNode(node) && node.qualifier && ts.isLiteralTypeNode(node.argument) && node.argument.literal.text.startsWith('.')) {
        let left = node.qualifier;
        while (ts.isQualifiedName(left)) left = left.left;
        add(node.argument.literal.text, left.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile(from.replace(/\.tsx?$/, '.d.ts'), text, ts.ScriptTarget.Latest));
    return [...keys];
  }
  return { api, declarations, exports, types, declarationTypes };
}
