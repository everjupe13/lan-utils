import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureSparkle, readRelease, updateFeed } from './macos-updates.mjs';

if (process.platform !== 'darwin') throw new Error('Сборка .app доступна только на macOS.');
const release = readRelease();
if (Buffer.from(release.publicKey, 'base64').length !== 32)
  throw new Error('Сначала выполните npm run setup:mac-updates.');
const sparkle = ensureSparkle(release);
const signingIdentity = process.env.MACOS_SIGNING_IDENTITY || '-';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = join(root, 'dist');
mkdirSync(target, { recursive: true });
// Express's static-file server rejects paths under hidden directories.
const stage = mkdtempSync(join(target, 'macos-'));
const cache = join(root, '.cache', 'swift');
mkdirSync(cache, { recursive: true });
const app = join(stage, 'Рядом.app');
const contents = join(app, 'Contents');
const resources = join(contents, 'Resources');
const runtime = join(resources, 'runtime');
const executable = join(contents, 'MacOS', 'Nearby');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Запускайте через npm run build:mac.');

function run(command, args) {
  return execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

try {
  mkdirSync(dirname(executable), { recursive: true });
  mkdirSync(runtime, { recursive: true });
  cpSync(join(root, 'desktop/macos/Info.plist'), join(contents, 'Info.plist'));
  for (const [key, value] of Object.entries({
    CFBundleShortVersionString: release.version,
    CFBundleVersion: String(release.build),
    SUFeedURL: updateFeed(release, process.arch),
    SUPublicEDKey: release.publicKey,
  }))
    run('/usr/bin/plutil', ['-replace', key, '-string', value, join(contents, 'Info.plist')]);
  const framework = join(contents, 'Frameworks/Sparkle.framework');
  mkdirSync(dirname(framework), { recursive: true });
  // ditto preserves the versioned framework's symlinks and code resources.
  run('/usr/bin/ditto', [join(sparkle, 'Sparkle.framework'), framework]);
  cpSync(join(sparkle, 'LICENSE'), join(resources, 'Sparkle-LICENSE.txt'));
  cpSync(process.execPath, join(resources, 'node'));
  // nvm's official Node builds are self-contained; reject Homebrew/dylib
  // dependencies rather than silently creating an app that only runs here.
  const libraries = execFileSync('/usr/bin/otool', ['-L', join(resources, 'node')], {
    encoding: 'utf8',
  });
  const nonSystem = libraries
    .split('\n')
    .slice(1)
    .filter((line) => line.trim())
    .filter((line) => !/^\s*\/(usr\/lib|System\/Library)\//.test(line));
  if (nonSystem.length)
    throw new Error(
      `Node.js зависит от внешних библиотек. Используйте официальный Node.js из nodejs.org или nvm:\n${nonSystem.join('\n')}`,
    );

  cpSync(join(root, 'package.json'), join(runtime, 'package.json'));
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const workspace of manifest.workspaces) {
    if (!existsSync(join(root, workspace, 'dist')))
      throw new Error(`Сначала соберите ${workspace}.`);
    mkdirSync(join(runtime, workspace), { recursive: true });
    cpSync(join(root, workspace, 'package.json'), join(runtime, workspace, 'package.json'));
    cpSync(join(root, workspace, 'dist'), join(runtime, workspace, 'dist'), { recursive: true });
  }
  // Use npm's actual production dependency graph. No download, global npm,
  // development tools, or symlinks back to the checkout in the delivered app.
  const dependencies = execFileSync(
    process.execPath,
    [npmCli, 'ls', '--omit=dev', '--all', '--parseable'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
    .trim()
    .split('\n')
    .slice(1);
  for (const dependency of new Set(dependencies)) {
    const path = relative(root, dependency);
    if (!path.startsWith(`node_modules${sep}`) && !path.includes(`${sep}node_modules${sep}`))
      throw new Error(`Зависимость вне проекта: ${dependency}`);
    const output = join(runtime, path);
    const source = realpathSync(dependency);
    mkdirSync(dirname(output), { recursive: true });
    if (manifest.workspaces.some((workspace) => resolve(root, workspace) === source)) {
      symlinkSync(relative(dirname(output), join(runtime, relative(root, source))), output);
    } else {
      cpSync(source, output, {
        recursive: true,
        // Nested dependencies are copied separately from npm's graph.
        filter: (entry) =>
          entry === source || !relative(source, entry).split(sep).includes('node_modules'),
      });
    }
  }
  cpSync(join(root, 'desktop/server.mjs'), join(runtime, 'server.mjs'));
  run('/usr/bin/xcrun', [
    'swiftc',
    '-swift-version',
    '5',
    '-O',
    '-parse-as-library',
    '-target',
    `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx13.5`,
    '-module-cache-path',
    cache,
    join(root, 'desktop/macos/Nearby.swift'),
    join(root, 'desktop/macos/Updates.swift'),
    '-F',
    join(contents, 'Frameworks'),
    '-framework',
    'Sparkle',
    '-Xlinker',
    '-rpath',
    '-Xlinker',
    '@executable_path/../Frameworks',
    '-o',
    executable,
  ]);

  const iconTool = join(stage, 'make-icon');
  run('/usr/bin/xcrun', [
    'swiftc',
    '-module-cache-path',
    cache,
    join(root, 'desktop/macos/MakeIcon.swift'),
    '-o',
    iconTool,
  ]);
  const iconset = join(stage, 'AppIcon.iconset');
  run(iconTool, [iconset]);
  run('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'AppIcon.icns')]);
  run('/usr/bin/plutil', ['-lint', join(contents, 'Info.plist')]);
  // Sign inside out, including Sparkle's installer and XPC helpers.
  const frameworkVersion = realpathSync(join(framework, 'Versions/Current'));
  for (const binary of [
    join(resources, 'node'),
    join(frameworkVersion, 'Autoupdate'),
    join(frameworkVersion, 'Updater.app'),
    join(frameworkVersion, 'XPCServices/Downloader.xpc'),
    join(frameworkVersion, 'XPCServices/Installer.xpc'),
    framework,
    app,
  ]) {
    const signing = ['--force', '--sign', signingIdentity];
    if (signingIdentity !== '-') signing.push('--timestamp', '--options', 'runtime');
    if (binary === join(resources, 'node') && signingIdentity !== '-')
      signing.push('--entitlements', join(root, 'desktop/macos/Node.entitlements'));
    run('/usr/bin/codesign', [...signing, binary]);
  }
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  // Exercise the delivered Node binary and dependencies, with all writable
  // data outside the bundle. A packaging failure must not replace the old app.
  execFileSync(process.execPath, ['--test', join(root, 'desktop/test/server.test.mjs')], {
    cwd: stage,
    env: { ...process.env, NEARBY_DESKTOP_RESOURCES: resources },
    stdio: 'inherit',
  });
  const destination = join(target, 'Рядом.app');
  rmSync(destination, { recursive: true, force: true });
  renameSync(app, destination);
  console.log(
    `\nГотово: ${destination}\nmacOS 13.5+, ${process.arch}. Откройте .app в Finder. Автозапуска при входе нет.`,
  );
} finally {
  rmSync(stage, { recursive: true, force: true });
}
