import { Post } from '../../domain/post.model';

export const POST_REPOSITORY = Symbol('POST_REPOSITORY');

export type SavePostData = Omit<
  Post,
  'id' | 'createdAt' | 'updatedAt' | 'author' | 'analytics'
> & {
  id?: string;
};

export interface PostRepositoryPort {
  save(data: SavePostData): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  findBySlug(slug: string, publishedOnly?: boolean): Promise<Post | null>;
  findAllAdmin(): Promise<Post[]>;
  findPublished(tag?: string): Promise<Post[]>;
  findBySlugExact(slug: string): Promise<Post | null>;
  remove(post: Post): Promise<void>;
}
