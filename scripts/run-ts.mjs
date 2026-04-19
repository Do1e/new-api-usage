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

const tempDirectory = mkdtempSync(join(tmpdir(), 'db-support-runner-'));
const loadedFiles = new Map();

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

globalThis.__loadTsFile = async (filePath) => {
  const absoluteFilePath = resolve(process.cwd(), filePath);
  const existingFileUrl = loadedFiles.get(absoluteFilePath);

  if (existingFileUrl) {
    return import(existingFileUrl);
  }

  const source = readFileSync(absoluteFilePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: absoluteFilePath,
  });
  const outputFilePath = join(
    tempDirectory,
    `${loadedFiles.size}-${basename(absoluteFilePath, '.ts')}.mjs`,
  );
  const outputFileUrl = pathToFileURL(outputFilePath).href;

  writeFileSync(outputFilePath, transpiled.outputText);
  loadedFiles.set(absoluteFilePath, outputFileUrl);

  return import(outputFileUrl);
};

try {
  await globalThis.__loadTsFile(inputPath);
} catch (error) {
  fail('Failed to launch TypeScript test runner.', error);
}
