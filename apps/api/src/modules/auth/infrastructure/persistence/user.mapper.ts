import { UserEntity } from '../../../../database/entities';
import { User } from '../../domain/user.model';
import { CreateUserData } from '../../application/ports/user.repository.port';

export class UserMapper {
  static toDomain(entity: UserEntity): User {
    return {
      id: entity.id,
      email: entity.email,
      password: entity.password,
      role: entity.role,
      twoFactorSecret: entity.twoFactorSecret,
      twoFactorEnabled: entity.twoFactorEnabled,
      posts: entity.posts ?? [],
      comments: entity.comments ?? [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toCreateEntity(data: CreateUserData): Partial<UserEntity> {
    return {
      email: data.email,
      password: data.password,
      role: data.role,
      twoFactorSecret: data.twoFactorSecret,
      twoFactorEnabled: data.twoFactorEnabled,
    };
  }

  static toPersistence(user: User): Partial<UserEntity> {
    return {
      id: user.id,
      email: user.email,
      password: user.password,
      role: user.role,
      twoFactorSecret: user.twoFactorSecret,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
