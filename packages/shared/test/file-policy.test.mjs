import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileNameProblem } from '@nearby/shared/file-policy';

test('shared filename policy covers supported categories and rejects unsafe filenames', () => {
  for (const name of [
    'image.png',
    'clip.mp4',
    'voice.mp3',
    'document.docx',
    'archive.tar.gz',
    'README.md',
    'records.csv',
    'data.json',
  ])
    assert.equal(fileNameProblem(name), null, name);
  for (const name of [
    'run.exe',
    'run.app',
    'install.dmg',
    'install.pkg',
    'run.command',
    'run.sh',
    'run.ps1',
    'image.EXE.png',
    'notes.txt ',
    'image.svg',
  ])
    assert.ok(fileNameProblem(name), name);
});
