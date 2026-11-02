import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileNameProblem } from '@nearby/shared';
import { ALLOWED_FILE_EXTENSIONS } from '@nearby/shared/file-policy';

test('public package exports resolve to compiled ESM without source imports', async () => {
  assert.match(import.meta.resolve('@nearby/shared/file-policy'), /\/dist\/file-policy\.js$/);
  assert.equal(fileNameProblem('report.pdf'), null);
  assert.ok(ALLOWED_FILE_EXTENSIONS.includes('.png'));
  for (const subpath of ['chess', 'person', 'room', 'protocol', 'chat', 'files']) {
    await import(`@nearby/shared/${subpath}`);
  }
  assert.throws(() => import.meta.resolve('@nearby/shared/src/file-policy'), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  });
});
