import { useMemo, useState } from 'react';
import { gameWebSocketOptions } from '../connections/gameConnection';
import { identityStorage, initialProfile } from '../services/identityStorage';
import type { Profile } from '@nearby/shared/person';
import { useGameSession } from './useGameSession';
import { useWebSocketConnection } from './useWebSocketConnection';

/** Composition root: change the connection hook here to switch the application's transport. */
export function useApplication() {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const options = useMemo(gameWebSocketOptions, []);
  const { client } = useWebSocketConnection(options);
  const game = useGameSession(profile, client);
  function resetProfile() {
    identityStorage.clear();
    setProfile(null);
  }
  return {
    profile,
    setProfile,
    resetProfile,
    game,
    needsProfile: !profile || game.status === 'rejected',
  };
}
