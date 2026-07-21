import { Repository } from 'typeorm';
import { AnalyticsEntity } from '../../../../database/entities';
import { TypeOrmPostAnalyticsAdapter } from './typeorm-post-analytics.adapter';

describe('TypeOrmPostAnalyticsAdapter', () => {
  it('ensures zero analytics for a post', async () => {
    const analyticsRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => v),
    };
    const adapter = new TypeOrmPostAnalyticsAdapter(
      analyticsRepository as unknown as Repository<AnalyticsEntity>,
    );
    await adapter.ensureForPost('p1');
    expect(analyticsRepository.create).toHaveBeenCalledWith({
      postId: 'p1',
      views: 0,
      claps: 0,
    });
    expect(analyticsRepository.save).toHaveBeenCalled();
  });
});
