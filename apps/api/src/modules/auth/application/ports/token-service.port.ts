import { JwtPayload } from '../../domain/auth.types';

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenServicePort {
  signAccessToken(payload: JwtPayload): Promise<string>;
  signRefreshToken(payload: JwtPayload): Promise<string>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
}
