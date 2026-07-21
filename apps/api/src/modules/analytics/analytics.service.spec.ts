import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AnalyticsEntity, PostEntity, PostStatus } from '../../database/entities';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let postsRepository: { findOne: jest.Mock };

  beforeEach(() => {
    analyticsRepository = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
      find: jest.fn(),
    };
    postsRepository = {
      findOne: jest.fn(),
    };
    service = new AnalyticsService(
      analyticsRepository as unknown as Repository<AnalyticsEntity>,
      postsRepository as unknown as Repository<PostEntity>,
    );
  });

  it('tracks views and creates analytics when missing', async () => {
    postsRepository.findOne.mockResolvedValue({
      id: 'p1',
      status: PostStatus.PUBLISHED,
    });
    analyticsRepository.findOne.mockResolvedValue(null);
    analyticsRepository.save
      .mockResolvedValueOnce({ postId: 'p1', views: 0, claps: 0 })
      .mockResolvedValueOnce({ postId: 'p1', views: 1, claps: 0 });
    const result = await service.trackView('p1');
    expect(result.views).toBe(1);
  });

  it('claps with clamped count', async () => {
    postsRepository.findOne.mockResolvedValue({ id: 'p1' });
    analyticsRepository.findOne.mockResolvedValue({
      postId: 'p1',
      views: 1,
      claps: 0,
    });
    analyticsRepository.save.mockImplementation(async (v) => v);
    await expect(service.clap('p1')).resolves.toMatchObject({ claps: 1 });
    const result = await service.clap('p1', 100);
    expect(result.claps).toBe(51);
    const low = await service.clap('p1', 0);
    expect(low.claps).toBe(52);
  });

  it('getForPost and summary', async () => {
    postsRepository.findOne.mockResolvedValue({ id: 'p1' });
    analyticsRepository.findOne.mockResolvedValue({
      postId: 'p1',
      views: 2,
      claps: 3,
    });
    await expect(service.getForPost('p1')).resolves.toMatchObject({ views: 2 });
    analyticsRepository.find.mockResolvedValue([
      { views: 2, claps: 3 },
      { views: 1, claps: 1 },
    ]);
    await expect(service.getSummary()).resolves.toEqual({
      totalViews: 3,
      totalClaps: 4,
      posts: 2,
    });
  });

  it('throws when published post missing', async () => {
    postsRepository.findOne.mockResolvedValue(null);
    await expect(service.trackView('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
