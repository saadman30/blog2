import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../database/entities';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function ctx(user?: { role: UserRole }): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows when no roles required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(ctx({ role: UserRole.EDITOR }))).toBe(true);
  });

  it('allows when roles array empty', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('allows matching role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(ctx({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('forbids missing user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
  });

  it('forbids mismatched role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(ctx({ role: UserRole.EDITOR }))).toThrow(
      ForbiddenException,
    );
  });
});
