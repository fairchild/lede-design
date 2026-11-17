// The live half of Lede's design system on claude.ai: React 19 and ReactDOM as two classic scripts for
// `components/lib/`, every registry export as one classic script, `components/bundle.js`, that assigns `window.Lede`,
// and each docs sample compiled to a script a preview runs against those globals. build-design-system.mjs calls it.
//
// The format loads React 18 from a CDN by default, but Lede passes `ref` as a plain prop, which React 18 drops, so the
// system carries React 19 itself. The bundle and the libraries share one React: both read `window.React`.
import ts from 'typescript';
import { build } from 'vite';

const VIRTUAL = '\0lede-ds:';
const ENTRY = '__lede_ds_entry';
// Each bare React import, served from the globals the libraries assign. A CommonJS shape gives named imports, default
// imports and namespace imports alike.
const GLOBALS = {
  react: 'module.exports = window.React;',
  'react-dom': 'module.exports = window.ReactDOM;',
  'react-dom/client': 'module.exports = window.ReactDOM;',
  // The automatic JSX runtime over createElement: props carry their children, and a key arrives on its own.
  'react/jsx-runtime': `const R = window.React;
export const Fragment = R.Fragment;
export function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : { ...props, key }); }
export const jsxs = jsx;`,
  'react/jsx-dev-runtime': `export { Fragment, jsx as jsxDEV } from 'react/jsx-runtime';`,
};

/** A Vite plugin serving virtual modules by id, and each of `globals`, the ids of GLOBALS, from the window. */
const virtual = (modules, globals) => ({
  name: 'lede-design-system-virtual',
  enforce: 'pre',
  resolveId(id) {
    // Vite resolves a library's entry against the root first.
    if (id.endsWith(`/${ENTRY}`)) return VIRTUAL + ENTRY;
    if (id in modules) return VIRTUAL + id;
    if (globals.includes(id)) return `${VIRTUAL}global:${id}`;
    return null;
  },
  load(id) {
    if (!id.startsWith(VIRTUAL)) return null;
    const key = id.slice(VIRTUAL.length);
    return key.startsWith('global:') ? GLOBALS[key.slice('global:'.length)] : modules[key];
  },
});

const ALIAS = [
  { find: /^@\/components\/lede\//, replacement: `${process.cwd()}/registry/lede/` },
  { find: /^@lede\//, replacement: `${process.cwd()}/registry/lede/` },
];

/** One classic script from `entry`, with React's production build and nothing left to import. */
async function iife(entry, { globals = Object.keys(GLOBALS), modules = {} } = {}) {
  const result = await build({
    configFile: false,
    mode: 'production',
    root: process.cwd(),
    logLevel: 'error',
    publicDir: false,
    resolve: { alias: ALIAS },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [virtual({ ...modules, [ENTRY]: entry }, globals)],
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      reportCompressedSize: false,
      lib: { entry: ENTRY, formats: ['iife'], name: '__lede_ds', fileName: () => 'out.js' },
    },
  });
  const chunk = [result].flat()[0].output.find((o) => o.type === 'chunk');
  return safe(chunk.code.replace(/^var __lede_ds\s*=\s*/, ''));
}

/** A classic script that can be inlined: no literal `</script` or `<!--` to end or escape its element. */
export const safe = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '\\x3C!--');

/** `components/lib/`: React and ReactDOM, the client APIs included, each assigning its global. */
export async function buildLibraries(version) {
  const react = await iife(`import * as React from 'react';\nwindow.React = React;`, { globals: [] });
  // ReactDOM reads the React above, so the page has one React; createRoot and hydrateRoot sit beside flushSync.
  const reactDom = await iife(
    `import * as ReactDOM from 'react-dom';\nimport * as Client from 'react-dom/client';\nwindow.ReactDOM = { ...ReactDOM, ...Client };`,
    { globals: ['react'] },
  );
  const banner = (name) => `/** ${name} ${version}, production build. MIT License, Copyright (c) Meta Platforms, Inc. and affiliates. */\n`;
  return {
    files: { 'components/lib/react.production.js': banner('react') + react, 'components/lib/react-dom.production.js': banner('react-dom') + reactDom },
    libraries: [
      { name: 'react', version, global: 'React', file: 'components/lib/react.production.js' },
      { name: 'react-dom', version, global: 'ReactDOM', file: 'components/lib/react-dom.production.js' },
    ],
  };
}

/** `components/bundle.js`: every export of the registry's barrels, with SpecView and its catalog, as `window.Lede`. */
export async function buildBundle({ header, banner }) {
  const exports = `export * from '@lede/index';
export * from '@lede/blocks/index';
export * from '@lede/flows/index';
export { SpecView } from '@lede/json-render/spec-view';
export { catalog } from '@lede/json-render/catalog';`;
  const bundle = await iife(`import * as Lede from 'lede-exports';\nwindow.Lede = Object.assign(window.Lede || {}, Lede);`, { modules: { 'lede-exports': exports } });
  return `/* @ds-bundle: ${JSON.stringify(header)} */\n${banner}\n${bundle}`;
}

/**
 * A docs sample as a function body that returns its component, for a preview's script. Imports become reads of the
 * globals: React's from `React`, Lede's from `Lede`. Every name it reads from Lede must be one the bundle exports.
 */
export function compileSample(source, path, exported) {
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, verbatimModuleSyntax: false },
  });
  let component;
  const body = outputText
    // A namespace import of React reads the global; one named React is the global already.
    .replace(/^import \* as (\w+) from 'react';$/gm, (_, as) => (as === 'React' ? '' : `const ${as} = React;`))
    .replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';$/gm, (_, names, from) => {
      const global = from === 'react' ? 'React' : /^@\/components\/lede\//.test(from) ? 'Lede' : null;
      if (!global) throw new Error(`${path}: a preview can't import '${from}'`);
      const list = names.split(',').map((n) => n.trim()).filter(Boolean).map((n) => n.split(/\s+as\s+/));
      if (global === 'Lede') for (const [name] of list) if (!exported.has(name)) throw new Error(`${path}: window.Lede has no ${name}`);
      return `const { ${list.map(([name, as]) => (as ? `${name}: ${as}` : name)).join(', ')} } = ${global};`;
    })
    .replace(/^export function (\w+)/gm, (_, name) => {
      if (/^[A-Z]/.test(name)) component = name;
      return `function ${name}`;
    })
    .replace(/^export \{\};$/gm, '');
  if (/^\s*(import|export)\b/m.test(body)) throw new Error(`${path}: an import or export the preview can't run`);
  if (!component) throw new Error(`${path}: no component export`);
  return safe(`${body.trim()}\nreturn ${component};`);
}

/** A value as JavaScript source, for a preview to pass the props the static render used. */
export function toSource(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return `(${value.toString()})`;
  if (Array.isArray(value)) return `[${value.map(toSource).join(', ')}]`;
  if (value && typeof value === 'object') {
    if (value.$$typeof && typeof value.type === 'string') return `React.createElement(${JSON.stringify(value.type)}, ${toSource(value.props)})`;
    if (value.$$typeof) throw new Error('toSource: only an element of an HTML tag');
    return `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${toSource(v)}`).join(', ')} }`;
  }
  return JSON.stringify(value);
}
