import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../../database/entities';
import {
  CreateUserData,
  UserRepositoryPort,
} from '../../application/ports/user.repository.port';
import { User } from '../../domain/user.model';
import { UserMapper } from './user.mapper';

@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.usersRepository.findOne({ where: { email } });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findById(id: string): Promise<User | null> {
    const entity = await this.usersRepository.findOne({ where: { id } });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const entity = this.usersRepository.create(UserMapper.toCreateEntity(data));
    const saved = await this.usersRepository.save(entity);
    return UserMapper.toDomain(saved);
  }

  async save(user: User): Promise<User> {
    const saved = await this.usersRepository.save(
      UserMapper.toPersistence(user) as UserEntity,
    );
    return UserMapper.toDomain(saved);
  }
}
