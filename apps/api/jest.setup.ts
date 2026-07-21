import 'reflect-metadata';

jest.mock('isomorphic-dompurify', () => ({
  sanitize: (dirty: string) =>
    dirty.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ''),
}));
