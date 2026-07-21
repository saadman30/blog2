import { Analytics } from '../../domain/analytics.model';
import { AnalyticsService } from '../../application/analytics.service';
import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: jest.Mocked<
    Pick<AnalyticsService, 'trackView' | 'clap' | 'getForPost' | 'getSummary'>
  >;

  beforeEach(() => {
    analyticsService = {
      trackView: jest.fn(),
      clap: jest.fn(),
      getForPost: jest.fn(),
      getSummary: jest.fn(),
    };
    controller = new AnalyticsController(
      analyticsService as unknown as AnalyticsService,
    );
  });

  it('delegates endpoints', async () => {
    const row = { views: 1, claps: 2 } as Analytics;
    analyticsService.trackView.mockResolvedValue(row);
    analyticsService.clap.mockResolvedValue(row);
    analyticsService.getForPost.mockResolvedValue(row);
    analyticsService.getSummary.mockResolvedValue({
      totalViews: 1,
      totalClaps: 2,
      posts: 1,
    });

    await expect(controller.trackView('p1')).resolves.toEqual(row);
    await expect(controller.clap('p1', {})).resolves.toEqual(row);
    await expect(controller.clap('p1', { count: 3 })).resolves.toEqual(row);
    await expect(controller.getForPost('p1')).resolves.toEqual(row);
    await expect(controller.summary()).resolves.toEqual({
      totalViews: 1,
      totalClaps: 2,
      posts: 1,
    });
  });
});
