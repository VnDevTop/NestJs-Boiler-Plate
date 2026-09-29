import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenTables1790713844015 implements MigrationInterface {
  name = 'AddTokenTables1790713844015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "email" character varying(255) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "ipAddress" character varying(100), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_90489f8f3368c45f461e90efbe" ON "email_verification_tokens"  ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_464e435574cc84eb70e4baef19" ON "email_verification_tokens"  ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verification_tokens_user" ON "email_verification_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "ipAddress" character varying(100), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_1143abb8c3fad8b06dd857a8c9" ON "password_reset_tokens"  ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f75f11ca4ed69b941336c5d0e3" ON "password_reset_tokens"  ("expiresAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_reset_tokens_user" ON "password_reset_tokens"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "FK_10f285d038feb767bf7c2da14b3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_d6a19d4b4f6c62dcd29daa497e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "FK_10f285d038feb767bf7c2da14b3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_password_reset_tokens_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f75f11ca4ed69b941336c5d0e3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1143abb8c3fad8b06dd857a8c9"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_email_verification_tokens_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_464e435574cc84eb70e4baef19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_90489f8f3368c45f461e90efbe"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
  }
}
