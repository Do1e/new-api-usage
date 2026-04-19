import * as fsPromises from 'node:fs/promises';
import { run } from 'node:test';

const { glob } = fsPromises as typeof fsPromises & {
  glob: (pattern: string) => AsyncIterable<string>;
};

const testFiles = (await Array.fromAsync(glob('tests/**/*.test.ts'))).sort();

if (testFiles.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const stream = run({
  concurrency: false,
  files: testFiles,
});

stream.on('test:fail', () => {
  process.exitCode = 1;
});
