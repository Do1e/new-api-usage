import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
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

const loadedFiles = new Map();
const projectRoot = process.cwd();
const tempDirectory = mkdtempSync(join(projectRoot, '.db-support-runner-'));

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

const isRelativeSpecifier = (specifier) => specifier.startsWith('./') || specifier.startsWith('../');

const isTsFile = (filePath) => ['.ts', '.tsx', '.mts', '.cts'].includes(extname(filePath));

const getScriptKind = (filePath) => {
  switch (extname(filePath)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.mts':
      return ts.ScriptKind.External;
    case '.cts':
      return ts.ScriptKind.External;
    default:
      return ts.ScriptKind.TS;
  }
};

const getTranspileCompilerOptions = (filePath) => {
  const compilerOptions = {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  };

  if (extname(filePath) === '.tsx') {
    compilerOptions.jsx = ts.JsxEmit.ReactJSX;
  }

  return compilerOptions;
};

const findExistingModulePath = (basePath) => {
  const candidates = extname(basePath)
    ? [basePath]
    : [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.mts`,
      `${basePath}.cts`,
      `${basePath}.js`,
      `${basePath}.mjs`,
      `${basePath}.cjs`,
      join(basePath, 'index.ts'),
      join(basePath, 'index.tsx'),
      join(basePath, 'index.mts'),
      join(basePath, 'index.cts'),
      join(basePath, 'index.js'),
      join(basePath, 'index.mjs'),
      join(basePath, 'index.cjs'),
    ];

  return candidates.find((candidate) => existsSync(candidate));
};

const resolveMappedSpecifier = (specifier, containingFilePath) => {
  if (specifier.startsWith('@/')) {
    return findExistingModulePath(resolve(projectRoot, specifier.slice(2)));
  }

  if (isRelativeSpecifier(specifier)) {
    return findExistingModulePath(resolve(dirname(containingFilePath), specifier));
  }

  return undefined;
};

const getModuleSpecifier = (node) => {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier;
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0];
  }

  return undefined;
};

const rewriteModuleSpecifiers = async (source, absoluteFilePath) => {
  const sourceFile = ts.createSourceFile(
    absoluteFilePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(absoluteFilePath),
  );
  const replacements = [];

  const visit = (node) => {
    const moduleSpecifier = getModuleSpecifier(node);

    if (moduleSpecifier) {
      replacements.push(moduleSpecifier);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const resolvedReplacements = [];

  for (const moduleSpecifier of replacements) {
    const resolvedPath = resolveMappedSpecifier(moduleSpecifier.text, absoluteFilePath);

    if (!resolvedPath) {
      continue;
    }

    const replacementUrl = isTsFile(resolvedPath)
      ? await loadTsFile(resolvedPath)
      : pathToFileURL(resolvedPath).href;

    resolvedReplacements.push({
      end: moduleSpecifier.getEnd(sourceFile),
      start: moduleSpecifier.getStart(sourceFile),
      value: JSON.stringify(replacementUrl),
    });
  }

  return resolvedReplacements
    .sort((first, second) => second.start - first.start)
    .reduce((rewrittenSource, replacement) => (
      `${rewrittenSource.slice(0, replacement.start)}${replacement.value}${rewrittenSource.slice(replacement.end)}`
    ), source);
};

const loadTsFile = async (filePath) => {
  const absoluteFilePath = resolve(projectRoot, filePath);
  const existingFileUrl = loadedFiles.get(absoluteFilePath);

  if (existingFileUrl) {
    await import(existingFileUrl);
    return existingFileUrl;
  }

  const source = readFileSync(absoluteFilePath, 'utf8');
  const outputFilePath = join(
    tempDirectory,
    `${loadedFiles.size}-${basename(absoluteFilePath, extname(absoluteFilePath))}.mjs`,
  );
  const outputFileUrl = pathToFileURL(outputFilePath).href;

  loadedFiles.set(absoluteFilePath, outputFileUrl);

  const rewrittenSource = await rewriteModuleSpecifiers(source, absoluteFilePath);
  const transpiled = ts.transpileModule(rewrittenSource, {
    compilerOptions: getTranspileCompilerOptions(absoluteFilePath),
    fileName: absoluteFilePath,
  });

  writeFileSync(outputFilePath, transpiled.outputText);

  await import(outputFileUrl);
  return outputFileUrl;
};

globalThis.__loadTsFile = loadTsFile;

try {
  await globalThis.__loadTsFile(inputPath);
} catch (error) {
  fail('Failed to launch TypeScript test runner.', error);
}
