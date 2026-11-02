// Optional Developer ID and notarization setup on an ephemeral GitHub runner.
// Credentials are never printed or interpolated into shell commands.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (!process.env.RUNNER_TEMP || !process.env.GITHUB_ENV)
  throw new Error('Только для GitHub Actions.');
const keychain = join(process.env.RUNNER_TEMP, 'nearby-signing.keychain-db');
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`Не удалось выполнить ${command}; проверьте secrets подписи Apple.`);
  return result.stdout;
}
if (process.argv.includes('--cleanup')) {
  if (existsSync(keychain)) run('/usr/bin/security', ['delete-keychain', keychain]);
  process.exit(0);
}
const certificate = process.env.MACOS_CERTIFICATE_P12;
if (!certificate) {
  if (process.env.MACOS_SIGNING_IDENTITY || process.env.APPLE_ID || process.env.APPLE_APP_PASSWORD)
    throw new Error(
      'Для подписи Apple нужно настроить весь набор secrets, начиная с MACOS_CERTIFICATE_P12.',
    );
  console.log(
    'Developer ID не настроен: будет создана локальная ad-hoc сборка с подписью обновлений Ed25519.',
  );
  process.exit(0);
}
if (!process.env.MACOS_SIGNING_IDENTITY) throw new Error('Нужен secret MACOS_SIGNING_IDENTITY.');
const password = randomBytes(24).toString('base64');
const certPath = join(process.env.RUNNER_TEMP, 'nearby-certificate.p12');
try {
  writeFileSync(certPath, Buffer.from(certificate, 'base64'), { mode: 0o600 });
  run('/usr/bin/security', ['create-keychain', '-p', password, keychain]);
  run('/usr/bin/security', ['set-keychain-settings', '-lut', '21600', keychain]);
  run('/usr/bin/security', ['unlock-keychain', '-p', password, keychain]);
  run('/usr/bin/security', [
    'import',
    certPath,
    '-P',
    process.env.MACOS_CERTIFICATE_PASSWORD || '',
    '-k',
    keychain,
    '-T',
    '/usr/bin/codesign',
    '-T',
    '/usr/bin/security',
  ]);
  run('/usr/bin/security', [
    'set-key-partition-list',
    '-S',
    'apple-tool:,apple:',
    '-k',
    password,
    keychain,
  ]);
  const existing = [
    ...run('/usr/bin/security', ['list-keychains', '-d', 'user']).matchAll(/"([^"]+)"/g),
  ].map((match) => match[1]);
  run('/usr/bin/security', [
    'list-keychains',
    '-d',
    'user',
    '-s',
    keychain,
    ...existing.filter((path) => path !== keychain),
  ]);
  if (process.env.APPLE_ID || process.env.APPLE_TEAM_ID || process.env.APPLE_APP_PASSWORD) {
    if (!process.env.APPLE_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_APP_PASSWORD)
      throw new Error('Для нотариализации нужны APPLE_ID, APPLE_TEAM_ID и APPLE_APP_PASSWORD.');
    run('/usr/bin/xcrun', [
      'notarytool',
      'store-credentials',
      'nearby-notary',
      '--keychain',
      keychain,
      '--apple-id',
      process.env.APPLE_ID,
      '--team-id',
      process.env.APPLE_TEAM_ID,
      '--password',
      process.env.APPLE_APP_PASSWORD,
    ]);
    appendFileSync(process.env.GITHUB_ENV, 'MACOS_NOTARY_PROFILE=nearby-notary\n');
    appendFileSync(process.env.GITHUB_ENV, `MACOS_NOTARY_KEYCHAIN=${keychain}\n`);
  }
} finally {
  rmSync(certPath, { force: true });
}
