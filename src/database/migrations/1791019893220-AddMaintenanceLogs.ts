import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaintenanceLogs1791019893220 implements MigrationInterface {
  name = 'AddMaintenanceLogs1791019893220';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "maintenance_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "finishedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "durationMs" integer NOT NULL, "dryRun" boolean NOT NULL, "totalDeleted" integer NOT NULL DEFAULT '0', "timedOut" boolean NOT NULL DEFAULT false, "trigger" character varying(20) NOT NULL DEFAULT 'cron', "pending" jsonb NOT NULL DEFAULT '[]'::jsonb, "failedTargets" jsonb NOT NULL DEFAULT '[]'::jsonb, "targets" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_096e4b6bb7c9fe74d960e7523e4" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "maintenance_logs"`);
  }
}
