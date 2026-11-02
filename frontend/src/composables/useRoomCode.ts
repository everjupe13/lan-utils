import { useState, type FormEvent } from 'react';

export function useRoomCode(onJoin: (roomId: string) => void) {
  const [code, setCode] = useState(
    () => new URLSearchParams(location.search).get('room')?.toUpperCase().slice(0, 6) ?? '',
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    onJoin(code.trim().toUpperCase());
  }
  return { code, setCode: (value: string) => setCode(value.toUpperCase()), submit };
}
