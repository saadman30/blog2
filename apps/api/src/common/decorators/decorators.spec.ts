import { ExecutionContext } from '@nestjs/common';
import { ROLES_KEY, Roles } from './roles.decorator';
import { IS_PUBLIC_KEY, Public } from './public.decorator';
import { extractCurrentUser } from './current-user.decorator';
import { UserRole } from '../../database/entities';

describe('decorators', () => {
  it('Roles sets metadata', () => {
    class Demo {
      @Roles(UserRole.ADMIN)
      handler() {
        return true;
      }
    }
    expect(Reflect.getMetadata(ROLES_KEY, Demo.prototype.handler)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('Public sets metadata', () => {
    class Demo {
      @Public()
      handler() {
        return true;
      }
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Demo.prototype.handler)).toBe(true);
  });

  it('extractCurrentUser returns request user', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 'u1' } }),
      }),
    } as unknown as ExecutionContext;
    expect(extractCurrentUser(undefined, ctx)).toEqual({ id: 'u1' });
  });

  it('extractCurrentUser returns undefined when missing', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
    expect(extractCurrentUser(undefined, ctx)).toBeUndefined();
  });
});
