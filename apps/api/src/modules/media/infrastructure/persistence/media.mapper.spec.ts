import { MediaEntity } from '../../../../database/entities';
import { MediaMapper } from './media.mapper';

describe('MediaMapper', () => {
  it('maps entity to domain', () => {
    const entity = {
      id: 'm1',
      url: '/uploads/a.webp',
      key: 'a.webp',
      mimeType: 'image/webp',
      size: '42' as unknown as number,
      alt: 'x',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    } as MediaEntity;

    expect(MediaMapper.toDomain(entity)).toEqual({
      id: 'm1',
      url: '/uploads/a.webp',
      key: 'a.webp',
      mimeType: 'image/webp',
      size: 42,
      alt: 'x',
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  });

  it('maps domain fields to persistence', () => {
    expect(
      MediaMapper.toPersistence({
        url: '/uploads/a.webp',
        key: 'a.webp',
        mimeType: 'image/webp',
        size: 10,
        alt: null,
      }),
    ).toEqual({
      url: '/uploads/a.webp',
      key: 'a.webp',
      mimeType: 'image/webp',
      size: 10,
      alt: null,
    });
  });
});
