import { Analytics } from '../../domain/analytics.model';

export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');

export interface AnalyticsRepositoryPort {
  findByPostId(postId: string): Promise<Analytics | null>;
  save(data: {
    id?: string;
    postId: string;
    views: number;
    claps: number;
  }): Promise<Analytics>;
  findAll(): Promise<Analytics[]>;
}
