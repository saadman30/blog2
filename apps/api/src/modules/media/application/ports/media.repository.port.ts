import { Media } from '../../domain/media.model';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaRepositoryPort {
  save(data: {
    url: string;
    key: string;
    mimeType: string;
    size: number;
    alt: string | null;
  }): Promise<Media>;
  findAll(): Promise<Media[]>;
  findById(id: string): Promise<Media | null>;
  remove(media: Media): Promise<void>;
}
