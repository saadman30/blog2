import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Public } from '../../../../common/decorators/public.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { UserRole } from '../../../../database/entities';
import { AnalyticsService } from '../../application/analytics.service';

export class ClapDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number;
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @Get()
  summary() {
    return this.analyticsService.getSummary();
  }

  @Public()
  @Post(':postId/view')
  trackView(@Param('postId') postId: string) {
    return this.analyticsService.trackView(postId);
  }

  @Public()
  @Post(':postId/clap')
  clap(@Param('postId') postId: string, @Body() dto: ClapDto) {
    return this.analyticsService.clap(postId, dto.count ?? 1);
  }

  @Public()
  @Get(':postId')
  getForPost(@Param('postId') postId: string) {
    return this.analyticsService.getForPost(postId);
  }
}
