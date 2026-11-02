import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ConnectionClient } from '../connections/ConnectionClient';
import type { TransportFactory } from '../types/connection';

/** Generic hook for any implementation of MessageTransport, including long polling. */
export function useConnection<TOutgoing, TIncoming>(
  factory: TransportFactory<TOutgoing, TIncoming>,
) {
  const client = useMemo(() => new ConnectionClient(factory), [factory]);
  const state = useSyncExternalStore(client.subscribeState, client.getSnapshot, client.getSnapshot);
  useEffect(() => () => client.disconnect(), [client]);
  return {
    client,
    ...state,
    connect: client.connect,
    disconnect: client.disconnect,
    send: client.send,
    subscribe: client.subscribe,
  };
}
