import { useState, type FormEvent } from 'react';

export function useDeviceName(initial: string, onSubmit: (name: string) => void) {
  const [name, setName] = useState(initial);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  }
  return { name, setName, submit };
}
