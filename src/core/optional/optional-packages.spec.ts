import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OPTIONAL_PACKAGES } from './optional-packages.js';

const SRC_ROOT = join(process.cwd(), 'src');

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);

    if (statSync(full).isDirectory()) {
      return collectSourceFiles(full);
    }

    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

// Matches `import ... from 'pkg'` and `export ... from 'pkg'`, including the
// type-only forms, which still fail the build when the package is missing.
const STATIC_IMPORT = /\b(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;

function staticImportsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers: string[] = [];

  for (const match of source.matchAll(STATIC_IMPORT)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

describe('optional packages are never statically imported', () => {
  const files = collectSourceFiles(SRC_ROOT);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(OPTIONAL_PACKAGES))(
    'no source file statically imports %s',
    (specifier) => {
      const offenders = files
        .filter((file) => staticImportsOf(file).includes(specifier))
        .map((file) => file.replace(`${process.cwd()}/`, ''));

      expect(offenders).toEqual([]);
    },
  );

  it('keeps the package list free of anything already required', () => {
    const required = files.flatMap(staticImportsOf);

    for (const specifier of Object.keys(OPTIONAL_PACKAGES)) {
      expect(required).not.toContain(specifier);
    }
  });
});
