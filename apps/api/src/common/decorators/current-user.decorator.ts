import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../domain';

export function extractCurrentUser(
  _data: unknown,
  ctx: ExecutionContext,
): User | undefined {
  const request = ctx.switchToHttp().getRequest<{ user?: User }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);
