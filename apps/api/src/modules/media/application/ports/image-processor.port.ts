export const IMAGE_PROCESSOR = Symbol('IMAGE_PROCESSOR');

export interface ImageProcessorPort {
  toWebp(buffer: Buffer, quality?: number): Promise<Buffer>;
}
