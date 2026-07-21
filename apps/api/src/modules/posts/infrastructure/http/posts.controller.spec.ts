import { UserEntity, UserRole } from '../../../../database/entities';
import { PostStatus } from '../../../../domain';
import { Post } from '../../domain/post.model';
import { PostsService } from '../../application/posts.service';
import { PostsController } from './posts.controller';

describe('PostsController', () => {
  let controller: PostsController;
  let postsService: jest.Mocked<
    Pick<
      PostsService,
      | 'create'
      | 'findAllAdmin'
      | 'findPublished'
      | 'findBySlug'
      | 'findById'
      | 'renderHtml'
      | 'update'
      | 'remove'
    >
  >;

  const user = { id: 'u1', role: UserRole.EDITOR } as UserEntity;
  const post = {
    id: 'p1',
    slug: 'hello',
    content: 'md',
    status: PostStatus.PUBLISHED,
  } as Post;

  beforeEach(() => {
    postsService = {
      create: jest.fn(),
      findAllAdmin: jest.fn(),
      findPublished: jest.fn(),
      findBySlug: jest.fn(),
      findById: jest.fn(),
      renderHtml: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new PostsController(postsService as unknown as PostsService);
  });

  it('delegates CRUD operations', async () => {
    postsService.create.mockResolvedValue(post);
    await expect(
      controller.create(user, { title: 't', content: 'c' }),
    ).resolves.toEqual(post);

    postsService.findAllAdmin.mockResolvedValue([post]);
    await expect(controller.listAdmin()).resolves.toEqual([post]);

    postsService.findPublished.mockResolvedValue([post]);
    await expect(controller.listPublished('tag')).resolves.toEqual([post]);

    postsService.findById.mockResolvedValue(post);
    await expect(controller.getById('p1')).resolves.toEqual(post);

    postsService.update.mockResolvedValue(post);
    await expect(controller.update('p1', { title: 'n' })).resolves.toEqual(
      post,
    );

    postsService.remove.mockResolvedValue(undefined);
    await expect(controller.remove('p1')).resolves.toEqual({ deleted: true });
  });

  it('returns html for public slug', async () => {
    postsService.findBySlug.mockResolvedValue(post);
    postsService.renderHtml.mockResolvedValue('<p>md</p>');
    await expect(controller.getBySlug('hello')).resolves.toEqual({
      ...post,
      html: '<p>md</p>',
    });
  });
});
