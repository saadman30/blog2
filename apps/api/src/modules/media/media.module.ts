import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaEntity } from '../../database/entities';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [TypeOrmModule.forFeature([MediaEntity])],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
