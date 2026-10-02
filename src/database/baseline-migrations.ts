import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import dataSourceDefinition from './data-source.js';

/**
 * Records migrations as already applied, without running them.
 *
 * ## Why this exists
 *
 * `migration:run` executes the SQL in each migration. On a database that was
 * created before this project tracked migrations — by hand, by an earlier
 * `synchronize: true`, or by a `CREATE TABLE` in a setup script — the first
 * migration fails on its first statement, because the table it creates already
 * exists. The schema is right; only the bookkeeping is missing.
 *
 * That leaves the database in a state where every `migration:run` fails and no
 * later migration can be applied. Reconciling it means writing to the `migrations`
 * table, which is what this does, and it is the only correct way: that table is
 * not a status file, it is the record of which SQL has run against this
 * particular database.
 *
 * ## When it is safe
 *
 * Only when the schema already matches what the migrations would have produced.
 * Verify that first:
 *
 *   - for every table a migration creates, confirm the columns, indexes and
 *     foreign keys exist, for example through `information_schema`;
 *   - `npm run migration:show` should list what is about to be marked;
 *   - take a backup. This script cannot undo a schema it did not create.
 *
 * ## Usage
 *
 *   npm run migration:baseline                mark every pending migration
 *   npm run migration:baseline -- InitialSchema
 *
 * The optional argument marks only migrations whose name contains that text,
 * which is how a database that already has the base tables adopts one later
 * migration without adopting all of them.
 *
 * It refuses to write without `CONFIRM_BASELINE=yes`, so a mistyped command
 * prints what it would have done and changes nothing.
 */

loadEnv();

interface MigrationEntry {
  name: string;
  timestamp: number;
}

/**
 * Every migration file on disk, oldest first.
 *
 * The stored name is the class name, which TypeORM builds as
 * `<FileName><Timestamp>` — not the file name on its own. Getting this wrong
 * writes a row the CLI never recognises as applied, so the migration silently
 * runs a second time.
 */
function migrationsOnDisk(): MigrationEntry[] {
  const directory = join(process.cwd(), 'dist', 'database', 'migrations');

  return readdirSync(directory)
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const match = /^(\d+)-(.+)\.js$/.exec(file);

      if (!match) {
        return null;
      }

      const timestamp = match[1];

      return { timestamp: Number(timestamp), name: `${match[2]}${timestamp}` };
    })
    .filter((entry): entry is MigrationEntry => entry !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function main(): Promise<void> {
  const only = process.argv[2];

  // The same options the app and the CLI use, so the two cannot disagree about
  // which database and which schema is being discussed.
  const dataSource = new DataSource(dataSourceDefinition.options);

  await dataSource.initialize();

  try {
    const applied = new Set(
      (await dataSource.query('SELECT "timestamp" FROM "migrations"')).map(
        (row: { timestamp: string }) => String(row.timestamp),
      ),
    );

    const pending = migrationsOnDisk().filter(
      (entry) => !applied.has(String(entry.timestamp)),
    );

    const targets = only
      ? pending.filter((entry) => entry.name.includes(only))
      : pending;

    if (targets.length === 0) {
      console.log(
        only
          ? `No pending migration matches "${only}".`
          : 'Nothing to baseline: every migration is already recorded.',
      );
      return;
    }

    console.log('Would record as already applied:');
    for (const entry of targets) {
      console.log(`  ${entry.timestamp} ${entry.name}`);
    }

    if (targets.length !== pending.length) {
      const skipped = pending.filter((entry) => !targets.includes(entry));
      console.log(`\nLeaving pending, because "${only}" did not match:`);
      for (const entry of skipped) {
        console.log(`  ${entry.timestamp} ${entry.name}`);
      }
    }

    if (process.env.CONFIRM_BASELINE !== 'yes') {
      console.log(
        '\nNothing was written. Check the schema matches those migrations, take a ' +
          'backup, then re-run with CONFIRM_BASELINE=yes.',
      );
      return;
    }

    for (const entry of targets) {
      await dataSource.query(
        'INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)',
        [entry.timestamp, entry.name],
      );
    }

    console.log(`\nRecorded ${targets.length} migration(s).`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
