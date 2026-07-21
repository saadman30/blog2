import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('media')
export class MediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  url!: string;

  @Column()
  key!: string;

  @Column()
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({ type: 'varchar', nullable: true })
  alt!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
