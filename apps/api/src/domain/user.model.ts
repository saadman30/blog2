import { UserRole } from './user-role.enum';

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  twoFactorSecret: string | null;
  twoFactorEnabled: boolean;
  posts: unknown[];
  comments: unknown[];
  createdAt: Date;
  updatedAt: Date;
}
