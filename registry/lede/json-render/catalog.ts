import { defineCatalog, type ComputedFunction } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

const text = z.string();
const tone = z.enum(['primary', 'critical']);
const rowEvent = z.enum(['archive', 'flag', 'delete']);
const inRepeat = 'Inside a repeat, pass the item’s id as { "$template": "${id}" }, since { "$item": "id" } in params is its state path.';

const number = (value: unknown) => Number.parseFloat(String(value));
const decimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const plural = new Intl.PluralRules('en-US');

/** A number as text, with `unit` after it, or `units` when the number takes a plural noun: “1 cup”, “1.5 cups”. */
const counted = (n: number, unit: unknown, units: unknown) => {
  const noun = plural.select(n) === 'one' || units == null ? unit : units;
  return noun ? `${decimals.format(n)} ${String(noun)}` : decimals.format(n);
};

/**
 * Functions a spec calls with `{ "$computed": name, "args": { … } }`. SpecView hands them to json-render, the catalog
 * lists their names in the prompt and `rules` gives each one's args. Add one here and describe it in `rules`.
 */
export const functions = {
  scale: ({ amount, from, to, unit, units }) => {
    const scaled = (number(amount) * number(to)) / number(from);
    return Number.isFinite(scaled) ? counted(scaled, unit, units) : String(amount ?? '');
  },
  remaining: ({ from, take, unit, units }) => {
    const left = Math.max(0, number(from) - (number(take) || 0));
    return Number.isFinite(left) ? counted(left, unit, units) : String(from ?? '');
  },
} satisfies Record<string, ComputedFunction>;

/**
 * The Lede components a model may use. Each prop keeps the Lede component's own name and values, so a spec reads like
 * the JSX it becomes. `catalog-fit.ts` checks that every prop here is one the component accepts.
 */
