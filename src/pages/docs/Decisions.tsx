import { Fragment, type ReactNode } from 'react';
import { PageHeader } from '@lede/blocks/page-header';
import { Disclosure } from '@lede/disclosure';
import { tokenFamilies } from './Foundations';
import tokens from '../../../tokens/tokens.json';
import { floors, fills } from '../../../tokens/contrast.json';
import exceptions from '../../../tokens/literal-exceptions.json';
import registry from '../../../registry.json';

interface Decision { title: string; summary: ReactNode; why: ReactNode; cost: ReactNode; heldBy: ReactNode[] }
interface Group { id: string; title: string; decisions: Decision[] }

const { text, control } = floors;
const THEMES = tokens.color.themes.length;
const ACCENTS = tokens.color.tokens.filter((t) => t.name.startsWith('preset-')).length;
const NOT_CONTROLS = Object.keys(fills.notControls).length;
const REFLOW = tokens.breakpoint.tokens.find((t) => t.name === 'breakpoint-reflow')!.value;
const breakpoint = (name: string) => tokens.breakpoint.tokens.find((t) => t.name === `breakpoint-${name}`)!.value;
const atDefault = (em: string) => `${parseFloat(em) * 16}px`;
const [SIDEBAR, SPLIT] = [breakpoint('sidebar'), breakpoint('split')];
// "@base-ui/react@^1.9.0" is the package "@base-ui/react".
const PACKAGES = [...new Set(registry.items.flatMap((item) => item.dependencies ?? []))].map((dep) => dep.replace(/(.)@[^@]*$/, '$1'));

/** "a, b and c", each in code: Lede’s lists have no serial comma. */
const codeList = (names: string[]) => names.map((name, i) => (
  <Fragment key={name}>{i === 0 ? '' : i === names.length - 1 ? ' and ' : ', '}<code>{name}</code></Fragment>
));

