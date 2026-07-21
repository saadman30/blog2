import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  it('allows public routes', () => {
    const guard = new JwtAuthGuard(reflector);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('delegates to passport for protected routes', () => {
    const guard = new JwtAuthGuard(reflector);
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const parent = Object.getPrototypeOf(JwtAuthGuard.prototype);
    const spy = jest.spyOn(parent, 'canActivate').mockReturnValue(true);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    spy.mockRestore();
  });

  it('handleRequest returns user', () => {
    const guard = new JwtAuthGuard(reflector);
    expect(guard.handleRequest(null, { id: '1' })).toEqual({ id: '1' });
  });

  it('handleRequest throws Unauthorized when no user', () => {
    const guard = new JwtAuthGuard(reflector);
    expect(() => guard.handleRequest(null, false)).toThrow(UnauthorizedException);
  });

  it('handleRequest rethrows errors', () => {
    const guard = new JwtAuthGuard(reflector);
    const err = new Error('jwt');
    expect(() => guard.handleRequest(err, false)).toThrow(err);
  });
});
