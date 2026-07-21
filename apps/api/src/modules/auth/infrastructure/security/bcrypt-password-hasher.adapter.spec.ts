import * as bcrypt from 'bcrypt';
import { BcryptPasswordHasherAdapter } from './bcrypt-password-hasher.adapter';

jest.mock('bcrypt');

describe('BcryptPasswordHasherAdapter', () => {
  const adapter = new BcryptPasswordHasherAdapter();

  it('hashes with cost factor 12', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    await expect(adapter.hash('plain')).resolves.toBe('hashed');
    expect(bcrypt.hash).toHaveBeenCalledWith('plain', 12);
  });

  it('compares password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    await expect(adapter.compare('plain', 'hashed')).resolves.toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
  });
});
