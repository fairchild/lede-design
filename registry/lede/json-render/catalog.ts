import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

const text = z.string();
const tone = z.enum(['primary', 'critical']);
const rowEvent = z.enum(['archive', 'flag', 'delete']);

/**
 * The Lede components a model may use. Each prop keeps the Lede component's own name and values, so a spec reads like
 * the JSX it becomes. In the Lede repo, `integrations/json-render/src/catalog-fit.ts` checks that every prop here is one the component accepts.
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
      description: 'A titled list of rows. Use it for settings, messages or any set of items that people scan and pick from. Its children are ListRows.',
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
      description: 'One item in a ListGroup: a title, an optional subtitle and a value on the right. Bind “press” to open the item. For a setting, set checked and bind it with $bindState: the row shows a Switch named by its title and emits “change”. Each row action emits its event, such as “archive”, and shows in a menu and under a swipe.',
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
        value: text.optional(),
        type: z.enum(['text', 'email', 'password', 'tel', 'url']).optional(),
        placeholder: text.optional(),
        hint: text.optional(),
        error: text.optional(),
        required: z.boolean().optional(),
        rows: z.number().int().min(2).max(12).optional(),
      }),
      description: 'A labeled text input. Bind value with $bindState. Word error as the fix, such as “Enter an email address with an @.” Set rows for text that runs past one line.',
    },
    Switch: {
      props: z.object({ label: text, checked: z.boolean().optional(), disabled: z.boolean().optional() }),
      events: ['change'],
      description: 'An on or off setting that applies at once, outside a list. Bind checked with $bindState. In a list, use a ListRow with checked.',
    },
    Checkbox: {
      props: z.object({ label: text, checked: z.boolean().optional(), disabled: z.boolean().optional() }),
      events: ['change'],
      description: 'A yes or no choice that applies when the form is sent, such as agreeing to terms. Bind checked with $bindState.',
    },
    SegmentedControl: {
      props: z.object({ label: text, options: z.array(text).min(2).max(5), value: text.optional() }),
      events: ['change'],
      description: 'A choice of two to five options shown side by side, such as a view or a period. Bind value with $bindState.',
    },
    FormSection: {
      props: z.object({ legend: text, description: text.optional() }),
      slots: ['default'],
      description: 'A group of related fields with a name, such as “Contact details”. Its children are TextFields, Switches and Checkboxes.',
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
    open: { params: z.object({ id: text }), description: 'Open an item by its id.' },
    archive: { params: z.object({ id: text }), description: 'Archive an item by its id.' },
    submit: { params: z.object({ form: text }), description: 'Send the named form.' },
  },
});

export type CatalogType = keyof typeof catalog.data.components;
