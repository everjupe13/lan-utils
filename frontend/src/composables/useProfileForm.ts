import { useState, type FormEvent } from 'react';
import type { Profile } from '@nearby/shared/person';

export function useProfileForm(initial: Profile | null, onSubmit: (profile: Profile) => void) {
  const [login, setLogin] = useState(initial?.login ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ login: login.trim(), name: name.trim() });
  }
  return { login, setLogin, name, setName, submit };
}
