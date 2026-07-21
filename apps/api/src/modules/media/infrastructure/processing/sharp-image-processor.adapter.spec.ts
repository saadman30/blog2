import sharp from 'sharp';
import { SharpImageProcessorAdapter } from './sharp-image-processor.adapter';

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    webp: jest.fn().mockReturnValue({
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp')),
    }),
  })),
}));

describe('SharpImageProcessorAdapter', () => {
  let adapter: SharpImageProcessorAdapter;

  beforeEach(() => {
    adapter = new SharpImageProcessorAdapter();
    jest.clearAllMocks();
    (sharp as unknown as jest.Mock).mockImplementation(() => ({
      webp: jest.fn().mockReturnValue({
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('webp')),
      }),
    }));
  });

  it('converts buffer to webp with default quality', async () => {
    const input = Buffer.from('img');
    await expect(adapter.toWebp(input)).resolves.toEqual(Buffer.from('webp'));
    expect(sharp).toHaveBeenCalledWith(input);
    const instance = (sharp as unknown as jest.Mock).mock.results[0].value;
    expect(instance.webp).toHaveBeenCalledWith({ quality: 80 });
  });

  it('accepts custom quality', async () => {
    await adapter.toWebp(Buffer.from('img'), 50);
    const instance = (sharp as unknown as jest.Mock).mock.results[0].value;
    expect(instance.webp).toHaveBeenCalledWith({ quality: 50 });
  });
});
