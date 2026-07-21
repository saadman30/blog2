import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserRole } from '../../../../database/entities';
import {
  MediaService,
  UploadedFileLike,
} from '../../application/media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('alt') alt?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }
    return this.mediaService.upload(file, alt);
  }

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Get()
  list() {
    return this.mediaService.findAll();
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const deleted = await this.mediaService.remove(id);
    if (!deleted) {
      throw new NotFoundException('Media not found');
    }
    return { deleted: true };
  }
}
