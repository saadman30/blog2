import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalFileStorageAdapter } from './local-file-storage.adapter';

describe('LocalFileStorageAdapter', () => {
  let adapter: LocalFileStorageAdapter;
  let configService: { get: jest.Mock };
  let mkdirSpy: jest.SpyInstance;
  let writeFileSpy: jest.SpyInstance;
  let unlinkSpy: jest.SpyInstance;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('./uploads'),
    };
    adapter = new LocalFileStorageAdapter(
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

  it('ensures directory exists', async () => {
    await adapter.ensureDir();
    expect(mkdirSpy).toHaveBeenCalledWith('./uploads', { recursive: true });
  });

  it('writes and unlinks under local path', async () => {
    await adapter.write('a.webp', Buffer.from('x'));
    expect(writeFileSpy).toHaveBeenCalledWith(
      path.join('./uploads', 'a.webp'),
      Buffer.from('x'),
    );
    await adapter.unlink('a.webp');
    expect(unlinkSpy).toHaveBeenCalledWith(path.join('./uploads', 'a.webp'));
  });

  it('defaults local path when config missing', async () => {
    configService.get.mockReturnValue(undefined);
    await adapter.ensureDir();
    expect(mkdirSpy).toHaveBeenCalledWith('./uploads', { recursive: true });
    await adapter.write('b.webp', Buffer.from('y'));
    expect(writeFileSpy).toHaveBeenCalledWith(
      path.join('./uploads', 'b.webp'),
      Buffer.from('y'),
    );
  });
});
