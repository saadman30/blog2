import { MediaEntity } from '../../../../database/entities';
import { Media } from '../../domain/media.model';

export class MediaMapper {
  static toDomain(entity: MediaEntity): Media {
    return {
      id: entity.id,
      url: entity.url,
      key: entity.key,
      mimeType: entity.mimeType,
      size: Number(entity.size),
      alt: entity.alt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toPersistence(data: {
    url: string;
    key: string;
    mimeType: string;
    size: number;
    alt: string | null;
  }): Pick<MediaEntity, 'url' | 'key' | 'mimeType' | 'size' | 'alt'> {
    return {
      url: data.url,
      key: data.key,
      mimeType: data.mimeType,
      size: data.size,
      alt: data.alt,
    };
  }
}
