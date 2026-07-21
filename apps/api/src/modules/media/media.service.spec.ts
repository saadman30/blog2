import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { promises as fs } from 'fs';
import { MediaEntity } from '../../database/entities';
import { MediaService } from './media.service';

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    webp: jest.fn().mockReturnValue({
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp')),
    }),
  })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-1'),
}));

describe('MediaService', () => {
  let service: MediaService;
  let mediaRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let mkdirSpy: jest.SpyInstance;
  let writeFileSpy: jest.SpyInstance;
  let unlinkSpy: jest.SpyInstance;

  beforeEach(() => {
    mediaRepository = {
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 'm1', ...v })),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('./uploads'),
    };
    service = new MediaService(
      mediaRepository as unknown as Repository<MediaEntity>,
      configService as unknown as ConfigService,
    );
    mkdirSpy = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    writeFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
  });

  afterEach(() => {
    mkdirSpy.mockRestore();
    writeFileSpy.mockRestore();
    unlinkSpy.mockRestore();
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
    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled();
  });

  it('uses defaults for path and alt', async () => {
    configService.get.mockReturnValue(undefined);
    await service.upload({
      originalname: 'a.png',
      mimetype: 'image/png',
      buffer: Buffer.from('img'),
      size: 3,
    });
    expect(mediaRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ alt: null }),
    );
  });

  it('lists and finds media', async () => {
    mediaRepository.find.mockResolvedValue([]);
    mediaRepository.findOne.mockResolvedValue(null);
    await expect(service.findAll()).resolves.toEqual([]);
    await expect(service.findById('x')).resolves.toBeNull();
  });

  it('removes media and ignores missing files', async () => {
    mediaRepository.findOne.mockResolvedValue({
      id: 'm1',
      key: 'uuid-1.webp',
    });
    unlinkSpy.mockRejectedValue(new Error('missing'));
    await expect(service.remove('m1')).resolves.toBe(true);
    expect(mediaRepository.remove).toHaveBeenCalled();
  });

  it('returns false when media missing', async () => {
    mediaRepository.findOne.mockResolvedValue(null);
    await expect(service.remove('x')).resolves.toBe(false);
  });

  it('unlinks file when present', async () => {
    mediaRepository.findOne.mockResolvedValue({
      id: 'm1',
      key: 'uuid-1.webp',
    });
    unlinkSpy.mockResolvedValue(undefined);
    configService.get.mockReturnValue(undefined);
    await expect(service.remove('m1')).resolves.toBe(true);
  });
});
