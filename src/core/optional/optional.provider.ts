import { Logger, type FactoryProvider, type Provider } from '@nestjs/common';

import { loadOptional } from './optional.util.js';

const logger = new Logger('OptionalIntegration');

export interface OptionalProviderOptions<T> {
  /**
   * Turns the raw package into the value the app injects, for example
   * `createTransport`. Called only when the package resolved, so it may assume a
   * non-null module.
   */
  use?: (module: T) => T;
  /** Extra condition beyond installation, typically an environment flag. */
  isEnabled?: () => boolean;
}

/**
 * Builds a provider whose value is the optional package, or `null` when the
 * package is missing or the feature is switched off.
 *
 * `null` is a legitimate injected value: consumers are expected to branch on it
 * and fall back, which is why the return type keeps the union instead of
 * throwing. Throwing at resolution time would make an unused feature a startup
 * failure, which is the opposite of what this foundation is for.
 */
export function createOptionalProvider<T>(
  specifier: string,
  options: OptionalProviderOptions<T> = {},
): FactoryProvider<T | null> {
  return {
    provide: specifier,
    useFactory: (): T | null => {
      if (options.isEnabled && !options.isEnabled()) {
        logger.debug(`${specifier} is registered as null, feature disabled`);
        return null;
      }

      const loaded = loadOptional<T>(specifier);

      if (loaded === null) {
        logger.debug(
          `${specifier} is not installed, provider resolves to null. ` +
            'Install it and set the matching env flag to enable the feature.',
        );
        return null;
      }

      return options.use ? options.use(loaded) : loaded;
    },
  };
}

/**
 * Every optional integration in one list, so a module imports the array and a
 * new integration is one entry rather than a new provider block.
 */
export function createOptionalProviders<T>(
  specifiers: readonly string[],
  options: OptionalProviderOptions<T> = {},
): Provider[] {
  return specifiers.map((specifier) =>
    createOptionalProvider<T>(specifier, options),
  );
}
