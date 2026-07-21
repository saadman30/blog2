import { UserRole } from '../../../../domain';
import { User } from '../../domain/user.model';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface CreateUserData {
  email: string;
  password: string;
  role: UserRole;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
}

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  save(user: User): Promise<User>;
}
