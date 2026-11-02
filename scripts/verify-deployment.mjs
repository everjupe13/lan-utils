import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const stage = mkdtempSync(join(tmpdir(), 'nearby-production-'));

try {
  for (const name of ['package.json', 'package-lock.json'])
    cpSync(join(root, name), join(stage, name));
  for (const workspace of manifest.workspaces) {
    const output = resolve(root, workspace, 'dist');
    if (!existsSync(output))
      throw new Error(`Нет сборки ${workspace}/dist. Сначала выполните npm run build.`);
    cpSync(join(root, workspace, 'package.json'), join(stage, workspace, 'package.json'));
    cpSync(output, join(stage, workspace, 'dist'), { recursive: true });
  }

  const install = [
    'ci',
    '--omit=dev',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--cache',
    process.env.npm_config_cache ?? join(stage, '.npm-cache'),
  ];
  if (process.argv.includes('--offline')) install.push('--offline');
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Запускайте проверку через npm run verify:deployment.');
  execFileSync(process.execPath, [npmCli, ...install], { cwd: stage, stdio: 'inherit' });

  // This child sees only compiled application files and freshly installed production dependencies.
  const verify = `
    import assert from 'node:assert/strict';
    import { existsSync, readFileSync, readdirSync } from 'node:fs';
    import { pathToFileURL } from 'node:url';
    import { fileNameProblem } from '@nearby/shared/file-policy';
    import { createApplication } from './backend/dist/app.js';

    for (const path of ['frontend/src', 'backend/src', 'packages/shared/src']) assert.equal(existsSync(path), false, path);
    assert.equal(existsSync('node_modules/typescript'), false);
    assert.ok(import.meta.resolve('@nearby/shared/file-policy').startsWith(pathToFileURL(process.cwd() + '/').href));
    assert.equal(fileNameProblem('image.png'), null);
    assert.ok(fileNameProblem('program.exe'));
    const assets = readdirSync('frontend/dist/assets').filter(name => name.endsWith('.js'));
    const bundle = assets.map(name => readFileSync('frontend/dist/assets/' + name, 'utf8')).join('');
    assert.ok(bundle.includes('Расширение файла не разрешено'));
    assert.equal(/backend\\/src|packages\\/shared\\/src/.test(bundle), false);
    const { server, files } = createApplication();
    await files.dispose();
    server.close(() => {});
    console.log('Production-проверка пройдена: frontend, backend и shared работают без исходников и dev-зависимостей.');
  `;
  execFileSync(process.execPath, ['--input-type=module', '--eval', verify], {
    cwd: stage,
    stdio: 'inherit',
  });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
