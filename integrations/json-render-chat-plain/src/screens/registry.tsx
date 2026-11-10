import { defineRegistry } from '@json-render/react';
import { shadcnComponents as shadcn } from '@json-render/shadcn';
import { catalog } from './catalog';

/** Each catalog type drawn by the package's own component. The chat passes the action handlers to `JSONUIProvider`. */
export const { registry } = defineRegistry(catalog, {
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
  actions: { open: async () => {}, archive: async () => {}, submit: async () => {} },
});
