import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messageLinks } from '../src/utils/messageLinks';
import { deviceHint } from '../src/utils/deviceHint';

test('only HTTP(S) links become clickable, while punctuation and markup remain plain text', () => {
  const parts = messageLinks(
    'Открой (http://192.168.1.2:5173/chat). <img src=x> javascript:alert(1)',
  );
  assert.deepEqual(
    parts.filter((part) => part.href),
    [{ text: 'http://192.168.1.2:5173/chat', href: 'http://192.168.1.2:5173/chat' }],
  );
  assert.equal(
    parts.map((part) => part.text).join(''),
    'Открой (http://192.168.1.2:5173/chat). <img src=x> javascript:alert(1)',
  );
  assert.deepEqual(messageLinks('https://example.com/a_(b)'), [
    { text: 'https://example.com/a_(b)', href: 'https://example.com/a_(b)' },
  ]);
});

test('device names are editable hints based on browser information, without privileged APIs', () => {
  assert.deepEqual(deviceHint('Mozilla/5.0 (iPhone) AppleWebKit Mobile Safari'), {
    name: 'iPhone · Safari',
    kind: 'phone',
  });
  assert.deepEqual(deviceHint('Mozilla/5.0 (Windows NT 10.0) Chrome/123'), {
    name: 'Windows · Chrome',
    kind: 'computer',
  });
});
