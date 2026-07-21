import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessorPort } from '../../application/ports/image-processor.port';

@Injectable()
export class SharpImageProcessorAdapter implements ImageProcessorPort {
  async toWebp(buffer: Buffer, quality = 80): Promise<Buffer> {
    return sharp(buffer).webp({ quality }).toBuffer();
  }
}
