import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Analytics } from '../domain/analytics.model';
import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepositoryPort,
} from './ports/analytics.repository.port';
import {
  PUBLISHED_POST_LOOKUP,
  PublishedPostLookupPort,
} from './ports/published-post.port';

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepository: AnalyticsRepositoryPort,
    @Inject(PUBLISHED_POST_LOOKUP)
    private readonly publishedPostLookup: PublishedPostLookupPort,
  ) {}

  async trackView(postId: string): Promise<Analytics> {
    const analytics = await this.getOrCreate(postId);
    analytics.views += 1;
    return this.analyticsRepository.save(analytics);
  }

  async clap(postId: string, count = 1): Promise<Analytics> {
    const safeCount = Math.min(Math.max(1, count), 50);
    const analytics = await this.getOrCreate(postId);
    analytics.claps += safeCount;
    return this.analyticsRepository.save(analytics);
  }

  async getForPost(postId: string): Promise<Analytics> {
    return this.getOrCreate(postId);
  }

  async getSummary(): Promise<{
    totalViews: number;
    totalClaps: number;
    posts: number;
  }> {
    const rows = await this.analyticsRepository.findAll();
    const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
    const totalClaps = rows.reduce((sum, row) => sum + row.claps, 0);
    return { totalViews, totalClaps, posts: rows.length };
  }

  private async getOrCreate(postId: string): Promise<Analytics> {
    const exists = await this.publishedPostLookup.existsPublished(postId);
    if (!exists) {
      throw new NotFoundException('Published post not found');
    }
    let analytics = await this.analyticsRepository.findByPostId(postId);
    if (!analytics) {
      analytics = await this.analyticsRepository.save({
        postId,
        views: 0,
        claps: 0,
      });
    }
    return analytics;
  }
}
