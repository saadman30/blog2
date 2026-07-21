import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaEntity } from '../../database/entities';

describe('MediaController', () => {
  let controller: MediaController;
  let mediaService: jest.Mocked<Pick<MediaService, 'upload' | 'findAll' | 'remove'>>;

  beforeEach(() => {
    mediaService = {
      upload: jest.fn(),
      findAll: jest.fn(),
      remove: jest.fn(),
    };
    controller = new MediaController(mediaService as unknown as MediaService);
  });

  it('uploads images', async () => {
    const media = { id: 'm1' } as MediaEntity;
    mediaService.upload.mockResolvedValue(media);
    await expect(
      controller.upload(
        {
          originalname: 'a.png',
          mimetype: 'image/png',
          buffer: Buffer.from('x'),
          size: 1,
        },
        'alt',
      ),
    ).resolves.toEqual(media);
  });

  it('rejects missing file', async () => {
    await expect(controller.upload(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects non-images', async () => {
    await expect(
      controller.upload({
        originalname: 'a.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists media', async () => {
    mediaService.findAll.mockResolvedValue([]);
    await expect(controller.list()).resolves.toEqual([]);
  });

  it('removes media', async () => {
    mediaService.remove.mockResolvedValue(true);
    await expect(controller.remove('m1')).resolves.toEqual({ deleted: true });
  });

  it('throws when remove misses', async () => {
    mediaService.remove.mockResolvedValue(false);
    await expect(controller.remove('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
