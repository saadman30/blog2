import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostEntity } from './post.entity';

@Entity('analytics')
export class AnalyticsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  postId!: string;

  @Column({ type: 'int', default: 0 })
  views!: number;

  @Column({ type: 'int', default: 0 })
  claps!: number;

  @OneToOne(() => PostEntity, (post) => post.analytics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post!: PostEntity;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
