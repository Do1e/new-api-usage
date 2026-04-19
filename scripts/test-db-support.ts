import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const TEST_DIRECTORY = 'tests';
const TEST_FILE_SUFFIX = '.test.ts';

type LoadTsFile = (filePath: string) => Promise<unknown>;

const fail = (error: unknown): never => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Test runner failed.');
  }

  process.exit(1);
};

const collectTestFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  });
  const testFiles: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      testFiles.push(...(await collectTestFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(TEST_FILE_SUFFIX)) {
      testFiles.push(entryPath);
    }
  }

  return testFiles.sort();
};

const main = async (): Promise<void> => {
  try {
    const nodeTest = await import('node:test');

    if (typeof nodeTest.test !== 'function') {
      fail(new Error('This test runner requires a Node.js release with node:test support.'));
    }
  } catch (_error) {
    fail(new Error('This test runner requires a Node.js release with node:test support.'));
  }

  const maybeLoadTsFile = (globalThis as { __loadTsFile?: LoadTsFile }).__loadTsFile;

  if (typeof maybeLoadTsFile !== 'function') {
    fail(new Error('TypeScript test loader is not available.'));
  }

  const loadTsFile = maybeLoadTsFile as LoadTsFile;

  const testFiles = await collectTestFiles(TEST_DIRECTORY);

  if (testFiles.length === 0) {
    console.error('No test files found.');
    process.exit(1);
  }

  for (const testFile of testFiles) {
    await loadTsFile(resolve(process.cwd(), testFile));
  }
};

void main().catch((error: unknown) => {
  fail(error);
});
