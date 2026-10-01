import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Role } from '../../../common/enums/index.js';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: Role.User,
  })
  role!: Role;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: false })
  isManager!: boolean;

  /**
   * Whether the address in `email` has been confirmed.
   *
   * A row of its own rather than "is there a live verification token", because
   * the token is deleted on confirmation and on retention while this is the
   * lasting answer. Phase 19 uses it to gate sensitive actions.
   */
  @Column({ type: 'boolean', default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
