import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostStatus } from './post-status.enum';
import { UserEntity } from './user.entity';
import { CommentEntity } from './comment.entity';
import { AnalyticsEntity } from './analytics.entity';

@Entity('posts')
export class PostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'int', default: 0 })
  readingTime!: number;

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.DRAFT })
  status!: PostStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column('text', { array: true, default: '{}' })
  tags!: string[];

  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => UserEntity, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author!: UserEntity;

  @OneToMany(() => CommentEntity, (comment) => comment.post)
  comments!: CommentEntity[];

  @OneToOne(() => AnalyticsEntity, (analytics) => analytics.post)
  analytics!: AnalyticsEntity;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
