import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEntity, PostEntity, PostStatus } from '../../database/entities';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEntity)
    private readonly analyticsRepository: Repository<AnalyticsEntity>,
    @InjectRepository(PostEntity)
    private readonly postsRepository: Repository<PostEntity>,
  ) {}

  async trackView(postId: string): Promise<AnalyticsEntity> {
    const analytics = await this.getOrCreate(postId);
    analytics.views += 1;
    return this.analyticsRepository.save(analytics);
  }

  async clap(postId: string, count = 1): Promise<AnalyticsEntity> {
    const safeCount = Math.min(Math.max(1, count), 50);
    const analytics = await this.getOrCreate(postId);
    analytics.claps += safeCount;
    return this.analyticsRepository.save(analytics);
  }

  async getForPost(postId: string): Promise<AnalyticsEntity> {
    return this.getOrCreate(postId);
  }

  async getSummary(): Promise<{ totalViews: number; totalClaps: number; posts: number }> {
    const rows = await this.analyticsRepository.find();
    const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
    const totalClaps = rows.reduce((sum, row) => sum + row.claps, 0);
    return { totalViews, totalClaps, posts: rows.length };
  }

  private async getOrCreate(postId: string): Promise<AnalyticsEntity> {
    const post = await this.postsRepository.findOne({
      where: { id: postId, status: PostStatus.PUBLISHED },
    });
    if (!post) {
      throw new NotFoundException('Published post not found');
    }
    let analytics = await this.analyticsRepository.findOne({ where: { postId } });
    if (!analytics) {
      analytics = await this.analyticsRepository.save(
        this.analyticsRepository.create({ postId, views: 0, claps: 0 }),
      );
    }
    return analytics;
  }
}
