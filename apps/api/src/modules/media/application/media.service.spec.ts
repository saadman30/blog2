import { MediaService } from './media.service';
import { FileStoragePort } from './ports/file-storage.port';
import { ImageProcessorPort } from './ports/image-processor.port';
import { MediaRepositoryPort } from './ports/media.repository.port';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-1'),
}));

describe('MediaService', () => {
  let service: MediaService;
  let mediaRepository: jest.Mocked<MediaRepositoryPort>;
  let imageProcessor: jest.Mocked<ImageProcessorPort>;
  let fileStorage: jest.Mocked<FileStoragePort>;

  beforeEach(() => {
    mediaRepository = {
      save: jest.fn(async (v) => ({
        id: 'm1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...v,
      })),
      findAll: jest.fn(),
      findById: jest.fn(),
      remove: jest.fn(),
    };
    imageProcessor = {
      toWebp: jest.fn().mockResolvedValue(Buffer.from('webp')),
    };
    fileStorage = {
      ensureDir: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
    };
    service = new MediaService(mediaRepository, imageProcessor, fileStorage);
  });

  it('uploads and converts to webp', async () => {
    const entity = await service.upload(
      {
        originalname: 'a.png',
        mimetype: 'image/png',
        buffer: Buffer.from('img'),
        size: 3,
      },
      'alt',
    );
    expect(entity.mimeType).toBe('image/webp');
    expect(entity.url).toBe('/uploads/uuid-1.webp');
    expect(entity.key).toBe('uuid-1.webp');
    expect(fileStorage.ensureDir).toHaveBeenCalled();
    expect(imageProcessor.toWebp).toHaveBeenCalledWith(Buffer.from('img'));
    expect(fileStorage.write).toHaveBeenCalledWith(
      'uuid-1.webp',
      Buffer.from('webp'),
    );
  });

  it('uses null alt when omitted', async () => {
    await service.upload({
      originalname: 'a.png',
      mimetype: 'image/png',
      buffer: Buffer.from('img'),
      size: 3,
    });
    expect(mediaRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ alt: null }),
    );
  });

  it('lists and finds media', async () => {
    mediaRepository.findAll.mockResolvedValue([]);
    mediaRepository.findById.mockResolvedValue(null);
    await expect(service.findAll()).resolves.toEqual([]);
    await expect(service.findById('x')).resolves.toBeNull();
  });

  it('removes media and ignores missing files', async () => {
    mediaRepository.findById.mockResolvedValue({
      id: 'm1',
      url: '/uploads/uuid-1.webp',
      key: 'uuid-1.webp',
      mimeType: 'image/webp',
      size: 4,
      alt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fileStorage.unlink.mockRejectedValue(new Error('missing'));
    await expect(service.remove('m1')).resolves.toBe(true);
    expect(mediaRepository.remove).toHaveBeenCalled();
  });

  it('returns false when media missing', async () => {
    mediaRepository.findById.mockResolvedValue(null);
    await expect(service.remove('x')).resolves.toBe(false);
  });

  it('unlinks file when present', async () => {
    mediaRepository.findById.mockResolvedValue({
      id: 'm1',
      url: '/uploads/uuid-1.webp',
      key: 'uuid-1.webp',
      mimeType: 'image/webp',
      size: 4,
      alt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fileStorage.unlink.mockResolvedValue(undefined);
    await expect(service.remove('m1')).resolves.toBe(true);
    expect(fileStorage.unlink).toHaveBeenCalledWith('uuid-1.webp');
  });
});
