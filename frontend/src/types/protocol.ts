import type { ClientMessage } from '@nearby/shared/protocol';

export type GameCommand = Exclude<ClientMessage, { type: 'hello' }>;
