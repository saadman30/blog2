import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../database/entities';

export function extractCurrentUser(
  _data: unknown,
  ctx: ExecutionContext,
): UserEntity | undefined {
  const request = ctx.switchToHttp().getRequest<{ user?: UserEntity }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);
