import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostEntity, PostStatus } from '../../../../database/entities';
import { Post } from '../../domain/post.model';
import {
  PostRepositoryPort,
  SavePostData,
} from '../../application/ports/post.repository.port';
import { toDomain, toPersistence } from './post.mapper';

@Injectable()
export class TypeOrmPostRepository implements PostRepositoryPort {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepository: Repository<PostEntity>,
  ) {}

  async save(data: SavePostData): Promise<Post> {
    const entity = this.postsRepository.create(toPersistence(data));
    const saved = await this.postsRepository.save(entity);
    return toDomain(saved);
  }

  async findById(id: string): Promise<Post | null> {
    const entity = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'analytics'],
    });
    return entity ? toDomain(entity) : null;
  }

  async findBySlug(
    slug: string,
    publishedOnly = true,
  ): Promise<Post | null> {
    const where = publishedOnly
      ? { slug, status: PostStatus.PUBLISHED }
      : { slug };
    const entity = await this.postsRepository.findOne({
      where,
      relations: ['author', 'analytics'],
    });
    return entity ? toDomain(entity) : null;
  }

  async findAllAdmin(): Promise<Post[]> {
    const entities = await this.postsRepository.find({
      order: { updatedAt: 'DESC' },
      relations: ['author'],
    });
    return entities.map(toDomain);
  }

  async findPublished(tag?: string): Promise<Post[]> {
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('post.publishedAt', 'DESC');

    if (tag) {
      qb.andWhere(':tag = ANY(post.tags)', { tag });
    }

    const entities = await qb.getMany();
    return entities.map(toDomain);
  }

  async findBySlugExact(slug: string): Promise<Post | null> {
    const entity = await this.postsRepository.findOne({
      where: { slug },
    });
    return entity ? toDomain(entity) : null;
  }

  async remove(post: Post): Promise<void> {
    await this.postsRepository.remove(
      this.postsRepository.create(toPersistence(post)),
    );
  }
}
