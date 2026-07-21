import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../../domain';
import {
  AuthResult,
  AuthTokens,
  JwtPayload,
  LoginInput,
  PublicUser,
  RegisterInput,
} from '../domain/auth.types';
import { User } from '../domain/user.model';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from './ports/password-hasher.port';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from './ports/token-service.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from './ports/user.repository.port';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
  ) {}

  async register(dto: RegisterInput): Promise<AuthResult> {
    const existing = await this.users.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password = await this.passwordHasher.hash(dto.password);
    const saved = await this.users.create({
      email: dto.email.toLowerCase(),
      password,
      role: UserRole.EDITOR,
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
    const tokens = await this.issueTokens(saved);
    return { user: this.sanitizeUser(saved), tokens };
  }

  async login(dto: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordHasher.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode || dto.twoFactorCode !== user.twoFactorSecret) {
        throw new UnauthorizedException('Invalid two-factor code');
      }
    }

    const tokens = await this.issueTokens(user);
    return { user: this.sanitizeUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      const user = await this.users.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUserById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async enableTwoFactor(userId: string, secret: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    user.twoFactorSecret = secret;
    user.twoFactorEnabled = true;
    return this.users.save(user);
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ]);
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): PublicUser {
    const { password: _password, twoFactorSecret: _secret, ...safe } = user;
    return safe;
  }
}
