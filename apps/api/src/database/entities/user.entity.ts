import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.enum';
import { PostEntity } from './post.entity';
import { CommentEntity } from './comment.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EDITOR })
  role!: UserRole;

  @Column({ type: 'varchar', nullable: true })
  twoFactorSecret!: string | null;

  @Column({ default: false })
  twoFactorEnabled!: boolean;

  @OneToMany(() => PostEntity, (post) => post.author)
  posts!: PostEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.author)
  comments!: CommentEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
