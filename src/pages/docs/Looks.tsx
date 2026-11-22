import type { ReactNode } from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { Disclosure } from '@lede/disclosure';
import { Button } from '@lede/button';
import { Switch } from '@lede/switch';
import { SegmentedControl } from '@lede/segmented-control';
import { TextField } from '@lede/text-field';
import { ListGroup, ListRow } from '@lede/list';
import { LOOKS, useLook, useSetLook, type LookId } from '@/look-switcher';
import { RouterLink as Link } from '@/router-link';
import { CodeExample } from './CodeExample';
import { Scroll } from './Foundations';
import tokens from '../../../tokens/tokens.json';

/* SPIKE: how Lede takes a look, and the three example looks. Not linked from the nav yet; Overview's principles link here. */

interface Overlay { principle: string; keeps: ReactNode; changes: ReactNode }
interface Reference { label: string; href: string; note: string }
interface Look {
  id: Exclude<LookId, 'lede'>; name: string; tagline: string;
  about: ReactNode; references: Reference[]; overlay: Overlay[]; beyond: string[];
}

const PRINCIPLES: Overlay[] = [
  {
    principle: 'Hierarchy',
    keeps: 'Content leads and controls stay quiet. One filled Button per view and one large title per screen.',
    changes: 'How “floats above” is drawn. Lede uses glass and soft shadows; a look may use an offset shadow, a bevel or a rule.',
  },
  {
    principle: 'Harmony',
    keeps: <>Every radius still derives from <code>--radius</code> and <code>--radius-step</code>, so nested corners stay concentric, even at zero.</>,
    changes: 'The capsule, the corner size and the motion’s timing. Reduced motion still wins over any look.',
  },
  {
    principle: 'Consistency',
    keeps: 'Every look follows the person’s light or dark setting, motion and transparency preferences. With Increase contrast on, Lede’s high-contrast palette replaces the look’s colors.',
    changes: 'The palette in each of those settings.',
  },
  {
    principle: 'Progressive disclosure',
    keeps: 'Everything. A look doesn’t move, hide or reveal anything.',
    changes: 'Nothing.',
  },
  {
    principle: 'Semantic HTML',
    keeps: 'Everything. A look is CSS only: the same elements, keyboard paths, focus order and names for a screen reader.',
    changes: 'Nothing.',
  },
];

