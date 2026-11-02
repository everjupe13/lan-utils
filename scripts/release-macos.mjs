import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  ensureSparkle,
  privateKeyPath,
  publicKeyFromSeed,
  readRelease,
  root,
  verifyArchiveSignature,
} from './macos-updates.mjs';

const release = readRelease();
const tag = `v${release.version}`;
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== tag)
  throw new Error(`Тег должен совпадать с desktop/release.json: ${tag}`);
const secret =
  process.env.SPARKLE_PRIVATE_KEY ||
  (existsSync(privateKeyPath) ? readFileSync(privateKeyPath, 'utf8') : '');
if (!secret || publicKeyFromSeed(secret) !== release.publicKey)
  throw new Error('Нужен закрытый ключ SPARKLE_PRIVATE_KEY, соответствующий desktop/release.json.');
const sparkle = ensureSparkle(release);
const app = join(root, 'dist/Рядом.app');
if (!existsSync(app)) throw new Error('Сначала выполните npm run build:mac.');
function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}
function plist(key) {
  return execFileSync(
    '/usr/bin/plutil',
    ['-extract', key, 'raw', join(app, 'Contents/Info.plist')],
    { encoding: 'utf8' },
  ).trim();
}
if (
  plist('CFBundleVersion') !== String(release.build) ||
  plist('CFBundleShortVersionString') !== release.version
)
  throw new Error('Версия собранного приложения не совпадает с release.json. Пересоберите .app.');
if (plist('SUPublicEDKey') !== release.publicKey)
  throw new Error('В приложении другой публичный ключ обновлений.');
const directory = join(root, 'dist', 'updates', process.arch);
// This directory is generated solely by this script.
rmSync(directory, { recursive: true, force: true });
mkdirSync(directory, { recursive: true });
const filename = `Nearby-${release.version}-${process.arch}.zip`;
const archive = join(directory, filename);
const feed = join(directory, `appcast-${process.arch}.xml`);

// Notarization is optional for local EdDSA-signed builds. Public distribution
// should set a Developer ID identity and a stored notarytool profile.
if (process.env.MACOS_NOTARY_PROFILE) {
  if (!process.env.MACOS_SIGNING_IDENTITY)
    throw new Error('Для нотариализации нужна MACOS_SIGNING_IDENTITY.');
  const submission = join(directory, 'notarization.zip');
  run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, submission]);
  const notaryArgs = [
    'notarytool',
    'submit',
    submission,
    '--keychain-profile',
    process.env.MACOS_NOTARY_PROFILE,
    '--wait',
  ];
  if (process.env.MACOS_NOTARY_KEYCHAIN)
    notaryArgs.push('--keychain', process.env.MACOS_NOTARY_KEYCHAIN);
  run('/usr/bin/xcrun', notaryArgs);
  run('/usr/bin/xcrun', ['stapler', 'staple', app]);
  rmSync(submission);
}
run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive]);
cpSync(join(root, 'desktop/RELEASE_NOTES.md'), join(directory, filename.replace(/\.zip$/, '.md')));
function withSecret(tool, args) {
  // Supply the seed via stdin, never via argv, logs, app bundle, or artifacts.
  const result = spawnSync(join(sparkle, 'bin', tool), ['--ed-key-file', '-', ...args], {
    input: secret.trim() + '\n',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0)
    throw new Error(`${tool}: ${result.stderr || 'не удалось подписать обновление'}`);
  if (result.stdout) process.stdout.write(result.stdout);
}
withSecret('generate_appcast', [
  '--download-url-prefix',
  `https://github.com/${release.repository}/releases/download/${tag}/`,
  '--embed-release-notes',
  '--maximum-deltas',
  '0',
  '-o',
  feed,
  directory,
]);
withSecret('sign_update', ['--verify', feed]);
const signature = readFileSync(feed, 'utf8').match(
  /<enclosure\b[^>]*sparkle:edSignature="([^"]+)"/s,
)?.[1];
if (!signature || !verifyArchiveSignature(readFileSync(archive), release.publicKey, signature))
  throw new Error('Подпись архива не проходит проверку закреплённым публичным ключом.');
// Release notes are embedded in the signed appcast, no separate asset needed.
rmSync(join(directory, filename.replace(/\.zip$/, '.md')));
console.log(
  `Готово: ${archive}\nПодписанный канал: ${feed}\nЗагрузите оба файла в GitHub Release ${tag}.`,
);
