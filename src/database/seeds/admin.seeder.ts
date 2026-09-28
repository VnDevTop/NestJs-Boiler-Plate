import type { DataSource } from 'typeorm';

import { generatePassword, hashPassword } from '../../common/utils/index.js';
import { Role } from '../../common/enums/index.js';
import { User } from '../../modules/users/entities/index.js';

export interface Seeder {
  name: string;
  run(dataSource: DataSource): Promise<void>;
}

const MIN_PASSWORD_LENGTH = 12;

/**
 * Creates the first administrator.
 *
 * Idempotent on purpose: a seed that fails halfway, or that runs twice by
 * accident, must not create a second admin or fail on a unique email.
 *
 * With no ADMIN_PASSWORD a random one is generated and printed. That is not the
 * same as shipping a default password, because nobody can guess it and nobody
 * else has ever seen it. It is only shown here, and only when the account was
 * actually created.
 */
export class AdminSeeder implements Seeder {
  readonly name = 'admin';

  async run(dataSource: DataSource): Promise<void> {
    const email = (
      process.env.ADMIN_EMAIL ?? 'admin@example.com'
    ).toLowerCase();
    const users = dataSource.getRepository(User);
    const existing = await users.findOneBy({ email });

    // Checked before anything is generated, so a second run is silent and does
    // not print a password for an account that already has a different one.
    if (existing) {
      return;
    }

    const provided = process.env.ADMIN_PASSWORD;

    if (provided && provided.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }

    const password = provided ?? generatePassword();

    await users.insert({
      email,
      password: await hashPassword(password),
      firstName: 'Admin',
      lastName: null,
      role: Role.Admin,
      isActive: true,
      isManager: true,
    });

    if (!provided) {
      this.printCredentials(email, password);
    }
  }

  private printCredentials(email: string, password: string): void {
    process.stdout.write(
      [
        '',
        '  Admin user created.',
        '',
        `    email    ${email}`,
        `    password ${password}`,
        '',
        '  This password is shown once and is not stored anywhere in the clear.',
        '  Save it now and change it after the first sign in.',
        '',
      ].join('\n'),
    );
  }
}
