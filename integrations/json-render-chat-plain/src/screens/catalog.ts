import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { shadcnComponentDefinitions as shadcn } from '@json-render/shadcn/catalog';
import { z } from 'zod';

const id = z.object({ id: z.string() });

/**
 * The shadcn components a model may use, picked from `@json-render/shadcn` the way its README shows: thirteen that cover
 * the chat's screens. Each keeps the package's own schema and description.
 */
export const catalog = defineCatalog(schema, {
  components: {
    Stack: shadcn.Stack,
    Card: shadcn.Card,
    Heading: shadcn.Heading,
    Text: shadcn.Text,
    Badge: shadcn.Badge,
    Separator: shadcn.Separator,
    Button: shadcn.Button,
    Input: shadcn.Input,
    Textarea: shadcn.Textarea,
    Checkbox: shadcn.Checkbox,
    Switch: shadcn.Switch,
    ToggleGroup: shadcn.ToggleGroup,
    Radio: shadcn.Radio,
  },
  actions: {
    archive: { params: id, description: 'Archive an item by its id.' },
    submit: {
      params: z.object({ form: z.string(), values: z.record(z.string(), z.unknown()).optional() }),
      description: 'Send the named form. Pass what the person entered as values, read from state: { "$state": "/signup" }.',
    },
  },
});

export type CatalogAction = keyof typeof catalog.data.actions;
