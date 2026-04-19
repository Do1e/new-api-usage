import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as nodeTest from 'node:test';

const TEST_DIRECTORY = 'tests';
const TEST_FILE_SUFFIX = '.test.ts';

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
  if (typeof nodeTest.run !== 'function') {
    fail(new Error('This test runner requires a Node.js release with node:test run() support.'));
  }

  const testFiles = await collectTestFiles(TEST_DIRECTORY);

  if (testFiles.length === 0) {
    console.error('No test files found.');
    process.exit(1);
  }

  const stream = nodeTest.run({
    concurrency: false,
    files: testFiles,
  });

  stream.on('error', (error) => {
    fail(error);
  });

  stream.on('test:fail', () => {
    process.exitCode = 1;
  });

  stream.pipe(process.stdout);
};

void main().catch((error: unknown) => {
  fail(error);
});
