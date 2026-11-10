import type { SPEC_DATA_PART, SpecDataPart } from '@json-render/core';
import type { UIMessage } from 'ai';

/** A chat message whose data parts are json-render's spec patches, typed the way json-render documents. */
export type AppMessage = UIMessage<unknown, { [K in typeof SPEC_DATA_PART]: SpecDataPart }>;
