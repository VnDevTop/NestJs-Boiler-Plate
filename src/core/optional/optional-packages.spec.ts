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

  // The `specifier` field, not the registry key: they differ for BullMQ, whose
  // key is `bullmq` and whose specifier is `@nestjs/bullmq`. Checking the key
  // would guard `from 'bullmq'` and wave through `from '@nestjs/bullmq'`, which
  // is the same failure with a different spelling.
  const specifiers = Object.values(OPTIONAL_PACKAGES).map(
    (entry) => entry.specifier,
  );

  it.each(specifiers)('no source file statically imports %s', (specifier) => {
    const offenders = files
      .filter((file) => staticImportsOf(file).includes(specifier))
      .map((file) => file.replace(`${process.cwd()}/`, ''));

    expect(offenders).toEqual([]);
  });

  it('keeps the package list free of anything already required', () => {
    const required = files.flatMap(staticImportsOf);

    for (const specifier of specifiers) {
      expect(required).not.toContain(specifier);
    }
  });

  it('guards both spellings of a scoped provider, not just the bare one', () => {
    // Without this the `it.each` above would quietly check `bullmq` while the
    // adapter imports `@nestjs/bullmq`, and the test would pass on a violation.
    expect(specifiers).toContain('@nestjs/bullmq');
  });
});
