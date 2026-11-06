# Changelog

## 0.4.0

0.4.0 is the first public release, installed from `https://lede.cloudcompute.com/r/v0.4.0/{name}.json`. It removes
the names 0.3.0 deprecated and `clear` glass, and `SettingsGroup`'s `title` and AppearanceFlow's `onValueChange` are
now required. Escape and Enter act, focus lands where the person acts next in every flow, a `touch` density sizes
controls for a finger and breakpoints follow the browser's text size.

### Upgrading

From 0.3.0, rename what the Removed table lists, pass the props that are now required and replace `glass="clear"`.
TypeScript reports each of them.

From 0.2.0, do the same, and check the places 0.3.0 changed, which this file doesn't repeat:

- DataTable's parts `Cards`, `DataRow` and `Pager`, rendered on their own, require `locale`. Pass `undefined` for the
  browser's locale.
- Type is in rem, so text follows the browser's text size and a project's own `html { font-size }`. A smaller root
  shrinks Lede's text.
- Button, TextField and GlassToolbarButton set a minimum height in place of a fixed one, and a label can wrap, so
  larger text makes them taller.
- Some of Lede's text changed, so a test that matches it can need an update.

### Removed

0.3.0 deprecated these names, and 0.4.0 removes them.

| Removed | Use |
| --- | --- |
| DailyBrief | DailyBriefFlow |
| `DailyBriefProps` | `DailyBriefFlowProps` |
| SettingsHome | SettingsFlow |
| `SettingsHomeProps` | `SettingsFlowProps` |
| AppearanceSettings | AppearanceFlow |
| `AppearanceSettingsProps` | `AppearanceFlowProps` |
| ListGroup `header` | `title` |
| `SettingsGroup` `header` | `title`, now required |
| AppearanceFlow `onChange` | `onValueChange`, now required |
| ThemeProvider `onAccent` | `accentForeground` |
| OnboardingFlow `initial` | `defaultValue` |

### Breaking

- `SettingsGroup`'s `title` and AppearanceFlow's `onValueChange` are required.
- ThemeProvider's `glass` takes `'regular'` or `'solid'`. `'clear'` is gone: in every theme little could be read on it
  over content of any color, so a leftover `data-glass="clear"` draws as `regular`.

### Added

- Lede has a mark: a heavy line over two light ones on a `primary` tile. The docs site uses it for its favicon and
  beside the wordmark in its header, which follow the theme and accent, and a 1200×630 social card carries it.
- A `touch` density, for screens used with a finger: `<ThemeProvider density="touch">`. Controls are 36, 44 and 56px
  tall, the row ••• is 44px and no control answers a press over less than 44×44px. Type and spacing don't change.
- Wherever a coarse pointer can be used, the row ••• answers a press over 44×44px in every density. Small Buttons,
  SegmentedControl options, AppShell footer links and WorkbenchShell's dividers reach `size-hit-absolute-min`, which is
  now keyed by density: 24px, and 44px in `touch`.
- InboxFlow's Select mode puts Lede's Checkbox on each row, which answers a press over 44×44px. The native checkbox
  it replaces answered over 22×22px.
- Escape backs out one layer per press, and a held Escape backs out of one. PageHeader takes `backOnEscape`: with
  `back` set on a level 1 heading, Escape activates the back link. An open menu, dialog or popover, an IME composition
  and a field the person changed each keep their Escape, and so does a search field while it holds text.
  `useBackOnEscape` gives a flow's own back link the same rules.
- InboxFlow's Escape ends selection mode with focus on Select. Otherwise it closes the open message, or the not-found
  detail, by its back link. Select moves focus to the first row's checkbox.
- Escape inside SelectionBar is Done.
- DataTable's paging lands on the new page. Next and Previous move focus to the summary line above the new rows, and
  Load more moves it to the first new row. Focus moves once the rows are this view's, in the commit that renders
  them. When the person moved focus elsewhere while the page loaded, it stays there. A Load more that adds no rows
  and leaves moves focus to the summary line.
- DataTable's summary line shows the focus ring when it takes focus from the keyboard.
- A screen's title shows Lede's focus ring when focus lands on it after a key press, such as Enter on a link, Escape
  or Back: PageHeader's heading, InboxFlow's message title and WorkbenchShell's heading. After a click, a tap or a cold
  load it shows none.
- `lede-utils` adds `input-modality.ts`. `focusLanding()` focuses a title without scrolling, with `focusVisible: false`
  unless the most recent input was a key press. Chromium matches `:focus-visible` on a cold load's scripted focus and
  after a click on a link that keys had focused.
  `lastInputWasTouch()` says whether the last input was a finger or a pen.
- In a DataTable without row links, each row's header cell takes `tabindex="-1"`, so focus can land on a new row,
  and it shows Lede's focus ring there.
