import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const workspacePaths = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces;
const workspaces = workspacePaths.map((directory) => ({
  directory: resolve(root, directory),
  name: JSON.parse(readFileSync(resolve(root, directory, 'package.json'), 'utf8')).name,
}));
const shared = workspaces.find((workspace) => workspace.name === '@nearby/shared');
const exports = JSON.parse(readFileSync(join(shared.directory, 'package.json'), 'utf8')).exports;
const errors = [];

function inside(directory, target) {
  const path = relative(directory, target);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function checkImport(workspace, file, source, node, specifier) {
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const report = (message) => errors.push(`${relative(root, file)}:${line}: ${message}`);
  if (specifier.startsWith('.')) {
    if (!inside(workspace.directory, resolve(dirname(file), specifier))) {
      report(
        `Импорт за границей пакета: ${specifier}. Используйте публичный API workspace-пакета.`,
      );
    }
    return;
  }
  if (isAbsolute(specifier) || specifier.startsWith('file:')) {
    report(`Абсолютный импорт запрещён: ${specifier}`);
    return;
  }
  if (specifier === shared.name || specifier.startsWith(shared.name + '/')) {
    const subpath = specifier === shared.name ? '.' : '.' + specifier.slice(shared.name.length);
    if (!Object.hasOwn(exports, subpath)) report(`Непубличный импорт shared: ${specifier}`);
    return;
  }
  if (workspace === shared && inside(join(shared.directory, 'src'), file)) {
    report(
      `Shared должен оставаться независимым от приложений, Node.js и сторонних библиотек: ${specifier}`,
    );
    return;
  }
  const peer = workspaces.find(
    (value) =>
      value !== workspace && (specifier === value.name || specifier.startsWith(value.name + '/')),
  );
  if (peer) report(`Приложения не импортируют друг друга: ${specifier}`);
}

function visit(workspace, file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function walk(node) {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      specifier = node.moduleSpecifier;
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      specifier = node.argument.literal;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      specifier = node.arguments[0];
    else if (ts.isExternalModuleReference(node)) specifier = node.expression;
    if (specifier && ts.isStringLiteralLike(specifier))
      checkImport(workspace, file, source, node, specifier.text);
    ts.forEachChild(node, walk);
  }
  walk(source);
}

function scan(workspace, directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) scan(workspace, file);
    else if (/\.(?:[cm]?tsx?|mjs|cjs)$/.test(entry.name)) visit(workspace, file);
  }
}

for (const workspace of workspaces) {
  scan(workspace, join(workspace.directory, 'src'));
  scan(workspace, join(workspace.directory, 'test'));
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Границы пакетов соблюдены: frontend → shared ← backend.');
