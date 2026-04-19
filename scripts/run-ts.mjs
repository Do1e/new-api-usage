import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const fail = (message, error) => {
  console.error(message);

  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }

  process.exit(1);
};

const inputPath = process.argv[2];

if (!inputPath) {
  fail('Missing TypeScript entry file.');
}

const absoluteInputPath = resolve(process.cwd(), inputPath);
const source = readFileSync(absoluteInputPath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: absoluteInputPath,
});
const tempDirectory = mkdtempSync(join(tmpdir(), 'db-support-runner-'));
const tempFilePath = join(tempDirectory, `${basename(absoluteInputPath, '.ts')}.mjs`);

const cleanup = () => {
  rmSync(tempDirectory, { force: true, recursive: true });
};

process.once('exit', cleanup);
process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

try {
  writeFileSync(tempFilePath, transpiled.outputText);
  await import(pathToFileURL(tempFilePath).href);
} catch (error) {
  fail('Failed to launch TypeScript test runner.', error);
}
