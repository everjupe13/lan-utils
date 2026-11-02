import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readRelease, root } from './macos-updates.mjs';

const release = readRelease();
const tag = `v${release.version}`;
if (process.env.RELEASE_TAG !== tag) throw new Error('Тег релиза не совпадает с release.json.');
const assets = join(root, 'release-assets');
const expected = ['arm64', 'x64'].flatMap((arch) => [
  `Nearby-${release.version}-${arch}.zip`,
  `appcast-${arch}.xml`,
]);
const actual = readdirSync(assets).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected.sort()))
  throw new Error('Неполный или неожиданный набор артефактов релиза.');
const existing = spawnSync('gh', ['release', 'view', tag, '--json', 'isDraft'], {
  encoding: 'utf8',
});
if (existing.status === 0) {
  if (!JSON.parse(existing.stdout).isDraft)
    throw new Error('Этот релиз уже опубликован. Выпустите новую версию с новым тегом.');
} else {
  execFileSync(
    'gh',
    [
      'release',
      'create',
      tag,
      '--verify-tag',
      '--draft',
      '--title',
      `Рядом ${release.version}`,
      '--notes-file',
      join(root, 'desktop/RELEASE_NOTES.md'),
    ],
    { stdio: 'inherit' },
  );
}
execFileSync(
  'gh',
  ['release', 'upload', tag, '--clobber', ...expected.map((name) => join(assets, name))],
  { stdio: 'inherit' },
);
console.log(
  'Черновик релиза готов. Проверьте его и нажмите Publish release / Set as latest в GitHub.',
);