export const catalog = defineCatalog(schema, {
  components: {
    Screen: {
      props: z.object({}),
      slots: ['default'],
      description: 'The root of every spec. It stacks its children down the page with even spacing. Use it once, as the root.',
    },
    PageHeader: {
      props: z.object({ title: text, summary: text.optional() }),
      slots: ['actions'],
      description: 'The screen’s title and its takeaway in one sentence. Use one per screen, as the first child of Screen. Put at most two Buttons in its actions slot.',
    },
    ListGroup: {
      props: z.object({ title: text.optional(), summary: text.optional(), footer: text.optional() }),
      slots: ['default'],
      description: 'A titled list of rows. Use it for settings, messages or any set of items that people scan and pick from. Its children are ListRows. For rows from a state array, set repeat on the ListGroup and give it one ListRow child that reads each item with $item.',
    },
    ListRow: {
      props: z.object({
        title: text,
        subtitle: text.optional(),
        value: text.optional(),
        chevron: z.boolean().optional(),
        checked: z.boolean().optional(),
        actions: z.array(z.object({ label: text, tone: z.enum(['primary', 'neutral', 'critical']).optional(), event: rowEvent })).optional(),
      }),
      events: ['press', 'change', ...rowEvent.options],
      description: 'One item in a ListGroup: a title, an optional subtitle and a value on the right. The subtitle is one line that cuts off on a phone, so a reason, a problem or a difference between items goes in the title, the value, the ListGroup’s summary or a SummaryCard, never only in the subtitle. Bind “press” to open the item. For a setting, set checked and bind it with $bindState: the row shows a Switch named by its title and emits “change”. Each row action emits its event, such as “archive”, and shows in a menu and under a swipe.',
    },
    Button: {
      props: z.object({
        label: text,
        variant: z.enum(['filled', 'tinted', 'gray', 'plain']).optional(),
        tone: tone.optional(),
        size: z.enum(['sm', 'md', 'lg']).optional(),
        block: z.boolean().optional(),
        disabled: z.boolean().optional(),
      }),
      events: ['press'],
      description: 'An action. Use variant “filled” for the one main action on a screen and “gray” for the rest. Use tone “critical” for an action that deletes.',
    },
    TextField: {
      props: z.object({
        label: text,
        value: z.union([text, z.number()]).optional(),
        type: z.enum(['text', 'email', 'password', 'tel', 'url', 'number']).optional(),
        placeholder: text.optional(),
        hint: text.optional(),
        error: text.optional(),
        required: z.boolean().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.union([z.number().positive(), z.literal('any')]).optional(),
        pattern: z.string().optional(),
        minLength: z.number().int().min(0).optional(),
        maxLength: z.number().int().min(1).optional(),
        rows: z.number().int().min(2).max(12).optional(),
      }),
      events: ['submit'],
      description: 'A labeled text input. Bind value with $bindState. Enter in a one-line field emits “submit”: bind it to what the form’s main Button does. Word error as the fix, such as “Enter an email address with an @.” Put an example in hint, not placeholder: a placeholder in the field reads as a value already entered. For a number, set type “number” and its range with min and max; its value in state is then a number, which gt and lt compare. A number field takes any decimal unless step says otherwise, such as step 1 for whole numbers. pattern is a regular expression the whole value must match, such as "[0-9]{5}" for a 5-digit ZIP code, and minLength and maxLength bound its length. Set rows for text that runs past one line.',
    },
    Switch: {
      props: z.object({ label: text, checked: z.boolean().optional(), disabled: z.boolean().optional() }),
      events: ['change'],
      description: 'An on or off setting that applies at once, outside a list. Bind checked with $bindState. In a list, use a ListRow with checked.',
    },
    Checkbox: {
      props: z.object({ label: text, checked: z.boolean().optional(), disabled: z.boolean().optional(), required: z.boolean().optional(), error: text.optional() }),
      events: ['change'],
      description: 'A yes or no choice that applies when the form is sent. Set required when the form needs it checked, such as agreeing to terms, with an error such as “Agree to the terms to continue.” Bind checked with $bindState.',
    },
    SegmentedControl: {
      props: z.object({ label: text, options: z.array(text).min(2).max(5), value: text.optional(), required: z.boolean().optional(), error: text.optional() }),
      events: ['change'],
      description: 'A choice of two to five options, such as a view or a period. Its label shows above it. Give options that read on their own, such as “4 people” or “7:00 PM”. They sit side by side, and stack on a narrow screen. Bind value with $bindState. To make the person choose, start value at "" and set required, with an error that shows under it.',
    },
    FormSection: {
      props: z.object({ legend: text, description: text.optional() }),
      slots: ['default'],
      description: 'A group of related fields with a name, such as “Contact details”. Its children are TextFields, Switches, Checkboxes and SegmentedControls.',
    },
    EmptyState: {
      props: z.object({ title: text, description: text.optional() }),
      slots: ['action'],
      description: 'What a place is for when it has nothing in it yet, and how to fill it. Put at most one Button in its action slot.',
    },
    SummaryCard: {
      props: z.object({
        title: text,
        summary: text,
        figure: text.optional(),
        status: z.object({ tone: z.enum(['neutral', 'positive', 'caution', 'critical']), label: text }).optional(),
      }),
      description: 'One figure and the sentence that explains it, such as “3” and “invoices are overdue”. Spell the status out in its label.',
    },
  },
  actions: {
    open: { params: z.object({ id: text }), description: `Open an item by its id. ${inRepeat}` },
    archive: { params: z.object({ id: text }), description: `Archive an item by its id. ${inRepeat}` },
    submit: {
      params: z.object({ form: text, values: z.record(z.string(), z.unknown()).optional() }),
      description: 'Send the named form. Pass what the person entered as values, read from state: { "$state": "/signup" }. It doesn’t run while a field it reads fails its check: focus moves to that field instead.',
    },
  },
  functions,
});

export type CatalogType = keyof typeof catalog.data.components;
export type CatalogAction = keyof typeof catalog.data.actions;

/**
 * Lede's rules for a model, which `prompt` adds to json-render's. json-render's own prompt shows `repeat` on the first
 * components in a catalog, which here are Screen and PageHeader; these keep each to its one place.
 */