- ProfileFlow's Escape while editing cancels when nothing changed, with focus on Edit profile. When something changed,
  the edits stay, and the back link waits until the form closes.
- OnboardingFlow runs on Enter from start to finish. Each step lands where the person acts next: Account puts the
  cursor in its first field that needs input, Preferences lands on the chosen accent, Review on Finish and the last
  screen on Get started, which its title and summary describe. Finish below the first viewport gives way to the h1.
  Each step's form is named by its h1, and a Review row opens the control it names. `focusFields={false}` starts
  Account at its h1 instead, for a person whose last input was a touch.
- Switch submits its form on Enter, as a native checkbox does. Outside a form, Enter still toggles it.
- OnboardingFlow's Account fields label the on-screen Enter key `next`, and ProfileFlow's one-line fields label it
  `done`.

### Changed

- Window breakpoints are in em of the browser's text size: 26.25, 40, 56.25 and 68.75em wide and 35em tall. At the
  default size they fall where the px ones did. At 200% text a layout changes at twice the width, so a 1280px window
  shows the tab bar and one pane at a time. MasterDetail's `useStackedPanes` reads the same 68.75em, so WorkbenchShell's
  panels and its CSS switch together. DataTable's 440px card width stays in px.
- AppearanceFlow's preview card is `inert`. It's a picture of the result, so its controls leave the tab order and the
  accessibility tree, and Tab from the title reaches Mode first.
- A removal keeps the reader's place. After Archive or Delete, on a row, on the open message or in bulk, InboxFlow moves
  focus to the row after the first message removed, the row before when none is after it, and the list's heading when
  nothing is left. Undo lands on the first message it brought back. Both happen in the same task as the change.
- InboxFlow's notice stays at the top of the list pane while the list scrolls, so it and its Undo stay in view. It's
  opaque, with a raised edge, so rows that scroll under it don't show through.
- When a DataTable row with focus leaves, focus moves to the row that took its place, else the last row, else the
  summary line, in the commit that takes the row away. A row action's row that leaves while its menu is open lands the
  same way. A bulk action lands from the first of its rows that left once its SelectionBar has left too; a bar that
  stays, holding rows that failed, keeps focus on its button, and Done or Escape there returns focus to where it came from.
  Rows that leave because the page or view changed aren't a removal, so they leave focus to the caller.
- Below 900px, a focus target inside AppShell's main scrolls clear of the tab bar, and of the home indicator below it.
- Glass holds `foreground`, `--ld-destructive-on-tint` and the focus ring over content of any color. `glass-tint` rises
  from 0.72 to 0.78 in light and from 0.62 to 0.88 in dark, so dark glass shows less of what's behind it. Secondary and
  status colors are held everywhere but on glass in light and dark. SelectionBar's critical tool takes
  `--ld-destructive-on-tint`.
- A text field, the data table's select, a switch's off track and the selected segment draw a 1px `--input` edge in
  every theme, and the switch knob draws one from `shadow-knob`. Dark `--input` lightens to `#8c8c94` so the selected
  segment's edge holds 3:1 on its track.
- In -hc a gray or Tinted Button, the SegmentedControl track, the current ListRow, the current GlassBar item and
  AppShell link and a pressed toolbar tool draw an `--input` edge. The -hc glass stroke is 1px, `#48484e` and `#b6b6bc`.
- A disabled control takes `fill-control` and a `foreground-disabled` label in place of dimming to `opacity-disabled`.
  Plain and glass Buttons keep their background, and forced colors use `GrayText`.
- Text on a tint or gray fill mixes 60% of its color with `foreground`, down from 80%. `destructive`, `success`,
  `warning`, `preset-green`, `preset-orange` and dark `muted-foreground` shift so text holds on `muted` and gray fills:
  dark `destructive` lightens from `#ff6b6b` to `#ff8a8a`.
- `opacity-hint` rises to 0.7 and `opacity-resting` to 0.8, so a sort arrow and a chevron hold 3:1.
- InboxFlow's notice takes `radius-md`, as DataTable's does.
- A ListRow value that wraps under its title sits 2px below it, down from 22px.
- Under `breakpoint-reflow` a Disclosure's meta moves under its title, which keeps its words whole.

### Fixed

- SelectionBar wraps at large text. When its count and actions don't fit on one line they wrap, and on a phone at 200%
  text or more the count takes a line of its own, so no label runs into the next or off the screen.
- GlassBar is as tall as its items at large text. Its list items had a line box that added the page's text height
  above each link, which made the bar about 27px taller at 300% text on a phone and put SelectionBar over its top.
- Under React StrictMode, as in `npm run dev`, PageHeader yields to a move made in the commit that shows its
  screen: each onboarding step lands on its field or control, and Back or a back link lands on the row the person left.
  PageHeader reads where focus was as the screen renders, so StrictMode's second run of its effect sees that move too.
