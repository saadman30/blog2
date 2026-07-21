import { User } from './user.model';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type PublicUser = Omit<User, 'password' | 'twoFactorSecret'>;

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  twoFactorCode?: string;
}
