import { DataSource, DataSourceOptions } from 'typeorm';
import {
  UserEntity,
  PostEntity,
  MediaEntity,
  CommentEntity,
  AnalyticsEntity,
} from '../database/entities';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'pcms',
  password: process.env.DATABASE_PASSWORD ?? 'pcms_secret',
  database: process.env.DATABASE_NAME ?? 'pcms',
  entities: [UserEntity, PostEntity, MediaEntity, CommentEntity, AnalyticsEntity],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
