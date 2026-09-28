import { createRequire } from 'node:module';

// `createRequire` gives a CJS resolver that runs in an ESM build, which this
// project is. Importing a package with a bare `import` is resolved statically at
// build time, so a missing optional package becomes a build failure instead of a
// disabled feature. Everything optional goes through here instead.
const requireOptional = createRequire(import.meta.url);

/**
 * Loads an optional package, returning `null` when it is not installed.
 *
 * `null` is a supported value, not an error: the caller decides what a disabled
 * feature means, which is almost always "fall back to the in-house
 * implementation" or "leave the transport unregistered".
 */
export function loadOptional<T>(specifier: string): T | null {
  try {
    // Some packages are CommonJS and expose the namespace under `default` when
    // required from ESM, so both shapes are unwrapped to the same value.
    const loaded = requireOptional(specifier) as T & { default?: T };
    return loaded?.default ?? (loaded as T);
  } catch {
    return null;
  }
}

/**
 * True when the package can be resolved, without loading it twice in a caller
 * that then needs the module anyway.
 */
export function isOptionalAvailable(specifier: string): boolean {
  return loadOptional<unknown>(specifier) !== null;
}
