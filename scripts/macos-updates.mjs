import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, createPublicKey, verify } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const releasePath = join(root, 'desktop/release.json');
export const privateKeyPath = join(root, '.private/sparkle-private-key');

export function readRelease() {
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  if (
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    !Number.isSafeInteger(release.build) ||
    release.build < 1
  )
    throw new Error('desktop/release.json: нужны версия x.y.z и положительный целый build.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(release.repository))
    throw new Error('Некорректный GitHub repository.');
  if (!/^[\d.]+$/.test(release.sparkle.version) || !/^[a-f0-9]{64}$/.test(release.sparkle.sha256))
    throw new Error('Некорректная версия или SHA-256 Sparkle.');
  return release;
}

export function updateFeed(release, arch) {
  if (!['arm64', 'x64'].includes(arch)) throw new Error(`Неподдерживаемая архитектура: ${arch}`);
  return `https://github.com/${release.repository}/releases/latest/download/appcast-${arch}.xml`;
}

export function publicKeyFromSeed(encoded) {
  const seed = Buffer.from(encoded.trim(), 'base64');
  if (seed.length !== 32)
    throw new Error('Закрытый ключ Sparkle должен содержать 32-байтовый seed в base64.');
  const key = createPrivateKey({
    key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]),
    format: 'der',
    type: 'pkcs8',
  });
  return createPublicKey(key)
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('base64');
}

export function verifyArchiveSignature(bytes, publicKey, signature) {
  const key = createPublicKey({
    key: Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(publicKey, 'base64'),
    ]),
    format: 'der',
    type: 'spki',
  });
  return verify(null, bytes, key, Buffer.from(signature, 'base64'));
}

export function ensureSparkle(release) {
  const directory = join(root, '.cache/sparkle', release.sparkle.version);
  mkdirSync(directory, { recursive: true });
  const archive = join(directory, 'archive.tar.xz');
  if (!existsSync(archive)) {
    const temporary = `${archive}.download`;
    execFileSync(
      '/usr/bin/curl',
      [
        '--fail',
        '--location',
        '--retry',
        '2',
        '--connect-timeout',
        '15',
        '--max-time',
        '180',
        `https://github.com/sparkle-project/Sparkle/releases/download/${release.sparkle.version}/Sparkle-${release.sparkle.version}.tar.xz`,
        '--output',
        temporary,
      ],
      { stdio: 'inherit' },
    );
    const digest = createHash('sha256').update(readFileSync(temporary)).digest('hex');
    if (digest !== release.sparkle.sha256) throw new Error('SHA-256 архива Sparkle не совпадает.');
    renameSync(temporary, archive);
  }
  if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== release.sparkle.sha256)
    throw new Error('SHA-256 кешированного Sparkle не совпадает. Удалите повреждённый архив.');
  execFileSync('/usr/bin/tar', ['-xf', archive, '-C', directory]);
  return directory;
}