const LOOK_DETAILS: Look[] = [
  {
    id: 'skeuo', name: 'Skeuomorphic', tagline: 'Things that look like the objects they stand for.',
    about: (
      <>
        <p>A skeuomorph keeps the look of an older material after the material stops mattering: the stitched leather of an early calendar app, the brushed metal of a window frame, a button that seems to sit on the surface and sink when pressed. Interfaces leaned on it while touchscreens were new, because a control that looks pressable teaches itself. Flat design replaced it around 2013, and its ideas came back in softer form as depth, material and light.</p>
        <p>Here it means light from above: raised controls with a gradient and a bevel, fields and tracks set into the surface, embossed headings and a linen ground.</p>
      </>
    ),
    references: [
      { label: 'Skeuomorph', href: 'https://en.wikipedia.org/wiki/Skeuomorph', note: 'The term, from pottery and architecture to software.' },
      { label: 'Aqua (user interface)', href: 'https://en.wikipedia.org/wiki/Aqua_(user_interface)', note: 'Mac OS X’s glossy, lit controls, the high point of the style on the desktop.' },
      { label: 'Skeuomorphism in UX: what it is and why it disappeared', href: 'https://blog.logrocket.com/ux-design/skeuomorphism-ux-what-it-is-why-it-disappeared', note: 'Why it helped touch interfaces, and why iOS 7 left it.' },
      { label: 'What Apple learned from skeuomorphism', href: 'https://appleinsider.com/articles/22/08/23/what-apple-learned-from-skeuomorphism-and-why-it-still-matters', note: 'What survived into today’s depth and materials.' },
      { label: 'Abstraction vs skeuomorphism', href: 'https://thoughtbot.com/blog/abstraction-vs-skeuomorphism', note: 'When a real-world metaphor helps and when it gets in the way.' },
    ],
    overlay: [
      { principle: 'Hierarchy', keeps: 'One filled Button stands out most.', changes: 'It stands out by being the most lit and raised object, not only by color.' },
      { principle: 'Harmony', keeps: 'Corners stay concentric.', changes: 'Corners are small and fixed (10px), like machined parts, and a press sinks in place instead of shrinking.' },
      { principle: 'Consistency', keeps: 'Light and dark.', changes: 'Dark is lamplight on dark leather, not an inverted light theme.' },
    ],
    beyond: ['Embossed type on titles and the filled Button, which needs a text-shadow token.'],
  },
  {
    id: 'brutal', name: 'Neo-brutalist', tagline: 'Raw structure, shown on purpose.',
    about: (
      <>
        <p>Brutalist architecture left concrete bare and let the structure be the ornament. Brutalist websites took that idea to the web as plain HTML that doesn’t hide how it’s made. Neo-brutalism, which grew in product design from about 2020, keeps the honesty and adds color: thick black outlines, hard offset shadows with no blur, flat saturated fills, heavy grotesque type and no rounding.</p>
        <p>It reads as confident and a little loud, and it’s very clear about what you can press, because every control has a heavy edge and a shadow that collapses when pressed.</p>
      </>
    ),
    references: [
      { label: 'Brutalist architecture', href: 'https://en.wikipedia.org/wiki/Brutalist_architecture', note: 'Béton brut: the buildings the name comes from.' },
      { label: 'Neobrutalism: definition and best practices', href: 'https://www.nngroup.com/articles/neobrutalism/', note: 'Nielsen Norman Group on what defines it and where it hurts usability.' },
      { label: 'Brutalist Websites', href: 'https://brutalistwebsites.com', note: 'The collection that named brutalism on the web.' },
      { label: 'Neubrutalism, the definitive guide', href: 'https://manualdousuario.net/en/neubrutalism-web-design/', note: 'The traits in practice: borders, offset shadows, flat color.' },
      { label: 'Neo-brutalism, a guide to the trend', href: 'https://blog.hubspot.com/website/neo-brutalism', note: 'Examples from product sites that use it.' },
    ],
    overlay: [
      { principle: 'Hierarchy', keeps: 'One filled Button per view.', changes: 'Every control is loud, so the filled Button is told apart by its blue against everyone else’s yellow and white.' },
      { principle: 'Harmony', keeps: 'Corners stay concentric, at zero.', changes: 'Square everything, and motion in steps rather than springs, so movement looks mechanical.' },
      { principle: 'Consistency', keeps: 'Light and dark.', changes: 'Dark swaps black outlines for white ones and the blue accent for yellow.' },
    ],
    beyond: ['A tinted Button is yellow rather than a tint of the accent, which needs a tint-color token.', 'Row separators run edge to edge, which needs a separator-inset token.'],
  },
  {
    id: 'broadsheet', name: 'Broadsheet', tagline: 'A newspaper page: ink, newsprint and rules.',
    about: (
      <>
        <p>A broadsheet is a full-size newspaper, and its design is a few hundred years of practice in setting a lot of text so it’s easy to scan and to read. Headlines are bold serifs set tight. Body text is a serif made for long reading. Small, spaced capitals in a sans label the sections. Rules, not boxes, separate stories: a heavy rule over a section, hairlines between items and a thick-and-thin rule under a headline. Color is rare and means something.</p>
        <p>Lede is named after a newspaper term, the opening of a story that says what matters first. That’s also the Progressive disclosure principle, so this look is the closest to the system’s own idea.</p>
      </>
    ),
    references: [
      { label: 'Broadsheet', href: 'https://en.wikipedia.org/wiki/Broadsheet', note: 'The format and its conventions.' },
      { label: 'Newsreader, by Production Type', href: 'https://productiontype.com/family/newsreader', note: 'The serif used here: designed for reading news on screens, with an optical size axis for headlines and text.' },
      { label: 'Franklin Gothic', href: 'https://en.wikipedia.org/wiki/Franklin_Gothic', note: 'The American newspaper sans; Libre Franklin carries it here for labels and controls.' },
      { label: 'Blackletter', href: 'https://en.wikipedia.org/wiki/Blackletter', note: 'The script of newspaper nameplates, used here for the app’s name.' },
      { label: 'Tufte CSS', href: 'https://github.com/edwardtufte/tufte-css', note: 'Edward Tufte’s print conventions on the web: serif text, sidenotes, few boxes.' },
    ],
    overlay: [
      { principle: 'Hierarchy', keeps: 'Content leads.', changes: 'Type does all of it: headline size, small caps and rules. There are no shadows and no glass.' },
      { principle: 'Harmony', keeps: 'Corners stay concentric, at zero.', changes: 'Rules replace edges: a heavy rule over a list, dotted rules between rows and a column rule beside an open story.' },
      { principle: 'Progressive disclosure', keeps: 'The takeaway first.', changes: 'It’s marked the way a paper marks it: a headline, then a drop cap where the story starts.' },
    ],
    beyond: [
      'The blackletter nameplate.',
      'Lists and cards with no fill, so the paper runs under them.',
      'A double rule under the page title, a column rule beside the open message and a drop cap.',
      'Old-style figures in text and lining figures in tables.',
      'The current place in the left bar marked by a rule instead of a raised card.',
    ],
  },
];

