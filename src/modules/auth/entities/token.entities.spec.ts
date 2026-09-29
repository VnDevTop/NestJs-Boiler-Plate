import { getMetadataArgsStorage } from 'typeorm';

import { describe, expect, it } from 'vitest';

import './index.js';

const VERIFICATION = 'email_verification_tokens';
const RESET = 'password_reset_tokens';

/**
 * `getMetadataArgsStorage()` keeps columns, indices and relations in three
 * separate lists keyed by the target class, so a table's own metadata is not
 * enough to answer anything about its shape.
 *
 * Looked up lazily and by target class rather than by table name, because the
 * entity class here is the same object the storage holds only when this module
 * is loaded in the same graph as the entities, which a bare side-effect import
 * does not guarantee.
 */
function storage() {
  return getMetadataArgsStorage();
}

function tableOf(name: string) {
  return storage().tables.find((table) => table.name === name);
}

function targetOf(name: string) {
  return tableOf(name)?.target;
}

function columnsOf(name: string) {
  const target = targetOf(name);

  return target
    ? storage().columns.filter((column) => column.target === target)
    : [];
}

function columnOf(name: string, property: string) {
  return columnsOf(name).find((column) => column.propertyName === property);
}

function indexesOf(name: string) {
  const target = targetOf(name);

  return target
    ? storage().indices.filter((index) => index.target === target)
    : [];
}

/**
 * The property names an index covers.
 *
 * `columns` on a decorator index is `string[]` or a function producing one
 * depending on the metadata kind, so it is narrowed rather than assumed.
 */
function indexedColumns(name: string): string[] {
  return indexesOf(name).flatMap((index) => {
    const { columns } = index as { columns?: unknown };

    return Array.isArray(columns)
      ? columns.map((column) => String(column))
      : [];
  });
}

function relationsOf(name: string) {
  const target = targetOf(name);

  return target
    ? storage().relations.filter((relation) => relation.target === target)
    : [];
}

describe('EmailVerificationToken', () => {
  it('maps to the table name Phase 16 will purge', () => {
    expect(tableOf(VERIFICATION)).toBeDefined();
  });

  it('stores a 64 character hash, which is what sha256 hex is', () => {
    // A plaintext column here would make the table a list of working tokens.
    // The decorator stores the sql type and length inside `options`.
    const column = columnOf(VERIFICATION, 'tokenHash');

    expect(column?.options?.type).toBe('varchar');
    expect(column?.options?.length).toBe(64);
    expect(column?.options?.nullable).toBeFalsy();
  });

  it('stores no column that could hold the token itself', () => {
    const names = columnsOf(VERIFICATION).map((column) => column.propertyName);

    expect(names).not.toContain('token');
    expect(names).toContain('tokenHash');
  });

  it('indexes the hash uniquely, so a lookup is an equality match', () => {
    expect(
      indexesOf(VERIFICATION).filter((index) => index.unique).length,
    ).toBeGreaterThan(0);
  });

  it('indexes expiresAt, which is the column retention deletes on', () => {
    // An unindexed range scan here is a nightly cost that grows forever.
    expect(indexedColumns(VERIFICATION)).toContain('expiresAt');
  });

  it('records the address the token verifies', () => {
    // A user who changes address must not confirm the new one with a token
    // minted for the old one.
    expect(columnOf(VERIFICATION, 'email')).toBeDefined();
  });

  it('leaves usedAt null until the address is confirmed', () => {
    expect(columnOf(VERIFICATION, 'usedAt')?.options?.nullable).toBe(true);
  });

  it('cascades a user delete, since a token without a user is meaningless', () => {
    const relations = relationsOf(VERIFICATION);

    expect(relations).toHaveLength(1);
    expect(relations[0].options?.onDelete).toBe('CASCADE');
  });
});

describe('PasswordResetToken', () => {
  it('maps to the table name Phase 16 will purge', () => {
    expect(tableOf(RESET)).toBeDefined();
  });

  it('stores a 64 character hash, never the token', () => {
    expect(columnOf(RESET, 'tokenHash')?.options?.length).toBe(64);

    const names = columnsOf(RESET).map((c) => c.propertyName);
    expect(names).not.toContain('token');
  });

  it('indexes the hash uniquely', () => {
    expect(
      indexesOf(RESET).filter((index) => index.unique).length,
    ).toBeGreaterThan(0);
  });

  it('indexes expiresAt, which is the column retention deletes on', () => {
    expect(indexedColumns(RESET)).toContain('expiresAt');
  });

  it('leaves usedAt nullable, so null means the token is still usable', () => {
    // The usable condition is `usedAt IS NULL AND expiresAt > now`, which is why
    // a separate boolean that could disagree with the timestamp is not stored.
    expect(columnOf(RESET, 'usedAt')?.options?.nullable).toBe(true);
  });

  it('requires expiresAt, since a token with no deadline never expires', () => {
    expect(columnOf(RESET, 'expiresAt')?.options?.nullable).toBe(undefined);
  });

  it('records the requesting ip, which the email shows the user', () => {
    expect(columnOf(RESET, 'ipAddress')?.options?.nullable).toBe(true);
  });

  it('cascades a user delete', () => {
    const relations = relationsOf(RESET);

    expect(relations[0].options?.onDelete).toBe('CASCADE');
  });
});