const GROUPS: Group[] = [
  {
    id: 'markup', title: 'Markup',
    decisions: [
      {
        title: 'Semantic HTML first',
        summary: 'Each component starts from the native element, and Base UI fills in where HTML has no control for the job.',
        why: <>A native element brings its keyboard handling, form behavior and screen-reader semantics from the browser. SegmentedControl is a <code>{'<fieldset>'}</code> of radio inputs, and Checkbox is an <code>{'<input type="checkbox">'}</code>.</>,
        cost: <>The browser draws parts of a native control itself. The sort on a data table’s cards is a <code>{'<select>'}</code>, and its open list is the browser’s own.</>,
        heldBy: [
          <>The Semantic HTML rule in <code>CLAUDE.md</code>, in review.</>,
          <>axe, run on every route in all {THEMES} themes by <code>tests/a11y.spec.ts</code>, first with every Disclosure and collapsible table closed and then with each one open, fails a control inside a button, a control without a name and ARIA that an element’s role doesn’t allow.</>,
        ],
      },
      {
        title: 'One h1 per screen',
        summary: <>Every screen has one <code>{'<h1>'}</code>, its regions are named and its headings step down one level at a time.</>,
        why: 'Screen-reader users move through a page by heading and by landmark, so the outline is how they find their way around it.',
        cost: <>A component that can sit at more than one depth takes its heading level as a prop, such as Disclosure’s <code>headingLevel</code>, so the page that places it keeps the outline in order.</>,
        heldBy: [
          <><code>tests/a11y.spec.ts</code> loads every route in all {THEMES} themes and expects exactly one visible <code>{'<h1>'}</code>.</>,
          <>In the same test, axe’s <code>heading-order</code> rule fails a skipped level, and <code>landmark-unique</code> fails two landmarks of one kind with the same name.</>,
          <>The One h1 rule in <code>CLAUDE.md</code>, in review, for naming each region.</>,
        ],
      },
    ],
  },
  {
    id: 'accessibility', title: 'Accessibility',
    decisions: [
      {
        title: 'Contrast is measured',
        summary: `Every color is measured on what it sits on. Text needs ${text.standard}:1 and controls ${control.standard}:1, and text in the high-contrast themes needs ${text.hc}:1.`,
        why: 'Contrast decides whether people with low vision can read text and find controls. axe, as the tests run it, checks only the text on screen and only at AA, so the build measures every pair itself.',
        cost: <>Every color needs a pair. A new color token or <code>color-mix()</code> fails the build until <code>tokens/contrast.json</code> says what it sits on. Glass in light and dark holds only <code>foreground</code>, <code>--ld-destructive-on-tint</code> and the ring over content of any color, and to hold those its tint is 0.78 and 0.88 opaque.</>,
        heldBy: [
          <><code>npm run contrast</code> (<code>scripts/check-contrast.mjs</code>), part of every build, measures each pair in all {THEMES} themes and with each of the {ACCENTS} accent presets standing in for primary, and fails any pair under its floor.</>,
          <>Its -hc fill walk reads every rule in <code>registry/</code> that paints a control fill and fails one with no <code>--input</code> edge in -hc. Fields, selects, Switch tracks and the selected segment draw that edge in light and dark too, and the walk fails one that draws it only in -hc. <code>tokens/contrast.json</code> lists {NOT_CONTROLS} rules whose fill isn’t a control, each with its reason.</>,
          <>Its knob edge read measures a switch knob by its fill or the 1px edge that starts <code>shadow-knob</code>, whichever is stronger.</>,
          <><code>tests/contrast-gate.spec.ts</code> runs the gate on altered copies of its inputs, an -hc edge removed and a knob without its edge among them.</>,
        ],
      },
      {
        title: 'Large text reflows',
        summary: 'At 200% browser text on a phone, no page scrolls sideways, rows keep their text clear of their values and text is cut off only where a component truncates it on purpose. At 360px and 412px wide, no page grows wider than at 100%.',
        why: 'Type sizes are in rem, so they follow the reader’s text size setting, and every layout makes room for that.',
        cost: <>Large text makes a screen longer. A row’s value moves under its title when the two don’t fit side by side. In a window under {REFLOW} of the browser’s text size (<code>breakpoint-reflow</code>), a row’s subtitle wraps, a group’s summary moves under its title the same way and SummaryCard’s figure takes the smaller <code>title-1</code>. GlassBar’s labels stop growing at their default size, so its places still fit. SelectionBar wraps its count and actions onto lines of their own.</>,
        heldBy: [
          <><code>tests/reflow.spec.ts</code> loads every route at 200% text at 320, 390 and 412px wide, and the workbench at 300% at 320, 390 and 412px. It reads each route first with every Disclosure and collapsible table closed and then with each one open, since a closed panel’s text takes no space. It fails on a page that scrolls sideways, text cut off by a box that clips it, a row’s title or subtitle under its value and a title beside its value narrower than its longest word. A component’s own ellipsis or line clamp passes, except on a row subtitle (an inbox preview aside), the workbench’s title and a select’s chosen option, which must show in full.</>,
          <><code>tests/a11y.spec.ts</code> checks that no page is wider at 200% text than at 100%, at the phone widths it tests.</>,
          <>The same spec selects a message at 200% and 300% text on phones and fails when a SelectionBar label is cut off, two of its parts cross or a part leaves the screen. It also fails when SelectionBar reaches down over the tab bar.</>,
          <>CI runs both on Linux. A page that fits with macOS fonts can fail there, and the Linux container that <code>CONTRIBUTING.md</code> describes, with DejaVu Sans, reproduces those failures. Reflow results come from CI or that container.</>,
        ],
      },
      {
        title: 'Breakpoints follow text size',
        summary: <>Window breakpoints are in em of the browser’s text size, so at 200% text a layout changes at twice the window width. At the default size they fall where they did in px: the sidebar at {SIDEBAR} ({atDefault(SIDEBAR)}) and side-by-side panes at {SPLIT} ({atDefault(SPLIT)}).</>,
        why: 'Text at twice the size needs the room a window half as wide would give it, so the layout a phone gets is the one that fits.',
        cost: <>At 200% text a 1280px window shows the tab bar and one pane at a time. DataTable’s card width (<code>breakpoint-card-narrow</code>) stays in px, because em in a container query is the container’s font size. A text-size change on an open page moves the CSS at once, but takes effect in script on reload: Chromium sends no <code>change</code> event for it, so <code>useStackedPanes</code> keeps its old answer until then.</>,
        heldBy: [
          <><code>npm run literals</code> fails on a number in a media query that isn’t a breakpoint in that breakpoint’s unit, so a window breakpoint left in px fails the build.</>,
          <><code>tests/reflow.spec.ts</code> opens <code>/app/inbox</code> and <code>/layouts/workbench</code> in a 1280px window at 100% and 200% text, and checks the tab bar, the sidebar and how many workbench panels show. The script hides the workbench’s panels, so the test also holds <code>useStackedPanes</code> to the CSS.</>,
          <>The same spec opens a message at 1024px and checks it shows without its list, and opens the docs site’s layouts at 1280px and 200% text and checks the previews start at Narrow.</>,
        ],
      },
      {
        title: 'Hit areas are measured',
        summary: <>Every control answers a press over at least 24×24px in every density, and over 44×44px in <code>touch</code>. Wherever a finger can be used, a row’s ••• answers over 44×44px too.</>,
        why: 'A target is the area a press reaches, which can be larger than the box that’s drawn, so it’s measured where the press lands. A small control drawn at its size keeps a dense layout dense and still takes a finger.',
        cost: <><code>touch</code> makes controls 36, 44 and 56px tall, and the ••• 44px, so screens are longer. Small Buttons, SegmentedControl options and AppShell footer links reach the hit area with an overhang that a neighbor closer than half the difference would share. On a phone in <code>regular</code> the row •••’s overhang takes 2px of the row link, and the check lets a neighbor take up to 4px of a target’s edge. A link inside a sentence and a row slid aside to show its actions are exempt.</>,
        heldBy: [
          <><code>tests/hit-area.spec.ts</code> presses around the center of every link, button, input, select and divider on every route, in each density, with <code>elementFromPoint</code>, so a pseudo-element’s hit area counts and a neighbor’s doesn’t. On a phone it also checks the ••• in <code>regular</code> and <code>compact</code>.</>,
        ],
      },
      {
        title: 'Focus lands on purpose',
        summary: <>Focus moves to a new screen’s <code>{'<h1>'}</code> or to the title of what a link opens (an Inbox message, say), to the first field that needs fixing and back to the control that opened a menu or a form. A step that asks for typing, a choice or a confirmation lands on its field, its chosen option or its primary button, so Enter moves on. It stays on a sort control, switch, radio group, checkbox or Disclosure that changes in place, and paging moves it to the new page. A removal keeps the reader’s place on the row that took the removed one’s place, and Undo lands on what it brought back. Back, Forward and a back link return it to where the person was.</>,
        why: 'Keyboard and screen-reader users carry on from wherever focus is, so it goes where the next step starts.',
        cost: <>A component that removes the focused control has to say where focus goes next. After an archive, InboxFlow and DataTable move focus to the next row, or the list’s heading or the table’s summary line when nothing is left, and Inbox’s notice holds the top of the list so its Undo stays in view. Each new screen or action adds its rows to <code>tests/focus-table.ts</code>. The demo app finds a returning element again by its tag and its href or name, so an element that comes back renamed falls back to the screen’s heading, and a screen whose rows load later, such as Work, calls <code>restoreFocus()</code> once they’re in. Its heading holds focus until then, so focus moves twice there: the h1, then the row. WorkPage moves focus to its heading in a layout effect when a failure’s controls leave. No check tells it from <code>useEffect</code> under React 19.2, which runs that commit’s passive effects inside it too, after Dismiss and after Try again’s reply (observed). The layout effect keeps the move from resting on React’s scheduling. One gap is known: a PageHeader that <code>{'<Activity>'}</code> prerendered keeps focus off its heading when it’s revealed while a control inside <code>{'<main>'}</code> has focus.</>,
        heldBy: [
          <><code>tests/focus-table.ts</code> says where focus lands on each route and after each action. <code>tests/focus-arrival.spec.ts</code>, <code>tests/focus-actions.spec.ts</code> and <code>tests/keyboard-paths.spec.ts</code> run its rows by keyboard on desktop and by touch on a phone. They check each landing, the Tab stops around it and that Enter and Escape do nothing where nothing should happen.</>,
          <>A row marked <code>test.fixme</code> is behavior that isn’t built yet. It names the keyboard PR that builds it and enforces nothing until that PR turns it on.</>,
          <><code>tests/focus-trail.ts</code> samples the focused element on every frame, and a row fails when a frame shows <code>{'<body>'}</code> on the way to a landing. On a route change it holds because PageHeader focuses its heading in the same commit, after any other move.</>,
          <>An in-page link’s target has <code>tabindex="-1"</code>, so the browser moves focus there along with the view. <code>tests/focus-actions.spec.ts</code> checks the sidebar layout’s Projects link.</>,
          <><code>src/focus-restoration.ts</code> records the last element focused inside <code>{'<main>'}</code> on each history entry and focuses it again on Back, Forward and a link to the entry just before, such as a back link. InboxFlow returns a closed message to its row itself. The arrival table’s Back column and the back-link rows in <code>tests/focus-actions.spec.ts</code> check both.</>,
          <>The <code>strict-desktop</code> and <code>strict-phone</code> projects run the focus and keyboard specs against React’s development build, where StrictMode runs each effect twice, as <code>npm run dev</code> and most apps in development do. A production build runs each effect once, so it can’t show a move lost to the second run. The cost is a second build on each test runner and the focus rows run twice (<code>playwright.config.ts</code>).</>,
          <>PageHeader focuses its heading on mount only when the document has focus, so it never pulls focus into an embedded frame or a background tab (<code>registry/lede/blocks/page-header.tsx</code>). <code>tests/focus-arrival.spec.ts</code>, <code>tests/onboarding.spec.ts</code> and <code>tests/a11y.spec.ts</code> check the heading has focus.</>,
          <>The profile and onboarding forms focus the first invalid field when a submit fails. <code>tests/profile.spec.ts</code> checks the profile’s Name, Email and Short bio, and <code>tests/focus-actions.spec.ts</code> checks onboarding’s Name and Email.</>,
          <>Escape backs out one layer per press. PageHeader’s <code>backOnEscape</code> activates the back link, and an open menu or dialog, an IME composition or a field the person changed keeps its Escape first. InboxFlow ends selection mode, then closes the open message, and ProfileFlow cancels an unchanged edit. The <code>escape</code> column of <code>tests/focus-table.ts</code> and the layer tests in <code>tests/keyboard-paths.spec.ts</code> check each one.</>,
          <>DataTable’s Next and Previous move focus to the summary line above the new page, and Load more moves it to the first new row, in the commit that renders them. The paging rows in <code>tests/focus-table.ts</code> check every frame from the press to the landing, in client and server mode, in Work and on the docs page.</>,
          <>Enter acts. OnboardingFlow runs on Enter from Replay onboarding to Today: each step is a native <code>{'<form>'}</code>, its arrival target takes focus in the commit that shows it, and PageHeader yields to that move. Lede’s Switch submits its form on Enter, as a checkbox does. On touch, Daybook starts Account at its h1, so the on-screen keyboard doesn’t cover the step (<code>registry/lede/input-modality.ts</code>). The <code>enter</code> column of <code>tests/focus-table.ts</code> and the onboarding tests in <code>tests/keyboard-paths.spec.ts</code> check each step.</>,
          <>Menus come from Base UI, which returns focus to the trigger when a menu closes. <code>tests/row-menu.spec.ts</code> checks this on a data table row and <code>tests/focus-actions.spec.ts</code> on an Inbox row.</>,
          <>A removal keeps the reader’s place. InboxFlow and DataTable move focus to the row that took the removed one’s place, else the one before, in the commit that takes the row away, so no frame shows <code>{'<body>'}</code>. Below the sidebar’s breakpoint a focus target scrolls clear of the tab bar. The removal rows in <code>tests/focus-table.ts</code>, <code>tests/a11y.spec.ts</code> and the 32px tests in <code>tests/inbox.spec.ts</code> check the landing, the tab bar and the sticky notice. An Undo whose restore renders later keeps focus on its button until the messages are back, and a DataTable’s Done whose checkbox has gone, as it does when the table becomes cards, lands on the summary line. Side by side, Enter on the open message’s row moves focus to its title.</>,
        ],
      },
      {
        title: 'A title shows the ring after a key press',
        summary: <>When focus lands on a screen’s title after a key press, such as Enter on a link, Escape or Back, the title shows Lede’s focus ring. After a click, a tap or a cold load it shows none.</>,
        why: 'A sighted keyboard user who presses Back or Escape needs to see where focus went before pressing Tab. Someone who clicked or tapped already knows where they are, and a ring around the title on every page load would only be noise.',
        cost: <>Chromium matches <code>:focus-visible</code> on an element that script focuses before any input, as on a cold load, so the CSS alone would ring the title on every cold load. It matches after a click on a link that keys had focused, too. <code>focusLanding()</code> in <code>registry/lede/input-modality.ts</code>, part of <code>lede-utils</code>, focuses with <code>focusVisible: false</code> unless the most recent input was a key press. PageHeader’s <code>{'<h1>'}</code>, InboxFlow’s message title and WorkbenchShell’s <code>{'<h1>'}</code> land through it, so one listener holds the state for all three.</>,
        heldBy: [
          <>Every arrival row in <code>tests/focus-table.ts</code> checks the title it lands on. On desktop, reached by Enter on a link, Back or Forward, it shows the ring. After a cold load, and on a phone after a tap, it shows none. The row that opens a message from its row checks the message title the same way.</>,
          <><code>tests/focus-arrival.spec.ts</code> checks that a click into a page, Back after it, a click on a message and a click on a link that keys had focused show no ring. It checks that Escape after a click shows it, and that the ring shows while the key is still down. Each ring is read as an outline in the color of <code>--ring</code>.</>,
        ],
      },
      {
        title: 'Announcements',
        summary: 'InboxFlow’s notices and DataTable’s sort announcements go into a live region that was on the page before the message arrived.',
        why: 'Screen readers announce a change to a live region they already know about, so a region that arrives with its text can go unheard.',
        cost: <>Both announce through <code>@react-aria/live-announcer</code>, one more package to install. Its region sits outside every pane, so InboxFlow’s notice is heard while a narrow screen shows a message. DataTable’s refresh notice is the exception: it mounts with its text.</>,
        heldBy: [
          <><code>tests/spoken.ts</code> records each text added to a live region, with whether the region was already there and rendered.</>,
          <><code>tests/demo-state.spec.ts</code> uses it to check that a deleted message’s notice reaches such a region, and <code>tests/inbox.spec.ts</code> that each notice is spoken once.</>,
          <><code>tests/data-table.spec.ts</code> checks that a sort’s announcement reaches the announcer’s polite region.</>,
        ],
      },
      {
        title: 'Reader preferences',
        summary: 'Reduced motion, reduced transparency, more contrast and forced colors each change how Lede draws.',
        why: 'People turn these settings on because they need them, and a setting made once in the browser reaches every component.',
        cost: <>Reduced motion’s values are <code>!important</code> on <code>:root</code> and on every theme root, so a project that retunes a motion token, through ThemeProvider’s <code>tokens</code> too, still gets reduced motion. Forced colors remove backgrounds and shadows, so buttons, cards and other filled shapes carry a border there.</>,
        heldBy: [
          <><code>tests/reduced-motion.spec.ts</code> checks for 1ms and a linear spring under reduced motion, with motion tokens a project sets after Lede.</>,
          <><code>tests/forced-colours.spec.ts</code> checks that each control on the routes it walks keeps a boundary, a focus ring and a state beyond font weight, and that each edge drawn with <code>box-shadow</code>, in any theme, has a twin in forced colors.</>,
          <><code>tests/theme-scope.spec.ts</code> checks that <code>prefers-contrast: more</code> moves each provider to its high-contrast theme.</>,
          <>Under reduced transparency, glass draws as a solid card. That’s one rule in <code>lede.components.css</code>, held in review.</>,
        ],
      },
    ],
  },
  {
    id: 'tokens', title: 'Tokens',
    decisions: [
      {
        title: 'Tokens only',
        summary: <>Every number and color in registry CSS comes from <code>tokens/tokens.json</code> or from an exception that says why.</>,
        why: <>One source makes a theme, a density or a corner shape a single change that every component follows. The file holds all {tokenFamilies.count} token families, and <code>npm run tokens</code> generates the CSS from it, so the two can’t drift apart.</>,
        cost: 'A new value needs a token, or an exception with its reason. A media query can’t read a custom property, so breakpoints are written out as numbers, and the gate matches each one to its token.',
        heldBy: [
          <><code>npm run literals</code> (<code>scripts/check-literals.mjs</code>), part of every build, fails on a number or color in registry CSS that comes from no token.</>,
          <><code>tokens/literal-exceptions.json</code> holds {exceptions.length} exceptions, each with its reason, and the gate fails one that matches nothing.</>,
          <><code>tests/literal-gate.spec.ts</code> runs the gate on altered copies of the CSS.</>,
        ],
      },
      {
        title: 'Overlays keep their theme',
        summary: 'Every overlay puts ThemeScope directly inside its portal.',
        why: 'A portal renders outside its ThemeProvider’s wrapper, so without a scope an overlay loses the theme around it.',
        cost: 'An overlay a project builds itself needs ThemeScope too. The Components page shows how.',
        heldBy: [
          <><code>tests/theme-scope.spec.ts</code> reads every file under <code>registry/</code> and fails a <code>.Portal</code> without ThemeScope directly inside it, and any <code>createPortal</code>.</>,
          'The same file opens menus inside the site’s provider and nested ones, in every theme, and checks that each takes its own provider’s theme.',
        ],
      },
    ],
  },
  {
    id: 'api', title: 'API',
    decisions: [
      {
        title: 'Consistent names',
        summary: <>A heading prop is <code>title</code>, and a value callback is named for its prop: <code>value</code> and <code>onValueChange</code>, <code>open</code> and <code>onOpenChange</code>.</>,
        why: <>Names that follow one pattern can be guessed from the ones you know. HTML’s names stay where the meaning matches, such as <code>onChange</code> on a wrapper that passes native input props through. Classes start <code>ld-</code> and component custom properties <code>--ld-</code>, which keeps them apart from a project’s own.</>,
        cost: <>A rename keeps its old name for one release, marked <code>@deprecated</code> with the release that removes it, and the new name wins when both are passed.</>,
        heldBy: [
          <>The Names and Prefixes rules in <code>CLAUDE.md</code>, in review. Names also covers registry titles, which name the components you import.</>,
          <>Color that carries meaning is a <code>tone</code> declared with <code>ToneSubset</code>, so a value outside <code>Tone</code> fails the build’s typecheck.</>,
        ],
      },
      {
        title: 'Flows are router-agnostic',
        summary: 'A flow takes its data, hrefs and callbacks from the app. It fetches nothing and imports no router.',
        why: <>A flow drops into any React app, whatever its router or data layer. Its links render through LinkProvider, so they use the app’s own link component.</>,
        cost: <>The app does the wiring: fetching, routing and saving. Daybook’s pages in <code>src/pages/app/</code> show it for each flow.</>,
        heldBy: [
          <>The layer rule in <code>CLAUDE.md</code>, in review.</>,
          <><code>scripts/check-registry.mjs</code>, part of every build, fails a registry file whose relative import isn’t installed with it. The site’s <code>@/</code> and <code>@lede/</code> aliases fail there too, so a flow can’t import the docs site’s code.</>,
        ],
      },
    ],
  },
  {
    id: 'footprint', title: 'Footprint',
    decisions: [
      {
        title: 'Few dependencies',
        summary: `The registry installs ${PACKAGES.length} packages besides React, and every component arrives as source in your project.`,
        why: 'Source in your project can be read and changed like your own code. Each package is one more to keep up to date.',
        cost: <>Moving to a later tag runs the same <code>add</code> with <code>-o</code>, which overwrites your copies, edits included.</>,
        heldBy: [
          <>Review. Each item lists its packages under <code>dependencies</code> in <code>registry.json</code>, which this page reads: {codeList(PACKAGES)}.</>,
        ],
      },
      {
        title: 'Performance has a budget',
        summary: <>DataTable is timed against a plain <code>{'<table>'}</code> with the same rows, and the tests fail when it falls too far behind.</>,
        why: 'Each feature adds work for every row. Times depend on the machine, so the budget is a ratio to a plain table measured in the same browser.',
        cost: 'The ratio varies from machine to machine, so the budget catches a large regression. A smaller one shows in the ratios the test logs.',
        heldBy: [
          <><code>tests/perf-budget.spec.ts</code> mounts and sorts both tables in turn and compares the median ratios with its budget. It runs alone, so nothing else competes for the CPU: after the other projects locally, and on a runner of its own in CI.</>,
        ],
      },
    ],
  },
  {
    id: 'checks', title: 'Checks',
    decisions: [
      {
        title: 'Each check is seen failing',
        summary: 'Each new or changed test or gate is shown failing once in review, on a broken copy of the code it guards.',
        why: 'A check seen only passing can pass whatever the code does. A failure on a known break shows that it reads what it claims to.',
        cost: 'A pull request that adds or changes a check takes one more run, on a mutant it names, and then puts the code back.',
        heldBy: [
          <>The “Before you open a pull request” section of <code>CONTRIBUTING.md</code>, in review.</>,
          <><code>tests/contrast-gate.spec.ts</code> and <code>tests/literal-gate.spec.ts</code> run their gates on altered copies of their inputs, so those two keep their mutants in the suite.</>,
        ],
      },
    ],
  },
  {
    id: 'writing', title: 'Writing',
    decisions: [
      {
        title: 'One plain voice',
        summary: 'Everything Lede says leads with its takeaway, in plain US English.',
        why: 'Text that says what a thing is, what it’s for and how to use it leaves the judgment to the reader. Summaries are at most two sentences. The text has no marketing words, no contrast framing and no serial comma, rendered strings use curly quotes and dates follow en-US.',
        cost: 'No script checks prose, so each change’s text is read against the rules in review.',
        heldBy: [<>The Writing section of <code>CONTRIBUTING.md</code>, in review.</>],
      },
      {
        title: 'Released notes stay as shipped',
        summary: <>New changelog lines go under <code>## Unreleased</code>, and a released section stays as it shipped.</>,
        why: 'A consumer reads a released section as the record of what that version did, so editing it later changes the record they upgraded from.',
        cost: <>A correction to a released note is a new line under <code>## Unreleased</code>.</>,
        heldBy: [<>The “Before you open a pull request” section of <code>CONTRIBUTING.md</code>, in review.</>],
      },
    ],
  },
];

/** For the Overview's card. */
export const decisionCount = GROUPS.reduce((sum, group) => sum + group.decisions.length, 0);

export function Decisions() {
  return (
    <div className="ld-flow">
      <PageHeader title="Decisions" back={{ href: '/', label: 'Overview' }} summary="What Lede decided about how it’s built and why. Each decision names its cost and the check that holds it." />
      {GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={group.id} className="docs-section">
          <h2 id={group.id} className="text-title-3">{group.title}</h2>
          {group.decisions.map((d) => (
            <Disclosure key={d.title} title={d.title} summary={d.summary} headingLevel={3} className="wrap-anywhere">
              <dl className="docs-regions">
                <div><dt className="text-muted-foreground">Why</dt><dd>{d.why}</dd></div>
                <div><dt className="text-muted-foreground">Cost</dt><dd>{d.cost}</dd></div>
                <div>
                  <dt className="text-muted-foreground">Held by</dt>
                  <dd>{d.heldBy.length > 1 ? <ul className="docs-rules list-disc">{d.heldBy.map((h, i) => <li key={i}>{h}</li>)}</ul> : d.heldBy[0]}</dd>
                </div>
              </dl>
            </Disclosure>
          ))}
        </section>
      ))}
    </div>
  );
}
