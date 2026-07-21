import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostEntity } from './post.entity';
import { UserEntity } from './user.entity';

@Entity('comments')
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ default: false })
  isApproved!: boolean;

  @Column({ type: 'uuid' })
  postId!: string;

  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  @ManyToOne(() => PostEntity, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post!: PostEntity;

  @ManyToOne(() => UserEntity, (user) => user.comments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'authorId' })
  author!: UserEntity | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
