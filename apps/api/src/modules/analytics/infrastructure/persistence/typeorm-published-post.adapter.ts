import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity, PostStatus } from '../../../../database/entities';
import { PublishedPostLookupPort } from '../../application/ports/published-post.port';

@Injectable()
export class TypeOrmPublishedPostAdapter implements PublishedPostLookupPort {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepository: Repository<PostEntity>,
  ) {}

  async existsPublished(postId: string): Promise<boolean> {
    const post = await this.postsRepository.findOne({
      where: { id: postId, status: PostStatus.PUBLISHED },
    });
    return !!post;
  }
}
