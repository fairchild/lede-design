import type { ReactNode } from 'react';

export interface ExampleApp {
  /** Its folder under `integrations/`. */
  folder: string;
  summary: ReactNode;
  /** A file in the folder with the steps for a coding agent. */
  recipe?: string;
}

/** The example apps under `integrations/`, as `integrations/README.md` lists them. Overview counts them. */
export const EXAMPLE_APPS: ExampleApp[] = [
  { folder: 'json-render', summary: 'Lede drawn by json-render from recorded JSON specs.' },
  {
    folder: 'json-render-chat',
    summary: <>The same catalog in a chat built on the AI SDK’s <code>useChat</code>, with a scripted mock transport and a reference server.</>,
    recipe: 'AGENTS.md',
  },
  { folder: 'json-render-chat-plain', summary: 'The same chat with json-render’s shadcn components in place of Lede, and a measured comparison of the two.' },
];
