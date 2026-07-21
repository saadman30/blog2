import { AnalyticsEntity } from '../../../../database/entities';
import { Analytics } from '../../domain/analytics.model';

export class AnalyticsMapper {
  static toDomain(entity: AnalyticsEntity): Analytics {
    return {
      id: entity.id,
      postId: entity.postId,
      views: entity.views,
      claps: entity.claps,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toPersistence(data: {
    id?: string;
    postId: string;
    views: number;
    claps: number;
  }): Partial<AnalyticsEntity> {
    return {
      ...(data.id ? { id: data.id } : {}),
      postId: data.postId,
      views: data.views,
      claps: data.claps,
    };
  }
}
