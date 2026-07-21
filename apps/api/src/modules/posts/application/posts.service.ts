import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus } from '../../../domain';
import {
  estimateReadingTime,
  slugify,
} from '../../../common/utils/content.util';
import { Post } from '../domain/post.model';
import {
  HTML_RENDERER,
  HtmlRendererPort,
} from './ports/html-renderer.port';
import {
  POST_ANALYTICS,
  PostAnalyticsPort,
} from './ports/post-analytics.port';
import {
  POST_REPOSITORY,
  PostRepositoryPort,
} from './ports/post.repository.port';
import {
  POST_SCHEDULER,
  PostSchedulerPort,
} from './ports/post-scheduler.port';

export type CreatePostInput = {
  title: string;
  slug?: string;
  content: string;
  summary?: string;
  status?: PostStatus;
  scheduledAt?: string;
  tags?: string[];
  category?: string;
};

export type UpdatePostInput = {
  title?: string;
  slug?: string;
  content?: string;
  summary?: string;
  status?: PostStatus;
  scheduledAt?: string | null;
  tags?: string[];
  category?: string | null;
};

@Injectable()
export class PostsService {
  constructor(
    @Inject(POST_REPOSITORY)
    private readonly posts: PostRepositoryPort,
    @Inject(POST_ANALYTICS)
    private readonly analytics: PostAnalyticsPort,
    @Inject(POST_SCHEDULER)
    private readonly scheduler: PostSchedulerPort,
    @Inject(HTML_RENDERER)
    private readonly htmlRenderer: HtmlRendererPort,
  ) {}

  async create(
    author: { id: string },
    dto: CreatePostInput,
  ): Promise<Post> {
    const status = dto.status ?? PostStatus.DRAFT;
    this.assertScheduleValid(status, dto.scheduledAt);

    const slug = await this.ensureUniqueSlug(dto.slug ?? slugify(dto.title));
    const saved = await this.posts.save({
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

    await this.analytics.ensureForPost(saved.id);

    if (status === PostStatus.SCHEDULED && saved.scheduledAt) {
      await this.scheduler.schedulePublish(saved.id, saved.scheduledAt);
    }

    return saved;
  }

  async findAllAdmin(): Promise<Post[]> {
    return this.posts.findAllAdmin();
  }

  async findPublished(tag?: string): Promise<Post[]> {
    return this.posts.findPublished(tag);
  }

  async findBySlug(slug: string, publishedOnly = true): Promise<Post> {
    const post = await this.posts.findBySlug(slug, publishedOnly);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async findById(id: string): Promise<Post> {
    const post = await this.posts.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async update(id: string, dto: UpdatePostInput): Promise<Post> {
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

    const saved = await this.posts.save(post);
    if (saved.status === PostStatus.SCHEDULED && saved.scheduledAt) {
      await this.scheduler.schedulePublish(saved.id, saved.scheduledAt);
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const post = await this.findById(id);
    await this.posts.remove(post);
  }

  async renderHtml(content: string): Promise<string> {
    return this.htmlRenderer.render(content);
  }

  async publishScheduled(postId: string): Promise<{ published: boolean }> {
    const post = await this.posts.findById(postId);
    if (!post || post.status !== PostStatus.SCHEDULED) {
      return { published: false };
    }
    if (post.scheduledAt && post.scheduledAt.getTime() > Date.now()) {
      return { published: false };
    }
    post.status = PostStatus.PUBLISHED;
    post.publishedAt = new Date();
    await this.posts.save(post);
    return { published: true };
  }

  private assertScheduleValid(
    status: PostStatus,
    scheduledAt?: string | null,
  ): void {
    if (status === PostStatus.SCHEDULED && !scheduledAt) {
      throw new BadRequestException(
        'scheduledAt is required for SCHEDULED posts',
      );
    }
  }

  private async ensureUniqueSlug(
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = slugify(base) || 'post';
    let suffix = 0;
    while (true) {
      const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
      const existing = await this.posts.findBySlugExact(candidate);
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      suffix += 1;
    }
  }
}
