import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConnectionClient } from '../src/connections/ConnectionClient';
import type { MessageTransport, TransportHandlers } from '../src/types/connection';

class FakeTransport implements MessageTransport<string, string> {
  handlers!: TransportHandlers<string>;
  sent: string[] = [];
  closed = false;
  open(handlers: TransportHandlers<string>) {
    this.handlers = handlers;
  }
  send(message: string) {
    this.sent.push(message);
    return true;
  }
  close() {
    this.closed = true;
    this.handlers.onClose({ retryable: true });
  }
}

test('generic connection delivers data and sends messages without a WebSocket dependency', () => {
  const transport = new FakeTransport();
  const client = new ConnectionClient(() => transport);
  const received: string[] = [];
  const unsubscribe = client.subscribe((event) => {
    if (event.type === 'message') received.push(event.message);
  });
  assert.equal(client.send('before open'), false);
  client.connect();
  transport.handlers.onOpen();
  transport.handlers.onMessage('position');
  assert.equal(client.getSnapshot().status, 'open');
  assert.equal(client.send('move'), true);
  assert.deepEqual(transport.sent, ['move']);
  assert.deepEqual(received, ['position']);
  unsubscribe();
  transport.handlers.onMessage('unsubscribed');
  assert.deepEqual(received, ['position']);
  client.disconnect();
  assert.equal(transport.closed, true);
  assert.equal(client.send('after close'), false);
});

test('reconnect uses a fresh transport, ignores old callbacks, and cancels retries on disposal', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const transports: FakeTransport[] = [];
  const client = new ConnectionClient(() => {
    const value = new FakeTransport();
    transports.push(value);
    return value;
  });
  const received: string[] = [];
  client.subscribe((event) => {
    if (event.type === 'message') received.push(event.message);
  });
  client.connect();
  transports[0].handlers.onOpen();
  transports[0].handlers.onClose({ retryable: true });
  assert.equal(client.getSnapshot().status, 'reconnecting');
  t.mock.timers.tick(999);
  assert.equal(transports.length, 1);
  t.mock.timers.tick(1);
  assert.equal(transports.length, 2);
  transports[1].handlers.onOpen();
  transports[0].handlers.onMessage('stale');
  transports[1].handlers.onMessage('current');
  assert.deepEqual(received, ['current']);
  transports[1].handlers.onClose({ retryable: true });
  client.disconnect();
  t.mock.timers.tick(10_000);
  assert.equal(transports.length, 2);
  assert.equal(client.getSnapshot().status, 'closed');
});

test('a terminal close stops automatic reconnect', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let created = 0;
  const transport = new FakeTransport();
  const client = new ConnectionClient(() => {
    created++;
    return transport;
  });
  client.connect();
  transport.handlers.onOpen();
  transport.handlers.onClose({ retryable: false, reason: 'session_replaced' });
  t.mock.timers.tick(60_000);
  assert.equal(created, 1);
  assert.equal(client.getSnapshot().status, 'closed');
});

test('synchronous transport failures schedule only one retry even if close emits an event', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let created = 0;
  class BrokenTransport extends FakeTransport {
    open(handlers: TransportHandlers<string>) {
      super.open(handlers);
      throw new Error('Unavailable');
    }
  }
  const client = new ConnectionClient(
    () => {
      created++;
      return new BrokenTransport();
    },
    { retryDelay: () => 100 },
  );
  client.connect();
  assert.equal(client.getSnapshot().error, 'Unavailable');
  t.mock.timers.tick(100);
  assert.equal(created, 2);
  client.disconnect();
});
