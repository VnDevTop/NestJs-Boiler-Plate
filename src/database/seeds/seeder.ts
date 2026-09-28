import type { DataSource } from 'typeorm';

import { AdminSeeder, type Seeder } from './admin.seeder.js';

/**
 * Runs every seeder in order and reports what happened, so a seed is never a
 * silent no-op that leaves the environment unusable.
 */
export const SEEDERS: Seeder[] = [new AdminSeeder()];

export async function runSeeders(dataSource: DataSource): Promise<void> {
  for (const seeder of SEEDERS) {
    await seeder.run(dataSource);
    process.stdout.write(`  seeded: ${seeder.name}\n`);
  }
}
