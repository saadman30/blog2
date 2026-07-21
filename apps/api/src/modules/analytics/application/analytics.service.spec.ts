import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepositoryPort } from './ports/analytics.repository.port';
import { PublishedPostLookupPort } from './ports/published-post.port';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsRepository: jest.Mocked<AnalyticsRepositoryPort>;
  let publishedPostLookup: jest.Mocked<PublishedPostLookupPort>;

  beforeEach(() => {
    analyticsRepository = {
      findByPostId: jest.fn(),
      save: jest.fn(async (v) => ({
        id: v.id ?? 'a1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...v,
      })),
      findAll: jest.fn(),
    };
    publishedPostLookup = {
      existsPublished: jest.fn(),
    };
    service = new AnalyticsService(analyticsRepository, publishedPostLookup);
  });

  it('tracks views and creates analytics when missing', async () => {
    publishedPostLookup.existsPublished.mockResolvedValue(true);
    analyticsRepository.findByPostId.mockResolvedValue(null);
    analyticsRepository.save
      .mockResolvedValueOnce({
        id: 'a1',
        postId: 'p1',
        views: 0,
        claps: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'a1',
        postId: 'p1',
        views: 1,
        claps: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const result = await service.trackView('p1');
    expect(result.views).toBe(1);
  });

  it('claps with clamped count', async () => {
    publishedPostLookup.existsPublished.mockResolvedValue(true);
    analyticsRepository.findByPostId.mockResolvedValue({
      id: 'a1',
      postId: 'p1',
      views: 1,
      claps: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    analyticsRepository.save.mockImplementation(async (v) => ({
      id: 'a1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...v,
    }));
    await expect(service.clap('p1')).resolves.toMatchObject({ claps: 1 });
    const result = await service.clap('p1', 100);
    expect(result.claps).toBe(51);
    const low = await service.clap('p1', 0);
    expect(low.claps).toBe(52);
  });

  it('getForPost and summary', async () => {
    publishedPostLookup.existsPublished.mockResolvedValue(true);
    analyticsRepository.findByPostId.mockResolvedValue({
      id: 'a1',
      postId: 'p1',
      views: 2,
      claps: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.getForPost('p1')).resolves.toMatchObject({ views: 2 });
    analyticsRepository.findAll.mockResolvedValue([
      {
        id: 'a1',
        postId: 'p1',
        views: 2,
        claps: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'a2',
        postId: 'p2',
        views: 1,
        claps: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await expect(service.getSummary()).resolves.toEqual({
      totalViews: 3,
      totalClaps: 4,
      posts: 2,
    });
  });

  it('throws when published post missing', async () => {
    publishedPostLookup.existsPublished.mockResolvedValue(false);
    await expect(service.trackView('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
