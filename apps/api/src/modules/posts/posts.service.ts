import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { marked } from 'marked';
import { Repository } from 'typeorm';
import {
  AnalyticsEntity,
  PostEntity,
  PostStatus,
  UserEntity,
} from '../../database/entities';
import {
  estimateReadingTime,
  sanitizeHtml,
  slugify,
} from '../../common/utils/content.util';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

export const POST_SCHEDULER_QUEUE = 'post-scheduler';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postsRepository: Repository<PostEntity>,
    @InjectRepository(AnalyticsEntity)
    private readonly analyticsRepository: Repository<AnalyticsEntity>,
    @InjectQueue(POST_SCHEDULER_QUEUE)
    private readonly schedulerQueue: Queue,
  ) {}

  async create(author: UserEntity, dto: CreatePostDto): Promise<PostEntity> {
    const status = dto.status ?? PostStatus.DRAFT;
    this.assertScheduleValid(status, dto.scheduledAt);

    const slug = await this.ensureUniqueSlug(dto.slug ?? slugify(dto.title));
    const post = this.postsRepository.create({
      title: dto.title,
      slug,
      content: dto.content,
      summary: dto.summary ?? null,
      readingTime: estimateReadingTime(dto.content),
      status,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
      tags: dto.tags ?? [],
      category: dto.category ?? null,
      authorId: author.id,
    });

    const saved = await this.postsRepository.save(post);
    await this.analyticsRepository.save(
      this.analyticsRepository.create({ postId: saved.id, views: 0, claps: 0 }),
    );

    if (status === PostStatus.SCHEDULED && saved.scheduledAt) {
      await this.enqueuePublish(saved.id, saved.scheduledAt);
    }

    return saved;
  }

  async findAllAdmin(): Promise<PostEntity[]> {
    return this.postsRepository.find({
      order: { updatedAt: 'DESC' },
      relations: ['author'],
    });
  }

  async findPublished(tag?: string): Promise<PostEntity[]> {
    const qb = this.postsRepository
      .createQueryBuilder('post')
      .where('post.status = :status', { status: PostStatus.PUBLISHED })
      .orderBy('post.publishedAt', 'DESC');

    if (tag) {
      qb.andWhere(':tag = ANY(post.tags)', { tag });
    }

    return qb.getMany();
  }

  async findBySlug(slug: string, publishedOnly = true): Promise<PostEntity> {
    const where = publishedOnly
      ? { slug, status: PostStatus.PUBLISHED }
      : { slug };
    const post = await this.postsRepository.findOne({
      where,
      relations: ['author', 'analytics'],
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async findById(id: string): Promise<PostEntity> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'analytics'],
    });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async update(id: string, dto: UpdatePostDto): Promise<PostEntity> {
    const post = await this.findById(id);
    const nextStatus = dto.status ?? post.status;

    if (dto.scheduledAt !== undefined) {
      this.assertScheduleValid(
        nextStatus,
        dto.scheduledAt ?? undefined,
      );
    } else if (dto.status === PostStatus.SCHEDULED) {
      this.assertScheduleValid(nextStatus, post.scheduledAt?.toISOString());
    }

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.content !== undefined) {
      post.content = dto.content;
      post.readingTime = estimateReadingTime(dto.content);
    }
    if (dto.summary !== undefined) post.summary = dto.summary;
    if (dto.tags !== undefined) post.tags = dto.tags;
    if (dto.category !== undefined) post.category = dto.category;
    if (dto.slug !== undefined) {
      post.slug = await this.ensureUniqueSlug(dto.slug, id);
    }
    if (dto.scheduledAt !== undefined) {
      post.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    if (dto.status !== undefined) {
      post.status = dto.status;
      if (dto.status === PostStatus.PUBLISHED && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    const saved = await this.postsRepository.save(post);
    if (saved.status === PostStatus.SCHEDULED && saved.scheduledAt) {
      await this.enqueuePublish(saved.id, saved.scheduledAt);
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const post = await this.findById(id);
    await this.postsRepository.remove(post);
  }

  async renderHtml(content: string): Promise<string> {
    const html = await marked.parse(content);
    return sanitizeHtml(typeof html === 'string' ? html : String(html));
  }

  async publishDuePosts(): Promise<number> {
    const due = await this.postsRepository
      .createQueryBuilder('post')
      .where('post.status = :status', { status: PostStatus.SCHEDULED })
      .andWhere('post.scheduledAt <= :now', { now: new Date() })
      .getMany();

    for (const post of due) {
      post.status = PostStatus.PUBLISHED;
      post.publishedAt = new Date();
      await this.postsRepository.save(post);
    }
    return due.length;
  }

  private assertScheduleValid(
    status: PostStatus,
    scheduledAt?: string | null,
  ): void {
    if (status === PostStatus.SCHEDULED && !scheduledAt) {
      throw new BadRequestException('scheduledAt is required for SCHEDULED posts');
    }
  }

  private async ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = slugify(base) || 'post';
    let suffix = 0;
    while (true) {
      const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
      const existing = await this.postsRepository.findOne({
        where: { slug: candidate },
      });
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      suffix += 1;
    }
  }

  private async enqueuePublish(postId: string, scheduledAt: Date): Promise<void> {
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    await this.schedulerQueue.add(
      'publish-post',
      { postId },
      { delay, jobId: `publish-${postId}`, removeOnComplete: true },
    );
  }
}
