import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getMetadataArgsStorage } from 'typeorm';

import { describe, expect, it } from 'vitest';

import './index.js';

/**
 * Both tables are children of `users`, and both had to be re-pointed before the
 * retention job could hard-delete a user at all.
 *
 * - `user_devices` was `ON DELETE NO ACTION`, so deleting a user who still had a
 *   device raised a foreign key violation. The retention job runs at 3am, so that
 *   failure would have been found in the morning.
 * - `two_factor_secrets` had no foreign key at all, because the entity declared
 *   the column without a relation. Hard-deleting a user orphaned the secret
 *   permanently, which is the exact row this phase exists to remove.
 */
function relationTo(table: string) {
  const storage = getMetadataArgsStorage();
  const target = storage.tables.find((entry) => entry.name === table)?.target;

  return target
    ? storage.relations.find(
        (relation) =>
          relation.target === target && relation.relationType === 'many-to-one',
      )
    : undefined;
}

describe('user_devices relation to users', () => {
  it('cascades, so a hard-deleted user takes their devices with them', () => {
    expect(relationTo('user_devices')?.options.onDelete).toBe('CASCADE');
  });
});

describe('two_factor_secrets relation to users', () => {
  it('exists at all, which it did not before', () => {
    expect(relationTo('two_factor_secrets')).toBeDefined();
  });

  it('cascades, so no orphaned secret is left behind', () => {
    expect(relationTo('two_factor_secrets')?.options.onDelete).toBe('CASCADE');
  });
});

/**
 * The metadata above says what the entities declare. This says what actually
 * runs, which is the thing a deployment executes. A join column is only as good
 * as the generated constraint, and the migration is the artifact that decides it.
 */
describe('the migration that applies the cascades', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'src',
      'database',
      'migrations',
      '1790971189127-CascadeUserChildren.ts',
    ),
    'utf8',
  );

  it('adds a cascading constraint on user_devices', () => {
    const adds = migration.match(
      /ALTER TABLE "user_devices" ADD CONSTRAINT[^`]*ON DELETE CASCADE/,
    );

    expect(adds).not.toBeNull();
  });

  it('adds the cascading constraint on two_factor_secrets that was missing', () => {
    const adds = migration.match(
      /ALTER TABLE "two_factor_secrets" ADD CONSTRAINT[^`]*ON DELETE CASCADE/,
    );

    expect(adds).not.toBeNull();
  });

  it('drops the no-action constraint before adding the cascading one', () => {
    // Adding a second constraint on the same column would fail, so the order in
    // `up` is load-bearing and a regenerated migration would break.
    const dropAt = migration.indexOf(
      'ALTER TABLE "user_devices" DROP CONSTRAINT',
    );
    const addAt = migration.indexOf(
      'ALTER TABLE "user_devices" ADD CONSTRAINT',
    );

    expect(dropAt).toBeGreaterThan(-1);
    expect(addAt).toBeGreaterThan(dropAt);
  });

  it('reverses both constraints in down, so the change is revertable', () => {
    const [, down] = migration.split('public async down');

    expect(down).toContain('ALTER TABLE "user_devices" DROP CONSTRAINT');
    expect(down).toContain('ALTER TABLE "two_factor_secrets" DROP CONSTRAINT');
    expect(down).toContain('ON DELETE NO ACTION');
  });
});
