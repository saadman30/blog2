import { PostStatus } from '../../../domain';

export class Post {
  id!: string;
  title!: string;
  slug!: string;
  content!: string;
  summary!: string | null;
  readingTime!: number;
  status!: PostStatus;
  scheduledAt!: Date | null;
  publishedAt!: Date | null;
  tags!: string[];
  category!: string | null;
  authorId!: string;
  author?: unknown;
  analytics?: unknown;
  createdAt!: Date;
  updatedAt!: Date;
}
