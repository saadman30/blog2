import { AnalyticsEntity } from '../../../../database/entities';
import { AnalyticsMapper } from './analytics.mapper';

describe('AnalyticsMapper', () => {
  it('maps entity to domain', () => {
    const entity = {
      id: 'a1',
      postId: 'p1',
      views: 2,
      claps: 3,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    } as AnalyticsEntity;

    expect(AnalyticsMapper.toDomain(entity)).toEqual({
      id: 'a1',
      postId: 'p1',
      views: 2,
      claps: 3,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  });

  it('maps domain fields to persistence without id', () => {
    expect(
      AnalyticsMapper.toPersistence({
        postId: 'p1',
        views: 0,
        claps: 0,
      }),
    ).toEqual({
      postId: 'p1',
      views: 0,
      claps: 0,
    });
  });

  it('includes id when provided', () => {
    expect(
      AnalyticsMapper.toPersistence({
        id: 'a1',
        postId: 'p1',
        views: 1,
        claps: 2,
      }),
    ).toEqual({
      id: 'a1',
      postId: 'p1',
      views: 1,
      claps: 2,
    });
  });
});