- Critical filled and Tinted Buttons hover to a deeper `destructive`. They used to hover to `primary`.
- A pressed Plain Button only scales. It used to dim below 4.5:1 in light-hc.
- A Plain Button in a selected row takes `--ld-primary-on-tint`.
- A swiped row action's focus ring takes its label's color, which holds 3:1 on every action's fill.
- A focused segment's ring goes around its thumb, clear of it.
- A stacked SegmentedControl's corner is no rounder than `radius-capsule`, so it matches its segments under `square`.
- A page title scrolled into view, as InboxFlow's is after an action, keeps the shell's top padding above it.
- An Avatar keeps its outline in forced colors.
- Code in docs prose keeps to one line, so a name like `--radius` no longer breaks at its hyphens.
- When a refresh fails, screen readers announce DataTable's “Showing saved data” notice. Its status region is now
  on the page from the start, empty and unpainted, and the notice's text arrives in it. Before, the region arrived
  with its text, so screen readers could miss it.
- At 200% text on a 320px phone, four components fit the screen's width. With some fonts, such as DejaVu Sans, which
  `system-ui` resolves to on Ubuntu, each one widened the page by 4 to 22px. At the default text size they look as
  they did.
  - Under `breakpoint-reflow`, a ListGroup's summary moves under its title when the two don't fit side by side, and
    reads from the start there. Beside the title, the two squeezed to their longest words and then widened the list.
  - A Disclosure's title breaks a word too long for its line. The word used to widen the Disclosure.
  - Under `breakpoint-reflow`, a SummaryCard's figure takes `title-1` (1.75rem), so a figure of a few characters stays
    on one line.
  - MasterDetail's column under 1100px is as wide as its container. A ListRow in it breaks a title word too long for
    its line, and the word used to widen the column.
- A word too long for a SummaryCard, such as a long identifier in its title, figure or text, breaks. It used to run
  out of the card.
- A word too long for a ListGroup's header, such as a long identifier in its title or summary, breaks. At any text size
  it used to make the page scroll sideways.
- At 300% text on a 320px phone, no page scrolls sideways, and a control's label stays inside the control. On `/blocks`
  the page scrolled 88px sideways and EmptyState's “Open demo inbox” ran out of its card. At the default text size every
  page looks as it did.
  - AppShell's page breaks a word wider than its line, such as a long component name in prose.
  - EmptyState's title, text and action break a word too long for their line.
  - Under `breakpoint-reflow`, a Button's label breaks a word too long for the Button.
  - A Switch's label breaks a word too long for the room beside the switch.
  - GlassToolbar wraps its parts when they don't fit on one line, as SelectionBar's already did.
  - AppearanceFlow's accent names and InboxFlow's dates break a word too long for their place.
  - Under `breakpoint-reflow`, a message's time in InboxFlow's thread wraps.
- InboxFlow keeps focus off `<body>` when Archive or Delete (on a row, the selection or the open message), Undo or
  SelectionBar's Done takes the focused control away. Focus moves to its landing in the same task, when the callback
  renders its result at once, and a notice is announced after that move, so the move doesn't cut it off. An Undo whose
  result renders later keeps focus on its button and lands in the commit that brings the messages back, unless the
  person moved focus first. Done lands on Select. Every other landing is where it was.
- InboxFlow's open message takes focus with its title side by side too, so a link to a message lands on that message.
  A link from the list used to leave focus on the row, and a cold load or a link from elsewhere left it on `<body>`. Focus
  moves before the next frame, so on a phone no frame shows `<body>` between the list and the message.
- Side by side, activating the open message's row moves focus to the message's title, unless a modifier key is held. The row links to the URL
  already shown, so nothing remounted and focus stayed on the row.
- InboxFlow's `notFound` detail takes focus with its title side by side too. It used to leave focus on the list's
  heading, so a link to a removed message landed away from the explanation.
- SelectionBar's Done returns focus to the control it came into the bar from, such as a DataTable row's checkbox,
  while that control is still on the page. When `onClear` moves focus itself or takes that control away, focus stays
  where `onClear` leaves it. DataTable's Done lands on the summary line when that control has gone, as a row's checkbox
  does when the table becomes cards. It used to leave focus on `<body>`.
- SelectionBar forgets where focus came from when a selection ends without Done. Done on a later selection used to
  send focus to a checkbox from the earlier one and scroll the page to it.
- PageHeader focuses its heading at the end of the commit that mounts it, so a route change no longer paints a frame
  with focus on `<body>`. When something else in that commit moved focus inside its `<main>`, such as an `autoFocus`
  field or an app restoring focus on Back, the heading leaves it there.
- Closing InboxFlow's open message, by its back link or the browser's Back, returns focus to the message's row. It used
  to land on the list's heading. Each row writes its message's ID to `data-row-id`.
- WorkbenchShell focuses its heading in the commit that mounts it, so a route change no longer paints a frame with
  focus on `<body>`.
