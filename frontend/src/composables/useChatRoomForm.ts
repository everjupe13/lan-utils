import { useState, type FormEvent } from 'react';

export function useChatRoomForm(onCreate: (title: string) => void) {
  const [title, setTitle] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) {
      onCreate(title.trim());
      setTitle('');
    }
  }
  return { title, setTitle, submit };
}
