import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserEntity, UserRole } from '../../../../database/entities';
import { PostsService } from '../../application/posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Post()
  create(@CurrentUser() user: UserEntity, @Body() dto: CreatePostDto) {
    return this.postsService.create(user, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Get('admin')
  listAdmin() {
    return this.postsService.findAllAdmin();
  }

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Get('id/:id')
  getById(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @Public()
  @Get()
  listPublished(@Query('tag') tag?: string) {
    return this.postsService.findPublished(tag);
  }

  @Public()
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const post = await this.postsService.findBySlug(slug);
    const html = await this.postsService.renderHtml(post.content);
    return { ...post, html };
  }

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.postsService.remove(id);
    return { deleted: true };
  }
}
