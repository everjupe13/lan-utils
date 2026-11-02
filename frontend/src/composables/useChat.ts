import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { chatWebSocketOptions } from '../connections/chatConnection';
import { ChatSession } from '../services/ChatSession';
import { chatStorage } from '../services/chatStorage';
import type { ChatIdentity, ChatSnapshot } from '../types/chat';
import { useWebSocketConnection } from './useWebSocketConnection';

const empty: ChatSnapshot = {
  status: 'connecting',
  device: null,
  devices: [],
  conversations: [],
  conversation: null,
  pending: null,
  lastSent: null,
  unread: {},
  error: '',
};
const getEmpty = () => empty;
const noSubscribe = () => () => {};

export function useChat() {
  const [identity, setIdentity] = useState(chatStorage.readIdentity);
  const options = useMemo(chatWebSocketOptions, []);
  const { client } = useWebSocketConnection(options);
  const session = useMemo(
    () =>
      identity
        ? new ChatSession(
            client,
            identity,
            chatStorage,
            new URLSearchParams(location.search).get('room'),
          )
        : null,
    [client, identity],
  );
  const state = useSyncExternalStore(
    session?.subscribe ?? noSubscribe,
    session?.getSnapshot ?? getEmpty,
    getEmpty,
  );
  useEffect(() => session?.start(), [session]);
  useEffect(() => {
    if (!state.conversation || state.status !== 'connected') return;
    const url = new URL(location.href);
    url.searchParams.set('room', state.conversation.id);
    history.replaceState(null, '', url);
  }, [state.conversation?.id, state.status]);
  function enter(value: ChatIdentity) {
    chatStorage.writeIdentity(value);
    setIdentity(value);
  }
  return {
    ...state,
    identity,
    enter,
    session,
    ready: state.status === 'connected',
    needsName: !identity || state.status === 'rejected',
  };
}
