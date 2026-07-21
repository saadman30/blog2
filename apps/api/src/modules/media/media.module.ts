import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaEntity } from '../../database/entities';
import { MediaService } from './application/media.service';
import { FILE_STORAGE } from './application/ports/file-storage.port';
import { IMAGE_PROCESSOR } from './application/ports/image-processor.port';
import { MEDIA_REPOSITORY } from './application/ports/media.repository.port';
import { MediaController } from './infrastructure/http/media.controller';
import { TypeOrmMediaRepository } from './infrastructure/persistence/typeorm-media.repository';
import { SharpImageProcessorAdapter } from './infrastructure/processing/sharp-image-processor.adapter';
import { LocalFileStorageAdapter } from './infrastructure/storage/local-file-storage.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([MediaEntity])],
  controllers: [MediaController],
  providers: [
    MediaService,
    { provide: MEDIA_REPOSITORY, useClass: TypeOrmMediaRepository },
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessorAdapter },
    { provide: FILE_STORAGE, useClass: LocalFileStorageAdapter },
  ],
  exports: [MediaService],
})
export class MediaModule {}
