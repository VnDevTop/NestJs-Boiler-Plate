import 'reflect-metadata';

import dataSource from './data-source.js';
import { runSeeders } from './seeds/index.js';

/**
 * `npm run seed`. Runs outside Nest on purpose, so it cannot be triggered by a
 * stray HTTP request and does not need the whole application context.
 */
async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    process.stdout.write('Running seeders\n');
    await runSeeders(dataSource);
    process.stdout.write('Seed complete\n');
  } finally {
    await dataSource.destroy();
  }
}

await seed().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${String(error)}\n`);
  process.exit(1);
});
