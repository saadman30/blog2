import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../../database/entities';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Omit<UserEntity, 'password' | 'twoFactorSecret'>;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      password,
      role: dto.role ?? UserRole.EDITOR,
      twoFactorSecret: null,
      twoFactorEnabled: false,
    });
    const saved = await this.usersRepository.save(user);
    const tokens = await this.issueTokens(saved);
    return { user: this.sanitizeUser(saved), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
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
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUserById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async enableTwoFactor(userId: string, secret: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    user.twoFactorSecret = secret;
    user.twoFactorEnabled = true;
    return this.usersRepository.save(user);
  }

  private async issueTokens(user: UserEntity): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private sanitizeUser(
    user: UserEntity,
  ): Omit<UserEntity, 'password' | 'twoFactorSecret'> {
    const { password: _password, twoFactorSecret: _secret, ...safe } = user;
    return safe;
  }
}