const LOOK_TOKENS = tokens.look.tokens;
const RECIPE = `/* 1. Colors and the other theme tokens, light and dark. */
[data-look="mine"] .ld-theme[data-theme] {
  --preset-blue: #b0161e;           /* the default accent */
  --background-grouped: #f8f4ea;
  --radius: 0px;
  --font-sans: "Newsreader Variable", Georgia, serif;

  /* 2. The look-* tokens: what changes beyond color and size. */
  --look-ui-font: "Libre Franklin Variable", sans-serif;
  --look-surface-edge: inset 0 2px 0 var(--foreground);
  --look-press: none;
  --look-label-case: uppercase;
}
[data-look="mine"] .ld-theme[data-theme^="dark"] {
  --preset-blue: #ff7a6b;
  --background-grouped: #15120f;
}

/* 3. Only what no token reaches. Each rule here is a request for a token. */`;

const Usage = ({ text }: { text: string }) => <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;

function OverlayTable({ rows, caption }: { rows: Overlay[]; caption: string }) {
  return (
    <Scroll label={caption}>
      <table className="docs-table">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Principle</th><th scope="col">Every look keeps</th><th scope="col">A look may change</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.principle}><th scope="row">{r.principle}</th><td>{r.keeps}</td><td>{r.changes}</td></tr>)}</tbody>
      </table>
    </Scroll>
  );
}

/** The same few components, live, in whichever look is chosen. */
function Sampler() {
  return (
    <div className="docs-looks-sampler">
      <div className="docs-demo">
        <Button variant="filled">Publish</Button>
        <Button variant="tinted">Save draft</Button>
        <Button variant="gray">Cancel</Button>
        <Switch label="Notify subscribers" defaultChecked />
      </div>
      <SegmentedControl label="Edition" options={['Morning', 'Evening', 'Weekend']} defaultValue="Morning" />
      <TextField label="Headline" defaultValue="City council approves the new library" />
      <ListGroup title="Front page" headingLevel={3}>
        <ListRow title="City council approves the new library" subtitle="Metro · 6 min read" value="A1" chevron href="#sampler" />
        <ListRow title="Harbor cleanup reaches its second mile" subtitle="Environment · 4 min read" value="A3" chevron href="#sampler" />
      </ListGroup>
    </div>
  );
}

