import { MigrationInterface, QueryRunner } from 'typeorm';

export class CascadeUserChildren1790971189127 implements MigrationInterface {
  name = 'CascadeUserChildren1790971189127';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "two_factor_secrets" ADD CONSTRAINT "FK_19f5536918227dabaddff3a7a50" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "two_factor_secrets" DROP CONSTRAINT "FK_19f5536918227dabaddff3a7a50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
