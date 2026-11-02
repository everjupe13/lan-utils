import { publicKeyFromSeed, readRelease } from './macos-updates.mjs';

const release = readRelease();
if (process.env.GITHUB_REF_TYPE !== 'tag' || process.env.GITHUB_REF_NAME !== `v${release.version}`)
  throw new Error('Тег должен совпадать с version в desktop/release.json.');
if (process.env.GITHUB_REPOSITORY !== release.repository)
  throw new Error('repository в desktop/release.json не совпадает с GitHub-репозиторием.');
if (
  !process.env.SPARKLE_PRIVATE_KEY ||
  publicKeyFromSeed(process.env.SPARKLE_PRIVATE_KEY) !== release.publicKey
)
  throw new Error(
    'Настройте GitHub Actions secret SPARKLE_PRIVATE_KEY из .private/sparkle-private-key.',
  );
console.log(`Релиз ${release.version}, build ${release.build}: тег и ключ подписи проверены.`);