export function Looks() {
  const look = useLook();
  const setLook = useSetLook();
  return (
    <div>
      <PageHeader title="Looks" back={{ href: '/', label: 'Overview' }} summary="A look changes how Lede appears and keeps how it works." />
      <p className="docs-intro">
        A look is a whole visual style laid over the same components. It changes color, type, edges, depth and texture. It never changes markup, behavior or what a screen reader hears. Pick one here and the whole site follows, this page included.
      </p>

      <section aria-labelledby="sampler" className="docs-section">
        <h2 id="sampler" className="text-title-3 docs-target">Try a look</h2>
        <SegmentedControl label="Look" options={LOOKS.map((l) => ({ value: l.id, label: l.name }))} value={look} onValueChange={(v) => setLook(v as LookId)} block />
        <Sampler />
        <p className="docs-note">The app shows each look on real screens: <Link href="/app/inbox/m1">the inbox</Link>, <Link href="/app/settings/appearance">Appearance</Link> and <Link href="/layouts/workbench">the workbench</Link>.</p>
      </section>

      <section aria-labelledby="principles" className="docs-section">
        <h2 id="principles" className="text-title-3 docs-target">How a look sits on the principles</h2>
        <p className="docs-intro">Lede’s principles hold in every look. Some describe structure and behavior, which a look can’t reach. Others describe appearance, where a look gives the same idea its own voice.</p>
        <OverlayTable rows={PRINCIPLES} caption="Lede’s principles, in any look" />
        <Disclosure title="Rules for a look" summary="Five rules every look follows" headingLevel={3}>
          <ul className="docs-rules">
            <li>Change values, not structure. If a look needs a rule that reaches into a component, that rule is a request for a token.</li>
            <li>Every look has a light and a dark palette, and follows the person’s setting.</li>
            <li>Text and controls meet Lede’s contrast floors in every look.</li>
            <li>The focus ring stays visible and at least <code>--stroke-ring</code> wide.</li>
            <li>State never rests on color alone: a selected, pressed or invalid control changes shape, edge or weight too.</li>
          </ul>
        </Disclosure>
      </section>

      <section aria-labelledby="make" className="docs-section">
        <h2 id="make" className="text-title-3 docs-target">Make a look</h2>
        <ol className="docs-steps">
          <li><p>Set <code>data-look</code> on <code>{'<html>'}</code>, or on any ancestor of your ThemeProvider.</p></li>
          <li><p>Set the theme tokens under <code>[data-look] .ld-theme[data-theme]</code>, once for light and again for dark. ThemeProvider sets <code>--primary</code> from the accent preset, so set the preset, such as <code>--preset-blue</code>.</p></li>
          <li><p>Set the <code>look-*</code> tokens for edges, depth, sheen, the pressed state, letter case, the interface’s face and texture. A value that names a color goes in the same block as the colors, so it follows light and dark.</p></li>
          <li><p>Write CSS for anything left, and keep it short. Each rule is a gap in the tokens.</p></li>
        </ol>
        <CodeExample label="A look’s CSS" language="css" code={RECIPE} />
        <Scroll label="The look tokens">
          <table className="docs-table">
            <caption>The <code>look-*</code> tokens. Each default draws Lede’s own look.</caption>
            <thead><tr><th scope="col">Token</th><th scope="col">Default</th><th scope="col">What it changes</th></tr></thead>
            <tbody>{LOOK_TOKENS.map((t) => <tr key={t.name}><th scope="row"><code>--{t.name}</code></th><td><code>{/^\{.+\}$/.test(t.value) ? `var(--${t.value.slice(1, -1)})` : t.value}</code></td><td><Usage text={t.usage} /></td></tr>)}</tbody>
          </table>
        </Scroll>
      </section>

      {LOOK_DETAILS.map((l) => (
        <section key={l.id} aria-labelledby={`look-${l.id}`} className="docs-section">
          <h2 id={`look-${l.id}`} className="text-title-3 docs-target">{l.name}</h2>
          <p className="docs-intro">{l.tagline}</p>
          <div className="docs-looks-about">{l.about}</div>
          <p className="docs-actions">
            <Button variant={look === l.id ? 'gray' : 'tinted'} onClick={() => setLook(l.id)} aria-pressed={look === l.id}>
              {look === l.id ? `${l.name} is on` : `Use ${l.name}`}
            </Button>
          </p>
          <Disclosure title="Where it comes from" summary={`${l.references.length} references`} headingLevel={3}>
            <ul className="docs-rules">{l.references.map((r) => <li key={r.href}><a href={r.href}>{r.label}</a>. {r.note}</li>)}</ul>
          </Disclosure>
          <Disclosure title="How it voices the principles" summary="What it keeps and what it changes" headingLevel={3}>
            <OverlayTable rows={l.overlay} caption={`${l.name}, principle by principle`} />
          </Disclosure>
          <Disclosure title="What the tokens don’t reach yet" summary={`${l.beyond.length} ${l.beyond.length === 1 ? 'rule' : 'rules'} of its own`} headingLevel={3}>
            <ul className="docs-rules">{l.beyond.map((b) => <li key={b}>{b}</li>)}</ul>
          </Disclosure>
        </section>
      ))}
    </div>
  );
}
