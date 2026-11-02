import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  publicKeyFromSeed,
  readRelease,
  root,
  updateFeed,
  verifyArchiveSignature,
} from '../../scripts/macos-updates.mjs';
import { join } from 'node:path';

test('Sparkle seed restores the matching Ed25519 public key and rejects malformed private keys', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64');
  const expected = publicKey
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('base64');
  assert.equal(publicKeyFromSeed(seed + '\n'), expected);
  assert.throws(() => publicKeyFromSeed('bad-key'));
});

test('modified archive bytes and archives from an unrelated signing key are rejected', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
  const archive = Buffer.from('update archive');
  const signature = sign(null, archive, privateKey).toString('base64');
  assert.equal(verifyArchiveSignature(archive, pub, signature), true);
  archive[0] ^= 1;
  assert.equal(verifyArchiveSignature(archive, pub, signature), false);
  const otherKey = generateKeyPairSync('ed25519').privateKey;
  assert.equal(
    verifyArchiveSignature(archive, pub, sign(null, archive, otherKey).toString('base64')),
    false,
  );
});

test('installed architectures keep separate stable release channels', () => {
  const release = readRelease();
  assert.notEqual(updateFeed(release, 'arm64'), updateFeed(release, 'x64'));
  for (const arch of ['arm64', 'x64']) {
    const url = new URL(updateFeed(release, arch));
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'github.com');
    assert.ok(url.pathname.endsWith(`/releases/latest/download/appcast-${arch}.xml`));
  }
  assert.throws(() => updateFeed(release, 'ia32'));
  assert.equal(Buffer.from(release.publicKey, 'base64').length, 32);
});

test('update verification requires signed feeds and archives with explicit installation', () => {
  const plist = readFileSync(join(root, 'desktop/macos/Info.plist'), 'utf8');
  for (const key of ['SURequireSignedFeed', 'SUVerifyUpdateBeforeExtraction'])
    assert.match(plist, new RegExp(`<key>${key}</key>\\s*<true/>`));
  for (const key of [
    'SUAutomaticallyUpdate',
    'SUAllowsAutomaticUpdates',
    'SUEnableSystemProfiling',
  ])
    assert.match(plist, new RegExp(`<key>${key}</key>\\s*<false/>`));
});
