import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const ROOT_DIR = resolve(CURRENT_FILE_PATH, '..', '..');
const SEARCH_DIRECTORIES = [
  join(ROOT_DIR, 'scripts'),
  join(ROOT_DIR, 'test'),
  join(ROOT_DIR, 'tests'),
];
const RUNNER_FILE_NAME = basename(CURRENT_FILE_PATH);

const collectTestFiles = async (directory: string): Promise<string[]> => {
  const entries: Array<{
    isDirectory: () => boolean;
    name: string;
  }> = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const testFiles: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      testFiles.push(...(await collectTestFiles(entryPath)));
      continue;
    }

    const isTypeScriptFile = extname(entry.name) === '.ts';
    const isRunnerFile = entry.name === RUNNER_FILE_NAME;
    const isTestFile = entry.name.endsWith('.test.ts');

    if (isTypeScriptFile && isTestFile && !isRunnerFile) {
      testFiles.push(entryPath);
    }
  }

  return testFiles;
};

const discoveredTestFiles = (
  await Promise.all(SEARCH_DIRECTORIES.map(async (directory) => collectTestFiles(directory)))
).flat().sort();

for (const filePath of discoveredTestFiles) {
  await import(pathToFileURL(filePath).href);
}

test('db support test files exist', () => {
  assert.ok(
    discoveredTestFiles.length > 0,
    'No db support test files found. Add at least one *.test.ts file under scripts/, test/, or tests/.',
  );
});
