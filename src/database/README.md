# Database Layer

Database infrastructure: migrations, seeds and the standalone data source the
TypeORM CLI needs. No business logic lives here.

```text
database
├── data-source.ts     standalone DataSource for the TypeORM CLI
├── seed.ts            npm run seed
├── migrations/        reviewed schema changes
├── seeds/             idempotent data setup
├── entities/          shared base entities, if any are needed
├── factories/         test data builders
└── subscribers/       entity lifecycle hooks
```

Feature entities stay in their own module:

```text
modules/users/entities/user.entity.ts
modules/auth/entities/refresh-token.entity.ts
```

## `synchronize` is off

```ts
// database.config.ts
synchronize: false   // the default
```

Schema changes go through a reviewed migration. With `synchronize` on, deploying
can rewrite a production table on its own, which is not something a deploy should
be able to do.

## Commands

```bash
npm run migration:generate   # create a migration from entity changes
npm run migration:run
npm run migration:revert
npm run seed
```

Each builds first and then runs the TypeORM CLI against `dist`, so there is no
`ts-node` in the toolchain and the CLI runs the same JavaScript the app does.

## The standalone data source

`src/database/data-source.ts` exists because `autoLoadEntities` only works inside the Nest
container, and the TypeORM CLI runs outside it. Entities are therefore listed
explicitly:

```ts
export const ENTITIES = [User, RefreshToken, UserDevice, TwoFactorSecret];
```

That list is the single place to update when an entity is added. It is explicit
on purpose: a migration generated from a silently incomplete list produces a
schema that is missing tables, and the failure shows up much later.

Set `DATABASE_SCHEMA` to target a schema other than `public`. Migrations are
qualified with `"public"`, so a generated migration is portable as long as the
search path points where you expect.

## Seeding

`npm run seed` runs outside Nest too, so it cannot be triggered by a stray HTTP
request and does not need the application context.

`seeds/seeder.ts` holds the ordered list, and each seeder is idempotent — a seed
that fails halfway, or that runs twice by accident, must not create duplicates.

### The admin account

With no `ADMIN_PASSWORD`, a random 24 character password is generated and printed
once:

```text
  Admin user created.

    email    admin@example.com
    password 0CAmn49o6rRxJXtk7o7InwPg
```

That is not the same as shipping a default password, because nobody can guess it
and nobody else has ever seen it. The seeder checks for an existing admin
**before** generating anything, so a second run stays silent rather than printing
a password that will not work for the account already there.

`generatePassword` in `src/common/utils/password.util.ts` uses base64url rather than
picking characters by `byte % length`, which would favour the first few.

## Adding a migration

1. Change the entity.
2. `npm run migration:generate` with a descriptive name.
3. Read the generated file before committing. It drops whatever the previous
   schema did not have, and a mistake there is a data loss bug in a review that
   looks like boilerplate.
4. `npm run migration:run`.
5. Add the new entity to `ENTITIES` if it is not there yet.
