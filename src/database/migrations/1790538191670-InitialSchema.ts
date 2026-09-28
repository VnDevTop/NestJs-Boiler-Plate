import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790538191670 implements MigrationInterface {
  name = 'InitialSchema1790538191670';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public"."users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "firstName" character varying(100), "lastName" character varying(100), "role" character varying(50) NOT NULL DEFAULT 'user', "isActive" boolean NOT NULL DEFAULT true, "isManager" boolean NOT NULL DEFAULT false, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "public"."users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "public"."refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jti" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "revokedReason" character varying(50), "replacedById" uuid, "deviceId" uuid, "ipAddress" character varying(100), "userAgent" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f3752400c98d5c0b3dca54d66d" ON "public"."refresh_tokens"  ("jti") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9769b295a8d670435ce210ba15" ON "public"."refresh_tokens"  ("deviceId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_revoked" ON "public"."refresh_tokens"  ("userId", "revokedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "public"."two_factor_secrets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "secretCiphertext" text NOT NULL, "secretIv" text NOT NULL, "secretAuthTag" text NOT NULL, "recoveryCodes" text array NOT NULL DEFAULT '{}', "isEnabled" boolean NOT NULL DEFAULT false, "enabledAt" TIMESTAMP WITH TIME ZONE, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "lastUsedCounter" integer, "failedAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5de07b983d9faff52e651db7f96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_19f5536918227dabaddff3a7a5" ON "public"."two_factor_secrets"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "public"."user_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "deviceName" character varying(100), "ipAddress" character varying(100), "userAgent" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c9e7e648903a9e537347aba4371" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_devices_user_active" ON "public"."user_devices"  ("userId", "isActive") `,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."user_devices" ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."user_devices" DROP CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "public"."refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_devices_user_active"`,
    );
    await queryRunner.query(`DROP TABLE "public"."user_devices"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_19f5536918227dabaddff3a7a5"`,
    );
    await queryRunner.query(`DROP TABLE "public"."two_factor_secrets"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_user_revoked"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9769b295a8d670435ce210ba15"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f3752400c98d5c0b3dca54d66d"`,
    );
    await queryRunner.query(`DROP TABLE "public"."refresh_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "public"."users"`);
  }
}