export const rules = [
  'Only the components under AVAILABLE COMPONENTS and the actions under AVAILABLE ACTIONS exist. Use no other type or action name.',
  'Screen is the root of every spec, and there is one. PageHeader is its first child, and there is one.',
  'To list items from a state array, put repeat on a ListGroup, with one ListRow child that reads each item with $item.',
  'In action params, { "$item": "id" } is the item’s state path. To pass the value, write { "$template": "${id}" }.',
  'An event runs several actions in order when its binding is an array, such as "press": [{ "action": "setState", … }, { "action": "submit", … }].',
  'To show a value worked out from others, use $computed. { "$computed": "scale", "args": { "amount": …, "from": …, "to": …, "unit": …, "units": … } } returns amount × to ÷ from. { "$computed": "remaining", "args": { "from": …, "take": …, "unit": …, "units": … } } returns from − take, and never less than 0. Each arg can be a literal, { "$state": … } or { "$item": … }, and a number inside text, such as “6 people”, counts as 6.',
  'Text reads right for every value it can show. Give a number its noun through unit and units, such as "unit": "cup", "units": "cups" for “1 cup” and “1.5 cups”, rather than in a $template.',
  'A field is checked when an action reads it. An action whose params read a field that is empty and required, out of its min and max, off its step, not matching its pattern, shorter than its minLength or not the email or URL its type asks for doesn’t run: the field shows its error and focus moves to it. So give each checked field an error as plain text worded as the fix, such as "error": "Enter minutes from 5 to 240.". An error names only what the field checks: to ask for a 5-digit ZIP code, set its pattern too. It shows only once a check holds an action back, and goes when the field passes. Bind the same actions to the field’s submit, so Enter in it does what its Button does. To clear a form after it sends, end the binding with a setState that empties its fields.',
  'Each spec is a whole screen, with its root, every element and the state it needs, even when it changes a screen from earlier in the conversation. An earlier screen’s state is what the person left in it, so carry over what they entered.',
  'Every control does something: it changes a setting, a value another element shows or a value an action sends, or it runs an action. A spec can’t sort or filter a list, so it has no sort or filter controls.',
];

/**
 * json-render's prompt shows its shapes with components and actions from other catalogs, such as Card, Select and
 * `loadCities`, and with Screen where this catalog would use ListGroup or Button. Each pair rewrites one of those in
 * this catalog's terms; `tests/specs.test.tsx` fails when a json-render update changes the text a pair looks for.
 */
export const promptFixes: ReadonlyArray<readonly [string, string]> = [
  ['{"type":"Card","props":{"title":"Hello"},"children":[]}', '{"type":"Screen","props":{},"children":[]}'],
  ['"type":"Screen","props":{},"repeat"', '"type":"ListGroup","props":{},"repeat"'],
  ['{"type":"PageHeader","props":{"title":{"$item":"title"}},"children":[]}', '{"type":"ListRow","props":{"title":{"$item":"title"}},"children":[]}'],
  ['{"type":"Screen","props":{},"on":{"press"', '{"type":"Button","props":{"label":"Save"},"on":{"press"'],
  ['A Screen with on: {', 'A Button with on: {'],
  ['"color": { "$cond": { "$state": "/activeTab", "eq": "home" }, "$then": "#007AFF", "$else": "#8E8E93" }', '"value": { "$cond": { "$state": "/settings/push" }, "$then": "On", "$else": "Off" }'],
  ['Example (cascading select — country changes trigger city loading):', 'Example (a new period sends the page back to its start):'],
  ['{"type":"Select","props":{"value":{"$bindState":"/form/country"},"options":["US","Canada","UK"]},"watch":{"/form/country":{"action":"loadCities","params":{"country":{"$state":"/form/country"}}}},"children":[]}',
    '{"type":"SegmentedControl","props":{"label":"Period","options":["Today","This week"],"value":{"$bindState":"/period"}},"watch":{"/period":{"action":"setState","params":{"statePath":"/page","value":1}}},"children":[]}'],
];

/** The system prompt for a model that writes Lede screens: json-render's, in this catalog's terms, with `rules`. */
export function prompt(options: { system?: string; mode?: 'inline' | 'standalone' } = {}) {
  const text = catalog.prompt({ mode: options.mode ?? 'inline', system: options.system, customRules: rules });
  return promptFixes.reduce((out, [from, to]) => out.replaceAll(from, to), text);
}
