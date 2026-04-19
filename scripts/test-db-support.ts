import * as fsPromises from 'node:fs/promises';
import { run } from 'node:test';

const { glob } = fsPromises as typeof fsPromises & {
  glob: (pattern: string) => AsyncIterable<string>;
};

const MINIMUM_NODE_MAJOR = 22;

const fail = (error: unknown): never => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Test runner failed.');
  }

  process.exit(1);
};

const collectTestFiles = async (): Promise<string[]> => {
  const testFiles: string[] = [];

  for await (const testFile of glob('tests/**/*.test.ts')) {
    testFiles.push(testFile);
  }

  return testFiles.sort();
};

const main = async (): Promise<void> => {
  const nodeMajorVersion = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);

  if (nodeMajorVersion < MINIMUM_NODE_MAJOR) {
    fail(new Error(`Node ${MINIMUM_NODE_MAJOR}+ is required to run db support tests.`));
  }

  const testFiles = await collectTestFiles();

  if (testFiles.length === 0) {
    console.error('No test files found.');
    process.exit(1);
  }

  const stream = run({
    concurrency: false,
    files: testFiles,
  });

  stream.on('error', (error) => {
    fail(error);
  });

  stream.on('test:fail', () => {
    process.exitCode = 1;
  });
};

void main().catch((error: unknown) => {
  fail(error);
});
