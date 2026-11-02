import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { privateKeyPath, publicKeyFromSeed, readRelease, releasePath } from './macos-updates.mjs';

const release = readRelease();
if (!existsSync(privateKeyPath)) {
  if (release.publicKey)
    throw new Error(
      'Публичный ключ уже закреплён. Восстановите .private/sparkle-private-key из резервной копии; не заменяйте ключ существующих установок.',
    );
  const { privateKey } = generateKeyPairSync('ed25519');
  const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64');
  mkdirSync(dirname(privateKeyPath), { recursive: true, mode: 0o700 });
  writeFileSync(privateKeyPath, `${seed}\n`, { mode: 0o600, flag: 'wx' });
}
chmodSync(privateKeyPath, 0o600);
const publicKey = publicKeyFromSeed(readFileSync(privateKeyPath, 'utf8'));
if (release.publicKey && release.publicKey !== publicKey)
  throw new Error('Закрытый ключ не соответствует публичному ключу релизов.');
release.publicKey = publicKey;
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
console.log(
  `Ключ обновлений подготовлен. Публичный ключ записан в desktop/release.json.\nЗакрытый ключ: ${privateKeyPath}\nСохраните его резервную копию и добавьте содержимое в GitHub Actions secret SPARKLE_PRIVATE_KEY. Не добавляйте закрытый ключ в Git.`,
);
