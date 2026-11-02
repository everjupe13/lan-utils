import { useMemo } from 'react';
import { WebSocketTransport } from '../connections/WebSocketTransport';
import type { WebSocketOptions } from '../types/connection';
import { useConnection } from './useConnection';

/** WebSocket convenience hook; reconnection and data subscriptions use the generic layer. */
export function useWebSocketConnection<TOutgoing, TIncoming>(
  options: WebSocketOptions<TOutgoing, TIncoming>,
) {
  const factory = useMemo(() => () => new WebSocketTransport(options), [options]);
  return useConnection(factory);
}

// Alternative spelling of the public hook.
export { useWebSocketConnection as useWebSockerConnetion };
