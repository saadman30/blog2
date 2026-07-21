import { Repository } from 'typeorm';
import { PostEntity, PostStatus } from '../../../../database/entities';
import { TypeOrmPublishedPostAdapter } from './typeorm-published-post.adapter';

describe('TypeOrmPublishedPostAdapter', () => {
  let adapter: TypeOrmPublishedPostAdapter;
  let postsRepository: { findOne: jest.Mock };

  beforeEach(() => {
    postsRepository = { findOne: jest.fn() };
    adapter = new TypeOrmPublishedPostAdapter(
      postsRepository as unknown as Repository<PostEntity>,
    );
  });

  it('returns true when published post exists', async () => {
    postsRepository.findOne.mockResolvedValue({
      id: 'p1',
      status: PostStatus.PUBLISHED,
    });
    await expect(adapter.existsPublished('p1')).resolves.toBe(true);
    expect(postsRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'p1', status: PostStatus.PUBLISHED },
    });
  });

  it('returns false when published post missing', async () => {
    postsRepository.findOne.mockResolvedValue(null);
    await expect(adapter.existsPublished('x')).resolves.toBe(false);
  });
});
