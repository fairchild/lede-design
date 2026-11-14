import { Fragment } from 'react';
import type { Spec } from '@json-render/core';
import { RouterLink } from '@/router-link';
import { PageHeader } from '@lede/blocks/page-header';
import { SpecView } from '@lede/json-render/spec-view';
import registry from '../../../registry.json';
import { version } from '../../../package.json';
import { CodeExample } from './CodeExample';
import { REPO } from './DocsLayout';
import { EXAMPLE_APPS } from './integration-apps';
import spec from './examples/json-render-spec.json';
import SPEC_CODE from './examples/json-render-spec.json?raw';

const ITEM = registry.items.find((item) => item.name === 'json-render')!;
const INSTALL_CODE = `npx shadcn@latest registry add '@lede=https://lede.cloudcompute.com/r/v${version}/{name}.json'
npx shadcn@latest add @lede/theme-provider @lede/json-render`;
const folder = (name: string) => `${REPO}/tree/main/integrations/${name}`;
/** Lede's design system on claude.ai, generated from this repo by `npm run design-system`. */
const DESIGN_SYSTEM_URL = 'https://claude.ai/artifact/Cw9GgaD1zxRk9ewxGMHv4x';
/** A canvas of Lede's foundations and components, drawn with Lede's stylesheet. */
const CANVAS_URL = 'https://claude.ai/artifact/7eECQYRQWxSkaJhwRtT4rJ#artboard-15dd8cd198dd';
const ARTIFACT_CODE = `"files": {
  "lede.css": { "artifact": "${DESIGN_SYSTEM_URL}", "path": "project/components/bundle.css" }
}

<link rel="stylesheet" href="lede.css">
<div class="ld-theme" data-theme="light" data-surface="grouped">…</div>`;

/** "a, b and c", each in code: Lede’s lists have no serial comma. */
const codeList = (names: string[]) => names.map((name, i) => (
  <Fragment key={name}>{i === 0 ? '' : i === names.length - 1 ? ' and ' : ', '}<code>{name}</code></Fragment>
));

export function Integrations() {
  return (
    <div className="ld-flow">
      <PageHeader title="Integrations" back={{ href: '/', label: 'Overview' }} summary="Each integration runs Lede beside another project. Claude builds with Lede from its design system, and json-render draws Lede screens from JSON specs, such as a model’s reply." />
      <section aria-labelledby="claude" className="docs-section">
        <h2 id="claude" className="text-title-3">Claude</h2>
        <p className="docs-intro">Lede’s <a href={DESIGN_SYSTEM_URL}>design system on claude.ai</a> holds its tokens, its whole stylesheet and every component, generated from this repo. Claude reads its README first, then builds with Lede in a chat artifact, a design canvas, a deck or Claude Code. Each component’s card has its React sample and the HTML that sample renders.</p>
        <ul className="docs-rules list-disc">
          <li><a href={DESIGN_SYSTEM_URL}>The Lede design system</a>: name it in a request, or choose it as a canvas’s or a deck’s design system.</li>
          <li><a href={CANVAS_URL}>The Lede canvas</a>: the foundations and components drawn with Lede’s own CSS, in all four themes.</li>
          <li>A React app in Claude Code installs from the registry, as <RouterLink href="/#install">Overview → Install</RouterLink> shows. The repo’s <code>lede-design-system</code> skill gives Claude the layers and the rules.</li>
        </ul>
        <p className="docs-intro">An HTML artifact copies the stylesheet from the design system and wraps the page in <code>ld-theme</code>:</p>
        <CodeExample label="Lede in an HTML artifact" language="tsx" code={ARTIFACT_CODE} />
      </section>
      <section aria-labelledby="json-render" className="docs-section">
        <h2 id="json-render" className="text-title-3">json-render</h2>
        <p className="docs-intro">SpecView draws a <a href="https://github.com/vercel-labs/json-render">json-render</a> spec with Lede, so a model’s reply can be a screen. <code>catalog</code> lists the components a model may use and goes into its prompt, <code>registry</code> draws each one and <code>check</code> finds the props a spec gets wrong.</p>
        <CodeExample label="Install commands for SpecView" language="shell" code={INSTALL_CODE} defaultOpen />
        <p className="docs-intro docs-note">The item brings the Lede components it draws and these npm packages, json-render’s at an exact version: {codeList(ITEM.dependencies ?? [])}. Then import Lede’s CSS once, as <RouterLink href="/#install">Overview → Install</RouterLink> shows.</p>
      </section>
      <section aria-labelledby="json-render-example" className="docs-section">
        <h2 id="json-render-example" className="text-title-3">A spec drawn by SpecView</h2>
        <p className="docs-intro">SpecView draws this spec on the page, so its switches work. A model writes the same JSON from the catalog.</p>
        <div className="docs-spec">
          <SpecView spec={spec as Spec} headingLevel={3} />
        </div>
        <CodeExample label="The spec as JSON" language="json" code={SPEC_CODE.trim()} defaultOpen />
      </section>
      <section aria-labelledby="example-apps" className="docs-section">
        <h2 id="example-apps" className="text-title-3">Example apps</h2>
        <p className="docs-intro">Each is a small app in the repo’s <code>integrations/</code> folder, with its own <code>package.json</code>. CI builds and tests each one on every pull request.</p>
        <ul className="docs-rules list-disc">
          {EXAMPLE_APPS.map((app) => (
            <li key={app.folder}>
              <a className="docs-path" href={folder(app.folder)}><code>integrations/{app.folder}</code></a>: {app.summary}
              {app.recipe ? <> To build it in your app, follow its <a className="docs-path" href={`${REPO}/blob/main/integrations/${app.folder}/${app.recipe}`}>recipe for a coding agent</a>.</> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
